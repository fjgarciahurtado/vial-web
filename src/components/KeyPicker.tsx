// SPDX-License-Identifier: GPL-2.0-or-later
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { KeycodeCatalog, KeycodeEntry } from '@/core/keycodes/catalog'
import { pickerCategories } from '@/core/keycodes/categories'

const MAX_RESULTS = 60

interface Props {
  catalog: KeycodeCatalog
  /** Code on the selected key, highlighted in the grid. Null when no key is selected. */
  current: number | null
  onPick(code: number): void
}

/** Lets people choose what the selected key does, by browsing categories or searching in plain words. */
export function KeyPicker({ catalog, current, onPick }: Props) {
  const categories = useMemo(() => pickerCategories(catalog), [catalog])
  const [tab, setTab] = useState(0)
  const [query, setQuery] = useState('')
  const disabled = current === null

  const searching = query.trim() !== ''
  const entries = searching
    ? catalog
        .search(query)
        .filter((e) => !e.masked)
        .slice(0, MAX_RESULTS)
    : (categories[tab]?.entries ?? [])

  return (
    <section
      aria-label="Choose what the key does"
      className="flex min-h-0 w-full flex-1 flex-col gap-3 rounded-2xl bg-panel p-3 sm:p-4 md:flex-row md:gap-5"
    >
      {/* Wide screens: search with the categories under it, beside the keys.
          Narrow screens: categories become one row that scrolls sideways. */}
      <div className="flex min-h-0 flex-none flex-col gap-2 md:w-72">
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-ink-soft" aria-hidden />
          <span className="sr-only">Search keys</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, like “volume up”"
            className="h-10 w-full rounded-xl border border-line bg-field pl-9 pr-3 text-base text-ink placeholder:text-ink-soft focus-visible:outline-2 focus-visible:outline-pick"
          />
        </label>

        <div
          role="tablist"
          aria-label="Key categories"
          className="-my-1 flex min-h-0 gap-1 overflow-x-auto py-1 md:my-0 md:grid md:grid-cols-2 md:content-start md:overflow-x-visible md:overflow-y-auto"
        >
          {categories.map((c, i) => {
            const active = !searching && tab === i
            return (
              <button
                key={c.title}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(i)
                  setQuery('')
                }}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-left text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-pick md:truncate ${
                  active ? 'bg-ink text-desk' : 'text-ink-soft hover:bg-field hover:text-ink'
                }`}
              >
                {c.title}
              </button>
            )
          })}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-ink-soft">No keys match “{query}”. Try a different word.</p>
      ) : (
        <ul
          className="-mx-1 grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] content-start gap-2 overflow-y-auto px-1 pt-1 pb-1"
          aria-label="Keys"
        >
          {entries.map((entry) => (
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
    </section>
  )
}

function PickerKey({
  entry,
  catalog,
  isCurrent,
  disabled,
  onPick,
}: {
  entry: KeycodeEntry
  catalog: KeycodeCatalog
  isCurrent: boolean
  disabled: boolean
  onPick(code: number): void
}) {
  const { name, legend, tooltip } = catalog.describe(entry.code)
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={isCurrent}
      aria-label={name}
      title={tooltip && tooltip !== name ? `${name}: ${tooltip}` : name}
      onClick={() => onPick(entry.code)}
      className={`flex h-14 w-full flex-col items-start justify-start overflow-hidden rounded-lg border-b-4 px-2 py-1.5 text-left text-xs font-semibold leading-tight transition-[transform,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pick enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${
        isCurrent ? 'border-pick-skirt bg-pick text-white' : 'border-cap-skirt bg-cap text-legend'
      }`}
    >
      {legend.length === 0 ? <span className="text-mod-skirt">None</span> : legend.slice(0, 3).map((l, i) => <span key={i}>{l}</span>)}
    </button>
  )
}
