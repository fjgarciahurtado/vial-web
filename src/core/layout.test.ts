// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { nextKey, numberKeys, packLayoutChoices, parseLayout, parseLayoutLabels, placeKeys, unpackLayoutChoices } from './layout'

// Vial marks encoders with "e" in the 10th label slot (see vial-gui test_keyboard.py)
const enc = (label: string) => `${label}\n\n\n\n\n\n\n\n\ne`
// Layout option "index,option" goes in the 4th label slot, which KLE stores bottom-right
const opt = (label: string, option: string) => `${label}\n\n\n${option}`

describe('parseLayout', () => {
  it('reads matrix positions from the top-left label', () => {
    const { keys } = parseLayout([['0,0', '0,1'], ['1,0']])
    expect(keys.map((k) => [k.row, k.col])).toEqual([[0, 0], [0, 1], [1, 0]])
    expect(keys[1]).toMatchObject({ x: 1, y: 0, w: 1, h: 1 })
  })

  it('keeps KLE widths and offsets', () => {
    const { keys } = parseLayout([[{ x: 0.5, w: 2 }, '0,0']])
    expect(keys[0]).toMatchObject({ x: 0.5, w: 2 })
  })

  it('separates encoders from keys', () => {
    const { keys, encoders } = parseLayout([['0,0', { x: 1 }, enc('0,0'), enc('0,1')]])
    expect(keys).toHaveLength(1)
    expect(encoders.map((e) => [e.index, e.direction])).toEqual([[0, 0], [0, 1]])
  })

  it('records which layout option a key belongs to', () => {
    const { keys } = parseLayout([['0,0', opt('0,1', '0,0'), opt('0,1', '0,1')]])
    expect(keys.map((k) => k.layout)).toEqual([undefined, { index: 0, option: 0 }, { index: 0, option: 1 }])
  })
})

describe('placeKeys', () => {
  // Backspace as one 2u key (option 0) or two 1u keys drawn further right (option 1)
  const { keys } = parseLayout([
    ['0,0', { w: 2 }, opt('0,1', '0,0'), { x: 1, w: 1 }, opt('0,1', '0,1'), opt('0,2', '0,1')],
  ])

  it('shows the default option', () => {
    const placed = placeKeys(keys, [0])
    expect(placed.map((k) => [k.col, k.x, k.w])).toEqual([[0, 0, 1], [1, 1, 2]])
  })

  it('moves the chosen option onto the default option’s place', () => {
    const placed = placeKeys(keys, [1])
    expect(placed.map((k) => [k.col, k.x])).toEqual([[0, 0], [1, 1], [2, 2]])
  })

  it('hides decals and moves everything to the top-left corner', () => {
    const { keys: withDecal } = parseLayout([[{ d: true }, 'decal', { x: 1 }, '0,0']])
    const placed = placeKeys(withDecal, [])
    expect(placed).toHaveLength(1)
    expect(placed[0].x).toBe(0)
  })
})

describe('layout option labels and choice bits (vial-gui layout_editor.py)', () => {
  const labels = parseLayoutLabels(['Split Backspace', ['Bottom row', 'ANSI', '7u', 'HHKB']])

  it('reads on/off and pick-one options', () => {
    expect(labels).toEqual([
      { title: 'Split Backspace', choices: null, bits: 1 },
      { title: 'Bottom row', choices: ['ANSI', '7u', 'HHKB'], bits: 2 },
    ])
  })

  it('packs the first option into the highest bits', () => {
    expect(packLayoutChoices(labels, [1, 2])).toBe(0b110)
    expect(unpackLayoutChoices(labels, 0b110)).toEqual([1, 2])
  })

  it('ignores bits above the known options', () => {
    expect(unpackLayoutChoices(labels, 0xff00 | 0b011)).toEqual([0, 3])
  })
})

describe('nextKey', () => {
  const { keys } = parseLayout([['1,1', '0,0'], ['0,1', '1,0']])

  it('follows reading order, across rows', () => {
    expect(nextKey(keys, [], { row: 1, col: 1 })).toEqual({ kind: 'key', row: 0, col: 0 })
    expect(nextKey(keys, [], { row: 0, col: 0 })).toEqual({ kind: 'key', row: 0, col: 1 })
  })

  it('returns null after the last key or for an unknown key', () => {
    expect(nextKey(keys, [], { row: 1, col: 0 })).toBeNull()
    expect(nextKey(keys, [], { row: 9, col: 9 })).toBeNull()
  })
})

describe('numberKeys', () => {
  it('numbers keys in reading order, rows top to bottom', () => {
    // Matrix order differs from where the keys are drawn.
    const { keys } = parseLayout([['1,1', '0,0'], ['0,1', '1,0']])
    expect([...numberKeys(keys, [])]).toEqual([
      ['1,1', 1],
      ['0,0', 2],
      ['0,1', 3],
      ['1,0', 4],
    ])
  })

  it('keeps staggered columns in one row', () => {
    // Column stagger, as on split keyboards: the second and third keys sit a little lower.
    const { keys } = parseLayout([['0,0', { y: 0.25 }, '0,1', { y: 0.25 }, '0,2'], [{ y: -0.5 }, '1,0', '1,1', '1,2']])
    expect([...numberKeys(keys, []).keys()]).toEqual(['0,0', '0,1', '0,2', '1,0', '1,1', '1,2'])
  })

  it('numbers only the keys of the chosen layout option', () => {
    const { keys } = parseLayout([['0,0', opt('0,1', '0,0'), opt('0,2', '0,1')]])
    expect([...numberKeys(keys, [1]).keys()]).toEqual(['0,0', '0,2'])
  })
})
