// SPDX-License-Identifier: GPL-2.0-or-later
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  availableModifierSets,
  buildCombined,
  innerKeyChoices,
  MOD,
  parseCombined,
  type CombinedKind,
  type CombinedSettings,
} from '@/core/keycodes/builders'
import type { KeycodeCatalog } from '@/core/keycodes/catalog'

const MAX_KEYS = 40

const KINDS: { kind: CombinedKind; title: string; text: string }[] = [
  { kind: 'shortcut', title: 'Shortcut', text: 'Presses several keys at once, like Ctrl + C.' },
  { kind: 'modtap', title: 'Tap or hold: modifier', text: 'Tap for one key, hold for Ctrl, Shift, Alt or Win.' },
  { kind: 'layertap', title: 'Tap or hold: layer', text: 'Tap for one key, hold to use another layer.' },
]

const MODIFIERS: { bit: number; name: string }[] = [
  { bit: MOD.ctrl, name: 'Ctrl' },
  { bit: MOD.shift, name: 'Shift' },
  { bit: MOD.alt, name: 'Alt' },
  { bit: MOD.gui, name: 'Win/Cmd' },
]

interface Props {
  catalog: KeycodeCatalog
  /** Code on the selected key, or null when no key is selected. */
  current: number | null
  onPick(code: number): void
}

/** Builds keys that combine two things, such as Ctrl + C or "tap for Esc, hold for Ctrl". */
export function CombinedBuilder({ catalog, current, onPick }: Props) {
  const [settings, setSettings] = useState(() => initialSettings(catalog, current))
  const [lastCurrent, setLastCurrent] = useState(current)
  // Start again from the newly selected key, as React recommends instead of an effect.
  if (current !== lastCurrent) {
    setLastCurrent(current)
    setSettings(initialSettings(catalog, current))
  }

  const layers = useMemo(
    () =>
      catalog
        .available()
        .filter((e) => e.masked && /^LT\d+\(kc\)$/.test(e.id))
        .map((e) => e.index!),
    [catalog],
  )
  const code = buildCombined(catalog, settings)
  const mods = settings.kind === 'layertap' ? 0 : settings.mods
  const right = (mods & MOD.right) !== 0

  const setKind = (kind: CombinedKind) =>
    setSettings((s) =>
      kind === 'layertap' ? { kind, layer: layers[1] ?? layers[0] ?? 0, inner: s.inner } : { kind, mods: s.kind === 'layertap' ? MOD.ctrl : s.mods, inner: s.inner },
    )
  const setMods = (next: number) => setSettings((s) => (s.kind === 'layertap' ? s : { ...s, mods: next }))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">Kind of key</legend>
        {KINDS.map(({ kind, title, text }) => (
          <label
            key={kind}
            className={`relative flex cursor-pointer flex-col gap-0.5 rounded-xl border-2 p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-pick ${
              settings.kind === kind ? 'border-pick bg-field' : 'border-transparent bg-field/60 hover:bg-field'
            }`}
          >
            <input
              type="radio"
              name="combined-kind"
              className="absolute inset-0 cursor-pointer opacity-0"
              checked={settings.kind === kind}
              onChange={() => setKind(kind)}
            />
            <span className="font-semibold">{title}</span>
            <span className="text-sm text-ink-soft">{text}</span>
          </label>
        ))}
      </fieldset>

      {settings.kind === 'layertap' ? (
        <label className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">Hold for</span>
          <select
            value={settings.layer}
            onChange={(e) => setSettings({ ...settings, layer: Number(e.target.value) })}
            className="h-10 rounded-lg border border-line bg-field px-3 focus-visible:outline-2 focus-visible:outline-pick"
          >
            {layers.map((l) => (
              <option key={l} value={l}>
                {l === 0 ? 'Main layer' : `Layer ${l}`}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-2 font-semibold">{settings.kind === 'shortcut' ? 'Hold down' : 'Hold for'}</legend>
          {MODIFIERS.map(({ bit, name }) => (
            <label
              key={name}
              className={`relative cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-pick ${
                mods & bit ? 'border-ink bg-ink text-desk' : 'border-line bg-field text-ink hover:border-ink-soft'
              }`}
            >
              <input
                type="checkbox"
                className="absolute inset-0 cursor-pointer opacity-0"
                checked={(mods & bit) !== 0}                 onChange={() => setMods(mods ^ bit)}
              />
              {name}
            </label>
          ))}
          <label className="ml-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-pick"
              checked={right}
              onChange={() => setMods(mods ^ MOD.right)}
            />
            Use the right-hand keys
          </label>
        </fieldset>
      )}

      <InnerKeyField
        catalog={catalog}
        label={settings.kind === 'shortcut' ? 'And press' : 'Tap for'}
        value={settings.inner}
        onChange={(inner) => setSettings({ ...settings, inner })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p aria-live="polite">{resultText(catalog, settings, code)}</p>
        <Button
          className="bg-pick hover:bg-pick-skirt"
          disabled={code === undefined || current === null}
          onClick={() => code !== undefined && onPick(code)}
        >
          Use on this key
        </Button>
      </div>
    </div>
  )
}

function InnerKeyField({
  catalog,
  label,
  value,
  onChange,
}: {
  catalog: KeycodeCatalog
  label: string
  value: number
  onChange(code: number): void
}) {
  const [query, setQuery] = useState('')
  const choices = useMemo(() => innerKeyChoices(catalog), [catalog])
  const shown = useMemo(() => {
    if (!query.trim()) return choices.slice(0, MAX_KEYS)
    const allowed = new Set(choices.map((c) => c.code))
    return catalog
      .search(query)
      .filter((e) => allowed.has(e.code))
      .slice(0, MAX_KEYS)
  }, [catalog, choices, query])

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold">
        {label}: <span className="font-normal">{value > 1 ? catalog.describe(value).name : 'choose a key'}</span>
      </legend>
      <label className="relative flex items-center sm:w-72">
        <Search className="pointer-events-none absolute left-3 size-4 text-ink-soft" aria-hidden />
        <span className="sr-only">Search for the key</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search, like “escape”"
          className="h-9 w-full rounded-lg border border-line bg-field pl-9 pr-3 text-ink placeholder:text-ink-soft focus-visible:outline-2 focus-visible:outline-pick"
        />
      </label>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {shown.map((entry) => {
          const { name, legend } = catalog.describe(entry.code)
          const checked = entry.code === value
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={name}
              title={name}
              onClick={() => onChange(entry.code)}
              className={`min-w-10 rounded-md border-b-[3px] px-2 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pick ${
                checked ? 'border-pick-skirt bg-pick text-white' : 'border-cap-skirt bg-cap text-legend'
              }`}
            >
              {legend.at(-1) ?? name}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function initialSettings(catalog: KeycodeCatalog, current: number | null): CombinedSettings {
  const parsed = current === null ? null : parseCombined(catalog, current)
  if (parsed) return parsed
  // Start from the key's own action when it can be the key to tap, e.g. Space.
  const inner = current !== null && current > 0x01 && current < 0xff ? current : 0x06 // C
  return { kind: 'shortcut', mods: MOD.ctrl, inner }
}

function resultText(catalog: KeycodeCatalog, settings: CombinedSettings, code: number | undefined): string {
  if (code !== undefined) return `This key will be: ${catalog.describe(code).name}.`
  if (settings.kind !== 'layertap' && (settings.mods & 0x0f) === 0) return 'Choose at least one key to hold.'
  if (settings.kind !== 'layertap' && !availableModifierSets(catalog, settings.kind).includes(settings.mods)) {
    return "Keyboards can't use this mix of keys. Try fewer of them."
  }
  return 'Choose a key.'
}
