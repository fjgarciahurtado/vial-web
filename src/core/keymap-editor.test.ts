// SPDX-License-Identifier: GPL-2.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { FakeKeyboard } from './fake-keyboard'
import { KeymapEditor, type Target } from './keymap-editor'
import { VialClient } from './vial-client'

const definition = { matrix: { rows: 1, cols: 2 }, layouts: { keymap: [['0,0', '0,1']] } }
const KC_A = 0x04
const KC_B = 0x05
const KC_C = 0x06
const KC_VOLU = 0xa9
const key = (layer: number, col: number): Target => ({ kind: 'key', layer, row: 0, col })
const knob = (layer: number, direction: number): Target => ({ kind: 'encoder', layer, index: 0, direction })

describe('KeymapEditor', () => {
  let fake: FakeKeyboard
  let editor: KeymapEditor

  beforeEach(() => {
    fake = new FakeKeyboard({ definition, layers: 2, encoders: 1 })
    editor = new KeymapEditor(
      new VialClient(fake.transport),
      [[[KC_A, KC_B]], [[0x01, 0x01]]],
      [[[0, 0]], [[0, 0]]],
    )
  })

  it('writes a new key to the keyboard and its own keymap', async () => {
    await editor.set(key(1, 1), KC_C)
    expect(fake.keycodeAt(1, 0, 1)).toBe(KC_C)
    expect(editor.get(key(1, 1))).toBe(KC_C)
  })

  it('writes encoder turns separately for each direction', async () => {
    await editor.set(knob(0, 1), KC_VOLU)
    expect(fake.encoders[0][0]).toEqual([0, KC_VOLU])
    expect(editor.encoders[0][0]).toEqual([0, KC_VOLU])
  })

  it('leaves earlier keymap objects untouched so React sees a change', async () => {
    const before = editor.keymap
    await editor.set(key(0, 0), KC_C)
    expect(editor.keymap).not.toBe(before)
    expect(before[0][0][0]).toBe(KC_A)
  })

  it('skips the write when the key already has that code', async () => {
    await editor.set(key(0, 0), KC_A)
    expect(fake.transport.sent).toHaveLength(0)
    expect(editor.canUndo).toBe(false)
  })

  it('undoes and redoes changes on the keyboard', async () => {
    await editor.set(key(0, 0), KC_C)
    await editor.set(knob(0, 0), KC_C)

    await editor.undo()
    expect(fake.encoders[0][0][0]).toBe(0)
    await editor.undo()
    expect(fake.keycodeAt(0, 0, 0)).toBe(KC_A)
    expect(editor.canUndo).toBe(false)

    await editor.redo()
    expect(fake.keycodeAt(0, 0, 0)).toBe(KC_C)
    expect(editor.canRedo).toBe(true)
  })

  it('forgets redo steps after a new change', async () => {
    await editor.set(key(0, 0), KC_C)
    await editor.undo()
    await editor.set(key(0, 1), KC_A)
    expect(editor.canRedo).toBe(false)
  })

  it('tells undo/redo which key changed so the UI can follow it', async () => {
    await editor.set(key(1, 1), KC_C)
    expect(await editor.undo()).toEqual([key(1, 1)])
  })

  it('keeps its keymap unchanged when the write fails', async () => {
    const failing = new KeymapEditor(
      new VialClient({ send: () => Promise.reject(new Error('unplugged')), close: async () => {} }),
      [[[KC_A, KC_B]]],
      [],
    )
    await expect(failing.set(key(0, 0), KC_C)).rejects.toThrow('unplugged')
    expect(failing.get(key(0, 0))).toBe(KC_A)
    expect(failing.canUndo).toBe(false)
  })

  it('saves layout options without adding an undo step', async () => {
    await editor.setLayoutOptions(0b10)
    expect(fake.layoutOptions).toBe(0b10)
    expect(editor.canUndo).toBe(false)
  })

  it('applies many changes as one undo step', async () => {
    await editor.setMany([
      { target: key(0, 0), code: KC_C },
      { target: key(0, 1), code: KC_B }, // unchanged, skipped
      { target: knob(1, 0), code: KC_VOLU },
    ])
    expect(fake.keycodeAt(0, 0, 0)).toBe(KC_C)
    expect(fake.encoders[1][0][0]).toBe(KC_VOLU)
    expect(fake.transport.sent).toHaveLength(2)

    await editor.undo()
    expect(fake.keycodeAt(0, 0, 0)).toBe(KC_A)
    expect(fake.encoders[1][0][0]).toBe(0)
    expect(editor.canUndo).toBe(false)
  })

  it('keeps what a batch already wrote undoable when it fails halfway', async () => {
    let writes = 0
    const flaky = new KeymapEditor(
      new VialClient({
        send: async (r) => {
          if (++writes > 1) throw new Error('unplugged')
          return r
        },
        close: async () => {},
      }),
      [[[KC_A, KC_B]]],
      [],
    )
    await expect(
      flaky.setMany([
        { target: key(0, 0), code: KC_C },
        { target: key(0, 1), code: KC_C },
      ]),
    ).rejects.toThrow('unplugged')
    expect(flaky.get(key(0, 0))).toBe(KC_C)
    expect(flaky.canUndo).toBe(true)
  })
})

