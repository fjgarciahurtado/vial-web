// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Keyboard lighting, ported from reload_persistent_rgb(), reload_rgb() and the
 * set_* methods in vial-gui protocol/keyboard_comm.py, plus the effect lists in
 * editor/rgb_configurator.py.
 */
import type { VialClient } from './vial-client'

const QMK_BACKLIGHT_BRIGHTNESS = 0x09
const QMK_BACKLIGHT_EFFECT = 0x0a
const QMK_RGBLIGHT_BRIGHTNESS = 0x80
const QMK_RGBLIGHT_EFFECT = 0x81
const QMK_RGBLIGHT_EFFECT_SPEED = 0x82
const QMK_RGBLIGHT_COLOR = 0x83
const VIALRGB_GET_INFO = 0x40
const VIALRGB_MODE = 0x41
const VIALRGB_GET_SUPPORTED = 0x42

export interface LightingKind {
  /** Single-colour LEDs under the keys. */
  backlight: boolean
  /** RGB LED strip (QMK rgblight), often mounted as underglow. */
  rgblight: boolean
  /** Per-key RGB through Vial's own protocol. */
  vialrgb: boolean
}

export interface LightingState {
  backlight?: { brightness: number; breathing: boolean }
  rgblight?: { brightness: number; effect: number; speed: number; hue: number; sat: number }
  vialrgb?: {
    maxBrightness: number
    /** Effect ids the firmware was built with. 0 (off) is always there. */
    effects: number[]
    mode: number
    speed: number
    hue: number
    sat: number
    brightness: number
  }
}

/** QMK RGB light strip (rgblight) effects, by id. color: whether the effect uses the chosen colour. */
export const RGBLIGHT_EFFECTS: { name: string; color: boolean }[] = (
  [
    ['All Off', false], ['Solid Color', true], ['Breathing 1', true], ['Breathing 2', true],
    ['Breathing 3', true], ['Breathing 4', true], ['Rainbow Mood 1', false], ['Rainbow Mood 2', false],
    ['Rainbow Mood 3', false], ['Rainbow Swirl 1', false], ['Rainbow Swirl 2', false], ['Rainbow Swirl 3', false],
    ['Rainbow Swirl 4', false], ['Rainbow Swirl 5', false], ['Rainbow Swirl 6', false], ['Snake 1', true],
    ['Snake 2', true], ['Snake 3', true], ['Snake 4', true], ['Snake 5', true], ['Snake 6', true],
    ['Knight 1', true], ['Knight 2', true], ['Knight 3', true], ['Christmas', true], ['Gradient 1', true],
    ['Gradient 2', true], ['Gradient 3', true], ['Gradient 4', true], ['Gradient 5', true], ['Gradient 6', true],
    ['Gradient 7', true], ['Gradient 8', true], ['Gradient 9', true], ['Gradient 10', true], ['RGB Test', true],
    ['Alternating', true],
  ] as const
).map(([name, color]) => ({ name, color }))

/** VialRGB effects, by id. */
export const VIALRGB_EFFECTS: string[] = [
  'Off', 'Direct Control', 'Solid Color', 'Alphas Mods', 'Gradient Up Down', 'Gradient Left Right',
  'Breathing', 'Band Sat', 'Band Val', 'Band Pinwheel Sat', 'Band Pinwheel Val', 'Band Spiral Sat',
  'Band Spiral Val', 'Cycle All', 'Cycle Left Right', 'Cycle Up Down', 'Rainbow Moving Chevron',
  'Cycle Out In', 'Cycle Out In Dual', 'Cycle Pinwheel', 'Cycle Spiral', 'Dual Beacon', 'Rainbow Beacon',
  'Rainbow Pinwheels', 'Raindrops', 'Jellybean Raindrops', 'Hue Breathing', 'Hue Pendulum', 'Hue Wave',
  'Typing Heatmap', 'Digital Rain', 'Solid Reactive Simple', 'Solid Reactive', 'Solid Reactive Wide',
  'Solid Reactive Multiwide', 'Solid Reactive Cross', 'Solid Reactive Multicross', 'Solid Reactive Nexus',
  'Solid Reactive Multinexus', 'Splash', 'Multisplash', 'Solid Splash', 'Solid Multisplash', 'Pixel Rain',
  'Pixel Fractal',
]

/** Which lighting systems vial.json declares. */
export function lightingKind(definition: { lighting?: string }): LightingKind {
  const l = definition.lighting
  return {
    backlight: l === 'qmk_backlight' || l === 'qmk_backlight_rgblight',
    rgblight: l === 'qmk_rgblight' || l === 'qmk_backlight_rgblight',
    vialrgb: l === 'vialrgb',
  }
}

export async function readLighting(client: VialClient, kind: LightingKind): Promise<LightingState> {
  const state: LightingState = {}

  if (kind.rgblight) {
    const [brightness] = await client.lightingGet(QMK_RGBLIGHT_BRIGHTNESS)
    const [effect] = await client.lightingGet(QMK_RGBLIGHT_EFFECT)
    const [speed] = await client.lightingGet(QMK_RGBLIGHT_EFFECT_SPEED)
    const [hue, sat] = await client.lightingGet(QMK_RGBLIGHT_COLOR)
    state.rgblight = { brightness, effect, speed, hue, sat }
  }

  if (kind.backlight) {
    const [brightness] = await client.lightingGet(QMK_BACKLIGHT_BRIGHTNESS)
    const [effect] = await client.lightingGet(QMK_BACKLIGHT_EFFECT)
    state.backlight = { brightness, breathing: effect === 1 }
  }

  if (kind.vialrgb) {
    const info = await client.lightingGet(VIALRGB_GET_INFO)
    const version = info[0] | (info[1] << 8)
    if (version !== 1) {
      throw new Error(`This keyboard uses VialRGB version ${version}. Update its firmware to the latest Vial.`)
    }
    // The firmware lists its effects 15 at a time, starting after the given id, ending with 0xFFFF.
    const effects = new Set([0])
    let highest = 0
    while (highest < 0xffff) {
      const data = await client.lightingGet(VIALRGB_GET_SUPPORTED, highest & 0xff, highest >> 8)
      for (let i = 0; i + 1 < data.length; i += 2) {
        const effect = data[i] | (data[i + 1] << 8)
        if (effect !== 0xffff) effects.add(effect)
        highest = Math.max(highest, effect)
      }
    }
    const mode = await client.lightingGet(VIALRGB_MODE)
    state.vialrgb = {
      maxBrightness: info[2],
      effects: [...effects].sort((a, b) => a - b),
      mode: mode[0] | (mode[1] << 8),
      speed: mode[2],
      hue: mode[3],
      sat: mode[4],
      brightness: mode[5],
    }
  }

  return state
}

/** Applies lighting changes as they happen; save() keeps them after unplugging. */
export class LightingController {
  state: LightingState
  private readonly client: VialClient

  constructor(client: VialClient, state: LightingState) {
    this.client = client
    this.state = state
  }

  async update(next: LightingState): Promise<void> {
    const { client, state } = this
    const changed = <T extends object>(before: T | undefined, after: T, key: keyof T) =>
      !before || before[key] !== after[key]

    if (next.backlight) {
      const b = next.backlight
      if (changed(state.backlight, b, 'brightness')) await client.lightingSet(QMK_BACKLIGHT_BRIGHTNESS, b.brightness)
      if (changed(state.backlight, b, 'breathing')) await client.lightingSet(QMK_BACKLIGHT_EFFECT, Number(b.breathing))
    }
    if (next.rgblight) {
      const r = next.rgblight
      if (changed(state.rgblight, r, 'brightness')) await client.lightingSet(QMK_RGBLIGHT_BRIGHTNESS, r.brightness)
      if (changed(state.rgblight, r, 'effect')) await client.lightingSet(QMK_RGBLIGHT_EFFECT, r.effect)
      if (changed(state.rgblight, r, 'speed')) await client.lightingSet(QMK_RGBLIGHT_EFFECT_SPEED, r.speed)
      if (changed(state.rgblight, r, 'hue') || changed(state.rgblight, r, 'sat')) {
        await client.lightingSet(QMK_RGBLIGHT_COLOR, r.hue, r.sat)
      }
    }
    if (next.vialrgb) {
      const v = next.vialrgb
      const keys = ['mode', 'speed', 'hue', 'sat', 'brightness'] as const
      if (keys.some((k) => changed(state.vialrgb, v, k))) {
        // VIALRGB_SET_MODE: mode (16-bit little-endian), speed, hue, saturation, value
        await client.lightingSet(VIALRGB_MODE, v.mode & 0xff, v.mode >> 8, v.speed, v.hue, v.sat, v.brightness)
      }
    }
    this.state = { ...state, ...next }
  }

  async save(): Promise<void> {
    await this.client.lightingSave()
  }
}
