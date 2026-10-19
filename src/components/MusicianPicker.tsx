// SPDX-License-Identifier: GPL-2.0-or-later
import { useMemo, useState } from 'react'
import { PickerKey } from '@/components/KeyPicker'
import { ChordList, MidiControls, NoteStyleToggles, OffPianoNotes, Piano } from '@/components/MidiPicker'
import type { KeycodeCatalog } from '@/core/keycodes/catalog'
import { chordKeys, keycodeOfNote, MIDI_CONTROL_GROUPS, noteName, noteOfKeycode } from '@/core/midi'
import { profileCategories } from '@/core/profiles'
import { useApp } from '@/store'

interface Props {
  catalog: KeycodeCatalog
  /** Code on the selected pad or knob, or null when nothing is selected. */
  current: number | null
  onPick(code: number): void
  /** The pads that play each note on the shown layer. */
  pads: Map<number, number[]>
  /** Called with the piano note pointed at, so the pads playing it can light up. */
  onPoint(note: number | null): void
}

type Tab = { id: string; title: string }

/**
 * Musician mode's key picker: the piano across the whole width, with each note showing
 * the pads that play it, then chords, the other MIDI keys, layers, macros and lighting.
 */
export function MusicianPicker({ catalog, current, onPick, pads, onPoint }: Props) {
  const style = useApp((s) => s.noteStyle)
  const [preview, setPreview] = useState<number[] | null>(null)
  const chords = useMemo(() => chordKeys(catalog), [catalog])
  const others = useMemo(() => profileCategories(catalog, 'musician').filter((c) => c.title !== 'MIDI'), [catalog])
  const controls = useMemo(
    () => new Set(MIDI_CONTROL_GROUPS.flatMap((g) => g.keys.map((k) => catalog.deserialize(k.id)))),
    [catalog],
  )
  const tabs: Tab[] = [
    { id: 'notes', title: 'Notes' },
    ...(chords.length ? [{ id: 'chords', title: 'Chords' }] : []),
    { id: 'controls', title: 'Octave, pedals and more' },
    ...others.map((c) => ({ id: c.title, title: c.title })),
  ]

  /** The tab that holds what the selected pad does, so picking a pad shows its current choice. */
  const tabFor = (code: number | null): string => {
    if (code === null || noteOfKeycode(code) !== null) return 'notes'
    if (chords.some((c) => c.code === code)) return 'chords'
    if (controls.has(code)) return 'controls'
    return others.find((c) => c.entries.some((e) => e.code === code))?.title ?? 'notes'
  }
  const [tab, setTab] = useState(() => tabFor(current))
  const [lastCurrent, setLastCurrent] = useState(current)
  if (current !== lastCurrent) {
    setLastCurrent(current)
    setTab(tabFor(current))
  }

  const disabled = current === null
  const currentNote = current === null ? null : noteOfKeycode(current)
  const currentChord = chords.find((c) => c.code === current)
  const lit = new Set(preview ?? currentChord?.notes ?? [])
  const category = others.find((c) => c.title === tab)
  const piano = (
    <Piano
      style={style}
      currentNote={currentNote}
      lit={lit}
      disabled={disabled}
      onPick={(note) => onPick(keycodeOfNote(note))}
      pads={pads}
      onPoint={onPoint}
    />
  )

  return (
    <section
      aria-label="Choose what the key does"
      className="flex min-h-0 w-full flex-1 flex-col gap-3 rounded-2xl bg-panel p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Key categories" className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                tab === t.id ? 'bg-ink text-desk' : 'text-ink-soft hover:bg-field hover:text-ink'
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
        {(tab === 'notes' || tab === 'chords') && <NoteStyleToggles />}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {tab === 'notes' && (
          <>
            {currentChord && (
              <p className="text-sm text-ink-soft">
                This pad plays the chord {currentChord.name}: {currentChord.notes.map((n) => noteName(n, style)).join(', ')}.
              </p>
            )}
            <OffPianoNotes notes={lit} />
            {piano}
          </>
        )}
        {tab === 'chords' && (
          <>
            <ChordList chords={chords} current={current} disabled={disabled} onPick={onPick} onPreview={setPreview} />
            <OffPianoNotes notes={lit} />
            {piano}
          </>
        )}
        {tab === 'controls' && <MidiControls catalog={catalog} current={current} disabled={disabled} onPick={onPick} />}
        {category && (
          <ul
            className="-mx-1 grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] content-start gap-2 px-1 pt-1 pb-1"
            aria-label="Keys"
          >
            {category.entries.map((entry) => (
              <li key={entry.id}>
                <PickerKey
                  entry={entry}
                  catalog={catalog}
                  isCurrent={entry.code === current}
                  disabled={disabled}
                  onPick={onPick}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
