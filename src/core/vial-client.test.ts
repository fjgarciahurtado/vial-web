// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { FakeTransport } from './fake-transport'
import { VialClient } from './vial-client'

const identity = async (bytes: Uint8Array) => bytes

describe('VialClient', () => {
  it('pads every request to 32 bytes', async () => {
    const t = new FakeTransport(() => [0x01, 0x00, 0x09])
    await new VialClient(t).getViaProtocol()
    expect(t.sent[0]).toHaveLength(32)
  })

  it('reads the VIA protocol version as big-endian', async () => {
    const t = new FakeTransport(() => [0x01, 0x00, 0x09])
    expect(await new VialClient(t).getViaProtocol()).toBe(9)
  })

  it('reads the Vial protocol and keyboard id as little-endian', async () => {
    const t = new FakeTransport(() => [6, 0, 0, 0, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11])
    const id = await new VialClient(t).getKeyboardId()
    expect(id).toEqual({ vialProtocol: 6, keyboardId: 0x1122334455667788n })
  })

  it('reads the layer count', async () => {
    const t = new FakeTransport(() => [0x11, 4])
    expect(await new VialClient(t).getLayerCount()).toBe(4)
  })

  it('downloads the definition in 32-byte blocks and trims the last one', async () => {
    const json = JSON.stringify({ name: 'x'.repeat(50) }) // 61 bytes: 2 blocks
    const payload = new TextEncoder().encode(json)
    const t = new FakeTransport((req) => {
      if (req[0] === 0xfe && req[1] === 0x01) return [payload.length, 0, 0, 0]
      if (req[0] === 0xfe && req[1] === 0x02) {
        const block = req[2] | (req[3] << 8)
        return [...payload.slice(block * 32, block * 32 + 32), 0xff, 0xff]
      }
      return []
    })
    const def = await new VialClient(t, identity).getDefinition()
    expect(def).toEqual({ name: 'x'.repeat(50) })
    expect(t.sent.filter((r) => r[1] === 0x02)).toHaveLength(2)
  })

  it('fetches the keymap buffer in 28-byte chunks and decodes big-endian keycodes', async () => {
    // 1 layer, 2 rows, 8 cols = 32 bytes = 2 chunks (28 + 4)
    const buffer = Array.from({ length: 32 }, (_, i) => i)
    const t = new FakeTransport((req) => {
      const offset = (req[1] << 8) | req[2]
      const size = req[3]
      return [0x12, req[1], req[2], size, ...buffer.slice(offset, offset + size)]
    })
    const keymap = await new VialClient(t).getKeymap(1, 2, 8)
    expect(t.sent).toHaveLength(2)
    expect(t.sent[1][3]).toBe(4)
    expect(keymap[0][0][0]).toBe(0x0001)
    expect(keymap[0][1][7]).toBe(0x1e1f)
  })

  it('reads the macro count', async () => {
    const t = new FakeTransport((req) => (req[0] === 0x0c ? [0x0c, 16] : []))
    expect(await new VialClient(t).getMacroCount()).toBe(16)
  })

  it('reads dynamic entry counts and feature bits (protocol/dynamic.py)', async () => {
    const reply = new Array(32).fill(0)
    reply.splice(0, 4, 8, 16, 4, 2)
    reply[31] = 0b11
    const t = new FakeTransport((req) => (req[0] === 0xfe && req[1] === 0x0d && req[2] === 0x00 ? reply : []))
    expect(await new VialClient(t).getDynamicEntryCounts()).toEqual({
      tapDance: 8,
      combo: 16,
      keyOverride: 4,
      altRepeatKey: 2,
      features: ['caps_word', 'layer_lock'],
    })
  })

  it('writes one keycode with layer, row, col and a big-endian code (CMD_VIA_SET_KEYCODE)', async () => {
    const t = new FakeTransport((req) => [...req])
    await new VialClient(t).setKeycode(1, 2, 3, 0x5221)
    expect([...t.sent[0].slice(0, 6)]).toEqual([0x05, 1, 2, 3, 0x52, 0x21])
  })

  it('reads and writes layout options as a big-endian 32-bit value (VIA_LAYOUT_OPTIONS)', async () => {
    const t = new FakeTransport((req) => (req[0] === 0x02 ? [0x02, 0x02, 0x00, 0x00, 0x01, 0x02] : [...req]))
    const client = new VialClient(t)
    expect(await client.getLayoutOptions()).toBe(0x0102)
    await client.setLayoutOptions(0x01020304)
    expect([...t.sent[1].slice(0, 6)]).toEqual([0x03, 0x02, 0x01, 0x02, 0x03, 0x04])
  })

  it('reads both directions of an encoder (CMD_VIAL_GET_ENCODER)', async () => {
    const t = new FakeTransport(() => [0x00, 0x81, 0x00, 0x80])
    expect(await new VialClient(t).getEncoder(1, 0)).toEqual([0x81, 0x80])
    expect([...t.sent[0].slice(0, 4)]).toEqual([0xfe, 0x03, 1, 0])
  })

  it('writes one encoder direction (CMD_VIAL_SET_ENCODER)', async () => {
    const t = new FakeTransport((req) => [...req])
    await new VialClient(t).setEncoder(1, 2, 1, 0x00e9)
    expect([...t.sent[0].slice(0, 7)]).toEqual([0xfe, 0x04, 1, 2, 1, 0x00, 0xe9])
  })

  it('reads the macro buffer in 28-byte chunks and stops once every macro has ended', async () => {
    const buffer = [...'ab', 0, ...'c', 0, ...'zzzz'.repeat(20)].map((c) => (typeof c === 'string' ? c.charCodeAt(0) : c))
    const t = new FakeTransport((req) => {
      if (req[0] === 0x0d) return [0x0d, 0, 90]
      const offset = (req[1] << 8) | req[2]
      return [...req.slice(0, 4), ...buffer.slice(offset, offset + req[3])]
    })
    const client = new VialClient(t)
    expect(await client.getMacroBufferSize()).toBe(90)
    const data = await client.getMacroBuffer(90, 2)
    expect([...data]).toEqual([97, 98, 0, 99, 0])
    expect(t.sent.filter((r) => r[0] === 0x0e)).toHaveLength(1)
  })

  it('handles a macro that ends exactly at the end of a chunk, and empty memory', async () => {
    const buffer = [...Array(27).fill(0x61), 0, 0x62, 0]
    const t = new FakeTransport((req) => {
      const offset = (req[1] << 8) | req[2]
      return [...req.slice(0, 4), ...buffer.slice(offset, offset + req[3])]
    })
    const one = await new VialClient(t).getMacroBuffer(30, 1)
    expect(one).toHaveLength(28)
    expect(t.sent).toHaveLength(1)
    const two = await new VialClient(t).getMacroBuffer(30, 2)
    expect(two).toHaveLength(30)

    const empty = new FakeTransport((req) => [...req.slice(0, 4)])
    expect([...(await new VialClient(empty).getMacroBuffer(4, 3))]).toEqual([0, 0, 0])
  })

  it('writes the macro buffer in chunks (CMD_VIA_MACRO_SET_BUFFER)', async () => {
    const t = new FakeTransport((req) => [...req])
    await new VialClient(t).setMacroBuffer(Uint8Array.from({ length: 30 }, (_, i) => i + 1))
    expect([...t.sent[0].slice(0, 5)]).toEqual([0x0f, 0, 0, 28, 1])
    expect([...t.sent[1].slice(0, 6)]).toEqual([0x0f, 0, 28, 2, 29, 30])
  })
})

