// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Macros: sequences of typed text, key presses and pauses that the keyboard
 * plays back. Byte format ported from vial-gui macro/macro_action.py and
 * protocol/macro.py, including QMK's SEND_STRING escape codes.
 */
import type { KeycodeCatalog } from './keycodes/catalog'

export type MacroAction =
  | { type: 'text'; text: string }
  /** tap = press and release; down / up = hold or let go, for shortcuts like Ctrl + C. */
  | { type: 'tap' | 'down' | 'up'; keys: number[] }
  | { type: 'delay'; ms: number }

export type Macro = MacroAction[]

const SS_QMK_PREFIX = 1
const SS_TAP_CODE = 1
const SS_DOWN_CODE = 2
const SS_UP_CODE = 3
const SS_DELAY_CODE = 4
const VIAL_MACRO_EXT_TAP = 5
const VIAL_MACRO_EXT_DOWN = 6
const VIAL_MACRO_EXT_UP = 7
/** From protocol 2, every escape starts with SS_QMK_PREFIX, and delays and 16-bit keycodes exist. */
const VIAL_PROTOCOL_ADVANCED_MACROS = 2

/** Longest pause a macro step can store. */
export const MAX_DELAY_MS = 254 + 254 * 255

const KEY_CODES = { tap: SS_TAP_CODE, down: SS_DOWN_CODE, up: SS_UP_CODE } as const
const KEY_TYPES = { [SS_TAP_CODE]: 'tap', [SS_DOWN_CODE]: 'down', [SS_UP_CODE]: 'up' } as const
const EXT_TO_BASIC: Record<number, number> = {
  [VIAL_MACRO_EXT_TAP]: SS_TAP_CODE,
  [VIAL_MACRO_EXT_DOWN]: SS_DOWN_CODE,
  [VIAL_MACRO_EXT_UP]: SS_UP_CODE,
}

export function serializeMacro(macro: Macro, vialProtocol: number): Uint8Array {
  const advanced = vialProtocol >= VIAL_PROTOCOL_ADVANCED_MACROS
  const out: number[] = []
  for (const action of macro) {
    if (action.type === 'text') {
      out.push(...new TextEncoder().encode(action.text))
    } else if (action.type === 'delay') {
      if (!advanced) throw new Error('This keyboard firmware is too old for pauses in macros.')
      // Each byte holds 1-255 (0 would end the macro), so delays go up to 254 + 254 * 255 ms.
      const ms = Math.min(MAX_DELAY_MS, Math.max(0, Math.round(action.ms)))
      out.push(SS_QMK_PREFIX, SS_DELAY_CODE, (ms % 255) + 1, Math.floor(ms / 255) + 1)
    } else {
      for (const kc of action.keys) {
        if (advanced) out.push(SS_QMK_PREFIX)
        if (kc < 256) {
          out.push(KEY_CODES[action.type], kc)
        } else {
          // Zero bytes end a macro, so QMK stores 0xNN00 as 0xFFNN (decode_keycode in QMK).
          const value = kc % 256 === 0 ? 0xff00 | (kc >> 8) : kc
          out.push(KEY_CODES[action.type] + 4, value & 0xff, value >> 8)
        }
      }
    }
  }
  return Uint8Array.from(out)
}

export function deserializeMacro(data: Uint8Array, vialProtocol: number): Macro {
  return vialProtocol >= VIAL_PROTOCOL_ADVANCED_MACROS ? deserializeV2(data) : deserializeV1(data)
}

/** Adds a key to the previous action when it's the same kind, as vial-gui does. */
function pushKey(out: Macro, type: 'tap' | 'down' | 'up', kc: number) {
  const last = out.at(-1)
  if (last && last.type === type) last.keys.push(kc)
  else out.push({ type, keys: [kc] })
}

/** vial-gui reads each byte as one character, which matches QMK's ASCII-only SEND_STRING. */
function pushChar(out: Macro, byte: number) {
  const last = out.at(-1)
  if (last?.type === 'text') last.text += String.fromCharCode(byte)
  else out.push({ type: 'text', text: String.fromCharCode(byte) })
}

function deserializeV1(data: Uint8Array): Macro {
  const out: Macro = []
  for (let i = 0; i < data.length; ) {
    const type = KEY_TYPES[data[i] as keyof typeof KEY_TYPES]
    if (type) {
      if (i + 1 >= data.length) break
      pushKey(out, type, data[i + 1])
      i += 2
    } else {
      pushChar(out, data[i])
      i += 1
    }
  }
  return out
}

function deserializeV2(data: Uint8Array): Macro {
  const out: Macro = []
  for (let i = 0; i < data.length; ) {
    if (data[i] !== SS_QMK_PREFIX) {
      pushChar(out, data[i])
      i += 1
      continue
    }
    if (i + 1 >= data.length) break
    const act = data[i + 1]
    if (KEY_TYPES[act as keyof typeof KEY_TYPES]) {
      if (i + 2 >= data.length) break
      pushKey(out, KEY_TYPES[act as keyof typeof KEY_TYPES], data[i + 2])
      i += 3
    } else if (EXT_TO_BASIC[act]) {
      if (i + 3 >= data.length) break
      let kc = data[i + 2] | (data[i + 3] << 8)
      if (kc > 0xff00) kc = (kc & 0xff) << 8
      pushKey(out, KEY_TYPES[EXT_TO_BASIC[act] as keyof typeof KEY_TYPES], kc)
      i += 4
    } else if (act === SS_DELAY_CODE) {
      if (i + 3 >= data.length) break
      out.push({ type: 'delay', ms: data[i + 2] - 1 + (data[i + 3] - 1) * 255 })
      i += 4
    } else {
      i += 2 // malformed: skip it, as vial-gui does
    }
  }
  return out
}

/** All macros as the firmware stores them: each one ends with a zero byte. */
export function serializeMacros(macros: Macro[], vialProtocol: number): Uint8Array {
  const parts = macros.map((m) => serializeMacro(m, vialProtocol))
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length + 1, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length + 1
  }
  return out
}

/** Splits the buffer at zero bytes into exactly `count` macros. */
export function deserializeMacros(buffer: Uint8Array, count: number, vialProtocol: number): Macro[] {
  const macros: Macro[] = []
  let start = 0
  for (let n = 0; n < count; n++) {
    let end = buffer.indexOf(0, start)
    if (end === -1) end = buffer.length
    macros.push(start < buffer.length ? deserializeMacro(buffer.subarray(start, end), vialProtocol) : [])
    start = end + 1
  }
  return macros
}

/** Bytes these macros need in the keyboard's macro memory. */
export function macroSize(macros: Macro[], vialProtocol: number): number {
  return serializeMacros(macros, vialProtocol).length
}

type SavedAction = (string | number)[]

/** The .vil form of one macro: ["text", "hi"], ["tap", "KC_A"], ["delay", 100]... */
export function saveMacro(macro: Macro, catalog: KeycodeCatalog): SavedAction[] {
  return macro.map((a) =>
    a.type === 'text' ? ['text', a.text] : a.type === 'delay' ? ['delay', a.ms] : [a.type, ...a.keys.map((k) => catalog.serialize(k))],
  )
}

/** Reads one .vil macro. onUnknownKey is called for each key name the catalogue doesn't know. */
export function loadSavedMacro(saved: unknown[], catalog: KeycodeCatalog, onUnknownKey?: () => void): Macro {
  const out: Macro = []
  for (const item of saved) {
    if (!Array.isArray(item)) continue
    const [tag, ...args] = item
    if (tag === 'text' && typeof args[0] === 'string') out.push({ type: 'text', text: args[0] })
    else if (tag === 'delay' && typeof args[0] === 'number') out.push({ type: 'delay', ms: args[0] })
    else if (tag === 'tap' || tag === 'down' || tag === 'up') {
      const keys = args.map((k) => (typeof k === 'number' ? k : catalog.deserialize(String(k))))
      keys.filter((k) => k === undefined).forEach(() => onUnknownKey?.())
      out.push({ type: tag, keys: keys.filter((k): k is number => k !== undefined) })
    }
  }
  return out
}

/**
 * Why a macro can't be written to the keyboard as it is, or null when it can.
 * Covers what the editor already prevents, for macros that come from elsewhere such as backups.
 */
export function macroProblem(macro: Macro): string | null {
  for (const action of macro) {
    if (action.type === 'text') {
      const problem = macroTextProblem(action.text)
      if (problem) return problem
    } else if (action.type === 'delay') {
      if (!Number.isInteger(action.ms) || action.ms < 0 || action.ms > MAX_DELAY_MS) {
        return `A pause of ${action.ms} ms can't be stored; pauses go from 0 to ${MAX_DELAY_MS} ms.`
      }
    } else if (action.keys.some((k) => !Number.isInteger(k) || k < 0 || k > 0xffff)) {
      return 'A key in this macro is not a valid keycode.'
    }
  }
  return null
}

/** One sentence about what a macro does, for lists and screen readers. */
export function describeMacro(macro: Macro, catalog: KeycodeCatalog): string {
  if (macro.length === 0) return 'Does nothing yet'
  const names = (keys: number[]) => keys.map((k) => catalog.describe(k).name).join(', ')
  const parts = macro.map((a) => {
    switch (a.type) {
      case 'text':
        return `types “${a.text.replaceAll('\n', '⏎')}”`
      case 'tap':
        return `presses ${names(a.keys)}`
      case 'down':
        return `holds ${names(a.keys)}`
      case 'up':
        return `lets go of ${names(a.keys)}`
      case 'delay':
        return `waits ${a.ms >= 1000 || a.ms % 100 === 0 ? `${a.ms / 1000} s` : `${a.ms} ms`}`
    }
  })
  const sentence = parts.join(', ')
  return sentence[0].toUpperCase() + sentence.slice(1)
}

/**
 * Keyboards type macro text through QMK's SEND_STRING, which only knows the
 * characters on a US keyboard. Returns a message about the first other one, or null.
 */
export function macroTextProblem(text: string): string | null {
  const bad = [...text].find((c) => !/[\x20-\x7e\n\t]/.test(c))
  return bad ? `Keyboards can only type letters, numbers and symbols from a US keyboard, so “${bad}” won't work. Use a separate key step for it instead.` : null
}

