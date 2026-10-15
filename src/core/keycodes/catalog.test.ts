// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import v5Data from './data/keycodes-v5.json'
import v6Data from './data/keycodes-v6.json'
import v5Samples from './__fixtures__/serialize-v5.json'
import v6Samples from './__fixtures__/serialize-v6.json'
import { KeycodeCatalog, type KeyboardCapabilities, type KeycodeData } from './catalog'

// Matches the keyboard extract_keycodes.py used when generating the fixtures.
const everything: KeyboardCapabilities = {
  layers: 32,
  macroCount: 256,
  tapDanceCount: 256,
  features: new Set(['caps_word', 'layer_lock', 'persistent_default_layer', 'repeat_key']),
  midi: 'advanced',
}

const small: KeyboardCapabilities = {
  layers: 4,
  macroCount: 2,
  tapDanceCount: 0,
  features: new Set(),
}

const v6 = (caps = small) => new KeycodeCatalog(v6Data as KeycodeData, caps)

describe('KeycodeCatalog.serialize matches vial-gui', () => {
  for (const [name, data, samples] of [
    ['v5', v5Data, v5Samples],
    ['v6', v6Data, v6Samples],
  ] as const) {
    it(`protocol ${name}`, () => {
      const catalog = new KeycodeCatalog(data as KeycodeData, everything)
      const mismatches = Object.entries(samples as Record<string, string>)
        .filter(([code, expected]) => catalog.serialize(Number(code)) !== expected)
        .slice(0, 5)
      expect(mismatches).toEqual([])
    })
  }
})

describe('KeycodeCatalog.deserialize', () => {
  it('turns names back into codes, including combined keys and hex', () => {
    const catalog = v6()
    expect(catalog.deserialize('KC_A')).toBe(0x04)
    expect(catalog.deserialize('LSFT(KC_A)')).toBe(0x0204)
    expect(catalog.deserialize('LT2(KC_SPACE)')).toBe(0x422c)
    expect(catalog.deserialize('MO(1)')).toBe(0x5221)
    expect(catalog.deserialize('0x7e40')).toBe(0x7e40)
  })

  it('accepts QMK aliases', () => {
    expect(v6().deserialize('KC_BSPC')).toBe(v6().deserialize('KC_BSPACE'))
  })

  it('returns undefined for names it does not know', () => {
    expect(v6().deserialize('NOT_A_KEY')).toBeUndefined()
  })
})

describe('KeycodeCatalog.available', () => {
  const ids = (catalog: KeycodeCatalog) => new Set(catalog.available().map((k) => k.id))

  it('offers layer keys only for layers the keyboard has', () => {
    const available = ids(v6())
    expect(available.has('MO(3)')).toBe(true)
    expect(available.has('MO(4)')).toBe(false)
    expect(available.has('LT3(kc)')).toBe(true)
    expect(available.has('LT4(kc)')).toBe(false)
  })

  it('offers Fn1/Fn2 (Fn3) only with four or more layers', () => {
    expect(ids(v6()).has('FN_MO13')).toBe(true)
    expect(ids(v6({ ...small, layers: 3 })).has('FN_MO13')).toBe(false)
  })

  it('offers only the macros and tap dances the keyboard has', () => {
    const available = ids(v6())
    expect(available.has('M1')).toBe(true)
    expect(available.has('M2')).toBe(false)
    expect(available.has('DYN_MACRO_PLAY1')).toBe(true)
    expect(available.has('TD(0)')).toBe(false)
  })

  it('hides keys that need a firmware feature the keyboard lacks', () => {
    expect(ids(v6()).has('QK_CAPS_WORD_TOGGLE')).toBe(false)
    expect(ids(v6({ ...small, features: new Set(['caps_word']) })).has('QK_CAPS_WORD_TOGGLE')).toBe(true)
  })

  it('hides MIDI keys unless the keyboard enables MIDI', () => {
    expect(v6().available().some((k) => k.group === 'midi')).toBe(false)
    const basic = v6({ ...small, midi: 'basic' }).available()
    expect(basic.some((k) => k.group === 'midi')).toBe(true)
    expect(basic.some((k) => k.group === 'midi_advanced')).toBe(false)
  })

  it('uses the keyboard’s own names for custom keys', () => {
    const catalog = v6({ ...small, customKeycodes: [{ name: 'CK_LOGO', title: 'Show logo', shortName: 'Logo' }] })
    const users = catalog.available().filter((k) => k.group === 'user')
    expect(users).toHaveLength(1)
    expect(catalog.describe(users[0].code)).toMatchObject({ name: 'Show logo', legend: ['Logo'] })
  })
})

describe('KeycodeCatalog.describe', () => {
  it('gives plain names and keycap legends', () => {
    const catalog = v6()
    expect(catalog.describe(0x04)).toMatchObject({ id: 'KC_A', name: 'A', legend: ['A'] })
    expect(catalog.describe(0x2a)).toMatchObject({ name: 'Backspace', legend: ['Bksp'] })
    expect(catalog.describe(0x1e)).toMatchObject({ name: '1', legend: ['!', '1'] })
    expect(catalog.describe(0xe1)).toMatchObject({ name: 'Left Shift' })
    expect(catalog.describe(0x00)).toMatchObject({ name: 'Nothing', legend: [] })
    expect(catalog.describe(0x01)).toMatchObject({ name: 'Same as the layer below' })
  })

  it('describes combined keys in words', () => {
    const catalog = v6()
    expect(catalog.describe(0x0204)).toMatchObject({ name: 'Shift + A', legend: ['Shift +', 'A'] })
    expect(catalog.describe(0x0306).legend).toEqual(['Ctrl+Shift +', 'C'])
    expect(catalog.describe(0x2129).legend).toEqual(['Esc', 'hold Ctrl'])
    expect(catalog.describe(0x3204).legend).toEqual(['A', 'hold RShift'])
    expect(catalog.describe(0x412c).legend).toEqual(['Space', 'hold L1'])
    expect(catalog.describe(0x0f04).legend).toEqual(['Hyper +', 'A'])
    expect(catalog.describe(0x422c).name).toBe('Hold for layer 2, tap for Space')
    expect(catalog.describe(0x5221).name).toBe('Hold for layer 1')
  })

  it('gives layer keys short legends that say what they do', () => {
    const catalog = v6()
    expect(catalog.describe(0x5221).legend).toEqual(['L1', 'hold'])
    expect(catalog.describe(catalog.deserialize('TG(2)')!).legend).toEqual(['L2', 'toggle'])
    expect(catalog.describe(catalog.deserialize('TO(0)')!).legend).toEqual(['L0', 'switch'])
  })

  it('falls back to the hex code for unknown values', () => {
    expect(v6().describe(0xffff)).toMatchObject({ id: '0xffff', name: 'Unknown key (0xffff)', legend: ['0xffff'] })
  })
})

describe('KeycodeCatalog.search', () => {
  const top = (query: string) => v6().search(query)[0]?.id

  it('finds keys by everyday words', () => {
    expect(top('volume up')).toBe('KC_VOLU')
    expect(top('backspace')).toBe('KC_BSPACE')
    expect(top('copy')).toBe('KC_COPY')
    expect(top('play')).toBe('KC_MPLY')
  })

  it('finds keys by their QMK name too', () => {
    expect(top('KC_ESC')).toBe('KC_ESCAPE')
  })

  it('only returns keys this keyboard can use', () => {
    expect(v6().search('MO(9)')).toEqual([])
  })
})
