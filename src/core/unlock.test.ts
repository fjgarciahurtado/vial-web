// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { FakeKeyboard } from './fake-keyboard'
import { unlockKeyboard } from './unlock'
import { VialClient } from './vial-client'

const definition = { matrix: { rows: 3, cols: 3 }, layouts: { keymap: [['0,0']] } }
const fake = (options: { unlocked?: boolean; holdPolls?: number } = {}) =>
  new FakeKeyboard({ definition, layers: 1, unlockKeys: [{ row: 0, col: 0 }, { row: 2, col: 1 }], ...options })

describe('VialClient unlock commands (unlocker.py, keyboard_comm.py)', () => {
  it('reads the lock state and the keys to hold', async () => {
    const status = await new VialClient(fake().transport).getUnlockStatus()
    expect(status).toEqual({ unlocked: false, inProgress: false, keys: [{ row: 0, col: 0 }, { row: 2, col: 1 }] })
  })

  it('locks the keyboard again', async () => {
    const kb = fake({ unlocked: true })
    await new VialClient(kb.transport).lock()
    expect(kb.unlocked).toBe(false)
  })
})

describe('unlockKeyboard', () => {
  it('does nothing when the keyboard is already unlocked', async () => {
    const kb = fake({ unlocked: true })
    await unlockKeyboard(new VialClient(kb.transport), { onStart() {}, onProgress() {}, intervalMs: 0 })
    expect(kb.transport.sent.some((r) => r[0] === 0xfe && r[1] === 0x06)).toBe(false)
  })

  it('starts unlocking, reports progress while keys are held, and finishes', async () => {
    const kb = fake({ holdPolls: 3 })
    const progress: number[] = []
    let keys: unknown = null
    await unlockKeyboard(new VialClient(kb.transport), {
      onStart: (k) => (keys = k),
      onProgress: (p) => progress.push(p),
      intervalMs: 0,
    })
    expect(keys).toEqual([{ row: 0, col: 0 }, { row: 2, col: 1 }])
    expect(progress.at(-1)).toBe(1)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))
    expect(kb.unlocked).toBe(true)
  })

  it('picks up an unlock that was already in progress without restarting it', async () => {
    const kb = fake({ holdPolls: 2 })
    kb.unlockInProgress = true
    await unlockKeyboard(new VialClient(kb.transport), { onStart() {}, onProgress() {}, intervalMs: 0 })
    expect(kb.transport.sent.some((r) => r[0] === 0xfe && r[1] === 0x06)).toBe(false)
    expect(kb.unlocked).toBe(true)
  })
})
