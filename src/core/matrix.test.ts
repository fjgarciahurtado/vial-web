// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { FakeKeyboard } from './fake-keyboard'
import { matrixTesterSupported, readMatrix } from './matrix'
import { VialClient } from './vial-client'

const definition = { matrix: { rows: 2, cols: 10 }, layouts: { keymap: [['0,0']] } }

describe('matrixTesterSupported (matrix_test.py valid())', () => {
  it('needs Vial protocol 3 and a matrix that fits one report', () => {
    expect(matrixTesterSupported(3, 5, 15)).toBe(true)
    expect(matrixTesterSupported(2, 5, 15)).toBe(false)
    expect(matrixTesterSupported(6, 15, 15)).toBe(false) // (15 // 8 + 1) * 15 = 30 > 28
  })
})

describe('readMatrix', () => {
  it('decodes which switches are down, with columns 0-7 in the last byte of each row', async () => {
    const fake = new FakeKeyboard({ definition, layers: 1, unlocked: true })
    fake.pressed.add('0,0').add('0,9').add('1,3')
    const matrix = await readMatrix(new VialClient(fake.transport), 2, 10)
    const down = matrix.flatMap((row, r) => row.flatMap((on, c) => (on ? [`${r},${c}`] : [])))
    expect(down).toEqual(['0,0', '0,9', '1,3'])
  })

  it('reports nothing pressed while the keyboard is locked, as the firmware does', async () => {
    const fake = new FakeKeyboard({ definition, layers: 1 })
    fake.pressed.add('0,0')
    const matrix = await readMatrix(new VialClient(fake.transport), 2, 10)
    expect(matrix.flat().some(Boolean)).toBe(false)
  })
})
