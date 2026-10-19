// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Phrases: macros that play notes, as Musician mode edits them. Each step holds its
 * notes down for a while, then lets go; a step with no notes is a rest.
 *
 * A macro can press MIDI keys because Vial runs every 16-bit key in a macro through
 * QMK's normal key handling (vial_keycode_down() in vial-qmk quantum/vial.c), the same
 * way a pad does. A macro plays to the end on its own, so its notes last as long as the
 * phrase says, not as long as the pad is held.
 */
import { MAX_DELAY_MS, type Macro, type MacroAction } from './macros'
import { keycodeOfNote, noteOfKeycode } from './midi'

export interface PhraseStep {
  /** MIDI notes played together; none for a rest. */
  notes: number[]
  /** How long the step lasts. */
  ms: number
}

export type Phrase = PhraseStep[]

export const DEFAULT_TEMPO = 120

/** Note lengths in beats, where a beat is a quarter note. */
export const LENGTHS: { beats: number; name: string }[] = [
  { beats: 4, name: 'Whole' },
  { beats: 3, name: 'Dotted half' },
  { beats: 2, name: 'Half' },
  { beats: 1.5, name: 'Dotted quarter' },
  { beats: 1, name: 'Quarter' },
  { beats: 0.75, name: 'Dotted eighth' },
  { beats: 0.5, name: 'Eighth' },
  { beats: 0.25, name: 'Sixteenth' },
]

/** How long a note of this many beats lasts at a tempo, in whole milliseconds that a macro can store. */
export function msFor(beats: number, tempo: number): number {
  return Math.min(MAX_DELAY_MS, Math.max(1, Math.round((beats * 60000) / tempo)))
}

/** "Quarter" when the time matches a note length at this tempo, otherwise null. */
export function lengthName(ms: number, tempo: number): string | null {
  return LENGTHS.find((l) => Math.abs(msFor(l.beats, tempo) - ms) <= 1)?.name ?? null
}

/**
 * The same phrase at another tempo: every step keeps its note length. Steps that match a
 * note length are worked out again from it, so changing the tempo back and forth never
 * drifts; other steps are scaled.
 */
export function retime(phrase: Phrase, from: number, to: number): Phrase {
  return phrase.map((s) => {
    const length = LENGTHS.find((l) => l.name === lengthName(s.ms, from))
    const ms = length ? msFor(length.beats, to) : Math.round((s.ms * from) / to)
    return { ...s, ms: Math.min(MAX_DELAY_MS, Math.max(1, ms)) }
  })
}

export function phraseToMacro(phrase: Phrase): Macro {
  return phrase.flatMap((step): MacroAction[] => {
    const keys = step.notes.map(keycodeOfNote)
    const wait: MacroAction = { type: 'delay', ms: step.ms }
    return keys.length ? [{ type: 'down', keys }, wait, { type: 'up', keys }] : [wait]
  })
}

/** The phrase a macro plays, or null when the macro does anything other than play notes and rests. */
export function macroToPhrase(macro: Macro): Phrase | null {
  const phrase: Phrase = []
  for (let i = 0; i < macro.length; i++) {
    const action = macro[i]
    if (action.type === 'delay') {
      phrase.push({ notes: [], ms: action.ms })
      continue
    }
    if (action.type !== 'down') return null
    const notes = action.keys.map(noteOfKeycode)
    const wait = macro[i + 1]
    const up = macro[i + 2]
    if (
      notes.some((n) => n === null) ||
      wait?.type !== 'delay' ||
      up?.type !== 'up' ||
      up.keys.length !== action.keys.length ||
      up.keys.some((k) => !action.keys.includes(k))
    ) {
      return null
    }
    phrase.push({ notes: notes as number[], ms: wait.ms })
    i += 2
  }
  return phrase
}
