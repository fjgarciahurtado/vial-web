// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Tap dance: one key that does different things when tapped, held, double-tapped,
 * or tapped then held. Ported from protocol/tap_dance.py and editor/tap_dance.py
 * in vial-gui; what the firmware does with empty actions is in on_dance_finished()
 * in vial-qmk quantum/vial.c.
 */
import type { KeycodeCatalog } from './keycodes/catalog'
import { DYNAMIC_VIAL_TAP_DANCE_GET, DYNAMIC_VIAL_TAP_DANCE_SET, type VialClient } from './vial-client'

export interface TapDance {
  onTap: number
  onHold: number
  onDoubleTap: number
  onTapHold: number
  /** Milliseconds to wait for another tap, or for a press to count as held. */
  tappingTerm: number
}

export type TapDanceAction = 'onTap' | 'onHold' | 'onDoubleTap' | 'onTapHold'
export const TAP_DANCE_ACTIONS: TapDanceAction[] = ['onTap', 'onHold', 'onDoubleTap', 'onTapHold']

/** Limits of vial-gui's tapping term box. */
export const MAX_TAPPING_TERM = 10000

export const EMPTY_TAP_DANCE: TapDance = { onTap: 0, onHold: 0, onDoubleTap: 0, onTapHold: 0, tappingTerm: 200 }

/** Four keycodes then the tapping term, five little-endian 16-bit numbers ("<HHHHH"). */
export function encodeTapDance(td: TapDance): number[] {
  return [td.onTap, td.onHold, td.onDoubleTap, td.onTapHold, td.tappingTerm].flatMap((v) => [v & 0xff, (v >> 8) & 0xff])
}

export function decodeTapDance(bytes: ArrayLike<number>): TapDance {
  const [onTap, onHold, onDoubleTap, onTapHold, tappingTerm] = Array.from(
    { length: 5 },
    (_, i) => bytes[i * 2] | (bytes[i * 2 + 1] << 8),
  )
  return { onTap, onHold, onDoubleTap, onTapHold, tappingTerm }
}

export async function readTapDances(client: VialClient, count: number): Promise<TapDance[]> {
  const entries: TapDance[] = []
  for (let i = 0; i < count; i++) {
    try {
      entries.push(decodeTapDance(await client.getDynamicEntry(DYNAMIC_VIAL_TAP_DANCE_GET, i)))
    } catch {
      throw new Error(`The keyboard couldn't read tap dance ${i + 1}.`)
    }
  }
  return entries
}

export async function writeTapDance(client: VialClient, index: number, td: TapDance): Promise<void> {
  await client.setDynamicEntry(DYNAMIC_VIAL_TAP_DANCE_SET, index, encodeTapDance(td))
}

/** The .vil form: four key names and the tapping term as a number (save_tap_dance). */
export function saveTapDance(td: TapDance, catalog: KeycodeCatalog): (string | number)[] {
  return [...TAP_DANCE_ACTIONS.map((a) => catalog.serialize(td[a])), td.tappingTerm]
}

/**
 * Reads a tap dance saved by vial-gui or vial-web. Returns null, after counting each
 * key it can't read, when any part is unreadable, so the keyboard's own is kept.
 */
export function loadSavedTapDance(saved: unknown, catalog: KeycodeCatalog, onUnknown: () => void): TapDance | null {
  if (!Array.isArray(saved)) {
    onUnknown()
    return null
  }
  let readable = true
  const codes = TAP_DANCE_ACTIONS.map((_, i) => {
    const value: unknown = saved[i] ?? 0
    const code =
      typeof value === 'number'
        ? Number.isInteger(value) && value >= 0 && value <= 0xffff
          ? value
          : undefined
        : typeof value === 'string'
          ? catalog.deserialize(value)
          : undefined
    if (code === undefined) {
      readable = false
      onUnknown()
    }
    return code ?? 0
  })
  const term = saved[4]
  if (typeof term !== 'number' || !Number.isFinite(term)) return null
  if (!readable) return null
  const [onTap, onHold, onDoubleTap, onTapHold] = codes
  return { onTap, onHold, onDoubleTap, onTapHold, tappingTerm: clampTerm(term) }
}

export function clampTerm(ms: number): number {
  return Math.min(MAX_TAPPING_TERM, Math.max(0, Math.round(ms)))
}

export function isEmptyTapDance(td: TapDance): boolean {
  return TAP_DANCE_ACTIONS.every((a) => td[a] === 0)
}

/** "Tap: Escape, hold: Ctrl" */
export function describeTapDance(td: TapDance, catalog: KeycodeCatalog): string {
  if (isEmptyTapDance(td)) return 'Not set up'
  const labels: Record<TapDanceAction, string> = { onTap: 'tap', onHold: 'hold', onDoubleTap: 'double tap', onTapHold: 'tap + hold' }
  const parts = TAP_DANCE_ACTIONS.filter((a) => td[a]).map((a) => `${labels[a]}: ${catalog.describe(td[a]).name}`)
  const text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * What an empty action does instead, following on_dance_finished() in vial-qmk:
 * the keyboard falls back to the tap key. Null when the action is set or has no fallback.
 */
export function fallbackFor(td: TapDance, action: TapDanceAction, catalog: KeycodeCatalog): string | null {
  if (td[action] !== 0 || action === 'onTap') return null
  const tap = td.onTap ? catalog.describe(td.onTap).name : null
  const hold = td.onHold ? catalog.describe(td.onHold).name : null
  switch (action) {
    case 'onHold':
      return tap && `Holds ${tap}.`
    case 'onDoubleTap':
      return tap && `Types ${tap} twice.`
    case 'onTapHold':
      if (tap) return `Types ${tap}, then holds ${hold ?? tap}.`
      return hold && `Holds ${hold}.`
  }
}
