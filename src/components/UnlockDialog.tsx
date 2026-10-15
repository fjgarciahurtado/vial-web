// SPDX-License-Identifier: GPL-2.0-or-later
import { useEffect, useRef } from 'react'
import { KeyboardView } from '@/components/KeyboardView'
import { useApp } from '@/store'

/**
 * Asks the person to hold the unlock keys, as vial-gui's Unlocker does. There is
 * no cancel button: the firmware stays in unlock mode until it finishes or the
 * keyboard is unplugged.
 */
export function UnlockDialog() {
  const { unlocking, keyboard, layer, isDemo } = useApp()
  const panel = useRef<HTMLDivElement>(null)
  const open = unlocking !== null
  useEffect(() => {
    if (open) panel.current?.focus()
  }, [open])
  if (!unlocking || !keyboard) return null

  const percent = Math.round(unlocking.progress * 100)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlock-title"
        className="flex w-full max-w-3xl flex-col gap-4 rounded-2xl bg-desk p-6 shadow-2xl outline-none"
      >
        <h2 id="unlock-title" className="text-2xl font-bold tracking-tight">
          Unlock your keyboard
        </h2>
        <p>
          This change needs extra permission, so nobody can make it without touching the keyboard.{' '}
          <strong>Press and hold the highlighted keys</strong> until the bar is full.
        </p>
        <KeyboardView
          keys={keyboard.keys}
          encoders={keyboard.encoders}
          keycodes={keyboard.keymap[layer]}
          encoderCodes={keyboard.encoderKeymap[layer]}
          layoutChoices={keyboard.layoutChoices}
          catalog={keyboard.catalog}
          highlighted={unlocking.keys}
        />
        <div
          role="progressbar"
          aria-label="Unlock progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-3 overflow-hidden rounded-full bg-cap-skirt"
        >
          <div className="h-full bg-pick transition-[width] duration-200" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-sm text-ink-soft">
          {isDemo
            ? 'This is the demo keyboard, so it holds the keys for you.'
            : 'Only unlock on a computer you trust. The keyboard locks again when you unplug it, or when you choose Lock.'}
        </p>
      </div>
    </div>
  )
}
