// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Modes: how much of the app people see. Easy keeps to everyday keys, layers, macros,
 * lighting and the key tester; Advanced shows everything; Musician is for MIDI keyboards and puts
 * notes, chords and layers first.
 */
import type { KeycodeCatalog } from './keycodes/catalog'
import { pickerCategories, type PickerCategory } from './keycodes/categories'

export type Profile = 'easy' | 'advanced' | 'musician'

/** The main areas of the app once a keyboard is open. */
export type Section = 'keys' | 'lighting' | 'tester' | 'macros' | 'advanced'

export const PROFILE_TITLES: Record<Profile, string> = {
  easy: 'Easy',
  advanced: 'Advanced',
  musician: 'Musician',
}

/** The sections each mode shows, in order. Sections the keyboard doesn't have are left out later. */
export const PROFILE_SECTIONS: Record<Profile, Section[]> = {
  easy: ['keys', 'lighting', 'macros', 'tester'],
  advanced: ['keys', 'lighting', 'macros', 'tester', 'advanced'],
  musician: ['keys', 'lighting', 'macros'],
}

/** Picker tabs each mode offers, in order, or null for all of them. */
const PROFILE_TABS: Record<Profile, string[] | null> = {
  easy: [
    'Letters & numbers',
    'Modifiers',
    'Symbols',
    'Navigation',
    'Numpad',
    'Media & mouse',
    'Layers',
    'Lighting',
    'Macros',
    'International',
  ],
  advanced: null,
  musician: ['MIDI', 'Layers', 'Macros', 'Lighting', 'Blank'],
}

/** Musician mode has no typing keys, so it gets Nothing and Same as below on their own. */
const BLANK_KEYS = ['KC_NO', 'KC_TRNS']

const hasMidi = (catalog: KeycodeCatalog) => catalog.available().some((e) => e.group === 'midi')

/** The modes that suit this keyboard: Musician only when it plays MIDI. */
export function profilesFor(catalog: KeycodeCatalog): Profile[] {
  return hasMidi(catalog) ? ['easy', 'advanced', 'musician'] : ['easy', 'advanced']
}

export function defaultProfile(catalog: KeycodeCatalog): Profile {
  return hasMidi(catalog) ? 'musician' : 'easy'
}

/** A remembered mode if it still suits the keyboard, otherwise the default. */
export function usableProfile(catalog: KeycodeCatalog, remembered: string | null): Profile {
  return profilesFor(catalog).find((p) => p === remembered) ?? defaultProfile(catalog)
}

/** Whether the key picker offers the builder for combined keys, such as Ctrl+C or hold for a layer. */
export function profileHasBuilder(profile: Profile): boolean {
  return profile !== 'musician'
}

/** The picker tabs a mode offers on this keyboard. */
export function profileCategories(catalog: KeycodeCatalog, profile: Profile): PickerCategory[] {
  const all = pickerCategories(catalog)
  const tabs = PROFILE_TABS[profile]
  if (!tabs) return all
  const blank = {
    title: 'Blank',
    entries: BLANK_KEYS.map((id) => catalog.available().find((e) => e.id === id)).filter((e) => e !== undefined),
  }
  return tabs
    .map((title) => (title === 'Blank' ? blank : all.find((c) => c.title === title)))
    .filter((c): c is PickerCategory => !!c && c.entries.length > 0)
}
