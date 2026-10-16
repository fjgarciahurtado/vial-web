// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { FakeKeyboard } from './fake-keyboard'
import {
  changedSettings,
  clampSetting,
  decodeSetting,
  encodeSetting,
  fieldValue,
  QMK_SETTING_GROUPS,
  readQmkSettings,
  settingGroups,
  withFieldValue,
  writeQmkSettings,
  type QmkSettingValues,
} from './qmk-settings'
import { VialClient } from './vial-client'

const definition = { matrix: { rows: 1, cols: 1 }, layouts: { keymap: [['0,0']] } }
const setup = (qmkSettings: Record<number, number>, vialProtocol = 6) => {
  const fake = new FakeKeyboard({ definition, layers: 1, vialProtocol, qmkSettings })
  return { fake, client: new VialClient(fake.transport) }
}
const field = (qsid: number, bit?: number) =>
  QMK_SETTING_GROUPS.flatMap((g) => g.fields).find((f) => f.qsid === qsid && f.bit === bit)!

describe('QMK settings byte format (qsid_serialize in editor/qmk_settings.py)', () => {
  it('writes little-endian values as wide as the setting', () => {
    expect(encodeSetting(7, 200)).toEqual([200, 0]) // Tapping Term, 2 bytes
    expect(encodeSetting(20, 5)).toEqual([5]) // Tapping Toggle, 1 byte
    expect(encodeSetting(21, 0x281)).toEqual([0x81, 0x02, 0, 0]) // key swaps, 4 bytes
    expect(encodeSetting(1, 0b1010)).toEqual([0b1010]) // booleans default to 1 byte
  })

  it('reads only as many bytes as the setting has', () => {
    expect(decodeSetting(7, [0x2c, 0x01, 0xff, 0xff])).toBe(300)
    expect(decodeSetting(20, [5, 0xff])).toBe(5)
    expect(decodeSetting(21, [0x81, 0x02, 0, 0, 0xff])).toBe(0x281)
  })
})

describe('readQmkSettings (reload_settings in protocol/keyboard_comm.py)', () => {
  it('finds the supported settings and reads their values', async () => {
    const { client } = setup({ 2: 50, 7: 180, 21: 0x80 })
    const settings = await readQmkSettings(client, 6)
    expect(settings.supported).toEqual([2, 7, 21])
    expect(settings.values).toEqual({ 2: 50, 7: 180, 21: 0x80 })
  })

  it('keeps asking while every reply slot is full', async () => {
    // 20 settings: more than the 16 ids one reply can hold.
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, i]))
    const { client } = setup(many)
    const settings = await readQmkSettings(client, 6)
    expect(settings.supported).toHaveLength(20)
  })

  it('skips settings this app has no controls for', async () => {
    const { client } = setup({ 7: 200, 999: 1 })
    const settings = await readQmkSettings(client, 6)
    expect(settings.supported).toEqual([7, 999])
    expect(settings.values).toEqual({ 7: 200 })
  })

  it('stops when the keyboard lists no new ids', async () => {
    const { fake, client } = setup({ 7: 200 })
    // Broken firmware: always the same full reply, with no 0xFFFF end marker.
    const send = fake.transport.send.bind(fake.transport)
    fake.transport.send = async (report) => {
      if (report[1] !== 0x09) return send(report)
      return new Uint8Array(32).fill(7).map((b, i) => (i % 2 ? 0 : b))
    }
    expect((await readQmkSettings(client, 6)).supported).toEqual([7])
  })

  it('reads nothing from keyboards older than Vial protocol 4', async () => {
    const { client } = setup({ 7: 200 }, 3)
    expect(await readQmkSettings(client, 3)).toEqual({ supported: [], values: {} })
  })
})

describe('writeQmkSettings', () => {
  it('writes only the settings that changed', async () => {
    const { fake, client } = setup({ 7: 200, 20: 5 })
    await writeQmkSettings(client, { 7: 200, 20: 5 }, { 7: 250, 20: 5 })
    const writes = fake.transport.sent.filter((r) => r[0] === 0xfe && r[1] === 0x0b)
    // CMD_VIAL_QMK_SETTINGS_SET, qsid (little-endian), value (little-endian, setting width)
    expect(writes.map((r) => [...r.slice(0, 6)])).toEqual([[0xfe, 0x0b, 7, 0, 250, 0]])
    expect(fake.qmkSettings[7]).toBe(250)
  })

  it('reports a setting the keyboard refused', async () => {
    const { client } = setup({ 7: 200 })
    await expect(writeQmkSettings(client, { 7: 200, 20: 1 }, { 7: 200, 20: 3 })).rejects.toThrow(/refused/)
  })
})

describe('settings fields', () => {
  it('packs on/off settings into bits of one value', () => {
    const swapCaps = field(21, 0)
    const nkro = field(21, 7)
    let values: QmkSettingValues = { 21: 0 }
    values = withFieldValue(values, nkro, true)
    values = withFieldValue(values, swapCaps, true)
    expect(values[21]).toBe(0x81)
    expect(fieldValue(values, nkro)).toBe(true)
    values = withFieldValue(values, nkro, false)
    expect(values[21]).toBe(0x01)
  })

  it('keeps numbers within their limits', () => {
    const term = field(7)
    expect(withFieldValue({ 7: 200 }, term, 20000)[7]).toBe(10000)
    expect(withFieldValue({ 7: 200 }, term, -5)[7]).toBe(0)
    expect(withFieldValue({ 7: 200 }, term, 12.6)[7]).toBe(13)
  })

  it('lists only groups with a setting the keyboard has', () => {
    const groups = settingGroups([7, 2])
    expect(groups.map((g) => g.id)).toEqual(['tap-hold', 'combo'])
    expect(groups[0].fields.map((f) => f.qsid)).toEqual([7])
  })

  it('brings backup values within what each setting allows', () => {
    expect(clampSetting(7, 99999)).toBe(10000)
    expect(clampSetting(21, 0xf081)).toBe(0x81) // only bits 0-9 mean something
    expect(clampSetting(999, 1)).toBeNull()
  })

  it('finds what changed', () => {
    expect(changedSettings({ 7: 200, 20: 5 }, { 7: 210, 20: 5 })).toEqual([7])
  })
})
