// SPDX-License-Identifier: GPL-2.0-or-later
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { KeyChoiceField } from '@/components/KeyChoiceField'
import { Button } from '@/components/ui/button'
import type { KeycodeCatalog } from '@/core/keycodes/catalog'
import { describeMacro, macroSize, macroTextProblem, type Macro, type MacroAction } from '@/core/macros'
import { useApp } from '@/store'

const STEP_TYPES: { type: MacroAction['type']; title: string; make(): MacroAction }[] = [
  { type: 'text', title: 'Type text', make: () => ({ type: 'text', text: '' }) },
  { type: 'tap', title: 'Press a key', make: () => ({ type: 'tap', keys: [] }) },
  { type: 'down', title: 'Hold a key down', make: () => ({ type: 'down', keys: [] }) },
  { type: 'up', title: 'Let go of a key', make: () => ({ type: 'up', keys: [] }) },
  { type: 'delay', title: 'Wait', make: () => ({ type: 'delay', ms: 100 }) },
]

const STEP_LABELS: Record<MacroAction['type'], string> = {
  text: 'Type',
  tap: 'Press',
  down: 'Hold down',
  up: 'Let go of',
  delay: 'Wait',
}

/**
 * Edits the keyboard's macros as a list of plain steps. Changes stay in the app
 * until saved; saving unlocks the keyboard first, as vial-gui does.
 */
export function MacroEditor() {
  const { keyboard, macroDrafts, setMacroDraft, discardMacroDrafts, saveMacros, notice, busy } = useApp()
  const [current, setCurrent] = useState(0)
  if (!keyboard) return null

  const { catalog, macroMemory, vialProtocol } = keyboard
  const macro = macroDrafts[current] ?? []
  const changed = JSON.stringify(macroDrafts) !== JSON.stringify(keyboard.macros)
  const used = macroSize(macroDrafts, vialProtocol)
  const tooBig = used > macroMemory
  const textProblem = macroDrafts.flat().map((a) => (a.type === 'text' ? macroTextProblem(a.text) : null)).find(Boolean)
  const canDelay = vialProtocol >= 2

  const update = (steps: Macro) => setMacroDraft(current, steps)
  const updateStep = (i: number, step: MacroAction) => update(macro.map((s, j) => (j === i ? step : s)))
  const move = (i: number, by: number) => {
    const next = [...macro]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    update(next)
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Macros</h1>
        <p className="text-ink-soft">
          A macro types text or presses keys for you. To use one, put it on a key: Keys, then Macros.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <nav aria-label="Macros" className="flex flex-none flex-col gap-1 md:w-64">
          {macroDrafts.map((m, i) => (
            <button
              key={i}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => setCurrent(i)}
              className={`flex flex-col rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                i === current ? 'bg-ink text-desk' : 'hover:bg-panel'
              }`}
            >
              <span className="font-semibold">Macro {i + 1}</span>
              <span className={`truncate text-sm ${i === current ? 'opacity-80' : 'text-ink-soft'}`}>
                {describeMacro(m, catalog)}
              </span>
            </button>
          ))}
        </nav>

        <section aria-label={`Macro ${current + 1} steps`} className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl bg-panel p-4 sm:p-5">
          <p aria-live="polite" className="font-semibold">
            {describeMacro(macro, catalog)}.
          </p>

          <ol className="flex flex-col gap-2">
            {macro.map((step, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-xl bg-field p-3">
                <div className="flex items-start gap-2">
                  <span className="w-6 flex-none pt-2 text-sm text-ink-soft">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <StepFields step={step} catalog={catalog} onChange={(s) => updateStep(i, s)} />
                  </div>
                  <div className="flex flex-none gap-1">
                    <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label="Move down" disabled={i === macro.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton label="Remove step" onClick={() => update(macro.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-soft">Add a step:</span>
            {STEP_TYPES.filter((t) => t.type !== 'delay' || canDelay).map((t) => (
              <Button key={t.type} variant="outline" size="sm" onClick={() => update([...macro, t.make()])}>
                <Plus aria-hidden />
                {t.title}
              </Button>
            ))}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel p-4">
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <p className={tooBig ? 'font-semibold text-alert' : 'text-ink-soft'}>
            Uses {used} of {macroMemory} bytes of macro memory
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className={`h-full ${tooBig ? 'bg-alert' : 'bg-pick'}`} style={{ width: `${Math.min(100, (used / macroMemory) * 100)}%` }} />
          </div>
          {textProblem && <p className="text-alert">{textProblem}</p>}
          <p aria-live="polite">{notice}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={discardMacroDrafts} disabled={!changed || busy}>
            Discard changes
          </Button>
          <Button className="bg-pick hover:bg-pick-skirt" onClick={saveMacros} disabled={!changed || tooBig || !!textProblem || busy}>
            Save macros
          </Button>
        </div>
      </div>
    </div>
  )
}

function StepFields({ step, catalog, onChange }: { step: MacroAction; catalog: KeycodeCatalog; onChange(step: MacroAction): void }) {
  const [adding, setAdding] = useState(false)
  const choices = useMemo(() => catalog.available().filter((e) => !e.masked && e.code > 0x01), [catalog])

  if (step.type === 'text') {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">{STEP_LABELS.text}</span>
        <textarea
          value={step.text}
          rows={Math.min(4, step.text.split('\n').length)}
          onChange={(e) => onChange({ ...step, text: e.target.value })}
          placeholder="Text to type"
          className="w-full rounded-lg border border-line bg-desk px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-pick"
        />
      </label>
    )
  }

  if (step.type === 'delay') {
    return (
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{STEP_LABELS.delay}</span>
        <input
          type="number"
          min={0}
          max={65000}
          step={50}
          value={step.ms}
          onChange={(e) => onChange({ ...step, ms: Math.max(0, Math.min(65000, Math.round(Number(e.target.value) || 0))) })}
          className="h-9 w-28 rounded-lg border border-line bg-desk px-3 focus-visible:outline-2 focus-visible:outline-pick"
        />
        <span className="text-sm text-ink-soft">milliseconds (1000 is one second)</span>
      </label>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm font-semibold">{STEP_LABELS[step.type]}</span>
        {step.keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1 rounded-md border-b-[3px] border-cap-skirt bg-cap py-0.5 pl-2 pr-1 text-xs font-semibold text-legend">
            {catalog.describe(k).name}
            <button
              type="button"
              aria-label={`Remove ${catalog.describe(k).name}`}
              onClick={() => onChange({ ...step, keys: step.keys.filter((_, j) => j !== i) })}
              className="rounded p-0.5 hover:bg-cap-skirt focus-visible:outline-2 focus-visible:outline-pick"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)} aria-expanded={adding}>
          <Plus aria-hidden />
          {step.keys.length ? 'Add another key' : 'Choose a key'}
        </Button>
      </div>
      {adding && (
        <KeyChoiceField
          catalog={catalog}
          choices={choices}
          label="Key to add"
          showValue={false}
          value={null}
          onChange={(code) => {
            onChange({ ...step, keys: [...step.keys, code] })
            setAdding(false)
          }}
        />
      )}
    </div>
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
