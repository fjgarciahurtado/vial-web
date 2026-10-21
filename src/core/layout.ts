// SPDX-License-Identifier: GPL-2.0-or-later
import { Serial } from '@ijprest/kle-serial'

export interface LayoutOptionRef {
  /** Which layout option (index into vial.json "layouts.labels"). */
  index: number
  /** Which choice of that option this key is drawn for. */
  option: number
}

interface Placed {
  x: number
  y: number
  w: number
  h: number
  rotation: { angle: number; x: number; y: number }
  /** Set when the key only appears for one choice of a layout option. */
  layout?: LayoutOptionRef
  decal?: boolean
}

export interface LayoutKey extends Placed {
  row: number
  col: number
}

export interface LayoutEncoder extends Placed {
  index: number
  /** 0 = counter-clockwise, 1 = clockwise. */
  direction: number
}

/**
 * Turns the KLE "keymap" from vial.json into positioned keys.
 * Label conventions match vial-gui protocol/keyboard_comm.py:
 * - top-left "row,col": matrix position
 * - center-right "e": encoder, top-left is "index,direction"
 * - bottom-right "layout,option": only shown when that layout option is chosen
 */
export function parseLayout(kle: unknown[]): { keys: LayoutKey[]; encoders: LayoutEncoder[] } {
  const keys: LayoutKey[] = []
  const encoders: LayoutEncoder[] = []

  for (const key of Serial.deserialize(kle).keys) {
    const placed: Placed = {
      x: key.x,
      y: key.y,
      w: key.width,
      h: key.height,
      rotation: { angle: key.rotation_angle, x: key.rotation_x, y: key.rotation_y },
    }
    if (key.labels[8]) {
      const [index, option] = key.labels[8].split(',').map(Number)
      placed.layout = { index, option }
    }
    if (key.decal) placed.decal = true

    const [a, b] = (key.labels[0] ?? '').split(',').map(Number)
    if (key.labels[4] === 'e') {
      encoders.push({ index: a, direction: b, ...placed })
    } else if (key.decal || key.labels[0]?.includes(',')) {
      keys.push({ row: Number.isNaN(a) ? 0 : a, col: Number.isNaN(b) ? 0 : b, ...placed })
    }
  }

  return { keys, encoders }
}

/**
 * Keeps the keys for the chosen layout options and moves them where they belong.
 * Ported from KeyboardWidget.place_widgets() in vial-gui: each chosen option is
 * shifted so its top-left corner lines up with option 0, decals are dropped, and
 * the whole board is moved to the top-left corner.
 */
export function placeKeys<T extends Placed>(items: T[], choices: number[]): T[] {
  const corner = new Map<string, { x: number; y: number }>()
  for (const item of items) {
    if (!item.layout) continue
    const id = `${item.layout.index},${item.layout.option}`
    const c = corner.get(id) ?? { x: Infinity, y: Infinity }
    corner.set(id, { x: Math.min(c.x, item.x), y: Math.min(c.y, item.y) })
  }

  const visible = items.flatMap((item) => {
    if (item.decal) return []
    if (!item.layout) return [item]
    const { index, option } = item.layout
    if (option !== (choices[index] ?? 0)) return []
    const chosen = corner.get(`${index},${option}`)!
    const base = corner.get(`${index},0`) ?? chosen
    return [shift(item, base.x - chosen.x, base.y - chosen.y)]
  })

  const left = Math.min(...visible.map((i) => i.x))
  const top = Math.min(...visible.map((i) => i.y))
  return visible.map((item) => shift(item, -left, -top))
}

/** The key after `from` in reading order (left to right, top to bottom), or null after the last one. */
export function nextKey(
  keys: LayoutKey[],
  choices: number[],
  from: { row: number; col: number },
): { kind: 'key'; row: number; col: number } | null {
  const order = numberKeys(keys, choices)
  const here = order.get(`${from.row},${from.col}`)
  if (here === undefined) return null
  for (const [id, n] of order) {
    if (n !== here + 1) continue
    const [row, col] = id.split(',').map(Number)
    return { kind: 'key', row, col }
  }
  return null
}

/**
 * Numbers the keys 1, 2, 3… in reading order: rows from the top, each row from the left.
 * MIDI pads are called "Pad 3" after these numbers. Keyed by "row,col".
 */
export function numberKeys(keys: LayoutKey[], choices: number[]): Map<string, number> {
  // A key less than half a key lower than the one before it stays in its row, so
  // staggered columns don't split it.
  const byHeight = placeKeys(keys, choices).sort((a, b) => a.y - b.y)
  const rows: LayoutKey[][] = []
  for (const key of byHeight) {
    const row = rows.at(-1)
    if (row && key.y - row.at(-1)!.y < 0.5) row.push(key)
    else rows.push([key])
  }
  const ordered = rows.flatMap((row) => row.sort((a, b) => a.x - b.x))
  return new Map(ordered.map((k, i) => [`${k.row},${k.col}`, i + 1]))
}

function shift<T extends Placed>(item: T, dx: number, dy: number): T {
  if (!dx && !dy) return item
  const { rotation } = item
  return { ...item, x: item.x + dx, y: item.y + dy, rotation: { ...rotation, x: rotation.x + dx, y: rotation.y + dy } }
}

export interface LayoutOption {
  title: string
  /** Names of each choice, or null for an on/off option. */
  choices: string[] | null
  /** How many bits the choice takes in the packed value. */
  bits: number
}

/** Reads vial.json "layouts.labels": a string is on/off, an array is [title, ...choices]. */
export function parseLayoutLabels(labels: unknown[] | undefined): LayoutOption[] {
  return (labels ?? []).map((label) => {
    if (typeof label === 'string') return { title: label, choices: null, bits: 1 }
    const [title, ...choices] = label as string[]
    return { title, choices, bits: Math.max(0, choices.length - 1).toString(2).replace(/^0$/, '').length }
  })
}

/** Packs choices into the 32-bit value the firmware stores; the first option takes the highest bits. */
export function packLayoutChoices(options: LayoutOption[], choices: number[]): number {
  return options.reduce((value, o, i) => value * 2 ** o.bits + ((choices[i] ?? 0) & (2 ** o.bits - 1)), 0) >>> 0
}

export function unpackLayoutChoices(options: LayoutOption[], value: number): number[] {
  const choices: number[] = []
  for (let i = options.length - 1; i >= 0; i--) {
    const size = 2 ** options[i].bits
    choices[i] = value % size
    value = Math.floor(value / size)
  }
  return choices
}
