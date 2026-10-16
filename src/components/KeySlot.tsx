// SPDX-License-Identifier: GPL-2.0-or-later
import type { KeycodeCatalog } from '@/core/keycodes/catalog'

/**
 * A labelled keycap that holds one key of a combo or tap dance. Click it, then pick a
 * key below to fill it. Empty slots have a dashed outline.
 */
export function KeySlot({
  catalog,
  label,
  code,
  selected,
  onSelect,
  wide = false,
}: {
  catalog: KeycodeCatalog
  label: string
  code: number
  selected: boolean
  onSelect(): void
  wide?: boolean
}) {
  const name = code ? catalog.describe(code).name : 'empty'
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${label}: ${name}`}
      onClick={onSelect}
      className={`flex h-14 flex-col items-center justify-center rounded-lg border-b-4 px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pick ${
        wide ? 'min-w-24' : 'min-w-14'
      } ${
        selected
          ? 'border-pick-skirt bg-pick text-white'
          : code
            ? 'border-cap-skirt bg-cap text-legend'
            : 'border-dashed border-line bg-field text-ink-soft'
      }`}
    >
      <span className="text-[10px] font-normal opacity-80">{label}</span>
      <span>{code ? (catalog.describe(code).legend.at(-1) ?? name) : '—'}</span>
    </button>
  )
}
