// SPDX-License-Identifier: GPL-2.0-or-later
// Byte fixtures come from vial-gui test/test_macro.py.
import { describe, expect, it } from 'vitest'
import v5Data from './keycodes/data/keycodes-v5.json'
import { KeycodeCatalog, type KeycodeData } from './keycodes/catalog'
import {
  deserializeMacro,
  describeMacro,
  macroTextProblem,
  deserializeMacros,
  loadSavedMacro,
  macroSize,
  saveMacro,
  serializeMacro,
  serializeMacros,
  type Macro,
} from './macros'

const KC_A = 0x04
const KC_B = 0x05
const KC_C = 0x06
const CMB_TOG = 0x5cf9 // v5 value used by vial-gui's tests
const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0))

const sample: Macro = [
  { type: 'text', text: 'Hello' },
  { type: 'tap', keys: [KC_A, KC_B, KC_C] },
  { type: 'text', text: 'World' },
  { type: 'down', keys: [KC_C, KC_B, KC_A] },
]

describe('macro bytes, protocol 1', () => {
  const v1 = bytes('Hello\x01\x04\x01\x05\x01\x06World\x02\x06\x02\x05\x02\x04')
  it('serializes', () => expect(serializeMacro(sample, 1)).toEqual(v1))
  it('deserializes', () => expect(deserializeMacro(v1, 1)).toEqual(sample))
})

describe('macro bytes, protocol 2 and later', () => {
  const head = 'Hello\x01\x01\x04\x01\x01\x05\x01\x01\x06World\x01\x02\x06\x01\x02\x05\x01\x02\x04'
  for (const [ms, tail] of [
    [1000, '\x01\x04\xEC\x04'],
    [0, '\x01\x04\x01\x01'],
    [1, '\x01\x04\x02\x01'],
    [256, '\x01\x04\x02\x02'],
  ] as const) {
    it(`handles a ${ms} ms delay`, () => {
      const macro: Macro = [...sample, { type: 'delay', ms }]
      expect(serializeMacro(macro, 2)).toEqual(bytes(head + tail))
      expect(deserializeMacro(bytes(head + tail), 2)).toEqual(macro)
    })
  }

  it('uses the two-byte form for keycodes above 255', () => {
    for (const [type, code] of [['tap', '\x05'], ['down', '\x06'], ['up', '\x07']] as const) {
      const data = bytes(`\x01${code}\xF9\x5C\x01${String.fromCharCode(code.charCodeAt(0) - 4)}\x04`)
      const macro: Macro = [{ type, keys: [CMB_TOG, KC_A] }]
      expect(serializeMacro(macro, 2)).toEqual(data)
      expect(deserializeMacro(data, 2)).toEqual(macro)
    }
  })

  it('avoids zero bytes in two-byte keycodes (decode_keycode in QMK)', () => {
    const data = bytes('\x01\x05\xA0\xFF\x01\x05\xB1\xFF\x01\x05\xC2\xFF')
    const macro: Macro = [{ type: 'tap', keys: [0xa000, 0xb100, 0xc200] }]
    expect(serializeMacro(macro, 2)).toEqual(data)
    expect(deserializeMacro(data, 2)).toEqual(macro)
  })

  it('refuses delays on protocol 1, which cannot store them', () => {
    expect(() => serializeMacro([{ type: 'delay', ms: 5 }], 1)).toThrow()
  })
})

describe('the macro buffer', () => {
  it('joins macros with zero bytes and pads to the macro count', () => {
    const buffer = serializeMacros([[{ type: 'text', text: 'a' }], []], 2)
    expect(buffer).toEqual(bytes('a\x00\x00'))
    expect(deserializeMacros(bytes('a\x00'), 3, 2)).toEqual([[{ type: 'text', text: 'a' }], [], []])
  })

  it('measures how much memory macros use', () => {
    expect(macroSize([[{ type: 'text', text: 'abc' }], []], 2)).toBe(5)
  })
})

describe('.vil macro format (save / restore in macro_action.py)', () => {
  const catalog = new KeycodeCatalog(v5Data as KeycodeData, { layers: 1, macroCount: 0, tapDanceCount: 0, features: new Set() })
  const macro: Macro = [
    { type: 'down', keys: [KC_A, KC_B, CMB_TOG] },
    { type: 'text', text: 'Hello world' },
    { type: 'delay', ms: 123 },
  ]
  const saved = [['down', 'KC_A', 'KC_B', 'CMB_TOG'], ['text', 'Hello world'], ['delay', 123]]

  it('saves actions as tagged lists with key names', () => expect(saveMacro(macro, catalog)).toEqual(saved))
  it('restores them', () => expect(loadSavedMacro(saved, catalog)).toEqual(macro))
  it('skips actions it does not know', () => {
    expect(loadSavedMacro([['beep'], ['text', 'x']], catalog)).toEqual([{ type: 'text', text: 'x' }])
  })
})

describe('describeMacro', () => {
  const catalog = new KeycodeCatalog(v5Data as KeycodeData, { layers: 1, macroCount: 0, tapDanceCount: 0, features: new Set() })
  it('summarises a macro in plain words', () => {
    expect(
      describeMacro(
        [
          { type: 'text', text: 'hi' },
          { type: 'tap', keys: [0x28] },
          { type: 'delay', ms: 500 },
          { type: 'down', keys: [0xe0] },
          { type: 'up', keys: [0xe0] },
        ],
        catalog,
      ),
    ).toBe('Types “hi”, presses Enter, waits 0.5 s, holds Left Ctrl, lets go of Left Ctrl')
  })
  it('says when a macro is empty', () => expect(describeMacro([], catalog)).toBe('Does nothing yet'))
})

describe('macroTextProblem', () => {
  it('accepts what QMK can type', () => expect(macroTextProblem('Hello, world!\n')).toBeNull())
  it('explains characters keyboards cannot type', () => expect(macroTextProblem('café')).toMatch(/é/))
})

