// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { FakeKeyboard } from './fake-keyboard'
import { lightingKind, LightingController, readLighting, RGBLIGHT_EFFECTS } from './lighting'
import { VialClient } from './vial-client'

const definition = { matrix: { rows: 1, cols: 1 }, layouts: { keymap: [['0,0']] } }
const setup = () => {
  const fake = new FakeKeyboard({ definition, layers: 1 })
  return { fake, client: new VialClient(fake.transport) }
}

describe('lightingKind (vial.json "lighting")', () => {
  it('reads which lighting systems the keyboard has', () => {
    expect(lightingKind({ lighting: 'qmk_backlight_rgblight' })).toEqual({ backlight: true, rgblight: true, vialrgb: false })
    expect(lightingKind({ lighting: 'vialrgb' })).toEqual({ backlight: false, rgblight: false, vialrgb: true })
    expect(lightingKind({})).toEqual({ backlight: false, rgblight: false, vialrgb: false })
  })
})

describe('RGBLIGHT_EFFECTS', () => {
  it('numbers effects as QMK rgblight_modes.h does, up to Twinkle', () => {
    expect(RGBLIGHT_EFFECTS[36].name).toBe('Alternating')
    expect(RGBLIGHT_EFFECTS[37].name).toBe('Twinkle 1')
    expect(RGBLIGHT_EFFECTS[42].name).toBe('Twinkle 6')
    expect(RGBLIGHT_EFFECTS).toHaveLength(43)
  })
})

describe('readLighting', () => {
  it('reads QMK backlight and RGB underglow (reload_rgb in keyboard_comm.py)', async () => {
    const { fake, client } = setup()
    Object.assign(fake.lighting, { 0x09: [120], 0x0a: [1], 0x80: [200], 0x81: [6], 0x82: [3], 0x83: [10, 255] })
    const state = await readLighting(client, { backlight: true, rgblight: true, vialrgb: false })
    expect(state.backlight).toEqual({ brightness: 120, breathing: true })
    expect(state.rgblight).toEqual({ brightness: 200, effect: 6, speed: 3, hue: 10, sat: 255 })
    expect(state.vialrgb).toBeUndefined()
  })

  it('reads VialRGB info, supported effects and mode', async () => {
    const { fake, client } = setup()
    fake.vialrgb = { maxBrightness: 180, effects: [1, 2, 6, 39], mode: 6, speed: 128, hsv: [20, 255, 150] }
    const state = await readLighting(client, { backlight: false, rgblight: false, vialrgb: true })
    expect(state.vialrgb).toEqual({ maxBrightness: 180, effects: [0, 1, 2, 6, 39], mode: 6, speed: 128, hue: 20, sat: 255, brightness: 150 })
  })
})

describe('LightingController', () => {
  it('writes only what changed, in the firmware’s byte layout', async () => {
    const { fake, client } = setup()
    fake.vialrgb = { maxBrightness: 255, effects: [2], mode: 2, speed: 0, hsv: [0, 0, 0] }
    const state = await readLighting(client, { backlight: true, rgblight: true, vialrgb: true })
    const lights = new LightingController(client, state)

    await lights.update({ backlight: { brightness: 50, breathing: true } })
    expect(fake.lighting[0x09]).toEqual([50])
    expect(fake.lighting[0x0a]).toEqual([1])

    await lights.update({ rgblight: { ...state.rgblight!, hue: 100, sat: 200 } })
    expect(fake.lighting[0x83]).toEqual([100, 200])

    await lights.update({ vialrgb: { ...state.vialrgb!, mode: 0x0102, speed: 9, hue: 1, sat: 2, brightness: 3 } })
    expect(fake.vialrgb.mode).toBe(0x0102)
    expect(fake.vialrgb.hsv).toEqual([1, 2, 3])
    expect(fake.vialrgb.speed).toBe(9)
  })

  it('saves so settings survive unplugging', async () => {
    const { fake, client } = setup()
    const lights = new LightingController(client, {})
    await lights.save()
    expect(fake.lightingSaved).toBe(true)
  })
})
