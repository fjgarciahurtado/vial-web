// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import v6Data from './data/keycodes-v6.json'
import { KeycodeCatalog, type KeycodeData } from './catalog'
import { pickerCategories } from './categories'

const catalog = new KeycodeCatalog(v6Data as KeycodeData, {
  layers: 2,
  macroCount: 0,
  tapDanceCount: 0,
  features: new Set(),
})
const categories = pickerCategories(catalog)
const ids = (title: string) => categories.find((c) => c.title === title)?.entries.map((e) => e.id) ?? []

describe('pickerCategories', () => {
  it('starts with everyday keys, including Nothing and Same as below', () => {
    expect(categories[0].title).toBe('Letters & numbers')
    expect(ids('Letters & numbers')).toEqual(expect.arrayContaining(['KC_NO', 'KC_TRNS', 'KC_A', 'KC_1', 'KC_F1']))
  })

  it('groups modifier keys together, out of the letters', () => {
    expect(ids('Modifiers')).toEqual(expect.arrayContaining(['KC_LSHIFT', 'KC_RGUI', 'OSM(MOD_LSFT)']))
    expect(ids('Letters & numbers')).not.toContain('KC_LSHIFT')
  })

  it('leaves out combined keys until the key builders exist', () => {
    const all = categories.flatMap((c) => c.entries)
    expect(all.some((e) => e.masked)).toBe(false)
  })

  it('drops categories this keyboard has nothing for', () => {
    expect(categories.map((c) => c.title)).not.toContain('Tap dance')
    expect(categories.map((c) => c.title)).not.toContain('MIDI')
  })

  it('puts every available non-combined key in exactly one category', () => {
    const shown = categories.flatMap((c) => c.entries.map((e) => e.id))
    const expected = catalog.available().filter((e) => !e.masked).map((e) => e.id)
    expect(shown.sort()).toEqual(expected.sort())
  })
})
