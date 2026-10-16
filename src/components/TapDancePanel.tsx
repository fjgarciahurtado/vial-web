// SPDX-License-Identifier: GPL-2.0-or-later
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { KeyPicker } from '@/components/KeyPicker'
import { KeySlot } from '@/components/KeySlot'
import { Button } from '@/components/ui/button'
import {
  clampTerm,
  describeTapDance,
  EMPTY_TAP_DANCE,
  fallbackFor,
  isEmptyTapDance,
  MAX_TAPPING_TERM,
  TAP_DANCE_ACTIONS,
  type TapDanceAction,
} from '@/core/tap-dance'
import { useApp } from '@/store'

const ACTION_TITLES: Record<TapDanceAction, string> = {
  onTap: 'Tap',
  onHold: 'Hold',
  onDoubleTap: 'Tap twice',
  onTapHold: 'Tap, then hold',
}

/**
 * Edits tap dances (editor/tap_dance.py). Like keys, each change is written to the
 * keyboard straight away.
 */
export function TapDancePanel() {
  const { keyboard, setTapDance, busy } = useApp()
  const [current, setCurrent] = useState(0)
  const [action, setAction] = useState<TapDanceAction>('onTap')
  if (!keyboard) return null

  const { catalog, tapDances, keymap, encoderKeymap } = keyboard
  const td = tapDances[current] ?? EMPTY_TAP_DANCE
  const firstFree = tapDances.findIndex(isEmptyTapDance)
  const code = catalog.deserialize(`TD(${current})`)
  const uses =
    code === undefined ? 0 : [...keymap.flat(2), ...encoderKeymap.flat(2)].filter((k) => k === code).length

  const open = (i: number) => {
    setCurrent(i)
    setAction('onTap')
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft">
        A tap dance key does different things depending on how you press it: tap it, hold it, tap it twice, or tap it
        and then hold. Set one up here, then put it on a key in Keys, under Tap dance.
      </p>

      <div className="flex flex-col gap-4 md:flex-row">
        <nav aria-label="Tap dances" className="flex max-h-[40svh] flex-none flex-col gap-1 overflow-y-auto md:w-64">
          {tapDances.map((t, i) => (
            <button
              key={i}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => open(i)}
              className={`flex flex-col rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                i === current ? 'bg-ink text-desk' : 'hover:bg-panel'
              }`}
            >
              <span className="font-semibold">Tap dance {i + 1}</span>
              <span className={`truncate text-sm ${i === current ? 'opacity-80' : 'text-ink-soft'}`}>
                {describeTapDance(t, catalog)}
              </span>
            </button>
          ))}
          {firstFree !== -1 && firstFree !== current && (
            <Button variant="ghost" className="justify-start" onClick={() => open(firstFree)}>
              <Plus aria-hidden />
              New tap dance
            </Button>
          )}
        </nav>

        <section
          aria-label={`Tap dance ${current + 1}`}
          className="flex min-w-0 flex-1 flex-col gap-4 self-start rounded-2xl bg-panel p-4 sm:p-5"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {TAP_DANCE_ACTIONS.map((a) => (
              <div key={a} className="flex flex-col items-start gap-1.5">
                <KeySlot
                  wide
                  catalog={catalog}
                  label={ACTION_TITLES[a]}
                  code={td[a]}
                  selected={action === a}
                  onSelect={() => setAction(a)}
                />
                <span className="text-sm text-ink-soft">
                  {td[a] ? '' : (fallbackFor(td, a, catalog) ?? 'Does nothing.')}
                </span>
              </div>
            ))}
          </div>

          <TermField
            key={`${current}:${td.tappingTerm}`}
            value={td.tappingTerm}
            onSave={(tappingTerm) => setTapDance(current, { tappingTerm })}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-ink-soft">
              {isEmptyTapDance(td)
                ? 'Choose what a tap does below.'
                : uses
                  ? `On ${uses} key${uses === 1 ? '' : 's'} of your keymap.`
                  : `Not on any key yet. In Keys, choose Tap dance, then Tap dance ${current + 1}.`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={busy || td[action] === 0}
                onClick={() => setTapDance(current, { [action]: 0 })}
              >
                <X aria-hidden />
                Clear {ACTION_TITLES[action].toLowerCase()}
              </Button>
              <Button
                variant="outline"
                disabled={busy || isEmptyTapDance(td)}
                onClick={() => {
                  setTapDance(current, { onTap: 0, onHold: 0, onDoubleTap: 0, onTapHold: 0 })
                  setAction('onTap')
                }}
              >
                Delete tap dance
              </Button>
            </div>
          </div>
        </section>
      </div>

      <p className="font-semibold">Choose what {ACTION_TITLES[action].toLowerCase()} does:</p>
      {/* Picks made while one is being written wait their turn. A change made while the keyboard is busy with
          something else, such as a restore, isn't saved, and the notice says so. */}
      <div className="flex h-[28rem] flex-col" aria-busy={busy}>
        <KeyPicker catalog={catalog} current={td[action]} onPick={(value) => setTapDance(current, { [action]: value })} />
      </div>
    </div>
  )
}

/** The tapping term. Saved when the person leaves the box or presses Enter, not on every keystroke. */
function TermField({ value, onSave }: { value: number; onSave(ms: number): Promise<boolean> }) {
  const [text, setText] = useState(String(value))
  const commit = async () => {
    const n = Number(text)
    const next = text.trim() === '' || !Number.isFinite(n) ? value : clampTerm(n)
    setText(String(next))
    // If it wasn't saved, show what the keyboard still has; the notice says why.
    if (next !== value && !(await onSave(next))) setText(String(value))
  }
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-semibold">Wait time</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_TAPPING_TERM}
          value={text}
          aria-label="Wait time"
          aria-describedby="tap-dance-term-help"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="h-10 w-32 rounded-lg border border-line bg-field px-3 focus-visible:outline-2 focus-visible:outline-pick"
        />
        <span className="text-ink-soft">ms</span>
      </span>
      <span id="tap-dance-term-help" className="text-sm text-ink-soft">
        How long the keyboard waits for another tap, and how long you hold before it counts as a hold.
      </span>
    </label>
  )
}
