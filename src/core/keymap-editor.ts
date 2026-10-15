// SPDX-License-Identifier: GPL-2.0-or-later
import type { Keymap, VialClient } from './vial-client'

/** encoders[layer][index] = [counter-clockwise, clockwise] */
export type EncoderKeymap = [number, number][][]

/** Something that holds a keycode: a key, or one turn direction of a rotary encoder. */
export type Target =
  | { kind: 'key'; layer: number; row: number; col: number }
  | { kind: 'encoder'; layer: number; index: number; direction: number }

interface Change {
  target: Target
  before: number
  after: number
}

/**
 * Changes keys on the keyboard and remembers each change for undo and redo.
 * Every change is written straight to the keyboard, as in vial-gui
 * (set_key and set_encoder in protocol/keyboard_comm.py). Keymaps are replaced,
 * never mutated, so UI state libraries notice updates.
 */
export class KeymapEditor {
  keymap: Keymap
  encoders: EncoderKeymap
  private readonly client: VialClient
  /** Each undo step is one or more changes made together. */
  private past: Change[][] = []
  private future: Change[][] = []

  constructor(client: VialClient, keymap: Keymap, encoders: EncoderKeymap) {
    this.client = client
    this.keymap = keymap
    this.encoders = encoders
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  get(target: Target): number {
    return target.kind === 'key'
      ? this.keymap[target.layer][target.row][target.col]
      : this.encoders[target.layer][target.index][target.direction]
  }

  async set(target: Target, code: number): Promise<void> {
    await this.setMany([{ target, code }])
  }

  /**
   * Writes several changes as one undo step, such as restoring a backup. If a
   * write fails, the changes already written stay undoable and the error is rethrown.
   */
  async setMany(changes: { target: Target; code: number }[]): Promise<void> {
    const step: Change[] = []
    try {
      for (const { target, code } of changes) {
        const before = this.get(target)
        if (before === code) continue
        await this.write(target, code)
        step.push({ target, before, after: code })
      }
    } finally {
      if (step.length) {
        this.past.push(step)
        this.future = []
      }
    }
  }

  /** Returns what changed back; empty when there is nothing to undo. */
  async undo(): Promise<Target[]> {
    const step = this.past.at(-1)
    if (!step) return []
    for (const change of [...step].reverse()) await this.write(change.target, change.before)
    this.future.push(this.past.pop()!)
    return step.map((c) => c.target)
  }

  async redo(): Promise<Target[]> {
    const step = this.future.at(-1)
    if (!step) return []
    for (const change of step) await this.write(change.target, change.after)
    this.past.push(this.future.pop()!)
    return step.map((c) => c.target)
  }

  /** Layout options change how the keyboard is drawn, not what keys do, so they aren't undo steps. */
  async setLayoutOptions(value: number): Promise<void> {
    await this.client.setLayoutOptions(value)
  }

  private async write(target: Target, code: number): Promise<void> {
    if (target.kind === 'key') {
      const { layer, row, col } = target
      await this.client.setKeycode(layer, row, col, code)
      this.keymap = replaceAt(this.keymap, [layer, row, col], code)
    } else {
      const { layer, index, direction } = target
      await this.client.setEncoder(layer, index, direction, code)
      this.encoders = replaceAt(this.encoders, [layer, index, direction], code)
    }
  }
}

/** Copies only the arrays along the path to the changed value. */
function replaceAt<T extends unknown[]>(grid: T, [i, ...rest]: number[], value: number): T {
  const copy = [...grid] as T
  copy[i] = rest.length ? replaceAt(grid[i] as unknown[], rest, value) : value
  return copy
}
