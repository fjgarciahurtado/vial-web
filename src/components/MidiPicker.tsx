// SPDX-License-Identifier: GPL-2.0-or-later
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeycodeCatalog } from '@/core/keycodes/catalog'
import {
  chordKeys,
  isBlackKey,
  keycodeOfNote,
  MIDI_CONTROL_GROUPS,
  noteName,
  noteOfKeycode,
  PIANO_FIRST_NOTE,
  PIANO_LAST_NOTE,
  type NoteNames,
} from '@/core/midi'

const NAMES_KEY = 'vial-web:note-names'
/** Width of one white key, in rem. Black keys sit across the line between two white keys. */
const WHITE = 2.25
const BLACK = 1.4

interface Props {
  catalog: KeycodeCatalog
  current: number | null
  disabled: boolean
  onPick(code: number): void
}

/**
 * The MIDI tab of the key picker, drawn the way a musician thinks: a piano for the note
 * keys, the keyboard's chord keys with their notes lit on the piano, and the other MIDI
 * keys in groups with plain names.
 */
export function MidiPicker({ catalog, current, disabled, onPick }: Props) {
  const [names, setNames] = useState<NoteNames>(readNames)
  const [preview, setPreview] = useState<number[] | null>(null)
  const chords = useMemo(() => chordKeys(catalog), [catalog])
  const currentNote = current === null ? null : noteOfKeycode(current)
  const currentChord = chords.find((c) => c.code === current)
  const lit = new Set(preview ?? currentChord?.notes ?? [])
  const offPiano = [...lit].filter((n) => n < PIANO_FIRST_NOTE || n > PIANO_LAST_NOTE)

  const chooseNames = (next: NoteNames) => {
    setNames(next)
    try {
      localStorage.setItem(NAMES_KEY, next)
    } catch {
      // Private windows may refuse storage; the choice then lasts until the page closes.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {currentChord
            ? `This key plays the chord ${currentChord.name}: ${currentChord.notes.map((n) => noteName(n, names)).join(', ')}.`
            : currentNote !== null
              ? `This key plays ${noteName(currentNote, names)}. Click a piano key to change it.`
              : 'Click a piano key to make this key play that note.'}
        </p>
        <div role="group" aria-label="Note names" className="flex gap-1 rounded-lg bg-field p-0.5 text-sm">
          {(
            [
              ['letters', 'C D E'],
              ['solfege', 'Do Re Mi'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={names === value}
              onClick={() => chooseNames(value)}
              className={`rounded-md px-2.5 py-1 font-semibold focus-visible:outline-2 focus-visible:outline-pick ${
                names === value ? 'bg-ink text-desk' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {chords.length > 0 && (
        <section aria-label="Chords" className="flex flex-col gap-2">
          <h3 className="font-semibold">Chords on this keyboard</h3>
          <div className="flex flex-wrap gap-2">
            {chords.map((chord) => (
              <button
                key={chord.code}
                type="button"
                disabled={disabled}
                aria-pressed={chord.code === current}
                title={chord.title}
                onClick={() => onPick(chord.code)}
                onMouseEnter={() => setPreview(chord.notes)}
                onMouseLeave={() => setPreview(null)}
                onFocus={() => setPreview(chord.notes)}
                onBlur={() => setPreview(null)}
                className={`flex flex-col items-start rounded-lg border-b-4 px-3 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pick disabled:opacity-50 ${
                  chord.code === current ? 'border-pick-skirt bg-pick text-white' : 'border-ok-skirt bg-ok text-legend'
                }`}
              >
                <span className="font-semibold">{chord.name}</span>
                <span className="text-xs opacity-80">{chord.notes.map((n) => noteName(n, names)).join(' · ')}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-ink-soft">
            Point at a chord to see its notes on the piano. Chords are built into the keyboard's firmware; their notes
            come from each chord's description.
          </p>
        </section>
      )}

      {offPiano.length > 0 && (
        <p className="text-sm font-semibold">
          {offPiano.map((n) => noteName(n, names)).join(', ')} {offPiano.length === 1 ? 'is' : 'are'} outside the piano
          below, which shows the notes from {noteName(PIANO_FIRST_NOTE, names)} to {noteName(PIANO_LAST_NOTE, names)}.
        </p>
      )}

      <Piano names={names} currentNote={currentNote} lit={lit} disabled={disabled} onPick={(note) => onPick(keycodeOfNote(note))} />

      {MIDI_CONTROL_GROUPS.map((group) => {
        const keys = group.keys.flatMap((k) => {
          const code = catalog.deserialize(k.id)
          return code !== undefined && catalog.available().some((e) => e.code === code) ? [{ ...k, code }] : []
        })
        if (!keys.length) return null
        return (
          <section key={group.title} aria-label={group.title} className="flex flex-col gap-2">
            <h3 className="font-semibold">{group.title}</h3>
            <p className="-mt-1 text-sm text-ink-soft">{group.help}</p>
            <div className="flex flex-wrap gap-1.5">
              {keys.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={k.code === current}
                  onClick={() => onPick(k.code)}
                  className={`rounded-md border-b-[3px] px-2.5 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pick disabled:opacity-50 ${
                    k.code === current ? 'border-pick-skirt bg-pick text-white' : 'border-cap-skirt bg-cap text-legend'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Piano({
  names,
  currentNote,
  lit,
  disabled,
  onPick,
}: {
  names: NoteNames
  currentNote: number | null
  lit: Set<number>
  disabled: boolean
  onPick(note: number): void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const notes = Array.from({ length: PIANO_LAST_NOTE - PIANO_FIRST_NOTE + 1 }, (_, i) => PIANO_FIRST_NOTE + i)
  const whites = notes.filter((n) => !isBlackKey(n))
  // Only the key's own note moves the piano; pointing at chords must not yank it around.
  const focusNote = currentNote ?? 60

  // Show the chosen note (or middle C) when the piano opens, since it is wider than the screen.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-note="${focusNote}"]`)
    if (el && scroller.current) scroller.current.scrollLeft = el.offsetLeft - scroller.current.clientWidth / 2
  }, [focusNote])

  const style = (note: number) =>
    note === currentNote
      ? 'bg-pick text-white border-pick-skirt'
      : lit.has(note)
        ? 'bg-ok text-legend border-ok-skirt'
        : isBlackKey(note)
          ? 'bg-case text-white border-case'
          : 'bg-cap text-legend border-cap-skirt'

  return (
    <section aria-label="Piano" className="flex flex-col gap-1">
      <div ref={scroller} className="overflow-x-auto pb-2">
        <div role="group" aria-label="Notes" className="relative h-36" style={{ width: `${whites.length * WHITE}rem` }}>
          {whites.map((note, i) => (
            <button
              key={note}
              type="button"
              data-note={note}
              disabled={disabled}
              aria-pressed={note === currentNote}
              aria-label={`Note ${noteName(note, names)}`}
              onClick={() => onPick(note)}
              style={{ left: `${i * WHITE}rem`, width: `${WHITE}rem` }}
              className={`absolute top-0 flex h-36 flex-col items-center justify-end rounded-b-md border border-b-4 pb-1.5 text-[10px] font-semibold focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-pick disabled:opacity-60 ${style(note)}`}
            >
              {/* Every key is named; C keys, the chosen note and chord notes also show the octave. */}
              {note % 12 === 0 || note === currentNote || lit.has(note) ? noteName(note, names) : pitchName(note, names)}
            </button>
          ))}
          {notes.filter(isBlackKey).map((note) => {
            const whitesBefore = whites.filter((w) => w < note).length
            return (
              <button
                key={note}
                type="button"
                data-note={note}
                disabled={disabled}
                aria-pressed={note === currentNote}
                aria-label={`Note ${noteName(note, names)}`}
                onClick={() => onPick(note)}
                style={{ left: `${whitesBefore * WHITE - BLACK / 2}rem`, width: `${BLACK}rem` }}
                className={`absolute top-0 z-10 flex h-22 items-end justify-center rounded-b-md border border-b-4 pb-1 text-[9px] font-semibold focus-visible:outline-2 focus-visible:outline-pick disabled:opacity-60 ${style(note)}`}
              >
                {pitchName(note, names)}
              </button>
            )
          })}
        </div>
      </div>
      <p className="text-sm text-ink-soft">
        Notes shown at the normal octave setting. Octave and transpose keys below move every note while you play.
      </p>
    </section>
  )
}

/** "C#" or "Do#": the note's name without its octave. */
function pitchName(note: number, names: NoteNames): string {
  return noteName(note, names).replace(/-?\d+$/, '')
}

function readNames(): NoteNames {
  try {
    return localStorage.getItem(NAMES_KEY) === 'solfege' ? 'solfege' : 'letters'
  } catch {
    return 'letters'
  }
}
