// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { FakeKeyboard } from './fake-keyboard'
import {
  decodeKeyOverride,
  describeKeyOverride,
  describeMods,
  EMPTY_KEY_OVERRIDE,
  encodeKeyOverride,
  keyOverrideProblem,
  loadSavedKeyOverride,
  NEW_KEY_OVERRIDE,
  OPTION,
  readKeyOverrides,
  saveKeyOverride,
  writeKeyOverride,
  type KeyOverride,
} from './key-overrides'
import v6Data from './keycodes/data/keycodes-v6.json'
import { KeycodeCatalog, type KeycodeData } from './keycodes/catalog'
import { VialClient } from './vial-client'

const catalog = new KeycodeCatalog(v6Data as KeycodeData, { layers: 2, macroCount: 0, tapDanceCount: 0, features: new Set() })
const definition = { matrix: { rows: 1, cols: 1 }, layouts: { keymap: [['0,0']] } }
const setup = (keyOverrideCount = 2) => {
  const fake = new FakeKeyboard({ definition, layers: 1, keyOverrideCount })
  return { fake, client: new VialClient(fake.transport) }
}
const SHIFT = 0b0010_0010 // Left and Right Shift
// Shift + Backspace sends Delete, without Shift.
const shiftBksp: KeyOverride = {
  trigger: 0x2a,
  replacement: 0x4c,
  layers: 0xffff,
  triggerMods: SHIFT,
  negativeMods: 0,
  suppressedMods: SHIFT,
  options: 0x87,
}

describe('key override byte format (protocol/key_override.py, "<HHHBBBB")', () => {
  it('is trigger, replacement and layers as 16-bit numbers, then four bytes', () => {
    const bytes = [0x2a, 0, 0x4c, 0, 0xff, 0xff, SHIFT, 0, SHIFT, 0x87]
    expect(encodeKeyOverride(shiftBksp)).toEqual(bytes)
    expect(decodeKeyOverride(bytes)).toEqual(shiftBksp)
  })
})

describe('readKeyOverrides and writeKeyOverride', () => {
  it('reads and writes entries with DYNAMIC_VIAL_KEY_OVERRIDE_GET/SET', async () => {
    const { fake, client } = setup(2)
    await writeKeyOverride(client, 1, shiftBksp)
    expect([...fake.transport.sent.at(-1)!.slice(0, 14)]).toEqual([0xfe, 0x0d, 0x06, 1, ...encodeKeyOverride(shiftBksp)])
    expect(await readKeyOverrides(client, 2)).toEqual([EMPTY_KEY_OVERRIDE, shiftBksp])
    expect([...fake.transport.sent.at(-1)!.slice(0, 4)]).toEqual([0xfe, 0x0d, 0x05, 1])
  })
})

describe('key overrides in backups', () => {
  it('saves the fields vial-gui saves, with key names', () => {
    expect(saveKeyOverride(shiftBksp, catalog)).toEqual({
      trigger: 'KC_BSPACE',
      replacement: 'KC_DELETE',
      layers: 0xffff,
      trigger_mods: SHIFT,
      negative_mod_mask: 0,
      suppressed_mods: SHIFT,
      options: 0x87,
    })
  })

  it('reads them back', () => {
    expect(loadSavedKeyOverride(saveKeyOverride(shiftBksp, catalog), catalog, () => {})).toEqual(shiftBksp)
  })

  it('gives up on entries it cannot read', () => {
    let unknown = 0
    const saved = saveKeyOverride(shiftBksp, catalog)
    expect(loadSavedKeyOverride({ ...saved, trigger: 'NOPE' }, catalog, () => unknown++)).toBeNull()
    expect(unknown).toBe(1)
    expect(loadSavedKeyOverride({ ...saved, options: 300 }, catalog, () => {})).toBeNull()
    expect(loadSavedKeyOverride({ trigger: 'KC_A' }, catalog, () => {})).toBeNull()
    expect(loadSavedKeyOverride([1, 2], catalog, () => {})).toBeNull()
  })
})

describe('describing key overrides', () => {
  it('says what an override does in plain words', () => {
    expect(describeKeyOverride(shiftBksp, catalog)).toBe('Shift + Backspace → Delete')
    expect(describeKeyOverride({ ...shiftBksp, options: 0x07 }, catalog)).toBe('Off: Shift + Backspace → Delete')
    expect(describeKeyOverride({ ...shiftBksp, triggerMods: 0b11, options: 0x8f }, catalog)).toBe(
      'Left Ctrl or Left Shift + Backspace → Delete',
    )
    expect(describeKeyOverride(EMPTY_KEY_OVERRIDE, catalog)).toBe('Not set up')
  })

  it('names modifiers once when both sides are chosen', () => {
    expect(describeMods(0b0001_0001 | 0b10)).toBe('Ctrl + Left Shift')
  })

  it('explains overrides that cannot work yet', () => {
    expect(keyOverrideProblem(EMPTY_KEY_OVERRIDE, 4)).toBeNull()
    expect(keyOverrideProblem(shiftBksp, 4)).toBeNull()
    expect(keyOverrideProblem({ ...shiftBksp, options: 0x07 }, 4)).toMatch(/turned off/)
    expect(keyOverrideProblem({ ...NEW_KEY_OVERRIDE, replacement: 0x4c }, 4)).toMatch(/key or modifiers/)
    expect(keyOverrideProblem({ ...shiftBksp, layers: 0b10000 }, 4)).toMatch(/layer/)
    expect(keyOverrideProblem({ ...shiftBksp, options: OPTION.enabled }, 4)).toMatch(/way for it to start/)
  })
})
