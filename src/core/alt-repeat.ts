// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Alt repeat keys: the Alt Repeat key sends the "opposite" of the last key pressed,
 * such as Down after Up. Each entry pairs a key with its opposite. Ported from
 * protocol/alt_repeat_key.py and editor/alt_repeat_key.py in vial-gui; matching
 * follows get_alt_repeat_key_keycode_user() in upstream vial-qmk quantum/vial.c.
 */
import { MODS } from './key-overrides'
import type { KeycodeCatalog } from './keycodes/catalog'
import { DYNAMIC_VIAL_ALT_REPEAT_KEY_GET, DYNAMIC_VIAL_ALT_REPEAT_KEY_SET, type VialClient } from './vial-client'

export { MODS }

export interface AltRepeat {
  /** The last key pressed. */
  keycode: number
  /** What Alt Repeat sends after it. */
  altKeycode: number
  /** Modifiers that may be held when the last key was pressed (MOD_BIT layout). */
  allowedMods: number
  options: number
}

export const AREP_OPTION = {
  /** Use this pair's alt key when no other pair matches. */
  defaultToThis: 1 << 0,
  /** Also works the other way round: after the alt key, send the key. */
  bidirectional: 1 << 1,
  /** Left and right modifiers count the same. */
  ignoreModHandedness: 1 << 2,
  enabled: 1 << 3,
} as const

export const EMPTY_ALT_REPEAT: AltRepeat = { keycode: 0, altKeycode: 0, allowedMods: 0, options: 0 }
export const NEW_ALT_REPEAT: AltRepeat = { ...EMPTY_ALT_REPEAT, options: AREP_OPTION.enabled }

/** keycode and alt keycode (16-bit), allowed mods, options: "<HHBB". */
export function encodeAltRepeat(a: AltRepeat): number[] {
  return [a.keycode & 0xff, (a.keycode >> 8) & 0xff, a.altKeycode & 0xff, (a.altKeycode >> 8) & 0xff, a.allowedMods & 0xff, a.options & 0xff]
}

export function decodeAltRepeat(b: ArrayLike<number>): AltRepeat {
  return { keycode: b[0] | (b[1] << 8), altKeycode: b[2] | (b[3] << 8), allowedMods: b[4], options: b[5] }
}

export async function readAltRepeats(client: VialClient, count: number): Promise<AltRepeat[]> {
  const entries: AltRepeat[] = []
  for (let i = 0; i < count; i++) {
    try {
      entries.push(decodeAltRepeat(await client.getDynamicEntry(DYNAMIC_VIAL_ALT_REPEAT_KEY_GET, i)))
    } catch {
      throw new Error(`The keyboard couldn't read alt repeat key ${i + 1}.`)
    }
  }
  return entries
}

export async function writeAltRepeat(client: VialClient, index: number, entry: AltRepeat): Promise<void> {
  await client.setDynamicEntry(DYNAMIC_VIAL_ALT_REPEAT_KEY_SET, index, encodeAltRepeat(entry))
}

/** The .vil form (AltRepeatKeyEntry.save in vial-gui). */
export function saveAltRepeat(a: AltRepeat, catalog: KeycodeCatalog) {
  return {
    keycode: catalog.serialize(a.keycode),
    alt_keycode: catalog.serialize(a.altKeycode),
    allowed_mods: a.allowedMods,
    options: a.options,
  }
}

/**
 * Reads an entry saved by vial-gui or vial-web. Returns null, after counting each key it
 * can't read, when any part is unreadable or out of range, so the keyboard's own is kept.
 */
export function loadSavedAltRepeat(saved: unknown, catalog: KeycodeCatalog, onUnknown: () => void): AltRepeat | null {
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) {
    onUnknown()
    return null
  }
  const data = saved as Record<string, unknown>
  const key = (value: unknown): number | undefined => {
    const code =
      typeof value === 'number'
        ? Number.isInteger(value) && value >= 0 && value <= 0xffff
          ? value
          : undefined
        : typeof value === 'string'
          ? catalog.deserialize(value)
          : undefined
    if (code === undefined) onUnknown()
    return code
  }
  const byte = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xff ? value : undefined)
  const keycode = key(data.keycode)
  const altKeycode = key(data.alt_keycode)
  const allowedMods = byte(data.allowed_mods)
  const options = byte(data.options)
  if (keycode === undefined || altKeycode === undefined || allowedMods === undefined || options === undefined) return null
  return { keycode, altKeycode, allowedMods, options }
}

export function isEmptyAltRepeat(a: AltRepeat): boolean {
  return a.keycode === 0 && a.altKeycode === 0
}

/** "Up → Down", "Up ↔ Down" when it works both ways. */
export function describeAltRepeat(a: AltRepeat, catalog: KeycodeCatalog): string {
  if (isEmptyAltRepeat(a)) return 'Not set up'
  const name = (code: number) => (code ? catalog.describe(code).name : 'nothing yet')
  const arrow = a.options & AREP_OPTION.bidirectional ? '↔' : '→'
  const text = `${name(a.keycode)} ${arrow} ${name(a.altKeycode)}`
  return a.options & AREP_OPTION.enabled ? text : `Off: ${text}`
}

/** Why an entry won't do anything yet, or null when it is ready (or empty). */
export function altRepeatProblem(a: AltRepeat): string | null {
  if (isEmptyAltRepeat(a)) return null
  if (!(a.options & AREP_OPTION.enabled)) return 'This pair is turned off.'
  if (a.altKeycode === 0) return 'Choose what Alt Repeat sends.'
  if (a.keycode === 0 && !(a.options & AREP_OPTION.defaultToThis)) return 'Choose the last key it answers to.'
  return null
}
