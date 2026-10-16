// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { FakeKeyboard } from './fake-keyboard'
import v6Data from './keycodes/data/keycodes-v6.json'
import { KeycodeCatalog, type KeycodeData } from './keycodes/catalog'
import {
  decodeTapDance,
  describeTapDance,
  EMPTY_TAP_DANCE,
  encodeTapDance,
  fallbackFor,
  loadSavedTapDance,
  readTapDances,
  saveTapDance,
  writeTapDance,
  type TapDance,
} from './tap-dance'
import { VialClient } from './vial-client'

const catalog = new KeycodeCatalog(v6Data as KeycodeData, { layers: 2, macroCount: 0, tapDanceCount: 0, features: new Set() })
const definition = { matrix: { rows: 1, cols: 1 }, layouts: { keymap: [['0,0']] } }
const setup = (tapDanceCount = 4) => {
  const fake = new FakeKeyboard({ definition, layers: 1, tapDanceCount })
  return { fake, client: new VialClient(fake.transport) }
}
// Tap for Escape, hold for Left Control, 180 ms.
const escCtrl: TapDance = { onTap: 0x29, onHold: 0xe0, onDoubleTap: 0, onTapHold: 0, tappingTerm: 180 }

describe('tap dance byte format (protocol/tap_dance.py, "<HHHHH")', () => {
  it('is four keycodes then the tapping term, little-endian', () => {
    expect(encodeTapDance(escCtrl)).toEqual([0x29, 0, 0xe0, 0, 0, 0, 0, 0, 180, 0])
    expect(decodeTapDance([0x29, 0, 0xe0, 0, 0, 0, 0, 0, 180, 0])).toEqual(escCtrl)
    expect(encodeTapDance({ ...escCtrl, tappingTerm: 1000 }).slice(8)).toEqual([0xe8, 0x03])
  })
})

describe('readTapDances and writeTapDance', () => {
  it('reads every tap dance (reload_tap_dance)', async () => {
    const { fake, client } = setup(2)
    fake.tapDances[1] = escCtrl
    expect(await readTapDances(client, 2)).toEqual([fake.tapDances[0], escCtrl])
    const gets = fake.transport.sent.filter((r) => r[1] === 0x0d && r[2] === 0x01)
    expect(gets.map((r) => [...r.slice(0, 4)])).toEqual([
      [0xfe, 0x0d, 0x01, 0],
      [0xfe, 0x0d, 0x01, 1],
    ])
  })

  it('writes one tap dance (tap_dance_set)', async () => {
    const { fake, client } = setup()
    await writeTapDance(client, 3, escCtrl)
    expect([...fake.transport.sent.at(-1)!.slice(0, 14)]).toEqual([0xfe, 0x0d, 0x02, 3, 0x29, 0, 0xe0, 0, 0, 0, 0, 0, 180, 0])
    expect(fake.tapDances[3]).toEqual(escCtrl)
  })
})

describe('tap dances in backups (save_tap_dance / restore_tap_dance)', () => {
  it('saves key names and the tapping term as a number, as vial-gui does', () => {
    expect(saveTapDance(escCtrl, catalog)).toEqual(['KC_ESCAPE', 'KC_LCTRL', 'KC_NO', 'KC_NO', 180])
  })

  it('reads them back', () => {
    expect(loadSavedTapDance(['KC_ESCAPE', 'KC_LCTRL', 'KC_NO', 'KC_NO', 180], catalog, () => {})).toEqual(escCtrl)
  })

  it('keeps the tapping term within limits', () => {
    expect(loadSavedTapDance(['KC_A', 'KC_NO', 'KC_NO', 'KC_NO', 99999], catalog, () => {})?.tappingTerm).toBe(10000)
  })

  it('gives up on entries it cannot read', () => {
    let unknown = 0
    expect(loadSavedTapDance(['KC_A', 'NOPE', 'KC_NO', 'KC_NO', 200], catalog, () => unknown++)).toBeNull()
    expect(unknown).toBe(1)
    expect(loadSavedTapDance(['KC_A', 'KC_NO', 'KC_NO', 'KC_NO', 'x'], catalog, () => {})).toBeNull()
    expect(loadSavedTapDance(null, catalog, () => {})).toBeNull()
  })
})

describe('describing tap dances', () => {
  it('says what each action does in plain words', () => {
    expect(describeTapDance(escCtrl, catalog)).toBe('Tap: Escape, hold: Left Ctrl')
    expect(describeTapDance(EMPTY_TAP_DANCE, catalog)).toBe('Not set up')
  })

  it('explains what empty actions do instead (on_dance_finished in vial.c)', () => {
    const tapOnly = { ...EMPTY_TAP_DANCE, onTap: 0x04 }
    expect(fallbackFor(tapOnly, 'onHold', catalog)).toBe('Holds A.')
    expect(fallbackFor(tapOnly, 'onDoubleTap', catalog)).toBe('Types A twice.')
    expect(fallbackFor(escCtrl, 'onTapHold', catalog)).toBe('Types Escape, then holds Left Ctrl.')
    expect(fallbackFor(escCtrl, 'onHold', catalog)).toBeNull()
    expect(fallbackFor(EMPTY_TAP_DANCE, 'onHold', catalog)).toBeNull()
  })
})
