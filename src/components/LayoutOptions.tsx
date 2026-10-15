// SPDX-License-Identifier: GPL-2.0-or-later
import type { LayoutOption } from '@/core/layout'

interface Props {
  options: LayoutOption[]
  choices: number[]
  disabled: boolean
  onChange(option: number, choice: number): void
}

/** Lets people match the drawing to their physical keys, such as a split backspace. */
export function LayoutOptions({ options, choices, disabled, onChange }: Props) {
  if (options.length === 0) return null
  return (
    <details className="w-full rounded-2xl bg-panel px-4 py-3 sm:px-5">
      <summary className="cursor-pointer font-semibold">Does the drawing match your keyboard?</summary>
      <p className="mt-2 text-ink-soft">
        Some keyboards come in different shapes. Choose the one that matches your keys. This only changes the drawing,
        not what the keys do.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {options.map((option, i) =>
          option.choices ? (
            <label key={i} className="flex flex-wrap items-center gap-3">
              <span className="min-w-40">{option.title}</span>
              <select
                value={choices[i] ?? 0}
                disabled={disabled}
                onChange={(e) => onChange(i, Number(e.target.value))}
                className="h-10 rounded-lg border border-line bg-field px-3 focus-visible:outline-2 focus-visible:outline-pick"
              >
                {option.choices.map((name, value) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label key={i} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={(choices[i] ?? 0) === 1}
                disabled={disabled}
                onChange={(e) => onChange(i, e.target.checked ? 1 : 0)}
                className="size-5 accent-pick"
              />
              <span>{option.title}</span>
            </label>
          ),
        )}
      </div>
    </details>
  )
}
