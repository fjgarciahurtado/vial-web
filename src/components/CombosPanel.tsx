// SPDX-License-Identifier: GPL-2.0-or-later
import { ArrowRight, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { KeyPicker } from '@/components/KeyPicker'
import { KeySlot } from '@/components/KeySlot'
import { Button } from '@/components/ui/button'
import { comboProblem, describeCombo, EMPTY_COMBO, isEmptyCombo, type Combo } from '@/core/combos'
import { useApp } from '@/store'

/** Slots 0-3 are the keys pressed together; 4 is what the combo does. */
const RESULT = 4

/**
 * Edits combos (editor/combos.py). Like keys, each change is written to the
 * keyboard straight away.
 */
export function CombosPanel() {
  const { keyboard, setCombo, busy } = useApp()
  const [current, setCurrent] = useState(0)
  const [slot, setSlot] = useState(0)
  if (!keyboard) return null

  const { catalog, combos } = keyboard
  const combo = combos[current] ?? EMPTY_COMBO
  const code = slot === RESULT ? combo.output : combo.keys[slot]
  const problem = comboProblem(combo)
  const slotName = slot === RESULT ? 'what the combo does' : `key ${slot + 1}`

  const put = async (value: number) => {
    const next: Combo =
      slot === RESULT ? { ...combo, output: value } : { ...combo, keys: combo.keys.map((k, i) => (i === slot ? value : k)) }
    if (!(await setCombo(current, next))) return
    // Move on to the next empty slot, so building a combo is a few clicks in a row.
    if (value !== 0 && slot !== RESULT) {
      const nextEmpty = next.keys.findIndex((k, i) => i > slot && k === 0)
      setSlot(nextEmpty !== -1 && nextEmpty < 2 ? nextEmpty : next.output === 0 ? RESULT : slot)
    }
  }

  const firstFree = combos.findIndex(isEmptyCombo)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft">
        A combo does something when you press several keys at the same time, for example A and S together for Escape.
        The keys still work on their own when pressed alone.
      </p>

      <div className="flex flex-col gap-4 md:flex-row">
        <nav aria-label="Combos" className="flex max-h-[40svh] flex-none flex-col gap-1 overflow-y-auto md:w-64">
          {combos.map((c, i) => (
            <button
              key={i}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => {
                setCurrent(i)
                setSlot(0)
              }}
              className={`flex flex-col rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                i === current ? 'bg-ink text-desk' : 'hover:bg-panel'
              }`}
            >
              <span className="font-semibold">Combo {i + 1}</span>
              <span className={`truncate text-sm ${i === current ? 'opacity-80' : 'text-ink-soft'}`}>
                {describeCombo(c, catalog)}
              </span>
            </button>
          ))}
          {firstFree !== -1 && firstFree !== current && (
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => {
                setCurrent(firstFree)
                setSlot(0)
              }}
            >
              <Plus aria-hidden />
              New combo
            </Button>
          )}
        </nav>

        <section aria-label={`Combo ${current + 1}`} className="flex min-w-0 flex-1 flex-col gap-4 self-start rounded-2xl bg-panel p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {combo.keys.map((k, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden className="text-ink-soft">
                    +
                  </span>
                )}
                <KeySlot catalog={catalog} label={`Key ${i + 1}`} code={k} selected={slot === i} onSelect={() => setSlot(i)} />
              </span>
            ))}
            <ArrowRight aria-hidden className="mx-1 size-5 text-ink-soft" />
            <KeySlot catalog={catalog} label="Result" code={combo.output} selected={slot === RESULT} onSelect={() => setSlot(RESULT)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className={problem ? 'font-semibold' : 'text-ink-soft'}>
              {problem ?? (isEmptyCombo(combo) ? 'Choose the first key below.' : 'This combo is ready to use.')}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy || code === 0} onClick={() => put(0)}>
                <X aria-hidden />
                Clear {slotName}
              </Button>
              <Button
                variant="outline"
                disabled={busy || isEmptyCombo(combo)}
                onClick={() => {
                  setCombo(current, EMPTY_COMBO)
                  setSlot(0)
                }}
              >
                Delete combo
              </Button>
            </div>
          </div>
        </section>
      </div>

      <p className="font-semibold">Choose {slotName}:</p>
      {/* Blocked while a combo is being written, because each pick moves on to the next slot. */}
      <div className={`flex h-[28rem] flex-col ${busy ? 'pointer-events-none opacity-70' : ''}`} inert={busy} aria-busy={busy}>
        <KeyPicker catalog={catalog} current={code} onPick={put} />
      </div>
    </div>
  )
}
