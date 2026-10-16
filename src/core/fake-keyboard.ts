// SPDX-License-Identifier: GPL-2.0-or-later
import { FakeTransport } from './fake-transport'

/** QK_BOOT in Vial protocol 6 keycodes. */
const QK_BOOT = 0x7c00

export interface FakeKeyboardOptions {
  definition: object
  layers: number
  vialProtocol?: number
  macroCount?: number
  tapDanceCount?: number
  comboCount?: number
  keyOverrideCount?: number
  featureFlags?: number
  altRepeatKeyCount?: number
  layoutOptions?: number
  /** Bytes of macro memory. */
  macroMemory?: number
  /** Number of rotary encoders. */
  encoders?: number
  unlocked?: boolean
  unlockKeys?: { row: number; col: number }[]
  /** Polls it takes to unlock once started, as if someone holds the keys. 0 never unlocks. */
  holdPolls?: number
  /** QMK settings the firmware has, by qsid, with their default values. */
  qmkSettings?: Record<number, number>
}

/**
 * Answers VIA/Vial requests the way firmware does, for tests. The definition is
 * served uncompressed, so pair it with an identity decompress function.
 */
export class FakeKeyboard {
  readonly keymap: Uint8Array
  /** encoders[layer][index] = [counter-clockwise, clockwise] */
  readonly encoders: [number, number][][]
  layoutOptions: number
  unlocked: boolean
  unlockInProgress = false
  private unlockCounter = 0
  /** QMK lighting values by VIA id, e.g. 0x09 backlight brightness. */
  readonly lighting: Record<number, number[]> = {}
  vialrgb = { maxBrightness: 255, effects: [] as number[], mode: 0, speed: 0, hsv: [0, 0, 0] }
  lightingSaved = false
  /** Macro memory: macros separated by zero bytes. */
  readonly macroBuffer: Uint8Array
  /** Tap dance slots, as the firmware stores them. */
  readonly tapDances: { onTap: number; onHold: number; onDoubleTap: number; onTapHold: number; tappingTerm: number }[]
  /** Alt repeat key slots, as the 6 bytes the firmware stores. */
  readonly altRepeats: number[][]
  /** Key override slots, as the 10 bytes the firmware stores. */
  readonly keyOverrides: number[][]
  /** Combo slots: four trigger keys and a result each. */
  readonly combos: { keys: number[]; output: number }[]
  /** QMK setting values by qsid. */
  qmkSettings: Record<number, number>
  /** Switches held down right now, as "row,col". */
  readonly pressed = new Set<string>()
  readonly transport: FakeTransport
  private readonly definition: Uint8Array
  private readonly options: FakeKeyboardOptions
  private readonly matrix: { rows: number; cols: number }

  constructor(options: FakeKeyboardOptions) {
    this.options = options
    this.matrix = (options.definition as { matrix: { rows: number; cols: number } }).matrix
    const { rows, cols } = this.matrix
    this.definition = new TextEncoder().encode(JSON.stringify(options.definition))
    this.keymap = new Uint8Array(options.layers * rows * cols * 2)
    this.encoders = Array.from({ length: options.layers }, () =>
      Array.from({ length: options.encoders ?? 0 }, (): [number, number] => [0, 0]),
    )
    this.layoutOptions = options.layoutOptions ?? 0
    this.macroBuffer = new Uint8Array(options.macroMemory ?? 0)
    this.unlocked = options.unlocked ?? false
    this.qmkSettings = { ...options.qmkSettings }
    this.tapDances = Array.from({ length: options.tapDanceCount ?? 0 }, () => ({
      onTap: 0,
      onHold: 0,
      onDoubleTap: 0,
      onTapHold: 0,
      tappingTerm: 200,
    }))
    this.altRepeats = Array.from({ length: options.altRepeatKeyCount ?? 0 }, () => new Array(6).fill(0))
    this.keyOverrides = Array.from({ length: options.keyOverrideCount ?? 0 }, () => new Array(10).fill(0))
    this.combos = Array.from({ length: options.comboCount ?? 0 }, () => ({ keys: [0, 0, 0, 0], output: 0 }))
    this.transport = new FakeTransport((req) => this.handle(req))
  }

  private handle(req: Uint8Array): number[] {
    const { options } = this
    switch (req[0]) {
      case 0x01: // CMD_VIA_GET_PROTOCOL_VERSION
        return [0x01, 0x00, 0x09]
      case 0x02: // CMD_VIA_GET_KEYBOARD_VALUE: layout options or switch matrix
        return req[1] === 0x03 ? [0x02, 0x03, ...this.matrixBits()] : [0x02, 0x02, ...u32be(this.layoutOptions)]
      case 0x03: // CMD_VIA_SET_KEYBOARD_VALUE, only VIA_LAYOUT_OPTIONS
        this.layoutOptions = ((req[2] << 24) | (req[3] << 16) | (req[4] << 8) | req[5]) >>> 0
        return [...req]
      case 0x05: {
        // CMD_VIA_SET_KEYCODE: layer, row, col, code (big-endian)
        const { rows, cols } = this.matrix
        this.keymap.set([req[4], req[5]], ((req[1] * rows + req[2]) * cols + req[3]) * 2)
        return [...req]
      }
      case 0x07: // CMD_VIA_LIGHTING_SET_VALUE
        if (req[1] === 0x41) {
          this.vialrgb.mode = req[2] | (req[3] << 8)
          this.vialrgb.speed = req[4]
          this.vialrgb.hsv = [req[5], req[6], req[7]]
        } else {
          this.lighting[req[1]] = req[1] === 0x83 ? [req[2], req[3]] : [req[2]]
        }
        return [...req]
      case 0x08: // CMD_VIA_LIGHTING_GET_VALUE
        return [0x08, req[1], ...this.lightingValue(req)]
      case 0x09: // CMD_VIA_LIGHTING_SAVE
        this.lightingSaved = true
        return [...req]
      case 0x0c: // CMD_VIA_MACRO_GET_COUNT
        return [0x0c, options.macroCount ?? 0]
      case 0x0d: // CMD_VIA_MACRO_GET_BUFFER_SIZE
        return [0x0d, this.macroBuffer.length >> 8, this.macroBuffer.length & 0xff]
      case 0x0e: {
        // CMD_VIA_MACRO_GET_BUFFER: offset (big-endian), size
        const offset = (req[1] << 8) | req[2]
        return [...req.slice(0, 4), ...this.macroBuffer.slice(offset, offset + req[3])]
      }
      case 0x0f: {
        // CMD_VIA_MACRO_SET_BUFFER: offset (big-endian), size, data
        const offset = (req[1] << 8) | req[2]
        this.macroBuffer.set(req.slice(4, 4 + req[3]), offset)
        return [...req]
      }
      case 0x11: // CMD_VIA_GET_LAYER_COUNT
        return [0x11, options.layers]
      case 0x12: {
        // CMD_VIA_KEYMAP_GET_BUFFER
        const offset = (req[1] << 8) | req[2]
        return [...req.slice(0, 4), ...this.keymap.slice(offset, offset + req[3])]
      }
      case 0xfe:
        return this.handleVial(req)
    }
    return []
  }

  private handleVial(req: Uint8Array): number[] {
    const { options } = this
    switch (req[1]) {
      case 0x00: // CMD_VIAL_GET_KEYBOARD_ID
        return [options.vialProtocol ?? 6, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]
      case 0x01: {
        // CMD_VIAL_GET_SIZE
        const n = this.definition.length
        return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]
      }
      case 0x02: {
        // CMD_VIAL_GET_DEFINITION
        const block = req[2] | (req[3] << 8)
        return [...this.definition.slice(block * 32, block * 32 + 32)]
      }
      case 0x03: {
        // CMD_VIAL_GET_ENCODER: layer, index
        const [ccw, cw] = this.encoders[req[2]][req[3]]
        return [ccw >> 8, ccw & 0xff, cw >> 8, cw & 0xff]
      }
      case 0x04: // CMD_VIAL_SET_ENCODER: layer, index, direction, code
        this.encoders[req[2]][req[3]][req[4]] = (req[5] << 8) | req[6]
        return [...req]
      case 0x05: {
        // CMD_VIAL_GET_UNLOCK_STATUS
        const reply = new Array(32).fill(255)
        reply[0] = Number(this.unlocked)
        reply[1] = Number(this.unlockInProgress)
        ;(options.unlockKeys ?? []).forEach(({ row, col }, i) => reply.splice(2 + i * 2, 2, row, col))
        return reply
      }
      case 0x06: // CMD_VIAL_UNLOCK_START
        this.unlockInProgress = true
        this.unlockCounter = options.holdPolls ?? 0
        return []
      case 0x07: {
        // CMD_VIAL_UNLOCK_POLL
        if (this.unlockInProgress && options.holdPolls) {
          if (this.unlockCounter === 0) this.unlockCounter = options.holdPolls
          this.unlockCounter--
          if (this.unlockCounter === 0) {
            this.unlocked = true
            this.unlockInProgress = false
          }
        }
        return [Number(this.unlocked), 0, this.unlockCounter]
      }
      case 0x08: // CMD_VIAL_LOCK
        this.unlocked = false
        return []
      case 0x09: {
        // CMD_VIAL_QMK_SETTINGS_QUERY: up to 16 ids above the given one, then 0xFFFF
        const after = req[2] | (req[3] << 8)
        const ids = Object.keys(this.qmkSettings)
          .map(Number)
          .filter((id) => id > after)
          .sort((a, b) => a - b)
          .slice(0, 16)
        while (ids.length < 16) ids.push(0xffff)
        return ids.flatMap((id) => [id & 0xff, id >> 8])
      }
      case 0x0a: {
        // CMD_VIAL_QMK_SETTINGS_GET: status 0, then the value (little-endian)
        const value = this.qmkSettings[req[2] | (req[3] << 8)]
        return value === undefined ? [0xff] : [0, ...u32le(value)]
      }
      case 0x0b: {
        // CMD_VIAL_QMK_SETTINGS_SET: qsid, value (little-endian, unused bytes are zero)
        const qsid = req[2] | (req[3] << 8)
        if (!(qsid in this.qmkSettings)) return [0xff]
        this.qmkSettings[qsid] = (req[4] | (req[5] << 8) | (req[6] << 16) | (req[7] << 24)) >>> 0
        return [0]
      }
      case 0x0c: // CMD_VIAL_QMK_SETTINGS_RESET
        this.qmkSettings = { ...options.qmkSettings }
        return []
      case 0x0d:
        return this.handleDynamic(req)
    }
    return []
  }

  /** CMD_VIAL_DYNAMIC_ENTRY_OP. Replies start with a status byte: 0 means it worked. */
  private handleDynamic(req: Uint8Array): number[] {
    const { options } = this
    const word = (i: number) => req[i] | (req[i + 1] << 8)
    switch (req[2]) {
      case 0x00: {
        // DYNAMIC_VIAL_GET_NUMBER_OF_ENTRIES
        const reply = new Array(32).fill(0)
        reply[0] = this.tapDances.length
        reply[1] = this.combos.length
        reply[2] = this.keyOverrides.length
        reply[3] = this.altRepeats.length
        reply[31] = options.featureFlags ?? 0
        return reply
      }
      case 0x01: {
        // DYNAMIC_VIAL_TAP_DANCE_GET: index
        const td = this.tapDances[req[3]]
        if (!td) return [1]
        return [0, ...[td.onTap, td.onHold, td.onDoubleTap, td.onTapHold, td.tappingTerm].flatMap((v) => [v & 0xff, v >> 8])]
      }
      case 0x02: {
        // DYNAMIC_VIAL_TAP_DANCE_SET: index, 4 keycodes and tapping term (little-endian)
        if (!this.tapDances[req[3]]) return [1]
        // vial_keycode_firewall: the bootloader key only goes in while unlocked.
        const key = (i: number) => (word(i) === QK_BOOT && !this.unlocked ? 0 : word(i))
        this.tapDances[req[3]] = { onTap: key(4), onHold: key(6), onDoubleTap: key(8), onTapHold: key(10), tappingTerm: word(12) }
        return [0]
      }
      case 0x05: {
        // DYNAMIC_VIAL_KEY_OVERRIDE_GET: index
        const ko = this.keyOverrides[req[3]]
        return ko ? [0, ...ko] : [1]
      }
      case 0x06: {
        // DYNAMIC_VIAL_KEY_OVERRIDE_SET: index, then the entry's 10 bytes
        if (!this.keyOverrides[req[3]]) return [1]
        const entry = [...req.slice(4, 14)]
        // vial_keycode_firewall: the bootloader key only goes in as a replacement while unlocked.
        if (word(6) === QK_BOOT && !this.unlocked) entry.splice(2, 2, 0, 0)
        this.keyOverrides[req[3]] = entry
        return [0]
      }
      case 0x07: {
        // DYNAMIC_VIAL_ALT_REPEAT_KEY_GET: index
        const entry = this.altRepeats[req[3]]
        return entry ? [0, ...entry] : [1]
      }
      case 0x08: {
        // DYNAMIC_VIAL_ALT_REPEAT_KEY_SET: index, then the entry's 6 bytes
        if (!this.altRepeats[req[3]]) return [1]
        const entry = [...req.slice(4, 10)]
        // vial_keycode_firewall: the bootloader key only goes in while unlocked.
        if (word(4) === QK_BOOT && !this.unlocked) entry.splice(0, 2, 0, 0)
        if (word(6) === QK_BOOT && !this.unlocked) entry.splice(2, 2, 0, 0)
        this.altRepeats[req[3]] = entry
        return [0]
      }
      case 0x03: {
        // DYNAMIC_VIAL_COMBO_GET: index
        const combo = this.combos[req[3]]
        if (!combo) return [1]
        return [0, ...[...combo.keys, combo.output].flatMap((k) => [k & 0xff, k >> 8])]
      }
      case 0x04: {
        // DYNAMIC_VIAL_COMBO_SET: index, 4 keys and output (little-endian)
        if (!this.combos[req[3]]) return [1]
        const output = word(12)
        this.combos[req[3]] = {
          keys: [word(4), word(6), word(8), word(10)],
          // vial_keycode_firewall: the bootloader key only goes in while unlocked.
          output: output === QK_BOOT && !this.unlocked ? 0 : output,
        }
        return [0]
      }
    }
    return []
  }

  /** VIA_SWITCH_MATRIX_STATE: big-endian bit rows. Vial firmware reports nothing while locked. */
  private matrixBits(): number[] {
    const { rows, cols } = this.matrix
    const rowSize = Math.ceil(cols / 8)
    const bytes = new Array(rows * rowSize).fill(0)
    if (!this.unlocked) return bytes
    for (const key of this.pressed) {
      const [r, c] = key.split(',').map(Number)
      bytes[r * rowSize + rowSize - 1 - Math.floor(c / 8)] |= 1 << (c % 8)
    }
    return bytes
  }

  private lightingValue(req: Uint8Array): number[] {
    const rgb = this.vialrgb
    switch (req[1]) {
      case 0x40: // VIALRGB_GET_INFO: protocol version 1, max brightness
        return [1, 0, rgb.maxBrightness]
      case 0x41: // VIALRGB_GET_MODE
        return [rgb.mode & 0xff, rgb.mode >> 8, rgb.speed, ...rgb.hsv]
      case 0x42: {
        // VIALRGB_GET_SUPPORTED: up to 15 effects above the given one, then 0xFFFF
        const after = req[2] | (req[3] << 8)
        const next = rgb.effects.filter((e) => e > after).slice(0, 15)
        while (next.length < 15) next.push(0xffff)
        return next.flatMap((e) => [e & 0xff, e >> 8])
      }
    }
    return this.lighting[req[1]] ?? [0, 0]
  }

  /** Reads a keycode straight from the fake EEPROM. */
  keycodeAt(layer: number, row: number, col: number): number {
    const { rows, cols } = this.matrix
    const offset = ((layer * rows + row) * cols + col) * 2
    return (this.keymap[offset] << 8) | this.keymap[offset + 1]
  }
}

function u32le(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
}

function u32be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}
