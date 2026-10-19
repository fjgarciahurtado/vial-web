// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { deserializeMacro, serializeMacro } from './macros'
import { keycodeOfNote } from './midi'
import { lengthName, macroToPhrase, msFor, phraseToMacro, retime, type Phrase } from './phrases'

const C4 = 60
const E4 = 64
const G4 = 67
const kc = keycodeOfNote

describe('phrases', () => {
  const phrase: Phrase = [
    { notes: [C4, E4, G4], ms: 500 },
    { notes: [], ms: 250 },
    { notes: [E4], ms: 250 },
  ]

  it('plays each step by holding its notes down, waiting, then letting go', () => {
    expect(phraseToMacro(phrase)).toEqual([
      { type: 'down', keys: [kc(C4), kc(E4), kc(G4)] },
      { type: 'delay', ms: 500 },
      { type: 'up', keys: [kc(C4), kc(E4), kc(G4)] },
      { type: 'delay', ms: 250 },
      { type: 'down', keys: [kc(E4)] },
      { type: 'delay', ms: 250 },
      { type: 'up', keys: [kc(E4)] },
    ])
  })

  it('reads back what it wrote, through the keyboard’s byte format', () => {
    const bytes = serializeMacro(phraseToMacro(phrase), 2)
    expect(macroToPhrase(deserializeMacro(bytes, 2))).toEqual(phrase)
    expect(macroToPhrase([])).toEqual([])
  })

  it('leaves alone macros that do more than play notes', () => {
    expect(macroToPhrase([{ type: 'text', text: 'hello' }])).toBeNull()
    expect(macroToPhrase([{ type: 'tap', keys: [0x04] }])).toBeNull()
    expect(macroToPhrase([{ type: 'down', keys: [0x04] }, { type: 'delay', ms: 10 }, { type: 'up', keys: [0x04] }])).toBeNull()
    // Notes held down and never let go.
    expect(macroToPhrase([{ type: 'down', keys: [kc(C4)] }, { type: 'delay', ms: 10 }])).toBeNull()
  })

  it('turns note lengths into time at a tempo', () => {
    expect(msFor(1, 120)).toBe(500)
    expect(msFor(0.5, 120)).toBe(250)
    expect(msFor(4, 60)).toBe(4000)
    expect(lengthName(500, 120)).toBe('Quarter')
    expect(lengthName(750, 120)).toBe('Dotted quarter')
    expect(lengthName(333, 120)).toBeNull()
  })

  it('changes the tempo of a whole phrase', () => {
    expect(retime(phrase, 120, 60).map((s) => s.ms)).toEqual([1000, 500, 500])
  })
})
