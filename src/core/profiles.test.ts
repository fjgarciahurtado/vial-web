// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import v6Data from './keycodes/data/keycodes-v6.json'
import { KeycodeCatalog, type KeycodeData } from './keycodes/catalog'
import { pickerCategories } from './keycodes/categories'
import { defaultProfile, profileCategories, profilesFor, PROFILE_SECTIONS, usableProfile } from './profiles'

const caps = { layers: 2, macroCount: 2, tapDanceCount: 2, features: new Set<string>() }
const plain = new KeycodeCatalog(v6Data as KeycodeData, caps)
const midi = new KeycodeCatalog(v6Data as KeycodeData, { ...caps, midi: 'advanced' })
const titles = (catalog: KeycodeCatalog, profile: Parameters<typeof profileCategories>[1]) =>
  profileCategories(catalog, profile).map((c) => c.title)

describe('modes', () => {
  it('offers Musician only on keyboards that play MIDI', () => {
    expect(profilesFor(plain)).toEqual(['easy', 'advanced'])
    expect(profilesFor(midi)).toEqual(['easy', 'advanced', 'musician'])
  })

  it('starts MIDI keyboards in Musician and others in Easy', () => {
    expect(defaultProfile(plain)).toBe('easy')
    expect(defaultProfile(midi)).toBe('musician')
  })

  it('falls back to the default when a remembered mode no longer fits the keyboard', () => {
    expect(usableProfile(plain, 'musician')).toBe('easy')
    expect(usableProfile(plain, 'advanced')).toBe('advanced')
    expect(usableProfile(midi, 'nonsense')).toBe('musician')
    expect(usableProfile(midi, null)).toBe('musician')
  })

  it('shows only the sections each mode is for', () => {
    expect(PROFILE_SECTIONS.easy).toEqual(['keys', 'lighting', 'macros', 'tester'])
    expect(PROFILE_SECTIONS.musician).toEqual(['keys', 'lighting', 'macros'])
    expect(PROFILE_SECTIONS.advanced).toEqual(['keys', 'lighting', 'macros', 'tester', 'advanced'])
  })
})

describe('key choices per mode', () => {
  it('Advanced offers every kind of key', () => {
    expect(titles(midi, 'advanced')).toEqual(pickerCategories(midi).map((c) => c.title))
  })

  it('Easy offers everyday keys, layers, macros and lighting', () => {
    const easy = titles(midi, 'easy')
    expect(easy).toEqual(expect.arrayContaining(['Letters & numbers', 'Modifiers', 'Layers', 'Macros']))
    for (const hidden of ['MIDI', 'Tap dance', 'Custom', 'Special']) expect(easy).not.toContain(hidden)
  })

  it('Musician starts with MIDI and offers layers, macros, lighting and blank keys, but no typing keys', () => {
    const musician = profileCategories(midi, 'musician')
    expect(musician.map((c) => c.title)).toEqual(['MIDI', 'Layers', 'Macros', 'Lighting', 'Blank'])
    expect(musician.at(-1)!.entries.map((e) => e.id)).toEqual(['KC_NO', 'KC_TRNS'])
  })
})
