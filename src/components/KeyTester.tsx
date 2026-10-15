// SPDX-License-Identifier: GPL-2.0-or-later
import { LockOpen, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { KeyboardView } from '@/components/KeyboardView'
import { Button } from '@/components/ui/button'
import { placeKeys } from '@/core/layout'
import { matrixTesterSupported, readMatrix } from '@/core/matrix'
import { useApp } from '@/store'

/** vial-gui polls every 20 ms; a little slower is still instant to the eye and lighter on the keyboard. */
const POLL_MS = 30

type Pos = { row: number; col: number }

/**
 * Shows which keys are pressed, straight from the keyboard's switches, so people
 * can check that every key works. Ported from vial-gui editor/matrix_test.py.
 */
export function KeyTester() {
  const { keyboard, client, unlocked, unlock, isDemo, pressDemoKey } = useApp()
  const [down, setDown] = useState<Pos[]>([])
  const [passed, setPassed] = useState<Map<string, Pos>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const supported = keyboard ? matrixTesterSupported(keyboard.vialProtocol, keyboard.rows, keyboard.cols) : false
  const testing = supported && unlocked && !error

  // Poll the switches while the tester is open.
  useEffect(() => {
    if (!testing || !client || !keyboard) return
    let stopped = false
    const poll = async () => {
      while (!stopped) {
        try {
          const matrix = await readMatrix(client, keyboard.rows, keyboard.cols)
          const now = matrix.flatMap((cols, row) => cols.flatMap((on, col) => (on ? [{ row, col }] : [])))
          if (stopped) return
          setDown(now)
          if (now.length) setPassed((p) => (now.every((k) => p.has(key(k))) ? p : new Map([...p, ...now.map((k) => [key(k), k] as const)])))
        } catch (err) {
          setError(err instanceof Error ? err.message : 'The keyboard stopped answering.')
          return
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS))
      }
    }
    poll()
    return () => {
      stopped = true
    }
  }, [testing, client, keyboard])

  // Keys pressed for testing shouldn't also click buttons or scroll the page.
  useEffect(() => {
    if (!testing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      if (isDemo && !e.repeat) pressDemoKey(e.code, e.type === 'keydown')
    }
    ;(document.activeElement as HTMLElement | null)?.blur()
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [testing, isDemo, pressDemoKey])

  // Keys shown for the chosen layout options; placeKeys also drops decals.
  const total = useMemo(
    () => (keyboard ? new Set(placeKeys(keyboard.keys, keyboard.layoutChoices).map(key)).size : 0),
    [keyboard],
  )
  if (!keyboard) return null

  return (
    <div className="flex flex-col items-center gap-4 pb-10">
      <h1 className="w-full text-2xl font-bold tracking-tight">{keyboard.name}</h1>
      <KeyboardView
        keys={keyboard.keys}
        encoders={keyboard.encoders}
        keycodes={keyboard.keymap[0]}
        encoderCodes={keyboard.encoderKeymap[0]}
        layoutChoices={keyboard.layoutChoices}
        catalog={keyboard.catalog}
        highlighted={down}
        passed={[...passed.values()]}
        className="max-h-[42svh] w-full flex-none"
      />

      {!supported ? (
        <p className="w-full rounded-2xl bg-panel p-4">
          This keyboard can't report key presses to the app. Updating it to the latest Vial firmware may add this.
        </p>
      ) : !unlocked ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel p-4">
          <p>To test keys, unlock the keyboard first. It only shares key presses with the app while unlocked.</p>
          <Button className="bg-pick hover:bg-pick-skirt" onClick={unlock}>
            <LockOpen aria-hidden />
            Unlock to test
          </Button>
        </div>
      ) : error ? (
        <p role="alert" className="w-full rounded-2xl border-l-4 border-alert bg-panel p-4">
          Testing stopped: {error}
        </p>
      ) : (
        <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel p-4">
          <div>
            <p>
              Press each key. It turns <strong>blue</strong> while held and <strong>green</strong> once it has worked.
              Keys that stay grey may not be working.
            </p>
            {isDemo && <p className="text-ink-soft">This is the demo, so press keys on your own keyboard.</p>}
          </div>
          <div className="flex items-center gap-3">
            <p aria-live="polite" className="font-semibold">
              {passed.size} of {total} keys work
            </p>
            <Button variant="outline" onClick={() => setPassed(new Map())} disabled={passed.size === 0}>
              <RotateCcw aria-hidden />
              Start again
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function key({ row, col }: Pos): string {
  return `${row},${col}`
}
