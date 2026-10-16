// SPDX-License-Identifier: GPL-2.0-or-later
import { ArrowRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { KeyPicker } from '@/components/KeyPicker'
import { KeySlot } from '@/components/KeySlot'
import { ModPicker } from '@/components/ModPicker'
import { Button } from '@/components/ui/button'
import {
  altRepeatProblem,
  AREP_OPTION,
  describeAltRepeat,
  EMPTY_ALT_REPEAT,
  isEmptyAltRepeat,
  NEW_ALT_REPEAT,
  type AltRepeat,
} from '@/core/alt-repeat'
import { useApp } from '@/store'

type Slot = 'keycode' | 'altKeycode'

/**
 * Edits alt repeat keys (editor/alt_repeat_key.py). Like keys, each change is written to
 * the keyboard straight away.
 */
export function AltRepeatPanel() {
  const { keyboard, setAltRepeat, busy } = useApp()
  const [current, setCurrent] = useState(0)
  const [slot, setSlot] = useState<Slot>('keycode')
  if (!keyboard) return null

  const { catalog, altRepeats, keymap, encoderKeymap } = keyboard
  const entry = altRepeats[current] ?? EMPTY_ALT_REPEAT
  const firstFree = altRepeats.findIndex(isEmptyAltRepeat)
  const problem = altRepeatProblem(entry)
  const altRepeatKey = catalog.deserialize('QK_ALT_REPEAT_KEY')
  const onKeymap = [...keymap.flat(2), ...encoderKeymap.flat(2)].some((k) => k === altRepeatKey)

  /** Changes the pair. An unused slot starts turned on. */
  const edit = (change: (current: AltRepeat) => Partial<AltRepeat>) =>
    setAltRepeat(current, (latest) => {
      const base = isEmptyAltRepeat(latest) && latest.options === 0 ? NEW_ALT_REPEAT : latest
      return { ...base, ...change(base) }
    })
  // Each click flips the option on the latest value, so quick clicks all count even while one is being saved.
  const toggle = (bit: number) => edit((a) => ({ options: a.options ^ bit }))

  const open = (i: number) => {
    setCurrent(i)
    setSlot('keycode')
  }
  const name = (code: number, fallback: string) => (code ? catalog.describe(code).name : fallback)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft">
        The Alt Repeat key sends the opposite of the last key you pressed: after Up it sends Down, after Undo it can send
        Redo. Each pair below says what the opposite of a key is.{' '}
        {onKeymap ? '' : 'To use it, put Alt Repeat on a key in Keys, under Special.'}
      </p>

      <div className="flex flex-col gap-4 md:flex-row">
        <nav aria-label="Alt repeat keys" className="flex max-h-[40svh] flex-none flex-col gap-1 overflow-y-auto md:w-64">
          {altRepeats.map((a, i) => (
            <button
              key={i}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => open(i)}
              className={`flex flex-col rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                i === current ? 'bg-ink text-desk' : 'hover:bg-panel'
              }`}
            >
              <span className="font-semibold">Pair {i + 1}</span>
              <span className={`truncate text-sm ${i === current ? 'opacity-80' : 'text-ink-soft'}`}>
                {describeAltRepeat(a, catalog)}
              </span>
            </button>
          ))}
          {firstFree !== -1 && firstFree !== current && (
            <Button variant="ghost" className="justify-start" onClick={() => open(firstFree)}>
              <Plus aria-hidden />
              New pair
            </Button>
          )}
        </nav>

        <section
          aria-label={`Pair ${current + 1}`}
          className="flex min-w-0 flex-1 flex-col gap-5 self-start rounded-2xl bg-panel p-4 sm:p-5"
        >
          {!isEmptyAltRepeat(entry) && (
            <Check label="Turned on" checked={(entry.options & AREP_OPTION.enabled) !== 0} bold onToggle={() => toggle(AREP_OPTION.enabled)} />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <KeySlot
              wide
              catalog={catalog}
              label="After this key"
              code={entry.keycode}
              selected={slot === 'keycode'}
              onSelect={() => setSlot('keycode')}
            />
            <ArrowRight aria-hidden className="mx-1 size-5 text-ink-soft" />
            <KeySlot
              wide
              catalog={catalog}
              label="Alt Repeat sends"
              code={entry.altKeycode}
              selected={slot === 'altKeycode'}
              onSelect={() => setSlot('altKeycode')}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Check
              label={`Works both ways: after ${name(entry.altKeycode, 'the second key')}, Alt Repeat sends ${name(entry.keycode, 'the first')}`}
              checked={(entry.options & AREP_OPTION.bidirectional) !== 0}
              onToggle={() => toggle(AREP_OPTION.bidirectional)}
            />
            <Check
              label="Use this pair after any key that has no pair of its own"
              checked={(entry.options & AREP_OPTION.defaultToThis) !== 0}
              onToggle={() => toggle(AREP_OPTION.defaultToThis)}
            />
          </div>

          <ModPicker
            title="Modifiers that may be held"
            help="With none chosen, the pair only answers when the first key was pressed on its own. Modifiers that are part of the key itself, like the Ctrl in Ctrl + Z, always count."
            mods={entry.allowedMods}
            onToggle={(bit) => edit((a) => ({ allowedMods: a.allowedMods ^ bit }))}
          />
          <Check
            label="Left and right modifiers count the same"
            checked={(entry.options & AREP_OPTION.ignoreModHandedness) !== 0}
            onToggle={() => toggle(AREP_OPTION.ignoreModHandedness)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className={problem ? 'font-semibold' : 'text-ink-soft'}>
              {problem ??
                (isEmptyAltRepeat(entry) ? 'Choose a key, then what Alt Repeat sends after it.' : 'This pair is ready to use.')}
            </p>
            <Button
              variant="outline"
              disabled={busy || isEmptyAltRepeat(entry)}
              onClick={() => {
                setAltRepeat(current, () => EMPTY_ALT_REPEAT)
                setSlot('keycode')
              }}
            >
              Delete pair
            </Button>
          </div>
        </section>
      </div>

      <p className="font-semibold">{slot === 'keycode' ? 'Choose the key:' : 'Choose what Alt Repeat sends after it:'}</p>
      {/* Picks made while one is being written wait their turn. A change made while the keyboard is busy with
          something else, such as a restore, isn't saved, and the notice says so. */}
      <div className="flex h-[28rem] flex-col" aria-busy={busy}>
        <KeyPicker catalog={catalog} current={entry[slot]} onPick={(code) => edit(() => ({ [slot]: code }))} />
      </div>
    </div>
  )
}

/** A checkbox that reports clicks as toggles, applied to the latest value in the store. */
function Check({
  label,
  checked,
  bold = false,
  onToggle,
}: {
  label: string
  checked: boolean
  bold?: boolean
  onToggle(): void
}) {
  return (
    <label className={`flex items-center gap-3 ${bold ? 'font-semibold' : ''}`}>
      <input type="checkbox" className="size-5 flex-none accent-pick" checked={checked} onChange={onToggle} />
      {label}
    </label>
  )
}
