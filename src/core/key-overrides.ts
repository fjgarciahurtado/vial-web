// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Key overrides: send a different key when a key is pressed with certain modifiers,
 * for example Shift + Backspace sends Delete. Ported from protocol/key_override.py
 * and editor/key_override.py in vial-gui. Option meanings follow vial-qmk
 * quantum/process_keycode/process_key_override.h (vial-gui's labels for options 4
 * and 5 are swapped).
 */
import type { KeycodeCatalog } from './keycodes/catalog'
import { DYNAMIC_VIAL_KEY_OVERRIDE_GET, DYNAMIC_VIAL_KEY_OVERRIDE_SET, type VialClient } from './vial-client'

export interface KeyOverride {
  /** Key that, with the trigger modifiers, activates the override. 0 means modifiers alone. */
  trigger: number
  /** Key sent instead. */
  replacement: number
  /** Bit per layer the override works on. */
  layers: number
  /** Modifiers that must be held (MOD_BIT layout: bit 0 Left Ctrl … bit 7 Right GUI). */
  triggerMods: number
  /** Modifiers that must not be held. */
  negativeMods: number
  /** Modifiers let go of while the replacement is sent. */
  suppressedMods: number
  /** Option bits, see OPTION. */
  options: number
}

export const OPTION = {
  /** Activate when the trigger key is pressed down. */
  activateOnTriggerDown: 1 << 0,
  /** Activate when a required modifier is pressed down. */
  activateOnModDown: 1 << 1,
  /** Activate when a forbidden modifier is released. */
  activateOnNegativeModUp: 1 << 2,
  /** Any one trigger modifier is enough, instead of all of them. */
  oneMod: 1 << 3,
  /** Never press the trigger key again after the override ends. */
  noReregisterTrigger: 1 << 4,
  /** Stay active when another key is pressed. */
  noUnregisterOnOtherKey: 1 << 5,
  enabled: 1 << 7,
} as const

/** ko_options_default in QMK: all three ways of activating. */
export const DEFAULT_ACTIVATION = OPTION.activateOnTriggerDown | OPTION.activateOnModDown | OPTION.activateOnNegativeModUp

export const EMPTY_KEY_OVERRIDE: KeyOverride = {
  trigger: 0,
  replacement: 0,
  layers: 0,
  triggerMods: 0,
  negativeMods: 0,
  suppressedMods: 0,
  options: 0,
}

/** What a new override starts as: on, on every layer, activating every way QMK does by default. */
export const NEW_KEY_OVERRIDE: KeyOverride = {
  ...EMPTY_KEY_OVERRIDE,
  layers: 0xffff,
  options: OPTION.enabled | DEFAULT_ACTIVATION,
}

/** Modifier bits, in MOD_BIT order. */
export const MODS: { bit: number; side: 'Left' | 'Right'; name: string }[] = [
  { bit: 0, side: 'Left', name: 'Ctrl' },
  { bit: 1, side: 'Left', name: 'Shift' },
  { bit: 2, side: 'Left', name: 'Alt' },
  { bit: 3, side: 'Left', name: 'GUI' },
  { bit: 4, side: 'Right', name: 'Ctrl' },
  { bit: 5, side: 'Right', name: 'Shift' },
  { bit: 6, side: 'Right', name: 'Alt' },
  { bit: 7, side: 'Right', name: 'GUI' },
]

/** trigger, replacement, layers (16-bit), then four bytes: "<HHHBBBB". */
export function encodeKeyOverride(ko: KeyOverride): number[] {
  const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff]
  return [
    ...u16(ko.trigger),
    ...u16(ko.replacement),
    ...u16(ko.layers),
    ko.triggerMods & 0xff,
    ko.negativeMods & 0xff,
    ko.suppressedMods & 0xff,
    ko.options & 0xff,
  ]
}

export function decodeKeyOverride(b: ArrayLike<number>): KeyOverride {
  const u16 = (i: number) => b[i] | (b[i + 1] << 8)
  return {
    trigger: u16(0),
    replacement: u16(2),
    layers: u16(4),
    triggerMods: b[6],
    negativeMods: b[7],
    suppressedMods: b[8],
    options: b[9],
  }
}

export async function readKeyOverrides(client: VialClient, count: number): Promise<KeyOverride[]> {
  const entries: KeyOverride[] = []
  for (let i = 0; i < count; i++) {
    try {
      entries.push(decodeKeyOverride(await client.getDynamicEntry(DYNAMIC_VIAL_KEY_OVERRIDE_GET, i)))
    } catch {
      throw new Error(`The keyboard couldn't read key override ${i + 1}.`)
    }
  }
  return entries
}

export async function writeKeyOverride(client: VialClient, index: number, ko: KeyOverride): Promise<void> {
  await client.setDynamicEntry(DYNAMIC_VIAL_KEY_OVERRIDE_SET, index, encodeKeyOverride(ko))
}

/** The .vil form (KeyOverrideEntry.save in vial-gui). */
export function saveKeyOverride(ko: KeyOverride, catalog: KeycodeCatalog) {
  return {
    trigger: catalog.serialize(ko.trigger),
    replacement: catalog.serialize(ko.replacement),
    layers: ko.layers,
    trigger_mods: ko.triggerMods,
    negative_mod_mask: ko.negativeMods,
    suppressed_mods: ko.suppressedMods,
    options: ko.options,
  }
}

/**
 * Reads an override saved by vial-gui or vial-web. Returns null, after counting each key
 * it can't read, when any part is unreadable or out of range, so the keyboard's own is kept.
 */
export function loadSavedKeyOverride(saved: unknown, catalog: KeycodeCatalog, onUnknown: () => void): KeyOverride | null {
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
  const bits = (value: unknown, max: number): number | undefined =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : undefined

  const trigger = key(data.trigger)
  const replacement = key(data.replacement)
  const ko = {
    layers: bits(data.layers, 0xffff),
    triggerMods: bits(data.trigger_mods, 0xff),
    negativeMods: bits(data.negative_mod_mask, 0xff),
    suppressedMods: bits(data.suppressed_mods, 0xff),
    options: bits(data.options, 0xff),
  }
  if (trigger === undefined || replacement === undefined || Object.values(ko).some((v) => v === undefined)) return null
  return { trigger, replacement, ...(ko as Omit<KeyOverride, 'trigger' | 'replacement'>) }
}

export function isEmptyKeyOverride(ko: KeyOverride): boolean {
  return ko.trigger === 0 && ko.replacement === 0 && ko.triggerMods === 0
}

/** "Left Ctrl + Left Shift", with both sides of a modifier said once: "Shift". */
export function describeMods(mods: number): string {
  const names: string[] = []
  for (const name of ['Ctrl', 'Shift', 'Alt', 'GUI']) {
    const left = MODS.find((m) => m.side === 'Left' && m.name === name)!
    const right = MODS.find((m) => m.side === 'Right' && m.name === name)!
    const l = mods & (1 << left.bit)
    const r = mods & (1 << right.bit)
    if (l && r) names.push(name)
    else if (l) names.push(`Left ${name}`)
    else if (r) names.push(`Right ${name}`)
  }
  return names.join(' + ')
}

/** "Shift + Backspace → Delete" */
export function describeKeyOverride(ko: KeyOverride, catalog: KeycodeCatalog): string {
  if (isEmptyKeyOverride(ko)) return 'Not set up'
  const mods = describeMods(ko.triggerMods)
  const joiner = ko.options & OPTION.oneMod && ko.triggerMods & (ko.triggerMods - 1) ? ' or ' : ' + '
  const when = [mods.split(' + ').join(joiner), ko.trigger ? catalog.describe(ko.trigger).name : ''].filter(Boolean).join(' + ')
  const text = `${when || 'nothing yet'} → ${ko.replacement ? catalog.describe(ko.replacement).name : 'nothing'}`
  return ko.options & OPTION.enabled ? text : `Off: ${text}`
}

/** Why an override won't do anything yet, or null when it is ready (or empty). */
export function keyOverrideProblem(ko: KeyOverride, layers: number): string | null {
  if (isEmptyKeyOverride(ko)) return null
  if (!(ko.options & OPTION.enabled)) return 'This override is turned off.'
  if (ko.trigger === 0 && ko.triggerMods === 0) return 'Choose the key or modifiers that start it.'
  if ((ko.layers & ((1 << layers) - 1)) === 0) return 'Choose at least one layer for it to work on.'
  if (!(ko.options & DEFAULT_ACTIVATION)) return 'Choose at least one way for it to start, under More options.'
  return null
}
