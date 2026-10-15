// SPDX-License-Identifier: GPL-2.0-or-later
/** Live switch state for the key tester, ported from vial-gui editor/matrix_test.py. */
import type { VialClient } from './vial-client'

const VIAL_PROTOCOL_MATRIX_TESTER = 3

/** The whole matrix must fit in one 32-byte reply after its 2-byte header (matrix_test.py valid()). */
export function matrixTesterSupported(vialProtocol: number, rows: number, cols: number): boolean {
  return vialProtocol >= VIAL_PROTOCOL_MATRIX_TESTER && (Math.floor(cols / 8) + 1) * rows <= 28
}

/** matrix[row][col] is true while that switch is held down. All false while the keyboard is locked. */
export async function readMatrix(client: VialClient, rows: number, cols: number): Promise<boolean[][]> {
  const data = await client.getSwitchMatrix()
  const rowSize = Math.ceil(cols / 8)
  return Array.from({ length: rows }, (_, row) => {
    const start = row * rowSize
    return Array.from({ length: cols }, (_, col) => {
      // Each row is big-endian: its last byte holds columns 0-7.
      const byte = data[start + rowSize - 1 - Math.floor(col / 8)]
      return ((byte >> (col % 8)) & 1) === 1
    })
  })
}
