// SPDX-License-Identifier: GPL-2.0-or-later
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { KeycodeCatalog, KeycodeEntry } from '@/core/keycodes/catalog'

const MAX_KEYS = 40

interface Props {
  catalog: KeycodeCatalog
  /** Keys people can choose from. */
  choices: KeycodeEntry[]
  label: string
  /** The chosen key, highlighted; null when none is chosen. */
  value: number | null
  onChange(code: number): void
  /** Shows the chosen key's name after the label. */
  showValue?: boolean
}

/** A compact key chooser: plain-word search over a set of keys, shown as small keycaps. */
export function KeyChoiceField({ catalog, choices, label, value, onChange, showValue = true }: Props) {
  const [query, setQuery] = useState('')
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
        {label}
        {showValue && (
          <>
            : <span className="font-normal">{value !== null && value > 1 ? catalog.describe(value).name : 'choose a key'}</span>
          </>
        )}
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
        {shown.length === 0 && <p className="text-ink-soft">No keys match “{query}”.</p>}
      </div>
    </fieldset>
  )
}
