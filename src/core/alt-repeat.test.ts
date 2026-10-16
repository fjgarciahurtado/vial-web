// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import {
  altRepeatProblem,
  AREP_OPTION,
  decodeAltRepeat,
  describeAltRepeat,
  EMPTY_ALT_REPEAT,
  encodeAltRepeat,
  loadSavedAltRepeat,
  NEW_ALT_REPEAT,
  readAltRepeats,
  saveAltRepeat,
  writeAltRepeat,
  type AltRepeat,
} from './alt-repeat'
import { FakeKeyboard } from './fake-keyboard'
import v6Data from './keycodes/data/keycodes-v6.json'
import { KeycodeCatalog, type KeycodeData } from './keycodes/catalog'
import { VialClient } from './vial-client'

const catalog = new KeycodeCatalog(v6Data as KeycodeData, { layers: 2, macroCount: 0, tapDanceCount: 0, features: new Set() })
const definition = { matrix: { rows: 1, cols: 1 }, layouts: { keymap: [['0,0']] } }
// After Up, Alt Repeat sends Down, and the other way round; Shift may be held.
const upDown: AltRepeat = { keycode: 0x52, altKeycode: 0x51, allowedMods: 0x22, options: 0b1010 }

describe('alt repeat byte format (protocol/alt_repeat_key.py, "<HHBB")', () => {
  it('is the key and alt key as 16-bit numbers, then allowed mods and options', () => {
    expect(encodeAltRepeat(upDown)).toEqual([0x52, 0, 0x51, 0, 0x22, 0b1010])
    expect(decodeAltRepeat([0x52, 0, 0x51, 0, 0x22, 0b1010])).toEqual(upDown)
  })
})

describe('readAltRepeats and writeAltRepeat', () => {
  it('reads and writes entries with DYNAMIC_VIAL_ALT_REPEAT_KEY_GET/SET', async () => {
    const fake = new FakeKeyboard({ definition, layers: 1, altRepeatKeyCount: 2 })
    const client = new VialClient(fake.transport)
    await writeAltRepeat(client, 1, upDown)
    expect([...fake.transport.sent.at(-1)!.slice(0, 10)]).toEqual([0xfe, 0x0d, 0x08, 1, ...encodeAltRepeat(upDown)])
    expect(await readAltRepeats(client, 2)).toEqual([EMPTY_ALT_REPEAT, upDown])
    expect([...fake.transport.sent.at(-1)!.slice(0, 4)]).toEqual([0xfe, 0x0d, 0x07, 1])
  })
})

describe('alt repeat keys in backups', () => {
  it('saves the fields vial-gui saves, with key names', () => {
    expect(saveAltRepeat(upDown, catalog)).toEqual({ keycode: 'KC_UP', alt_keycode: 'KC_DOWN', allowed_mods: 0x22, options: 0b1010 })
  })

  it('reads them back, and gives up on what it cannot read', () => {
    const saved = saveAltRepeat(upDown, catalog)
    expect(loadSavedAltRepeat(saved, catalog, () => {})).toEqual(upDown)
    let unknown = 0
    expect(loadSavedAltRepeat({ ...saved, alt_keycode: 'NOPE' }, catalog, () => unknown++)).toBeNull()
    expect(unknown).toBe(1)
    expect(loadSavedAltRepeat({ ...saved, options: 256 }, catalog, () => {})).toBeNull()
    expect(loadSavedAltRepeat('x', catalog, () => {})).toBeNull()
  })
})

describe('describing alt repeat keys', () => {
  it('says what a pair does in plain words', () => {
    expect(describeAltRepeat(upDown, catalog)).toBe('Up arrow ↔ Down arrow')
    expect(describeAltRepeat({ ...upDown, options: AREP_OPTION.enabled }, catalog)).toBe('Up arrow → Down arrow')
    expect(describeAltRepeat({ ...upDown, options: 0 }, catalog)).toBe('Off: Up arrow → Down arrow')
    expect(describeAltRepeat(EMPTY_ALT_REPEAT, catalog)).toBe('Not set up')
  })

  it('explains pairs that cannot work yet', () => {
    expect(altRepeatProblem(EMPTY_ALT_REPEAT)).toBeNull()
    expect(altRepeatProblem(upDown)).toBeNull()
    expect(altRepeatProblem({ ...upDown, options: 0 })).toMatch(/turned off/)
    expect(altRepeatProblem({ ...NEW_ALT_REPEAT, keycode: 0x52 })).toMatch(/what Alt Repeat sends/)
    expect(altRepeatProblem({ ...NEW_ALT_REPEAT, altKeycode: 0x51 })).toMatch(/last key/)
    // A default pair needs no key: it answers to anything else.
    expect(altRepeatProblem({ ...NEW_ALT_REPEAT, altKeycode: 0x51, options: AREP_OPTION.enabled | AREP_OPTION.defaultToThis })).toBeNull()
  })
})
