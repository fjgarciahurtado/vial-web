// SPDX-License-Identifier: GPL-2.0-or-later
import { ArrowRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { KeyPicker } from '@/components/KeyPicker'
import { KeySlot } from '@/components/KeySlot'
import { ModPicker } from '@/components/ModPicker'
import { Button } from '@/components/ui/button'
import {
  describeKeyOverride,
  EMPTY_KEY_OVERRIDE,
  isEmptyKeyOverride,
  keyOverrideProblem,
  NEW_KEY_OVERRIDE,
  OPTION,
  type KeyOverride,
} from '@/core/key-overrides'
import { useApp } from '@/store'

type Slot = 'trigger' | 'replacement'

const MORE_OPTIONS: { bit: number; title: string }[] = [
  {
    bit: OPTION.activateOnTriggerDown,
    title: 'Start when the key is pressed while the modifiers are held',
  },
  {
    bit: OPTION.activateOnModDown,
    title: 'Start when a modifier is pressed while the key is held',
  },
  {
    bit: OPTION.activateOnNegativeModUp,
    title: 'Start when a blocking modifier is let go',
  },
  {
    bit: OPTION.noUnregisterOnOtherKey,
    title: 'Keep going when another key is pressed',
  },
  {
    bit: OPTION.noReregisterTrigger,
    title: "Don't press the key again when the override ends",
  },
]

/**
 * Edits key overrides (editor/key_override.py). Like keys, each change is written to the
 * keyboard straight away.
 */
export function KeyOverridesPanel() {
  const { keyboard, setKeyOverride, busy } = useApp()
  const [current, setCurrent] = useState(0)
  const [slot, setSlot] = useState<Slot>('trigger')
  if (!keyboard) return null

  const { catalog, keyOverrides, layers } = keyboard
  const ko = keyOverrides[current] ?? EMPTY_KEY_OVERRIDE
  const firstFree = keyOverrides.findIndex(isEmptyKeyOverride)
  const problem = keyOverrideProblem(ko, layers)
  const allLayers = (1 << layers) - 1

  /** Changes the override. An unused slot starts from the usual settings: on, every layer. */
  const edit = (change: (current: KeyOverride) => Partial<KeyOverride>) =>
    setKeyOverride(current, (latest) => {
      const base = isEmptyKeyOverride(latest) && latest.options === 0 ? NEW_KEY_OVERRIDE : latest
      return { ...base, ...change(base) }
    })

  const open = (i: number) => {
    setCurrent(i)
    setSlot('trigger')
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft">
        A key override sends a different key when you press a key while holding certain modifiers. For example, Shift +
        Backspace can send Delete, while Backspace alone still deletes backwards.
      </p>

      <div className="flex flex-col gap-4 md:flex-row">
        <nav aria-label="Key overrides" className="flex max-h-[40svh] flex-none flex-col gap-1 overflow-y-auto md:w-64">
          {keyOverrides.map((k, i) => (
            <button
              key={i}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => open(i)}
              className={`flex flex-col rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                i === current ? 'bg-ink text-desk' : 'hover:bg-panel'
              }`}
            >
              <span className="font-semibold">Key override {i + 1}</span>
              <span className={`truncate text-sm ${i === current ? 'opacity-80' : 'text-ink-soft'}`}>
                {describeKeyOverride(k, catalog)}
              </span>
            </button>
          ))}
          {firstFree !== -1 && firstFree !== current && (
            <Button variant="ghost" className="justify-start" onClick={() => open(firstFree)}>
              <Plus aria-hidden />
              New key override
            </Button>
          )}
        </nav>

        <section
          aria-label={`Key override ${current + 1}`}
          className="flex min-w-0 flex-1 flex-col gap-5 self-start rounded-2xl bg-panel p-4 sm:p-5"
        >
          {!isEmptyKeyOverride(ko) && (
            <label className="flex items-center gap-3 font-semibold">
              <input
                type="checkbox"
                className="size-5 accent-pick"
                checked={(ko.options & OPTION.enabled) !== 0}
                onChange={(e) => {
                  const checked = e.target.checked
                  edit((k) => ({
                    options: checked ? k.options | OPTION.enabled : k.options & ~OPTION.enabled,
                  }))
                }}
              />
              Turned on
            </label>
          )}

          <ModPicker
            title="Hold these modifiers"
            mods={ko.triggerMods}
            onToggle={(bit) =>
              // Let go of the same modifiers too, unless someone chose differently: Shift + Backspace sends plain Delete.
              edit((k) => ({
                triggerMods: k.triggerMods ^ bit,
                ...(k.suppressedMods === k.triggerMods && {
                  suppressedMods: k.triggerMods ^ bit,
                }),
              }))
            }
          />
          {(ko.triggerMods & (ko.triggerMods - 1)) !== 0 && (
            <label className="-mt-3 flex items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-pick"
                checked={(ko.options & OPTION.oneMod) !== 0}
                onChange={(e) => {
                  const checked = e.target.checked
                  edit((k) => ({
                    options: checked ? k.options | OPTION.oneMod : k.options & ~OPTION.oneMod,
                  }))
                }}
              />
              Any one of them is enough
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <KeySlot
              wide
              catalog={catalog}
              label="Key"
              code={ko.trigger}
              selected={slot === 'trigger'}
              onSelect={() => setSlot('trigger')}
            />
            <ArrowRight aria-hidden className="mx-1 size-5 text-ink-soft" />
            <KeySlot
              wide
              catalog={catalog}
              label="Sends instead"
              code={ko.replacement}
              selected={slot === 'replacement'}
              onSelect={() => setSlot('replacement')}
            />
          </div>

          <ModPicker
            title="Let go of these modifiers while sending it"
            help="Usually the same as the ones you hold, so the new key is sent on its own."
            mods={ko.suppressedMods}
            onToggle={(bit) => edit((k) => ({ suppressedMods: k.suppressedMods ^ bit }))}
          />
          <ModPicker
            title="Don't override while holding"
            mods={ko.negativeMods}
            onToggle={(bit) => edit((k) => ({ negativeMods: k.negativeMods ^ bit }))}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-semibold">Works on layers</legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {Array.from({ length: layers }, (_, i) => (
                <label key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-pick"
                    checked={(ko.layers & (1 << i)) !== 0}
                    onChange={(e) => {
                      const checked = e.target.checked
                      edit((k) => ({
                        layers: checked ? k.layers | (1 << i) : k.layers & ~(1 << i),
                      }))
                    }}
                  />
                  {i === 0 ? 'Main layer' : `Layer ${i}`}
                </label>
              ))}
              <Button variant="ghost" size="sm" onClick={() => edit(() => ({ layers: 0xffff }))}>
                All
              </Button>
            </div>
          </fieldset>

          <details className="group">
            <summary className="cursor-pointer font-semibold">More options</summary>
            <div className="mt-3 flex flex-col gap-2">
              {MORE_OPTIONS.map(({ bit, title }) => (
                <label key={bit} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-pick"
                    checked={(ko.options & bit) !== 0}
                    onChange={(e) => {
                      const checked = e.target.checked
                      edit((k) => ({
                        options: checked ? k.options | bit : k.options & ~bit,
                      }))
                    }}
                  />
                  {title}
                </label>
              ))}
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className={problem ? 'font-semibold' : 'text-ink-soft'}>
              {problem ??
                (isEmptyKeyOverride(ko)
                  ? 'Choose the modifiers to hold and the key, then what it sends instead.'
                  : (ko.layers & allLayers) === allLayers
                    ? 'This key override works on every layer.'
                    : 'This key override is ready to use.')}
            </p>
            <Button
              variant="outline"
              disabled={busy || isEmptyKeyOverride(ko)}
              onClick={() => {
                setKeyOverride(current, () => EMPTY_KEY_OVERRIDE)
                setSlot('trigger')
              }}
            >
              Delete key override
            </Button>
          </div>
        </section>
      </div>

      <p className="font-semibold">{slot === 'trigger' ? 'Choose the key:' : 'Choose what it sends instead:'}</p>
      {/* Picks made while a change is being written wait their turn, so none is lost. */}
      <div className="flex h-[28rem] flex-col" aria-busy={busy}>
        <KeyPicker catalog={catalog} current={ko[slot]} onPick={(code) => edit(() => ({ [slot]: code }))} />
      </div>
    </div>
  )
}
