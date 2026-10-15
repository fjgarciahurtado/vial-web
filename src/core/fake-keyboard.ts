// SPDX-License-Identifier: GPL-2.0-or-later
import { FakeTransport } from './fake-transport'

export interface FakeKeyboardOptions {
  definition: object
  layers: number
  vialProtocol?: number
  macroCount?: number
  tapDanceCount?: number
  featureFlags?: number
  altRepeatKeyCount?: number
  layoutOptions?: number
  /** Number of rotary encoders. */
  encoders?: number
  unlocked?: boolean
  unlockKeys?: { row: number; col: number }[]
  /** Polls it takes to unlock once started, as if someone holds the keys. 0 never unlocks. */
  holdPolls?: number
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
    this.unlocked = options.unlocked ?? false
    this.transport = new FakeTransport((req) => this.handle(req))
  }

  private handle(req: Uint8Array): number[] {
    const { options } = this
    switch (req[0]) {
      case 0x01: // CMD_VIA_GET_PROTOCOL_VERSION
        return [0x01, 0x00, 0x09]
      case 0x02: // CMD_VIA_GET_KEYBOARD_VALUE, only VIA_LAYOUT_OPTIONS
        return [0x02, 0x02, ...u32be(this.layoutOptions)]
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
      case 0x0d: {
        // CMD_VIAL_DYNAMIC_ENTRY_OP, get number of entries
        const reply = new Array(32).fill(0)
        reply[0] = options.tapDanceCount ?? 0
        reply[3] = options.altRepeatKeyCount ?? 0
        reply[31] = options.featureFlags ?? 0
        return reply
      }
    }
    return []
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

function u32be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}
