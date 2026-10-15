// SPDX-License-Identifier: GPL-2.0-or-later
import type { KeycodeCatalog, KeycodeEntry, KeycodeGroup } from './catalog'

export interface PickerCategory {
  title: string
  entries: KeycodeEntry[]
}

/** Left/right Ctrl, Shift, Alt and Win/Cmd live in vial-gui's "basic" table. */
const isModifierKey = (e: KeycodeEntry) => e.group === 'basic' && e.code >= 0xe0 && e.code <= 0xe7

const CATEGORIES: [string, (e: KeycodeEntry) => boolean][] = [
  ['Letters & numbers', (e) => (e.group === 'basic' && !isModifierKey(e)) || e.group === 'special'],
  ['Modifiers', (e) => isModifierKey(e) || e.group === 'modifiers'],
  ['Symbols', inGroups('shifted')],
  ['Navigation', inGroups('navigation')],
  ['Numpad', inGroups('numpad')],
  ['Media & mouse', inGroups('media')],
  ['Layers', inGroups('layers')],
  ['Lighting', inGroups('backlight')],
  ['Macros', inGroups('macro')],
  ['Tap dance', inGroups('tap_dance')],
  ['Custom', inGroups('user')],
  ['International', inGroups('iso')],
  ['Special', inGroups('boot', 'quantum')],
  ['MIDI', inGroups('midi', 'midi_advanced')],
]

/**
 * Groups the keycodes a keyboard can use into picker tabs. Combined keys like
 * LSFT(kc) and LT1(kc) need a second key chosen, so they wait for the key
 * builders planned in Phase 2.
 */
export function pickerCategories(catalog: KeycodeCatalog): PickerCategory[] {
  const pickable = catalog.available().filter((e) => !e.masked)
  return CATEGORIES.map(([title, test]) => ({ title, entries: pickable.filter(test) })).filter(
    (c) => c.entries.length > 0,
  )
}

function inGroups(...groups: KeycodeGroup[]) {
  return (e: KeycodeEntry) => groups.includes(e.group)
}
