// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import v6Data from './keycodes/data/keycodes-v6.json'
import { KeycodeCatalog, type KeycodeData } from './keycodes/catalog'
import {
  chordKeys,
  isBlackKey,
  keycodeOfNote,
  MIDI_CONTROL_GROUPS,
  noteName,
  noteOfKeycode,
  parseChordNotes,
  PIANO_FIRST_NOTE,
  PIANO_LAST_NOTE,
} from './midi'

const caps = {
  layers: 2,
  macroCount: 0,
  tapDanceCount: 0,
  features: new Set<string>(),
  midi: 'advanced',
  customKeycodes: [
    { name: 'DO MAY', title: 'Acorde Do Mayor (C4 - E4 - G4)', shortName: 'C Maj' },
    { name: 'LA MIN', title: 'Acorde La Menor (A3 - C4 - E4)', shortName: 'Am' },
    { name: 'MACRO', title: 'Not a chord', shortName: 'Mac' },
  ],
}
const catalog = new KeycodeCatalog(v6Data as KeycodeData, caps)

describe('MIDI note keys (process_midi.c)', () => {
  it('maps the 72 note keys to MIDI notes at QMK’s default octave', () => {
    // MI_C plays 12 * octave + 0, and the default octave (MI_OCT_2) is 4: C3.
    expect(noteOfKeycode(catalog.deserialize('MI_C')!)).toBe(48)
    expect(noteOfKeycode(catalog.deserialize('MI_C_1')!)).toBe(60)
    expect(noteOfKeycode(catalog.deserialize('MI_B_5')!)).toBe(119)
    expect(noteOfKeycode(0x04)).toBeNull()
    expect(keycodeOfNote(60)).toBe(catalog.deserialize('MI_C_1'))
    expect(PIANO_FIRST_NOTE).toBe(48)
    expect(PIANO_LAST_NOTE).toBe(119)
  })

  it('names notes with letters or Do Re Mi', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(61)).toBe('C#4')
    expect(noteName(57, 'solfege')).toBe('La3')
    expect(noteName(66, 'solfege')).toBe('Fa#4')
    expect(isBlackKey(61)).toBe(true)
    expect(isBlackKey(64)).toBe(false)
  })
})

describe('chords', () => {
  it('reads the notes written in a chord key’s description', () => {
    expect(parseChordNotes('Acorde Do Mayor (C4 - E4 - G4)')).toEqual([60, 64, 67])
    expect(parseChordNotes('F#3 A#3 C#4')).toEqual([54, 58, 61])
    expect(parseChordNotes('Bb2, D3, F3')).toEqual([46, 50, 53])
    expect(parseChordNotes('Sol3 Si3 Re4')).toEqual([55, 59, 62])
    expect(parseChordNotes('Not a chord')).toEqual([])
    // One note isn't a chord.
    expect(parseChordNotes('Just C4')).toEqual([])
  })

  it('finds the custom keys that are chords', () => {
    expect(chordKeys(catalog)).toEqual([
      { code: catalog.deserialize('USER00'), name: 'C Maj', title: 'Acorde Do Mayor (C4 - E4 - G4)', notes: [60, 64, 67] },
      { code: catalog.deserialize('USER01'), name: 'Am', title: 'Acorde La Menor (A3 - C4 - E4)', notes: [57, 60, 64] },
    ])
  })
})

describe('MIDI key names', () => {
  it('names MIDI keys in plain words', () => {
    expect(catalog.describe(catalog.deserialize('MI_C_1')!)).toMatchObject({ name: 'MIDI C4', legend: ['MIDI', 'C4'] })
    expect(catalog.describe(catalog.deserialize('MI_Fs')!).name).toBe('MIDI F#3')
    expect(catalog.describe(catalog.deserialize('MI_SUS')!).name).toBe('MIDI Sustain pedal')
    expect(catalog.describe(catalog.deserialize('MI_OCT_N2')!).name).toBe('MIDI Octave -2')
  })
})

describe('MIDI controls', () => {
  it('groups every other MIDI key under a plain name', () => {
    const ids = MIDI_CONTROL_GROUPS.flatMap((g) => g.keys.map((k) => k.id))
    expect(ids).toContain('MI_OCTU')
    expect(ids).toContain('MI_SUS')
    expect(ids).toContain('MI_ALLOFF')
    expect(new Set(ids).size).toBe(ids.length)
    const advanced = catalog.available().filter((e) => e.group === 'midi_advanced' || e.id === 'MI_ALLOFF')
    expect(advanced.every((e) => ids.includes(e.id))).toBe(true)
  })
})
