// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Combined keys: one keycode that carries a second, basic key in its low byte.
 * vial-gui edits these by clicking the inner part of a key (set_key_matrix in
 * editor/keymap_editor.py, which only accepts basic inner keys). vial-web builds
 * them from plain choices instead: which modifiers or layer, and which key.
 */
import type { KeycodeCatalog, KeycodeEntry } from './catalog'

/** QMK modifier bits, as stored in bits 8-12 of combined keycodes. */
export const MOD = { ctrl: 0x01, shift: 0x02, alt: 0x04, gui: 0x08, right: 0x10 } as const

export type CombinedKind = 'shortcut' | 'modtap' | 'layertap'

export type CombinedSettings =
  | { kind: 'shortcut' | 'modtap'; mods: number; inner: number }
  | { kind: 'layertap'; layer: number; inner: number }

/** The kind of a masked outer keycode, from its QMK name. */
function kindOf(entry: KeycodeEntry): CombinedKind | null {
  if (!entry.masked) return null
  if (/^LT\d+\(kc\)$/.test(entry.id)) return 'layertap'
  return entry.id.endsWith('_T(kc)') ? 'modtap' : 'shortcut'
}

const modsOf = (entry: KeycodeEntry) => (entry.code >> 8) & 0x1f

function outers(catalog: KeycodeCatalog, kind: CombinedKind): KeycodeEntry[] {
  return catalog.available().filter((e) => kindOf(e) === kind)
}

/** Modifier combinations QMK has a keycode for, for shortcuts or tap-hold keys. */
export function availableModifierSets(catalog: KeycodeCatalog, kind: 'shortcut' | 'modtap'): number[] {
  return [...new Set(outers(catalog, kind).map(modsOf))]
}

/** Keys that can go inside a combined key: basic keys only, as in vial-gui. */
export function innerKeyChoices(catalog: KeycodeCatalog): KeycodeEntry[] {
  return catalog.available().filter((e) => !e.masked && e.code > 0x01 && e.code < 0xff)
}

/** The keycode for these settings, or undefined when QMK has no such key. */
export function buildCombined(catalog: KeycodeCatalog, settings: CombinedSettings): number | undefined {
  if (settings.inner <= 0x01 || settings.inner >= 0xff) return undefined
  const outer =
    settings.kind === 'layertap'
      ? outers(catalog, 'layertap').find((e) => e.index === settings.layer)
      : outers(catalog, settings.kind).find((e) => modsOf(e) === settings.mods)
  return outer && outer.code | settings.inner
}

/** Builder settings for a combined key, or null when the code isn't one. */
export function parseCombined(catalog: KeycodeCatalog, code: number): CombinedSettings | null {
  const outer = catalog.entry(code & 0xff00)
  const kind = outer && kindOf(outer)
  if (!outer || !kind) return null
  const inner = code & 0xff
  return kind === 'layertap' ? { kind, layer: outer.index!, inner } : { kind, mods: modsOf(outer), inner }
}
