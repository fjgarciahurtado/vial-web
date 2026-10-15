// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { FakeKeyboard } from './fake-keyboard'
import { loadKeyboard } from './keyboard'

const definition = {
  name: 'Test Pad',
  matrix: { rows: 1, cols: 2 },
  layouts: { keymap: [['0,0', '0,1']] },
}
// Vial label slots: "e" in the 10th marks an encoder, the 4th holds "layout,option"
const enc = (label: string) => `${label}\n\n\n\n\n\n\n\n\ne`
const opt = (label: string, option: string) => `${label}\n\n\n${option}`
const identity = async (bytes: Uint8Array) => bytes

describe('loadKeyboard', () => {
  it('reads layout, keymap and a keycode catalogue sized to the keyboard', async () => {
    const fake = new FakeKeyboard({ definition, layers: 2, macroCount: 3, tapDanceCount: 1 })
    fake.keymap.set([0x00, 0x04], 0) // layer 0, key 0,0 = KC_A

    const kb = await loadKeyboard(fake.transport, 'fallback', { decompress: identity })

    expect(kb.name).toBe('Test Pad')
    expect(kb.keys).toHaveLength(2)
    expect(kb.keymap[0][0][0]).toBe(0x04)
    expect(kb.catalog.describe(0x04).name).toBe('A')
    const ids = new Set(kb.catalog.available().map((k) => k.id))
    expect(ids.has('MO(1)')).toBe(true)
    expect(ids.has('MO(2)')).toBe(false)
    expect(ids.has('M2')).toBe(true)
    expect(ids.has('TD(0)')).toBe(true)
  })

  it('turns on features the way vial-gui does', async () => {
    const fake = new FakeKeyboard({ definition, layers: 1, featureFlags: 0b01, altRepeatKeyCount: 1 })
    const kb = await loadKeyboard(fake.transport, 'fallback', { decompress: identity })
    expect([...kb.capabilities.features].sort()).toEqual(['caps_word', 'persistent_default_layer', 'repeat_key'])
  })

  it('skips dynamic entries on keyboards older than Vial protocol 4', async () => {
    const fake = new FakeKeyboard({ definition, layers: 1, vialProtocol: 3, tapDanceCount: 5, featureFlags: 0b11 })
    const kb = await loadKeyboard(fake.transport, 'fallback', { decompress: identity })
    expect(kb.capabilities.tapDanceCount).toBe(0)
    expect(kb.capabilities.features.size).toBe(0)
    expect(fake.transport.sent.some((r) => r[0] === 0xfe && r[1] === 0x0d)).toBe(false)
  })

  it('reads layout options and encoder keys', async () => {
    const fake = new FakeKeyboard({
      definition: {
        matrix: { rows: 1, cols: 2 },
        layouts: {
          labels: ['Split Backspace'],
          keymap: [['0,0', opt('0,1', '0,0'), opt('0,1', '0,1'), enc('0,0'), enc('0,1')]],
        },
      },
      layers: 2,
      encoders: 1,
      layoutOptions: 1,
    })
    fake.encoders[1][0] = [0x81, 0x80]

    const kb = await loadKeyboard(fake.transport, 'fallback', { decompress: identity })
    expect(kb.layoutOptions).toEqual([{ title: 'Split Backspace', choices: null, bits: 1 }])
    expect(kb.layoutChoices).toEqual([1])
    expect(kb.encoderKeymap[1][0]).toEqual([0x81, 0x80])
  })

  it('skips layout options and encoders the keyboard does not have', async () => {
    const fake = new FakeKeyboard({ definition, layers: 1 })
    const kb = await loadKeyboard(fake.transport, 'fallback', { decompress: identity })
    expect(kb.layoutChoices).toEqual([])
    expect(kb.encoderKeymap).toEqual([[]])
    expect(fake.transport.sent.some((r) => r[0] === 0x02 || (r[0] === 0xfe && r[1] === 0x03))).toBe(false)
  })

  it('reads macros from macro memory', async () => {
    const fake = new FakeKeyboard({ definition, layers: 1, macroCount: 2, macroMemory: 64 })
    fake.macroBuffer.set([0x68, 0x69, 0, 1, 1, 4, 0])
    const kb = await loadKeyboard(fake.transport, 'fallback', { decompress: identity })
    expect(kb.macroMemory).toBe(64)
    expect(kb.macros).toEqual([[{ type: 'text', text: 'hi' }], [{ type: 'tap', keys: [0x04] }]])
  })
})

