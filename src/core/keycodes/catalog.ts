// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Keycode catalogue, ported from vial-gui keycodes/keycodes.py.
 *
 * The tables in ./data are generated from vial-gui by scripts/extract_keycodes.py,
 * so names and numeric values match vial-gui exactly. This module adds the
 * per-keyboard filtering, plain-language names and search.
 */
import { KEYWORDS, NAMES, layerKeyLegend, layerKeyName, maskedKeyLegend, maskedKeyName } from './friendly'
import { midiKeyName, noteName, noteOfKeycode } from '../midi'

export type KeycodeGroup =
  | 'special'
  | 'basic'
  | 'numpad'
  | 'navigation'
  | 'shifted'
  | 'iso'
  | 'layers'
  | 'boot'
  | 'modifiers'
  | 'quantum'
  | 'backlight'
  | 'media'
  | 'tap_dance'
  | 'macro'
  | 'user'
  | 'midi'
  | 'midi_advanced'

export interface KeycodeEntry {
  /** QMK name, e.g. KC_A or LSFT(kc). Masked keycodes end in "(kc)". */
  id: string
  code: number
  /** vial-gui keycap legend; lines separated by "\n". */
  label: string
  group: KeycodeGroup
  tooltip?: string
  /** Takes a second, inner keycode in its low byte, e.g. LSFT(kc). */
  masked?: boolean
  alias?: string[]
  /** Firmware feature the keyboard must report, e.g. "caps_word". */
  feature?: string
  printable?: string
  /** Layer, macro, tap dance or user keycode number. */
  index?: number
}

export interface KeycodeData {
  protocol: number
  masked: number[]
  keycodes: KeycodeEntry[]
}

export interface CustomKeycode {
  name?: string
  title?: string
  shortName?: string
}

/** What the connected keyboard supports. Mirrors recreate_keyboard_keycodes() in vial-gui. */
export interface KeyboardCapabilities {
  layers: number
  macroCount: number
  tapDanceCount: number
  features: Set<string>
  /** From vial.json "vial.midi": "basic", "advanced" or absent. */
  midi?: string | null
  /** From vial.json "customKeycodes". */
  customKeycodes?: CustomKeycode[] | null
}

export interface KeyDescription {
  code: number
  /** Serialized form, as saved in .vil files: KC_A, LSFT(KC_A), 0x7e40. */
  id: string
  /** Plain-language name for sentences and the picker. */
  name: string
  /** Keycap legend lines, top to bottom. */
  legend: string[]
  tooltip?: string
  group?: KeycodeGroup
}

const DEFAULT_USER_KEYCODES = 16

export class KeycodeCatalog {
  private readonly entries: KeycodeEntry[]
  private readonly masked: Set<number>
  /** code -> entry, last definition wins (same as vial-gui RAWCODES_MAP). */
  private readonly byCode = new Map<number, KeycodeEntry>()
  /** id or alias -> entry, with "(kc)" stripped from masked ids. */
  private readonly byName = new Map<string, KeycodeEntry>()
  private readonly visible: KeycodeEntry[]

  constructor(data: KeycodeData, caps: KeyboardCapabilities) {
    this.masked = new Set(data.masked)
    this.entries = data.keycodes.map((entry) => withCustomName(entry, caps.customKeycodes))

    for (const entry of this.entries) {
      this.byCode.set(entry.code, entry)
      for (const name of [entry.id, ...(entry.alias ?? [])]) {
        this.byName.set(name.replace('(kc)', ''), entry)
      }
    }
    this.visible = this.entries.filter((entry) => isAvailable(entry, caps))
  }

  /** The table entry for an exact code, if there is one. */
  entry(code: number): KeycodeEntry | undefined {
    return this.byCode.get(code)
  }

  /** Keycodes this keyboard can use, in vial-gui's order. */
  available(): KeycodeEntry[] {
    return this.visible
  }

  /** Integer keycode to its saved name. Same output as vial-gui Keycode.serialize. */
  serialize(code: number): string {
    if (!this.masked.has(code & 0xff00)) {
      const entry = this.byCode.get(code)
      if (entry) return entry.id
    } else {
      const outer = this.byCode.get(code & 0xff00)
      const inner = this.byCode.get(code & 0x00ff)
      if (outer && inner) return outer.id.replaceAll('kc', inner.id)
    }
    return `0x${code.toString(16)}`
  }

  /** Saved name back to an integer keycode, or undefined if it isn't recognised. */
  deserialize(id: string): number | undefined {
    if (/^0x[0-9a-f]+$/i.test(id)) return parseInt(id, 16)
    if (/^\d+$/.test(id)) return Number(id)

    const entry = this.byName.get(id)
    if (entry && !entry.masked) return entry.code

    const combined = /^([A-Z0-9_]+)\((.+)\)$/.exec(id)
    if (combined) {
      const outer = this.byName.get(combined[1])
      const inner = this.deserialize(combined[2])
      if (outer?.masked && inner !== undefined) return outer.code | (inner & 0xff)
    }
    return undefined
  }

  describe(code: number): KeyDescription {
    if (this.masked.has(code & 0xff00)) {
      const outer = this.byCode.get(code & 0xff00)
      const inner = this.byCode.get(code & 0x00ff)
      if (outer && inner) {
        const innerName = nameOf(inner)
        const innerLegend = legendOf(inner)
        return {
          code,
          id: this.serialize(code),
          name: maskedKeyName(outer.id, innerName) ?? `${firstLine(outer.label)} + ${innerName}`,
          legend: maskedKeyLegend(outer.id, outer.code, innerLegend.at(-1) ?? ''),
          tooltip: outer.tooltip?.replaceAll('kc', innerName),
          group: outer.group,
        }
      }
    } else {
      const entry = this.byCode.get(code)
      if (entry) {
        return {
          code,
          id: entry.id,
          name: nameOf(entry),
          legend: legendOf(entry),
          tooltip: entry.tooltip,
          group: entry.group,
        }
      }
    }

    const hex = `0x${code.toString(16)}`
    return { code, id: hex, name: `Unknown key (${hex})`, legend: [hex] }
  }

  /** Available keycodes matching every word of the query, best match first. */
  search(query: string): KeycodeEntry[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const words = q.split(/\s+/)

    return this.visible
      .map((entry, order) => ({ entry, order, score: score(entry, q, words) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .map((r) => r.entry)
  }
}

/** Loads the table for a Vial protocol version. vial-gui uses v6 from protocol 6 on. */
export async function loadKeycodeCatalog(vialProtocol: number, caps: KeyboardCapabilities): Promise<KeycodeCatalog> {
  const data = vialProtocol >= 6 ? await import('./data/keycodes-v6.json') : await import('./data/keycodes-v5.json')
  return new KeycodeCatalog(data.default as KeycodeData, caps)
}

function isAvailable(entry: KeycodeEntry, caps: KeyboardCapabilities): boolean {
  if (entry.feature && !caps.features.has(entry.feature)) return false

  switch (entry.group) {
    case 'layers':
      if (entry.id === 'FN_MO13' || entry.id === 'FN_MO23') return caps.layers >= 4
      if (entry.id.startsWith('LT')) return entry.index! < Math.min(caps.layers, 16)
      return entry.index === undefined || entry.index < caps.layers
    case 'macro':
      return entry.index === undefined || entry.index < caps.macroCount
    case 'tap_dance':
      return entry.index! < caps.tapDanceCount
    case 'user':
      return entry.index! < (caps.customKeycodes?.length || DEFAULT_USER_KEYCODES)
    case 'midi':
      return caps.midi === 'basic' || caps.midi === 'advanced'
    case 'midi_advanced':
      return caps.midi === 'advanced'
    default:
      return true
  }
}

/** Applies the keyboard's own names to USER keycodes (create_custom_user_keycodes in vial-gui). */
function withCustomName(entry: KeycodeEntry, custom?: CustomKeycode[] | null): KeycodeEntry {
  const c = entry.group === 'user' && custom?.[entry.index!]
  if (!c) return entry
  return {
    ...entry,
    label: c.shortName ?? entry.id,
    tooltip: c.title ?? entry.id,
    alias: c.name ? [c.name] : entry.alias,
  }
}

function nameOf(entry: KeycodeEntry): string {
  const named =
    NAMES[entry.id] ??
    layerKeyName(entry.id) ??
    (entry.group === 'midi' || entry.group === 'midi_advanced' ? midiKeyName(entry.id, entry.code) : undefined)
  if (named) return named
  if (entry.group === 'user' && entry.tooltip) return entry.tooltip
  // M0, M1... are counted from 1 for people: "Macro 1".
  if (isMacroSlot(entry)) return `Macro ${entry.index! + 1}`
  if (isTapDanceSlot(entry)) return `Tap dance ${entry.index! + 1}`

  const lines = entry.label.split('\n')
  if (entry.group === 'numpad') return `Numpad ${lines.join(' ')}`
  // Shifted pairs like "!\n1": the unshifted character is the key's name.
  if (lines.length === 2 && lines.every((l) => l.length <= 2)) return lines[1]
  return lines.join(' ').replace('- ', '-').trim()
}

function legendOf(entry: KeycodeEntry): string[] {
  if (isMacroSlot(entry)) return ['Macro', String(entry.index! + 1)]
  if (isTapDanceSlot(entry)) return ['Tap dance', String(entry.index! + 1)]
  // MIDI notes show the note they play at the normal octave, as the MIDI piano does.
  const note = entry.group === 'midi' ? noteOfKeycode(entry.code) : null
  if (note !== null) return ['MIDI', noteName(note)]
  return layerKeyLegend(entry.id) ?? (entry.label ? entry.label.split('\n') : [])
}

function isMacroSlot(entry: KeycodeEntry): boolean {
  return entry.group === 'macro' && entry.index !== undefined
}

function isTapDanceSlot(entry: KeycodeEntry): boolean {
  return entry.group === 'tap_dance' && entry.index !== undefined
}

function firstLine(label: string): string {
  return label.split('\n')[0]
}

function score(entry: KeycodeEntry, q: string, words: string[]): number {
  const ids = [entry.id, ...(entry.alias ?? [])].map((s) => s.toLowerCase())
  if (ids.includes(q)) return 100

  const name = nameOf(entry).toLowerCase()
  if (name === q) return 90
  if (name.startsWith(q)) return 60

  const haystack = [name, ...ids, entry.label, entry.tooltip ?? '', ...(KEYWORDS[entry.id] ?? [])]
    .join(' ')
    .toLowerCase()
  return words.every((w) => haystack.includes(w)) ? 30 : 0
}
