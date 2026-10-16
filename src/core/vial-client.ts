// SPDX-License-Identifier: GPL-2.0-or-later
import { MSG_LEN, type HidTransport } from './transport'
import { decompressXz } from './xz'

const CMD_VIA_GET_PROTOCOL_VERSION = 0x01
const CMD_VIA_GET_KEYBOARD_VALUE = 0x02
const CMD_VIA_SET_KEYBOARD_VALUE = 0x03
const CMD_VIA_SET_KEYCODE = 0x05
const CMD_VIA_LIGHTING_SET_VALUE = 0x07
const CMD_VIA_LIGHTING_GET_VALUE = 0x08
const CMD_VIA_LIGHTING_SAVE = 0x09
const CMD_VIA_MACRO_GET_COUNT = 0x0c
const CMD_VIA_MACRO_GET_BUFFER_SIZE = 0x0d
const CMD_VIA_MACRO_GET_BUFFER = 0x0e
const CMD_VIA_MACRO_SET_BUFFER = 0x0f
const CMD_VIA_GET_LAYER_COUNT = 0x11
const CMD_VIA_KEYMAP_GET_BUFFER = 0x12
const CMD_VIA_VIAL_PREFIX = 0xfe
const CMD_VIAL_GET_KEYBOARD_ID = 0x00
const CMD_VIAL_GET_SIZE = 0x01
const CMD_VIAL_GET_DEFINITION = 0x02
const CMD_VIAL_GET_ENCODER = 0x03
const CMD_VIAL_SET_ENCODER = 0x04
const CMD_VIAL_GET_UNLOCK_STATUS = 0x05
const CMD_VIAL_UNLOCK_START = 0x06
const CMD_VIAL_UNLOCK_POLL = 0x07
const CMD_VIAL_LOCK = 0x08
const CMD_VIAL_QMK_SETTINGS_QUERY = 0x09
const CMD_VIAL_QMK_SETTINGS_GET = 0x0a
const CMD_VIAL_QMK_SETTINGS_SET = 0x0b
const CMD_VIAL_QMK_SETTINGS_RESET = 0x0c
const CMD_VIAL_DYNAMIC_ENTRY_OP = 0x0d
const DYNAMIC_VIAL_GET_NUMBER_OF_ENTRIES = 0x00

/** Optional firmware features reported in the last byte of the dynamic entry count reply. */
const FEATURE_BITS: [number, string][] = [
  [0, 'caps_word'],
  [1, 'layer_lock'],
]

const VIA_LAYOUT_OPTIONS = 0x02
const VIA_SWITCH_MATRIX_STATE = 0x03

/** Max keymap bytes per request: 32 minus the 4-byte header. */
const BUFFER_FETCH_CHUNK = 28

export interface DynamicEntryCounts {
  tapDance: number
  combo: number
  keyOverride: number
  altRepeatKey: number
  features: string[]
}

export interface UnlockStatus {
  unlocked: boolean
  inProgress: boolean
  /** Keys to hold down to unlock. */
  keys: { row: number; col: number }[]
}

export type Decompress = (bytes: Uint8Array) => Promise<Uint8Array>

/** keymap[layer][row][col] = 16-bit keycode */
export type Keymap = number[][][]

/** Talks the VIA/Vial raw HID protocol. Ported from vial-gui protocol/keyboard_comm.py. */
export class VialClient {
  private readonly transport: HidTransport
  private readonly decompress: Decompress

  constructor(transport: HidTransport, decompress: Decompress = decompressXz) {
    this.transport = transport
    this.decompress = decompress
  }

  private async request(bytes: number[]): Promise<DataView> {
    if (bytes.length > MSG_LEN) throw new Error(`message longer than ${MSG_LEN} bytes`)
    const report = new Uint8Array(MSG_LEN)
    report.set(bytes)
    const reply = await this.transport.send(report)
    return new DataView(reply.buffer, reply.byteOffset, reply.byteLength)
  }

  async getViaProtocol(): Promise<number> {
    const data = await this.request([CMD_VIA_GET_PROTOCOL_VERSION])
    return data.getUint16(1, false)
  }

  async getKeyboardId(): Promise<{ vialProtocol: number; keyboardId: bigint }> {
    const data = await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_KEYBOARD_ID])
    return { vialProtocol: data.getUint32(0, true), keyboardId: data.getBigUint64(4, true) }
  }

  async getLayerCount(): Promise<number> {
    const data = await this.request([CMD_VIA_GET_LAYER_COUNT])
    return data.getUint8(1)
  }

  async getMacroCount(): Promise<number> {
    const data = await this.request([CMD_VIA_MACRO_GET_COUNT])
    return data.getUint8(1)
  }

  async getMacroBufferSize(): Promise<number> {
    const data = await this.request([CMD_VIA_MACRO_GET_BUFFER_SIZE])
    return data.getUint16(1, false)
  }

  /**
   * Reads macro memory until all `count` macros have ended (reload_macros_late in
   * protocol/macro.py). Returns the bytes up to and including the last macro's end.
   */
  async getMacroBuffer(size: number, count: number): Promise<Uint8Array> {
    const buffer = new Uint8Array(size)
    let read = 0
    let ends = 0
    while (read < size && ends < count) {
      const sz = Math.min(BUFFER_FETCH_CHUNK, size - read)
      const data = await this.request([CMD_VIA_MACRO_GET_BUFFER, (read >> 8) & 0xff, read & 0xff, sz])
      const chunk = new Uint8Array(data.buffer, data.byteOffset + 4, sz)
      buffer.set(chunk, read)
      for (const b of chunk) if (b === 0) ends++
      read += sz
    }
    let end = 0
    for (let n = 0; n < count && end < read; n++) {
      const next = buffer.indexOf(0, end)
      end = next === -1 || next >= read ? read : next + 1
    }
    return buffer.slice(0, end)
  }

  async setMacroBuffer(data: Uint8Array): Promise<void> {
    for (let offset = 0; offset < data.length; offset += BUFFER_FETCH_CHUNK) {
      const chunk = data.subarray(offset, offset + BUFFER_FETCH_CHUNK)
      await this.request([CMD_VIA_MACRO_SET_BUFFER, (offset >> 8) & 0xff, offset & 0xff, chunk.length, ...chunk])
    }
  }

  /** Needs Vial protocol 4 or newer. Ported from reload_dynamic() in protocol/dynamic.py. */
  async getDynamicEntryCounts(): Promise<DynamicEntryCounts> {
    const data = await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_DYNAMIC_ENTRY_OP, DYNAMIC_VIAL_GET_NUMBER_OF_ENTRIES])
    const flags = data.getUint8(MSG_LEN - 1)
    return {
      tapDance: data.getUint8(0),
      combo: data.getUint8(1),
      keyOverride: data.getUint8(2),
      altRepeatKey: data.getUint8(3),
      features: FEATURE_BITS.filter(([bit]) => flags & (1 << bit)).map(([, name]) => name),
    }
  }

  /** Setting ids greater than `after`, padded with 0xFFFF once the list ends (reload_settings). */
  async qmkSettingsQuery(after: number): Promise<number[]> {
    const data = await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_QMK_SETTINGS_QUERY, ...u16le(after)])
    return Array.from({ length: MSG_LEN / 2 }, (_, i) => data.getUint16(i * 2, true))
  }

  /** A setting's raw value bytes, or null if the keyboard doesn't have it. */
  async qmkSettingsGet(qsid: number): Promise<Uint8Array | null> {
    const data = await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_QMK_SETTINGS_GET, ...u16le(qsid)])
    return data.getUint8(0) === 0 ? new Uint8Array(data.buffer, data.byteOffset + 1, MSG_LEN - 1) : null
  }

  /** Writes a setting's value bytes. Returns false if the keyboard refused it. */
  async qmkSettingsSet(qsid: number, value: number[]): Promise<boolean> {
    const data = await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_QMK_SETTINGS_SET, ...u16le(qsid), ...value])
    return data.getUint8(0) === 0
  }

  /** Puts every QMK setting back to the firmware's defaults. */
  async qmkSettingsReset(): Promise<void> {
    await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_QMK_SETTINGS_RESET])
  }

  /** Ported from get_unlock_status(),get_unlock_in_progress() and get_unlock_keys() in vial-gui. */
  async getUnlockStatus(): Promise<UnlockStatus> {
    const data = await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_UNLOCK_STATUS])
    const keys = []
    for (let i = 0; i < 15; i++) {
      const row = data.getUint8(2 + i * 2)
      const col = data.getUint8(3 + i * 2)
      if (row !== 255 && col !== 255) keys.push({ row, col })
    }
    return { unlocked: data.getUint8(0) === 1, inProgress: data.getUint8(1) === 1, keys }
  }

  async unlockStart(): Promise<void> {
    await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_UNLOCK_START])
  }

  /** remaining counts down while the unlock keys are held, and resets when they're released. */
  async unlockPoll(): Promise<{ unlocked: boolean; remaining: number }> {
    const data = await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_UNLOCK_POLL])
    return { unlocked: data.getUint8(0) === 1, remaining: data.getUint8(2) }
  }

  async lock(): Promise<void> {
    await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_LOCK])
  }

  /** Downloads and decodes the keyboard's compressed vial.json. */
  async getDefinition(): Promise<unknown> {
    const sizeData = await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_SIZE])
    const size = sizeData.getUint32(0, true)

    const payload = new Uint8Array(size)
    for (let block = 0, offset = 0; offset < size; block++, offset += MSG_LEN) {
      const data = await this.request([
        CMD_VIA_VIAL_PREFIX,
        CMD_VIAL_GET_DEFINITION,
        block & 0xff,
        (block >> 8) & 0xff,
        (block >> 16) & 0xff,
        (block >> 24) & 0xff,
      ])
      const chunk = new Uint8Array(data.buffer, data.byteOffset, Math.min(MSG_LEN, size - offset))
      payload.set(chunk, offset)
    }

    const json = new TextDecoder().decode(await this.decompress(payload))
    return JSON.parse(json)
  }

  /** Ported from set_key() in protocol/keyboard_comm.py. */
  async setKeycode(layer: number, row: number, col: number, code: number): Promise<void> {
    await this.request([CMD_VIA_SET_KEYCODE, layer, row, col, (code >> 8) & 0xff, code & 0xff])
  }

  async getLayoutOptions(): Promise<number> {
    const data = await this.request([CMD_VIA_GET_KEYBOARD_VALUE, VIA_LAYOUT_OPTIONS])
    return data.getUint32(2, false)
  }

  async setLayoutOptions(value: number): Promise<void> {
    await this.request([CMD_VIA_SET_KEYBOARD_VALUE, VIA_LAYOUT_OPTIONS, ...u32be(value)])
  }

  /** Returns [counter-clockwise, clockwise] keycodes. */
  async getEncoder(layer: number, index: number): Promise<[number, number]> {
    const data = await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_ENCODER, layer, index])
    return [data.getUint16(0, false), data.getUint16(2, false)]
  }

  async setEncoder(layer: number, index: number, direction: number, code: number): Promise<void> {
    await this.request([CMD_VIA_VIAL_PREFIX, CMD_VIAL_SET_ENCODER, layer, index, direction, (code >> 8) & 0xff, code & 0xff])
  }

  /** Which switches are down right now (VIA_SWITCH_MATRIX_STATE); the reply after its 2-byte header. */
  async getSwitchMatrix(): Promise<Uint8Array> {
    const data = await this.request([CMD_VIA_GET_KEYBOARD_VALUE, VIA_SWITCH_MATRIX_STATE])
    return new Uint8Array(data.buffer, data.byteOffset + 2, MSG_LEN - 2)
  }

  /** Reads a lighting value; returns the reply after the command and id bytes. */
  async lightingGet(id: number, ...args: number[]): Promise<number[]> {
    const data = await this.request([CMD_VIA_LIGHTING_GET_VALUE, id, ...args])
    return [...new Uint8Array(data.buffer, data.byteOffset + 2, MSG_LEN - 2)]
  }

  async lightingSet(id: number, ...values: number[]): Promise<void> {
    await this.request([CMD_VIA_LIGHTING_SET_VALUE, id, ...values])
  }

  async lightingSave(): Promise<void> {
    await this.request([CMD_VIA_LIGHTING_SAVE])
  }

  async getKeymap(layers: number, rows: number, cols: number): Promise<Keymap> {
    const size = layers * rows * cols * 2
    const buffer = new Uint8Array(size)
    for (let offset = 0; offset < size; offset += BUFFER_FETCH_CHUNK) {
      const sz = Math.min(size - offset, BUFFER_FETCH_CHUNK)
      const data = await this.request([CMD_VIA_KEYMAP_GET_BUFFER, (offset >> 8) & 0xff, offset & 0xff, sz])
      buffer.set(new Uint8Array(data.buffer, data.byteOffset + 4, sz), offset)
    }

    const view = new DataView(buffer.buffer)
    return Array.from({ length: layers }, (_, layer) =>
      Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => view.getUint16(((layer * rows + row) * cols + col) * 2, false)),
      ),
    )
  }
}

function u16le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff]
}

function u32be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}
