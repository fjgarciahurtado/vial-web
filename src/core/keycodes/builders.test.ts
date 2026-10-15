// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import v5Data from './data/keycodes-v5.json'
import v6Data from './data/keycodes-v6.json'
import { buildCombined, innerKeyChoices, MOD, parseCombined, availableModifierSets } from './builders'
import { KeycodeCatalog, type KeycodeData } from './catalog'

const caps = { layers: 4, macroCount: 0, tapDanceCount: 0, features: new Set<string>() }
const v6 = new KeycodeCatalog(v6Data as KeycodeData, caps)
const v5 = new KeycodeCatalog(v5Data as KeycodeData, caps)
const KC_C = 0x06
const KC_ESC = 0x29
const KC_SPACE = 0x2c

describe('buildCombined', () => {
  it('builds shortcuts such as Ctrl + C', () => {
    const code = buildCombined(v6, { kind: 'shortcut', mods: MOD.ctrl, inner: KC_C })
    expect(v6.serialize(code!)).toBe('LCTL(KC_C)')
    expect(v6.describe(code!).name).toBe('Ctrl + C')
  })

  it('builds multi-modifier and right-hand shortcuts', () => {
    expect(v6.serialize(buildCombined(v6, { kind: 'shortcut', mods: MOD.ctrl | MOD.shift, inner: KC_C })!)).toBe('C_S(KC_C)')
    expect(v6.serialize(buildCombined(v6, { kind: 'shortcut', mods: MOD.right | MOD.alt, inner: KC_C })!)).toBe('RALT(KC_C)')
  })

  it('builds tap-or-hold modifier keys for each protocol version', () => {
    const modTap = { kind: 'modtap', mods: MOD.ctrl, inner: KC_ESC } as const
    expect(v6.serialize(buildCombined(v6, modTap)!)).toBe('LCTL_T(KC_ESCAPE)')
    expect(v5.serialize(buildCombined(v5, modTap)!)).toBe('LCTL_T(KC_ESCAPE)')
    expect(buildCombined(v6, modTap)).not.toBe(buildCombined(v5, modTap))
  })

  it('builds layer-tap keys for layers the keyboard has', () => {
    const code = buildCombined(v6, { kind: 'layertap', layer: 1, inner: KC_SPACE })
    expect(v6.describe(code!).name).toBe('Hold for layer 1, tap for Space')
    expect(buildCombined(v6, { kind: 'layertap', layer: 4, inner: KC_SPACE })).toBeUndefined()
  })

  it('refuses combinations QMK has no key for, and non-basic inner keys', () => {
    expect(buildCombined(v6, { kind: 'shortcut', mods: MOD.ctrl | MOD.shift | MOD.gui, inner: KC_C })).toBeUndefined()
    expect(buildCombined(v6, { kind: 'shortcut', mods: 0, inner: KC_C })).toBeUndefined()
    expect(buildCombined(v6, { kind: 'shortcut', mods: MOD.ctrl, inner: 0x5221 })).toBeUndefined()
  })
})

describe('parseCombined', () => {
  it('reads combined keys back into builder settings', () => {
    expect(parseCombined(v6, 0x0306)).toEqual({ kind: 'shortcut', mods: MOD.ctrl | MOD.shift, inner: KC_C })
    expect(parseCombined(v6, 0x2129)).toEqual({ kind: 'modtap', mods: MOD.ctrl, inner: KC_ESC })
    expect(parseCombined(v6, 0x412c)).toEqual({ kind: 'layertap', layer: 1, inner: KC_SPACE })
  })

  it('returns null for keys that are not combined', () => {
    expect(parseCombined(v6, KC_C)).toBeNull()
    expect(parseCombined(v6, 0x5221)).toBeNull()
  })

  it('round-trips everything it builds', () => {
    for (const mods of availableModifierSets(v6, 'modtap')) {
      const settings = { kind: 'modtap', mods, inner: KC_ESC } as const
      expect(parseCombined(v6, buildCombined(v6, settings)!)).toEqual(settings)
    }
  })
})

describe('choices', () => {
  it('offers only modifier sets QMK names', () => {
    const sets = availableModifierSets(v6, 'shortcut')
    expect(sets).toContain(MOD.ctrl | MOD.shift | MOD.alt | MOD.gui) // HYPR
    expect(sets).not.toContain(MOD.ctrl | MOD.shift | MOD.gui)
  })

  it('offers basic keys as the key to tap or press', () => {
    const ids = innerKeyChoices(v6).map((e) => e.id)
    expect(ids).toEqual(expect.arrayContaining(['KC_A', 'KC_ESCAPE', 'KC_SPACE', 'KC_F1', 'KC_LEFT']))
    expect(ids).not.toContain('MO(1)')
    expect(ids).not.toContain('KC_NO')
  })
})
