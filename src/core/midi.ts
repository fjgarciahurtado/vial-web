// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * MIDI keys drawn as a piano. Note keys MI_C … MI_B_5 play
 * 12 * octave + offset + transpose (midi_compute_note() in QMK
 * quantum/process_keycode/process_midi.c); at the default octave (MI_OCT_2,
 * octave 4) MI_C is MIDI note 48, C3, with C4 = 60 as middle C.
 *
 * QMK has no chord keycodes. Keyboards add their own as custom keycodes, and
 * vial-web finds them by the notes written in their description in vial.json,
 * for example "Acorde Do Mayor (C4 - E4 - G4)".
 */
import type { KeycodeCatalog } from './keycodes/catalog'

/** MI_C in Vial's keycodes (QK_MIDI_NOTE_C_0). */
const MI_C = 0x7103
const NOTE_KEYS = 72
const DEFAULT_OCTAVE = 4

export const PIANO_FIRST_NOTE = 12 * DEFAULT_OCTAVE
export const PIANO_LAST_NOTE = PIANO_FIRST_NOTE + NOTE_KEYS - 1

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const SOLFEGE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si']

export type NoteNames = 'letters' | 'solfege'

/** The MIDI note a note key plays at the default octave, or null for other keys. */
export function noteOfKeycode(code: number): number | null {
  const offset = code - MI_C
  return offset >= 0 && offset < NOTE_KEYS ? PIANO_FIRST_NOTE + offset : null
}

export function keycodeOfNote(note: number): number {
  return MI_C + note - PIANO_FIRST_NOTE
}

/** "C4", or "Do4" in Do Re Mi. Octaves follow the usual numbering: 60 is C4. */
export function noteName(note: number, names: NoteNames = 'letters'): string {
  return `${(names === 'solfege' ? SOLFEGE : LETTERS)[note % 12]}${Math.floor(note / 12) - 1}`
}

export function isBlackKey(note: number): boolean {
  return [1, 3, 6, 8, 10].includes(note % 12)
}

const STEPS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  DO: 0, RE: 2, MI: 4, FA: 5, SOL: 7, LA: 9, SI: 11,
}
const NOTE_PATTERN = /\b(Sol|Do|Re|Mi|Fa|La|Si|[A-G])(#|♯|b|♭)?(-?\d)\b/gi

/** The notes named in a text like "(C4 - E4 - G4)" or "Sol3 Si3 Re4". Fewer than two isn't a chord. */
export function parseChordNotes(text: string): number[] {
  const notes = [...text.matchAll(NOTE_PATTERN)].map(([, name, accidental, octave]) => {
    const shift = accidental === '#' || accidental === '♯' ? 1 : accidental ? -1 : 0
    return (Number(octave) + 1) * 12 + STEPS[name.toUpperCase()] + shift
  })
  return notes.length >= 2 ? notes : []
}

export interface ChordKey {
  code: number
  /** Short name, as on the keycap. */
  name: string
  /** The keyboard's description of the chord. */
  title: string
  notes: number[]
}

/** The keyboard's custom keys that play chords. */
export function chordKeys(catalog: KeycodeCatalog): ChordKey[] {
  return catalog
    .available()
    .filter((e) => e.group === 'user')
    .flatMap((e) => {
      const title = e.tooltip ?? ''
      const notes = parseChordNotes(title)
      return notes.length ? [{ code: e.code, name: e.label.replaceAll('\n', ' '), title, notes }] : []
    })
}

export interface MidiControlGroup {
  title: string
  help: string
  keys: { id: string; label: string }[]
}

const range = (prefix: string, from: number, to: number, label: (n: number) => string) =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const n = from + i
    return { id: `${prefix}${n < 0 ? `N${-n}` : n}`, label: label(n) }
  })
const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

/** "MIDI C4" or "MIDI Sustain pedal": a plain name for any MIDI key, or undefined for other keys. */
export function midiKeyName(id: string, code: number): string | undefined {
  const note = noteOfKeycode(code)
  if (note !== null && id.startsWith('MI_')) return `MIDI ${noteName(note)}`
  const control = MIDI_CONTROL_GROUPS.flatMap((g) => g.keys).find((k) => k.id === id)
  return control && `MIDI ${control.label}`
}

/** Every MIDI key that isn't a note, in groups with plain names. */
export const MIDI_CONTROL_GROUPS: MidiControlGroup[] = [
  {
    title: 'Octave',
    help: 'Moves every note key up or down by whole octaves. +2 is the normal setting, where the piano above starts at C3.',
    keys: [
      { id: 'MI_OCTD', label: 'Octave down' },
      { id: 'MI_OCTU', label: 'Octave up' },
      ...range('MI_OCT_', -2, 7, (n) => `Octave ${signed(n)}`),
    ],
  },
  {
    title: 'Transpose',
    help: 'Moves every note key up or down by semitones, to play in another key.',
    keys: [
      { id: 'MI_TRNSD', label: 'Transpose down' },
      { id: 'MI_TRNSU', label: 'Transpose up' },
      ...range('MI_TRNS_', -6, 6, (n) => `Transpose ${signed(n)}`),
    ],
  },
  {
    title: 'Velocity',
    help: 'How hard the notes are played: 1 is softest, 10 is loudest.',
    keys: [
      { id: 'MI_VELD', label: 'Softer' },
      { id: 'MI_VELU', label: 'Louder' },
      ...range('MI_VEL_', 1, 10, (n) => `Velocity ${n}`),
    ],
  },
  {
    title: 'Channel',
    help: 'Which MIDI channel the notes go to, for apps that listen to one channel per instrument.',
    keys: [
      { id: 'MI_CHD', label: 'Channel down' },
      { id: 'MI_CHU', label: 'Channel up' },
      ...range('MI_CH', 1, 16, (n) => `Channel ${n}`),
    ],
  },
  {
    title: 'Pedals and effects',
    help: 'Held like a pedal: the effect lasts while the key is down.',
    keys: [
      { id: 'MI_SUS', label: 'Sustain pedal' },
      { id: 'MI_SOST', label: 'Sostenuto pedal' },
      { id: 'MI_SOFT', label: 'Soft pedal' },
      { id: 'MI_PORT', label: 'Portamento' },
      { id: 'MI_LEG', label: 'Legato' },
      { id: 'MI_MOD', label: 'Modulation' },
      { id: 'MI_MODSD', label: 'Modulation speed down' },
      { id: 'MI_MODSU', label: 'Modulation speed up' },
      { id: 'MI_BENDD', label: 'Pitch bend down' },
      { id: 'MI_BENDU', label: 'Pitch bend up' },
      { id: 'MI_ALLOFF', label: 'All notes off' },
    ],
  },
]
