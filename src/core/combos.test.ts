// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import {
  comboProblem,
  decodeCombo,
  describeCombo,
  EMPTY_COMBO,
  encodeCombo,
  loadSavedCombo,
  readCombos,
  saveCombo,
  writeCombo,
  type Combo,
} from './combos'
import { FakeKeyboard } from './fake-keyboard'
import v6Data from './keycodes/data/keycodes-v6.json'
import { KeycodeCatalog, type KeycodeData } from './keycodes/catalog'
import { VialClient } from './vial-client'

const catalog = new KeycodeCatalog(v6Data as KeycodeData, { layers: 2, macroCount: 0, tapDanceCount: 0, features: new Set() })
const definition = { matrix: { rows: 1, cols: 1 }, layouts: { keymap: [['0,0']] } }
const setup = (comboCount = 4) => {
  const fake = new FakeKeyboard({ definition, layers: 1, comboCount })
  return { fake, client: new VialClient(fake.transport) }
}
// A + S gives Escape
const escCombo: Combo = { keys: [0x04, 0x16, 0, 0], output: 0x29 }

describe('combo byte format (protocol/combo.py, "<HHHHH")', () => {
  it('is four trigger keys then the result, little-endian', () => {
    expect(encodeCombo(escCombo)).toEqual([0x04, 0, 0x16, 0, 0, 0, 0, 0, 0x29, 0])
    expect(decodeCombo([0x04, 0, 0x16, 0, 0, 0, 0, 0, 0x29, 0])).toEqual(escCombo)
    expect(encodeCombo({ keys: [0x5221, 0, 0, 0], output: 0x7c00 }).slice(0, 2)).toEqual([0x21, 0x52])
  })
})

describe('readCombos and writeCombo', () => {
  it('reads every combo slot (reload_combo)', async () => {
    const { fake, client } = setup(3)
    fake.combos[1] = escCombo
    expect(await readCombos(client, 3)).toEqual([EMPTY_COMBO, escCombo, EMPTY_COMBO])
    const gets = fake.transport.sent.filter((r) => r[1] === 0x0d && r[2] === 0x03)
    expect(gets.map((r) => [...r.slice(0, 4)])).toEqual([
      [0xfe, 0x0d, 0x03, 0],
      [0xfe, 0x0d, 0x03, 1],
      [0xfe, 0x0d, 0x03, 2],
    ])
  })

  it('writes one combo (combo_set)', async () => {
    const { fake, client } = setup()
    await writeCombo(client, 2, escCombo)
    const set = fake.transport.sent.at(-1)!
    expect([...set.slice(0, 14)]).toEqual([0xfe, 0x0d, 0x04, 2, 0x04, 0, 0x16, 0, 0, 0, 0, 0, 0x29, 0])
    expect(fake.combos[2]).toEqual(escCombo)
  })

  it('reports a slot the keyboard could not read', async () => {
    const { client } = setup(1)
    await expect(readCombos(client, 2)).rejects.toThrow(/combo 2/)
  })
})

describe('combos in backups (save_combo / restore_combo)', () => {
  it('saves key names, as vial-gui does', () => {
    expect(saveCombo(escCombo, catalog)).toEqual(['KC_A', 'KC_S', 'KC_NO', 'KC_NO', 'KC_ESCAPE'])
  })

  it('reads key names and numbers back', () => {
    expect(loadSavedCombo(['KC_A', 'KC_S', 'KC_NO', 'KC_NO', 'KC_ESCAPE'], catalog, () => {})).toEqual(escCombo)
    expect(loadSavedCombo([4, 0x16, 0, 0, 0x29], catalog, () => {})).toEqual(escCombo)
  })

  it('counts names it cannot read and leaves those keys empty', () => {
    let unknown = 0
    expect(loadSavedCombo(['KC_A', 'NOPE', 'KC_NO', 'KC_NO', 'KC_B'], catalog, () => unknown++)).toEqual({
      keys: [0x04, 0, 0, 0],
      output: 0x05,
    })
    expect(unknown).toBe(1)
  })

  it('treats anything else as an empty combo', () => {
    expect(loadSavedCombo('nonsense', catalog, () => {})).toEqual(EMPTY_COMBO)
  })
})

describe('describing combos', () => {
  it('says what a combo does in plain words', () => {
    expect(describeCombo(escCombo, catalog)).toBe('A + S → Escape')
    expect(describeCombo(EMPTY_COMBO, catalog)).toBe('Not set up')
  })

  it('explains combos that cannot work yet', () => {
    expect(comboProblem(EMPTY_COMBO)).toBeNull()
    expect(comboProblem({ keys: [0x04, 0, 0, 0], output: 0x29 })).toMatch(/at least two keys/)
    expect(comboProblem({ keys: [0x04, 0x16, 0, 0], output: 0 })).toMatch(/what the combo does/)
    expect(comboProblem({ keys: [0x04, 0x04, 0, 0], output: 0x29 })).toMatch(/twice/)
    expect(comboProblem(escCombo)).toBeNull()
  })
})
