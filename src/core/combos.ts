// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Combos: press several keys together to get another key. Ported from
 * protocol/combo.py and editor/combos.py in vial-gui.
 */
import type { KeycodeCatalog } from './keycodes/catalog'
import { DYNAMIC_VIAL_COMBO_GET, DYNAMIC_VIAL_COMBO_SET, type VialClient } from './vial-client'

/** Up to four keys pressed together give `output`. 0 (KC_NO) marks an unused key. */
export interface Combo {
  keys: number[]
  output: number
}

export const EMPTY_COMBO: Combo = { keys: [0, 0, 0, 0], output: 0 }
const KEYS = 4

/** Four trigger keys, then the result: five little-endian 16-bit keycodes ("<HHHHH"). */
export function encodeCombo(combo: Combo): number[] {
  return [...combo.keys, combo.output].flatMap((code) => [code & 0xff, (code >> 8) & 0xff])
}

export function decodeCombo(bytes: ArrayLike<number>): Combo {
  const codes = Array.from({ length: KEYS + 1 }, (_, i) => bytes[i * 2] | (bytes[i * 2 + 1] << 8))
  return { keys: codes.slice(0, KEYS), output: codes[KEYS] }
}

export async function readCombos(client: VialClient, count: number): Promise<Combo[]> {
  const combos: Combo[] = []
  for (let i = 0; i < count; i++) {
    try {
      combos.push(decodeCombo(await client.getDynamicEntry(DYNAMIC_VIAL_COMBO_GET, i)))
    } catch {
      throw new Error(`The keyboard couldn't read combo ${i + 1}.`)
    }
  }
  return combos
}

export async function writeCombo(client: VialClient, index: number, combo: Combo): Promise<void> {
  await client.setDynamicEntry(DYNAMIC_VIAL_COMBO_SET, index, encodeCombo(combo))
}

/** The .vil form: five key names (save_combo). */
export function saveCombo(combo: Combo, catalog: KeycodeCatalog): (string | number)[] {
  return [...combo.keys, combo.output].map((code) => catalog.serialize(code))
}

/** Reads a combo saved by vial-gui or vial-web. Keys it can't read are left empty and counted. */
export function loadSavedCombo(saved: unknown, catalog: KeycodeCatalog, onUnknown: () => void): Combo {
  if (!Array.isArray(saved)) return { ...EMPTY_COMBO, keys: [...EMPTY_COMBO.keys] }
  const codes = Array.from({ length: KEYS + 1 }, (_, i) => {
    const value: unknown = saved[i]
    if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 0xffff ? value : 0
    if (typeof value !== 'string') return 0
    const code = catalog.deserialize(value)
    if (code === undefined) onUnknown()
    return code ?? 0
  })
  return { keys: codes.slice(0, KEYS), output: codes[KEYS] }
}

export function isEmptyCombo(combo: Combo): boolean {
  return combo.output === 0 && combo.keys.every((k) => k === 0)
}

/** "A + S → Escape" */
export function describeCombo(combo: Combo, catalog: KeycodeCatalog): string {
  if (isEmptyCombo(combo)) return 'Not set up'
  const keys = combo.keys.filter((k) => k !== 0).map((k) => catalog.describe(k).name)
  const output = combo.output ? catalog.describe(combo.output).name : 'nothing yet'
  return `${keys.join(' + ') || 'no keys yet'} → ${output}`
}

/** Why a half-made combo won't do anything yet, or null when it is ready (or empty). */
export function comboProblem(combo: Combo): string | null {
  if (isEmptyCombo(combo)) return null
  const keys = combo.keys.filter((k) => k !== 0)
  if (keys.length < 2) return 'A combo needs at least two keys pressed together.'
  if (new Set(keys).size < keys.length) return 'The same key is in this combo twice. Choose different keys.'
  if (combo.output === 0) return 'Choose what the combo does.'
  return null
}
