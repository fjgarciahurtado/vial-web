// SPDX-License-Identifier: GPL-2.0-or-later
import { FakeKeyboard } from './fake-keyboard'
import { loadKeyboard, type LoadedKeyboard } from './keyboard'
import { serializeMacros } from './macros'
import type { HidTransport } from './transport'

// 60% ANSI: [width, base-layer keycode, function-layer keycode]
type DemoKey = [number, number, number]
const ___ = 0x01 // KC_TRNS: same as the layer below

const ROWS: DemoKey[][] = [
  [[1, 0x29, 0x35], ...[0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x2d, 0x2e].map((k, i): DemoKey => [1, k, 0x3a + i]), [2, 0x2a, 0x4c]],
  [[1.5, 0x2b, ___], ...[0x14, 0x1a, 0x08, 0x15, 0x17, 0x1c, 0x18, 0x0c, 0x12, 0x13, 0x2f, 0x30].map((k): DemoKey => [1, k, ___]), [1.5, 0x31, ___]],
  [[1.75, 0x39, ___], ...[0x04, 0x16, 0x07, 0x09, 0x0a, 0x0b, 0x0d, 0x0e, 0x0f, 0x33, 0x34].map((k): DemoKey => [1, k, ___]), [2.25, 0x28, ___]],
  [[2.25, 0xe1, ___], ...[0x1d, 0x1b, 0x06, 0x19, 0x05, 0x11, 0x10, 0x36, 0x37, 0x38].map((k): DemoKey => [1, k, ___]), [2.75, 0xe5, 0x52]],
  [[1.25, 0xe0, ___], [1.25, 0xe3, ___], [1.25, 0xe2, ___], [6.25, 0x2c, ___], [1.25, 0xe6, 0x50], [1.25, 0xe7, 0x51], [1.25, 0x5221, ___], [1.25, 0xe4, 0x4f]],
]

/** Matrix column used by the extra key of the split backspace option. */
const SPLIT_COL = 14
const COLS = SPLIT_COL + 1

// KLE label helpers: the 4th label slot holds "layout,option", "e" in the 10th marks an encoder.
const option = (label: string, choice: number) => `${label}\n\n\n0,${choice}`
const encoder = (label: string) => `${label}\n\n\n\n\n\n\n\n\ne`

function kleRows(): unknown[][] {
  const rows = ROWS.map((row, r) => row.flatMap(([w], c): unknown[] => (w === 1 ? [`${r},${c}`] : [{ w }, `${r},${c}`])))
  // Backspace: one 2u key, or two 1u keys drawn beside the board, as vial.json files do.
  const backspaceCol = ROWS[0].length - 1
  rows[0][rows[0].length - 1] = option(`0,${backspaceCol}`, 0)
  rows[0].push({ x: 0.5, w: 1 }, option(`0,${backspaceCol}`, 1), option(`0,${SPLIT_COL}`, 1))
  // A volume knob above the top-right corner: one "key" per turn direction.
  return [[{ x: 13 }, encoder('0,0'), encoder('0,1')], ...rows]
}

/**
 * A pretend keyboard so people can explore the app before plugging one in.
 * It speaks the real protocol, so the demo uses exactly the same code as hardware.
 */
export async function openDemoKeyboard(): Promise<{
  transport: HidTransport
  keyboard: LoadedKeyboard
  fake: FakeKeyboard
}> {
  const fake = new FakeKeyboard({
    definition: {
      name: 'Demo 60% keyboard',
      matrix: { rows: ROWS.length, cols: COLS },
      layouts: { labels: ['Split Backspace'], keymap: kleRows() },
      lighting: 'vialrgb',
    },
    layers: 2,
    vialProtocol: 6,
    macroCount: 4,
    comboCount: 8,
    tapDanceCount: 4,
    keyOverrideCount: 4,
    macroMemory: 512,
    featureFlags: 0b11,
    encoders: 1,
    // Unlock by holding Esc and Enter. The demo holds them for you.
    unlockKeys: [
      { row: 0, col: 0 },
      { row: 2, col: 12 },
    ],
    holdPolls: 12,
    // Typical QMK defaults, as a recent Vial firmware reports them.
    qmkSettings: {
      1: 0, 2: 50, 3: 0, 4: 175, 5: 5, 6: 5000, 7: 200,
      9: 10, 10: 16, 11: 8, 12: 10, 13: 30, 14: 10, 15: 80, 16: 8, 17: 40,
      18: 0, 19: 80, 20: 5, 21: 0x80, 22: 0, 23: 0, 24: 0, 25: 200,
    },
  })

  const put = (layer: number, r: number, c: number, code: number) =>
    fake.keymap.set([code >> 8, code & 0xff], ((layer * ROWS.length + r) * COLS + c) * 2)
  ROWS.forEach((row, r) =>
    row.forEach(([, base, fn], c) => {
      put(0, r, c, base)
      put(1, r, c, fn)
    }),
  )
  put(0, 0, SPLIT_COL, 0x4c) // Delete
  put(1, 0, SPLIT_COL, ___)
  fake.encoders[0][0] = [0xaa, 0xa9] // Volume Down / Up
  fake.encoders[1][0] = [0xac, 0xab] // Previous / Next Track
  // Macro 1 signs off an email: types a greeting, presses Enter, types a name.
  fake.macroBuffer.set(
    serializeMacros(
      [
        [
          { type: 'text', text: 'Best regards,' },
          { type: 'tap', keys: [0x28] },
          { type: 'text', text: 'Alex' },
        ],
        [],
        [],
        [],
      ],
      6,
    ),
  )
  // Tap dance 1: tap for Escape, hold for Left Ctrl.
  fake.tapDances[0] = { onTap: 0x29, onHold: 0xe0, onDoubleTap: 0, onTapHold: 0, tappingTerm: 200 }
  // Key override 1: Shift + Backspace sends Delete, on every layer.
  fake.keyOverrides[0] = [0x2a, 0, 0x4c, 0, 0xff, 0xff, 0x22, 0, 0x22, 0x87]
  // Combo 1: press J and K together for Escape.
  fake.combos[0] = { keys: [0x0d, 0x0e, 0, 0], output: 0x29 }
  fake.vialrgb = { maxBrightness: 200, effects: [1, 2, 6, 13, 24, 29, 39], mode: 6, speed: 128, hsv: [150, 220, 160] }

  const keyboard = await loadKeyboard(fake.transport, 'Demo keyboard', { decompress: async (bytes) => bytes })
  return { transport: fake.transport, keyboard, fake }
}

/** HID usage codes for KeyboardEvent.code, enough to press every key on the demo board. */
const HID_USAGE: Record<string, number> = {
  Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b, Space: 0x2c, Minus: 0x2d, Equal: 0x2e,
  BracketLeft: 0x2f, BracketRight: 0x30, Backslash: 0x31, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
  Comma: 0x36, Period: 0x37, Slash: 0x38, CapsLock: 0x39, Delete: 0x4c, ContextMenu: 0x65,
  ControlLeft: 0xe0, ShiftLeft: 0xe1, AltLeft: 0xe2, MetaLeft: 0xe3,
  ControlRight: 0xe4, ShiftRight: 0xe5, AltRight: 0xe6, MetaRight: 0xe7,
}
for (let i = 0; i < 26; i++) HID_USAGE[`Key${String.fromCharCode(65 + i)}`] = 0x04 + i
for (let i = 1; i <= 9; i++) HID_USAGE[`Digit${i}`] = 0x1d + i
HID_USAGE.Digit0 = 0x27

/**
 * Presses or releases the demo switch that types this key on the main layer, so
 * the key tester can be tried with the computer's own keyboard.
 */
export function pressDemoKey(fake: FakeKeyboard, keymap: number[][][], code: string, down: boolean): void {
  const usage = HID_USAGE[code]
  if (usage === undefined) return
  keymap[0].forEach((row, r) =>
    row.forEach((keycode, c) => {
      if (keycode !== usage) return
      if (down) fake.pressed.add(`${r},${c}`)
      else fake.pressed.delete(`${r},${c}`)
    }),
  )
}
