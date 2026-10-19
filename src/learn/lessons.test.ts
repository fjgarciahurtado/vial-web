// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { PROFILE_SECTIONS } from '@/core/profiles'
import { boldParts, findLesson, LEARN_MODES, LESSONS, lessonsFor } from './lessons'

describe('lessons', () => {
  it('have unique ids that are safe in an address', () => {
    const ids = LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it('give every mode some lessons', () => {
    for (const { mode } of LEARN_MODES) expect(lessonsFor(mode).length).toBeGreaterThan(3)
  })

  it('list a mode’s own lessons before the shared ones', () => {
    const musician = lessonsFor('musician').map((l) => l.id)
    expect(musician[0]).toBe('pads-and-piano')
    expect(musician.slice(-2)).toEqual(['lighting', 'backup'])
    expect(lessonsFor('easy')[0].id).toBe('change-a-key')
  })

  it('start in a section their modes show', () => {
    for (const lesson of LESSONS) {
      for (const mode of lesson.modes) expect(PROFILE_SECTIONS[mode], lesson.id).toContain(lesson.section)
    }
  })

  it('each have a picture, taken by npm run learn:shots', () => {
    const pictures = Object.keys(import.meta.glob('../../public/learn/*.jpg'))
    for (const lesson of LESSONS) expect(pictures, lesson.id).toContain(`../../public/learn/${lesson.id}.jpg`)
  })

  it('close every bold mark', () => {
    for (const lesson of LESSONS) {
      for (const text of [...lesson.steps, lesson.check, lesson.tip ?? '']) {
        expect(text.split('**').length % 2, `${lesson.id}: ${text}`).toBe(1)
      }
    }
  })

  it('are found by id', () => {
    expect(findLesson('write-a-phrase')?.modes).toEqual(['musician'])
    expect(findLesson('nonsense')).toBeUndefined()
    expect(findLesson(null)).toBeUndefined()
  })
})

describe('boldParts', () => {
  it('splits the bold names of buttons from the plain text', () => {
    expect(boldParts('Click **Save macros** now.')).toEqual([
      { text: 'Click ', bold: false },
      { text: 'Save macros', bold: true },
      { text: ' now.', bold: false },
    ])
    expect(boldParts('**Keys**')).toEqual([{ text: 'Keys', bold: true }])
  })
})
