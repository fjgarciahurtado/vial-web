// SPDX-License-Identifier: GPL-2.0-or-later
import { ArrowDown, ArrowUp, Circle, Play, Plus, Square, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MacroSaveBar } from '@/components/MacroEditor'
import { NoteStyleToggles, OffPianoNotes, Piano } from '@/components/MidiPicker'
import { Button } from '@/components/ui/button'
import { describeMacro } from '@/core/macros'
import { noteName, type NoteStyle } from '@/core/midi'
import {
  DEFAULT_TEMPO,
  lengthName,
  LENGTHS,
  macroToPhrase,
  msFor,
  phraseToMacro,
  retime,
  type Phrase,
  type PhraseStep,
} from '@/core/phrases'
import { playPhrase } from '@/lib/preview-sound'
import { useApp } from '@/store'

const MIN_TEMPO = 20
const MAX_TEMPO = 300

/**
 * Musician mode's macros: each macro is a phrase of notes, chords and rests, written
 * with the piano. Saved like any other macro, so it also works in the other modes.
 */
export function MusicianMacros() {
  const { keyboard, macroDrafts, setMacroDraft, noteStyle } = useApp()
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [recording, setRecording] = useState(true)
  const [newBeats, setNewBeats] = useState(1)
  const [playing, setPlaying] = useState(false)
  const stopPlaying = useRef<(() => void) | null>(null)
  // Each macro remembers its tempo in this browser; the keyboard only stores times.
  const tempoKey = keyboard ? `vial-web:tempo:${keyboard.keyboardId}:${current}` : null
  const [tempo, setTempoState] = useState(() => Number(readStored(tempoKey)) || DEFAULT_TEMPO)
  const [lastTempoKey, setLastTempoKey] = useState(tempoKey)
  if (tempoKey !== lastTempoKey) {
    setLastTempoKey(tempoKey)
    setTempoState(Number(readStored(tempoKey)) || DEFAULT_TEMPO)
    setSelected(null)
  }
  // Stop the preview when leaving the page.
  useEffect(() => () => stopPlaying.current?.(), [])

  if (!keyboard) return null
  if (keyboard.vialProtocol < 2) {
    return (
      <div className="flex flex-col gap-4 pb-10">
        <h1 className="text-2xl font-bold tracking-tight">Macros</h1>
        <p className="rounded-2xl bg-panel p-4">
          This keyboard's firmware can't wait between steps of a macro, so it can't play phrases. Update the firmware to
          a newer Vial to write phrases here.
        </p>
      </div>
    )
  }

  const macro = macroDrafts[current] ?? []
  const phrase = macroToPhrase(macro)
  const name = (n: number) => noteName(n, noteStyle)
  const setPhrase = (next: Phrase) => setMacroDraft(current, phraseToMacro(next))
  const setTempo = (next: number) => {
    const t = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(next) || DEFAULT_TEMPO))
    if (t === tempo) return
    if (phrase) setPhrase(retime(phrase, tempo, t))
    setTempoState(t)
    writeStored(tempoKey, String(t))
  }
  const editing = phrase && selected !== null && selected < phrase.length ? selected : null
  const lit = new Set(editing !== null ? phrase![editing].notes : [])

  const pickNote = (note: number) => {
    if (!phrase) return
    if (recording || editing === null) {
      const at = editing !== null ? editing + 1 : phrase.length
      setPhrase([...phrase.slice(0, at), { notes: [note], ms: msFor(newBeats, tempo) }, ...phrase.slice(at)])
      setSelected(at)
      return
    }
    // Not recording: the piano adds or removes notes in the chosen step, to build a chord.
    const step = phrase[editing]
    const notes = step.notes.includes(note) ? step.notes.filter((n) => n !== note) : [...step.notes, note].sort((a, b) => a - b)
    setPhrase(phrase.map((s, i) => (i === editing ? { ...s, notes } : s)))
  }

  const play = () => {
    if (stopPlaying.current) return stopPlaying.current()
    if (!phrase?.length) return
    stopPlaying.current = playPhrase(phrase, () => {
      stopPlaying.current = null
      setPlaying(false)
    })
    setPlaying(true)
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Macros</h1>
        <p className="text-ink-soft">
          A macro plays a phrase of notes and chords when you press its pad. To use one, put it on a pad: Keys, then
          Macros.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <nav aria-label="Macros" className="flex flex-none flex-col gap-1 md:w-64">
          {macroDrafts.map((m, i) => (
            <button
              key={i}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => {
                stopPlaying.current?.()
                setCurrent(i)
              }}
              className={`flex flex-col rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                i === current ? 'bg-ink text-desk' : 'hover:bg-panel'
              }`}
            >
              <span className="font-semibold">Macro {i + 1}</span>
              <span className={`truncate text-sm ${i === current ? 'opacity-80' : 'text-ink-soft'}`}>
                {summary(m, keyboard.catalog, noteStyle)}
              </span>
            </button>
          ))}
        </nav>

        <section
          aria-label={`Macro ${current + 1} phrase`}
          className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl bg-panel p-4 sm:p-5"
        >
          {!phrase ? (
            <div className="flex flex-col items-start gap-3">
              <p>
                Macro {current + 1} does more than play notes: {describeMacro(macro, keyboard.catalog)}. Switch to Easy or
                Advanced to change it, or clear it to write a phrase here.
              </p>
              <Button variant="outline" onClick={() => setMacroDraft(current, [])}>
                Clear it and write a phrase
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <label className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Tempo</span>
                  {/* Applied when done typing: every step changes with the tempo, so half-typed values must not. */}
                  <input
                    key={tempo}
                    type="number"
                    min={MIN_TEMPO}
                    max={MAX_TEMPO}
                    defaultValue={tempo}
                    onBlur={(e) => setTempo(Number(e.target.value))}
                    onKeyDown={(e) => e.key === 'Enter' && setTempo(Number(e.currentTarget.value))}
                    className="h-9 w-20 rounded-lg border border-line bg-desk px-3 focus-visible:outline-2 focus-visible:outline-pick"
                  />
                  <span className="text-sm text-ink-soft">beats a minute</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-sm font-semibold">New notes last</span>
                  <LengthSelect beats={newBeats} onChange={setNewBeats} />
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    aria-pressed={recording}
                    onClick={() => setRecording(!recording)}
                    title="While recording, each piano key you click adds a step"
                  >
                    <Circle className={recording ? 'fill-alert text-alert' : ''} aria-hidden />
                    {recording ? 'Recording' : 'Record'}
                  </Button>
                  <Button variant="outline" onClick={play} disabled={!phrase.length && !playing}>
                    {playing ? <Square aria-hidden /> : <Play aria-hidden />}
                    {playing ? 'Stop' : 'Play'}
                  </Button>
                </div>
              </div>

              {phrase.length === 0 ? (
                <p className="text-ink-soft">No steps yet. Click piano keys below to add notes, one step each.</p>
              ) : (
                <ol aria-label="Steps" className="flex flex-col gap-1.5">
                  {phrase.map((step, i) => (
                    <StepRow
                      key={i}
                      index={i}
                      step={step}
                      tempo={tempo}
                      count={phrase.length}
                      chosen={i === editing}
                      name={name}
                      onChoose={() => {
                        setSelected(i === editing ? null : i)
                        setRecording(false)
                      }}
                      onChange={(s) => setPhrase(phrase.map((old, j) => (j === i ? s : old)))}
                      onMove={(by) => {
                        const next = [...phrase]
                        ;[next[i], next[i + by]] = [next[i + by], next[i]]
                        setPhrase(next)
                        if (editing === i) setSelected(i + by)
                      }}
                      onRemove={() => {
                        setPhrase(phrase.filter((_, j) => j !== i))
                        setSelected(null)
                      }}
                    />
                  ))}
                </ol>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const at = editing !== null ? editing + 1 : phrase.length
                    setPhrase([...phrase.slice(0, at), { notes: [], ms: msFor(newBeats, tempo) }, ...phrase.slice(at)])
                    setSelected(at)
                  }}
                >
                  <Plus aria-hidden />
                  Add a rest
                </Button>
                {phrase.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setPhrase([])}>
                    <Trash2 aria-hidden />
                    Clear all steps
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold" aria-live="polite">
                  {recording
                    ? editing !== null
                      ? `Click piano keys to add notes after step ${editing + 1}.`
                      : 'Click piano keys to add notes at the end.'
                    : editing !== null
                      ? `Click piano keys to add them to step ${editing + 1} or take them out, to build a chord.`
                      : 'Choose a step to change its notes, or press Record to add notes.'}
                </p>
                <NoteStyleToggles />
              </div>
              <OffPianoNotes notes={lit} />
              <Piano style={noteStyle} currentNote={null} lit={lit} disabled={false} onPick={pickNote} />
            </>
          )}
        </section>
      </div>

      <MacroSaveBar />
    </div>
  )
}

function StepRow({
  index,
  step,
  tempo,
  count,
  chosen,
  name,
  onChoose,
  onChange,
  onMove,
  onRemove,
}: {
  index: number
  step: PhraseStep
  tempo: number
  count: number
  chosen: boolean
  name(note: number): string
  onChoose(): void
  onChange(step: PhraseStep): void
  onMove(by: number): void
  onRemove(): void
}) {
  const what = step.notes.length ? step.notes.map(name).join(' + ') : 'Rest'
  const beats = LENGTHS.find((l) => l.name === lengthName(step.ms, tempo))?.beats ?? null
  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 ${chosen ? 'bg-ink text-desk' : 'bg-field'}`}
      aria-current={chosen ? 'step' : undefined}
    >
      <button
        type="button"
        onClick={onChoose}
        aria-pressed={chosen}
        aria-label={`Step ${index + 1}: ${what}`}
        className="flex min-w-40 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left font-semibold focus-visible:outline-2 focus-visible:outline-pick"
      >
        <span className="w-6 text-sm opacity-70">{index + 1}.</span>
        <span className={step.notes.length ? '' : 'italic opacity-70'}>{what}</span>
      </button>
      <LengthSelect
        beats={beats}
        ms={step.ms}
        label={`Length of step ${index + 1}`}
        onChange={(b) => onChange({ ...step, ms: msFor(b, tempo) })}
      />
      <div className="flex gap-0.5">
        <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp />
        </IconButton>
        <IconButton label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDown />
        </IconButton>
        <IconButton label="Remove step" onClick={onRemove}>
          <Trash2 />
        </IconButton>
      </div>
    </li>
  )
}

/** Note lengths. A time that matches none at this tempo shows in milliseconds. */
function LengthSelect({
  beats,
  ms,
  label,
  onChange,
}: {
  beats: number | null
  ms?: number
  label?: string
  onChange(beats: number): void
}) {
  return (
    <select
      aria-label={label}
      value={beats ?? 'custom'}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 rounded-lg border border-line bg-desk px-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-pick"
    >
      {beats === null && <option value="custom">{ms} ms</option>}
      {LENGTHS.map((l) => (
        <option key={l.beats} value={l.beats}>
          {l.name}
        </option>
      ))}
    </select>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick(): void
  children: React.ReactNode
}) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  )
}

/** "C4 + E4, rest, G4" for a phrase, or the usual description for other macros. */
function summary(macro: Parameters<typeof macroToPhrase>[0], catalog: Parameters<typeof describeMacro>[1], style: NoteStyle) {
  const phrase = macroToPhrase(macro)
  if (!phrase) return describeMacro(macro, catalog)
  if (!phrase.length) return 'Empty'
  return phrase.map((s) => (s.notes.length ? s.notes.map((n) => noteName(n, style)).join(' + ') : 'rest')).join(', ')
}

function readStored(key: string | null): string | null {
  try {
    return key ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function writeStored(key: string | null, value: string) {
  try {
    if (key) localStorage.setItem(key, value)
  } catch {
    // Private windows may refuse storage; the tempo then lasts until the page closes.
  }
}
