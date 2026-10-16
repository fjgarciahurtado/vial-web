// SPDX-License-Identifier: GPL-2.0-or-later
import { Keyboard as KeyboardIcon, Loader2, LockOpen, Redo2, Undo2, Unplug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BackupControls, RestoreConfirmation } from '@/components/BackupControls'
import { CombosPanel } from '@/components/CombosPanel'
import { KeyPicker } from '@/components/KeyPicker'
import { KeyTester } from '@/components/KeyTester'
import { KeyboardView } from '@/components/KeyboardView'
import { LayoutOptions } from '@/components/LayoutOptions'
import { MacroEditor } from '@/components/MacroEditor'
import { LightingPanel, lightingGlow } from '@/components/LightingPanel'
import { QmkSettingsPanel } from '@/components/QmkSettingsPanel'
import { TapDancePanel } from '@/components/TapDancePanel'
import { KeyOverridesPanel } from '@/components/KeyOverridesPanel'
import { UnlockDialog } from '@/components/UnlockDialog'
import { Button } from '@/components/ui/button'
import { openDemoKeyboard } from '@/core/demo'
import type { LoadedKeyboard } from '@/core/keyboard'
import { isWebHidSupported } from '@/core/webhid-transport'
import { useApp } from '@/store'

export default function App() {
  const keyboard = useApp((s) => s.keyboard)
  const view = useApp((s) => s.view)

  return (
    // With a keyboard open, the page fills the window exactly: the keyboard and the
    // picker share the screen and the picker scrolls inside itself.
    <div className={keyboard ? 'flex h-svh flex-col' : 'min-h-svh'}>
      <header className={`mx-auto flex w-full max-w-6xl flex-none items-center justify-between px-6 ${keyboard ? 'py-3' : 'py-5'}`}>
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <KeyboardIcon className="size-5" aria-hidden />
          Vial
        </span>
        {keyboard && <ViewNav />}
        {keyboard && <ConnectedBadge />}
      </header>
      {keyboard ? (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto h-full max-w-6xl px-6">{view === 'lighting' ? (
              <LightingView />
            ) : view === 'tester' ? (
              <KeyTester />
            ) : view === 'macros' ? (
              <MacroEditor />
            ) : view === 'advanced' ? (
              <AdvancedView />
            ) : (
              <Editor />
            )}</div>
        </main>
      ) : (
        <main className="mx-auto max-w-6xl px-6 pb-16">
          <Welcome />
        </main>
      )}
      <UnlockDialog />
    </div>
  )
}

function Welcome() {
  const { status, error, connect, openDemo, knownDevices, refreshKnownDevices } = useApp()
  const supported = isWebHidSupported()
  const preview = useDemoPreview()

  useEffect(() => {
    if (!supported) return
    refreshKnownDevices()
    navigator.hid.addEventListener('connect', refreshKnownDevices)
    navigator.hid.addEventListener('disconnect', refreshKnownDevices)
    return () => {
      navigator.hid.removeEventListener('connect', refreshKnownDevices)
      navigator.hid.removeEventListener('disconnect', refreshKnownDevices)
    }
  }, [supported, refreshKnownDevices])

  const connecting = status === 'connecting'
  return (
    <section className="flex flex-col items-center gap-14 pt-12 sm:pt-20">
      <div className="flex max-w-xl flex-col items-start gap-6 self-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Change what every key on your keyboard does.</h1>
        <p className="text-lg text-ink-soft">
          Plug in a keyboard that runs Vial firmware, then connect it here. Changes save to the keyboard itself, so they
          work on any computer.
        </p>

        {supported ? (
          <div className="flex flex-wrap gap-3">
            {knownDevices.map((device, i) => (
              <Button
                key={i}
                size="lg"
                className="h-12 bg-pick px-6 text-base hover:bg-pick-skirt"
                onClick={() => connect(device)}
                disabled={connecting}
              >
                Open {device.productName || 'keyboard'}
              </Button>
            ))}
            <Button
              size="lg"
              variant={knownDevices.length ? 'outline' : 'default'}
              className={knownDevices.length ? 'h-12 px-6 text-base' : 'h-12 bg-pick px-6 text-base hover:bg-pick-skirt'}
              onClick={() => connect()}
              disabled={connecting}
            >
              {connecting && <Loader2 className="animate-spin" aria-hidden />}
              {connecting ? 'Reading keyboard…' : knownDevices.length ? 'Connect another keyboard' : 'Connect keyboard'}
            </Button>
            <Button size="lg" variant="ghost" className="h-12 px-6 text-base" onClick={openDemo}>
              Try a demo keyboard
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p role="alert" className="rounded-lg bg-panel p-4 text-ink">
              This browser can't talk to keyboards. Open this page in Chrome or Edge on a computer.
            </p>
            <Button size="lg" variant="outline" className="h-12 w-fit px-6 text-base" onClick={openDemo}>
              Try a demo keyboard
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg border-l-4 border-alert bg-panel p-4 text-ink">
            {error}
          </p>
        )}
      </div>
      <div className="w-full max-w-4xl opacity-90">
        {preview && (
          <KeyboardView
            keys={preview.keys}
            encoders={preview.encoders}
            keycodes={preview.keymap[0]}
            encoderCodes={preview.encoderKeymap[0]}
            layoutChoices={preview.layoutChoices}
            catalog={preview.catalog}
          />
        )}
      </div>
    </section>
  )
}

/** The demo keyboard, drawn on the welcome screen so people see what the app is for. */
function useDemoPreview(): LoadedKeyboard | null {
  const [preview, setPreview] = useState<LoadedKeyboard | null>(null)
  useEffect(() => {
    let live = true
    openDemoKeyboard().then(({ keyboard }) => live && setPreview(keyboard))
    return () => {
      live = false
    }
  }, [])
  return preview
}

function ConnectedBadge() {
  const { keyboard, isDemo, disconnect, unlocked, lock } = useApp()
  return (
    <div className="flex items-center gap-3">
      {unlocked && (
        <Button variant="outline" size="sm" onClick={lock} title="The keyboard accepts risky changes until you lock it or unplug it">
          <LockOpen aria-hidden />
          Unlocked. Lock now
        </Button>
      )}
      <span className="text-sm text-ink-soft">{isDemo ? 'Demo mode' : `Connected to ${keyboard?.name}`}</span>
      <Button variant="outline" size="sm" onClick={disconnect}>
        <Unplug aria-hidden />
        {isDemo ? 'Leave demo' : 'Disconnect'}
      </Button>
    </div>
  )
}

/** Switches between the app's sections. Lighting, Macros and Advanced show only on keyboards that have them. */
function ViewNav() {
  const { keyboard, view, setView } = useApp()
  if (!keyboard) return null
  const { backlight, rgblight, vialrgb } = keyboard.lightingKind
  const views = [
    { id: 'keys' as const, title: 'Keys' },
    ...(backlight || rgblight || vialrgb ? [{ id: 'lighting' as const, title: 'Lighting' }] : []),
    ...(keyboard.macros.length ? [{ id: 'macros' as const, title: 'Macros' }] : []),
    { id: 'tester' as const, title: 'Key tester' },
    ...(advancedTabs(keyboard).length ? [{ id: 'advanced' as const, title: 'Advanced' }] : []),
  ]
  if (views.length < 2) return null
  return (
    <nav aria-label="Sections" className="flex gap-1 rounded-xl bg-panel p-1">
      {views.map((v) => (
        <button
          key={v.id}
          aria-current={view === v.id ? 'page' : undefined}
          onClick={() => setView(v.id)}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
            view === v.id ? 'bg-ink text-desk' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {v.title}
        </button>
      ))}
    </nav>
  )
}

function LightingView() {
  const { keyboard, notice } = useApp()
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
        className="max-h-[32svh] w-full flex-none"
        glow={lightingGlow(keyboard.lighting)}
      />
      <p className="min-h-6 w-full" aria-live="polite">
        {notice}
      </p>
      <LightingPanel />
    </div>
  )
}

type AdvancedTab = 'tapDance' | 'combos' | 'keyOverrides' | 'settings'

/** The Advanced features this keyboard has. */
function advancedTabs(keyboard: LoadedKeyboard): { id: AdvancedTab; title: string }[] {
  return [
    ...(keyboard.tapDances.length ? [{ id: 'tapDance' as const, title: 'Tap dance' }] : []),
    ...(keyboard.combos.length ? [{ id: 'combos' as const, title: 'Combos' }] : []),
    ...(keyboard.keyOverrides.length ? [{ id: 'keyOverrides' as const, title: 'Key overrides' }] : []),
    ...(keyboard.qmkSettings.supported.length ? [{ id: 'settings' as const, title: 'Typing settings' }] : []),
  ]
}

/** Features most people never need, each explained in plain words. */
function AdvancedView() {
  const { keyboard, notice } = useApp()
  const [chosen, setChosen] = useState<AdvancedTab | null>(null)
  if (!keyboard) return null
  const tabs = advancedTabs(keyboard)
  const tab = tabs.find((t) => t.id === chosen)?.id ?? tabs[0]?.id
  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Advanced</h1>
        {tabs.length > 1 && (
          <div role="tablist" aria-label="Advanced features" className="flex gap-1 rounded-xl bg-panel p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setChosen(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                  tab === t.id ? 'bg-ink text-desk' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {t.title}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="min-h-6 w-full" aria-live="polite">
        {notice}
      </p>
      {tab === 'tapDance' && <TapDancePanel />}
      {tab === 'combos' && <CombosPanel />}
      {tab === 'keyOverrides' && <KeyOverridesPanel />}
      {tab === 'settings' && (
        <>
          <p className="text-ink-soft">
            Fine-tune how {keyboard.name} behaves. The defaults suit most people, so change these only if something feels off.
          </p>
          <QmkSettingsPanel />
        </>
      )}
    </div>
  )
}

function Editor() {
  const { keyboard, layer, setLayer, selected, select, assign, undo, redo, canUndo, canRedo, notice, busy, setLayoutChoice } =
    useApp()
  useUndoShortcuts()
  if (!keyboard) return null
  const code = !selected
    ? null
    : selected.kind === 'key'
      ? keyboard.keymap[layer][selected.row][selected.col]
      : keyboard.encoderKeymap[layer][selected.index][selected.direction]
  const what = selected?.kind === 'encoder' ? `Turning the knob ${selected.direction ? 'right' : 'left'}` : 'This key'

  return (
    <>
    <section className="flex h-full min-h-[34rem] flex-col items-center gap-3 pb-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{keyboard.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Layers" className="flex gap-1 rounded-xl bg-panel p-1">
            {Array.from({ length: keyboard.layers }, (_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={layer === i}
                onClick={() => setLayer(i)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                  layer === i ? 'bg-ink text-desk' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {i === 0 ? 'Main layer' : `Layer ${i}`}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={undo} disabled={!canUndo || busy} title="Undo (Ctrl+Z)">
            <Undo2 aria-hidden />
            Undo change
          </Button>
          <Button variant="outline" onClick={redo} disabled={!canRedo || busy} title="Redo (Ctrl+Y)">
            <Redo2 aria-hidden />
            Redo change
          </Button>
        </div>
      </div>

      <KeyboardView
        keys={keyboard.keys}
        encoders={keyboard.encoders}
        keycodes={keyboard.keymap[layer]}
        encoderCodes={keyboard.encoderKeymap[layer]}
        layoutChoices={keyboard.layoutChoices}
        catalog={keyboard.catalog}
        selected={selected}
        onSelect={select}
        className="max-h-[38svh] w-full flex-none"
        glow={lightingGlow(keyboard.lighting)}
      />

      <RestoreConfirmation />

      <p className="min-h-6 w-full text-ink" aria-live="polite">
        {notice ??
          (selected && code !== null
            ? `${what} is ${keyboard.catalog.describe(code).name}. Choose what it should do instead.`
            : 'Pick a key or knob on the keyboard, then choose what it should do below.')}
      </p>

      <KeyPicker catalog={keyboard.catalog} current={code} onPick={assign} />
    </section>

    <div className="flex flex-col gap-4 pb-10">

      <LayoutOptions
        options={keyboard.layoutOptions}
        choices={keyboard.layoutChoices}
        disabled={busy}
        onChange={setLayoutChoice}
      />

      <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel px-4 py-3 sm:px-5">
        <p className="text-ink-soft">Keep a copy of your keymap, or bring back an earlier one. Files also work in Vial.</p>
        <BackupControls />
      </div>
    </div>
    </>
  )
}

/** Ctrl+Z undoes, Ctrl+Y or Ctrl+Shift+Z redoes. Cmd works too. Leaves text fields alone. */
function useUndoShortcuts() {
  const { undo, redo } = useApp()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.target instanceof HTMLInputElement) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])
}
