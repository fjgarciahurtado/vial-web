// SPDX-License-Identifier: GPL-2.0-or-later
import { MODS } from '@/core/key-overrides'

/** Eight modifier switches, left and right side. */
export function ModPicker({
  title,
  help,
  mods,
  onToggle,
}: {
  title: string
  help?: string
  mods: number
  /** Gets the modifier's bit; the change is applied to the latest value, so quick clicks all count. */
  onToggle(bit: number): void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold">{title}</legend>
      {help && <p className="-mt-1 text-sm text-ink-soft">{help}</p>}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {(['Left', 'Right'] as const).map((side) => (
          <div key={side} className="flex flex-wrap items-center gap-1.5">
            <span className="w-10 text-sm text-ink-soft">{side}</span>
            {MODS.filter((m) => m.side === side).map((m) => {
              const on = (mods & (1 << m.bit)) !== 0
              return (
                <button
                  key={m.bit}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${side} ${m.name}`}
                  onClick={() => onToggle(1 << m.bit)}
                  className={`rounded-md border-b-[3px] px-2.5 py-1 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pick ${
                    on ? 'border-pick-skirt bg-pick text-white' : 'border-cap-skirt bg-cap text-legend'
                  }`}
                >
                  {m.name}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </fieldset>
  )
}
