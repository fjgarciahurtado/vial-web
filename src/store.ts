// SPDX-License-Identifier: GPL-2.0-or-later
import { create } from 'zustand'
import { describeCombo, writeCombo, type Combo } from './core/combos'
import { describeTapDance, TAP_DANCE_ACTIONS, writeTapDance, type TapDance } from './core/tap-dance'
import { createBackup, parseBackup, planRestore, type RestorePlan } from './core/backup'
import { openDemoKeyboard, pressDemoKey } from './core/demo'
import { serializeMacros, type Macro } from './core/macros'
import type { FakeKeyboard } from './core/fake-keyboard'
import { loadKeyboard, type LoadedKeyboard } from './core/keyboard'
import { KeymapEditor, type Target } from './core/keymap-editor'
import { packLayoutChoices, unpackLayoutChoices } from './core/layout'
import { LightingController, type LightingState } from './core/lighting'
import { readQmkSettings, withFieldValue, writeQmkSettings, type QmkSettingValues, type SettingField } from './core/qmk-settings'
import type { HidTransport } from './core/transport'
import { unlockKeyboard } from './core/unlock'
import { VialClient } from './core/vial-client'
import { isWebHidSupported, WebHidTransport } from './core/webhid-transport'

type Status = 'idle' | 'connecting' | 'ready' | 'error'

/** The main areas of the app once a keyboard is open. */
export type View = 'keys' | 'lighting' | 'tester' | 'macros' | 'advanced'

/** The key or knob direction being edited, on the current layer. */
export type Selection = { kind: 'key'; row: number; col: number } | { kind: 'encoder'; index: number; direction: number }

const KNOB_TURNS = ['Turn left', 'Turn right']

/** State with no keyboard open. */
const CLOSED = {
  macroDrafts: [],
  settingsDraft: {},
  demo: null,
  view: 'keys' as View,
  lights: null,
  keyboard: null,
  transport: null,
  editor: null,
  client: null,
  isDemo: false,
  selected: null,
  notice: null,
  pendingRestore: null,
  unlocking: null,
  unlocked: false,
  canUndo: false,
  canRedo: false,
}

interface AppState {
  status: Status
  error: string | null
  keyboard: LoadedKeyboard | null
  isDemo: boolean
  layer: number
  selected: Selection | null
  transport: HidTransport | null
  editor: KeymapEditor | null
  client: VialClient | null
  /** Set while the unlock wizard is showing. */
  unlocking: { keys: { row: number; col: number }[]; progress: number } | null
  unlocked: boolean
  canUndo: boolean
  canRedo: boolean
  /** One-line message about the last change, read out to screen readers. */
  notice: string | null
  busy: boolean
  /** A restore waiting for the person to confirm, because the backup is from another keyboard. */
  pendingRestore: RestorePlan | null
  /** Sections of the opened backup that won't be restored, in plain words. */
  pendingNotes: string[]
  /** Keyboards the browser already trusts, for one-click reconnecting. */
  knownDevices: HIDDevice[]
  refreshKnownDevices(): Promise<void>
  connect(device?: HIDDevice): Promise<void>
  openDemo(): Promise<void>
  disconnect(): Promise<void>
  setLayer(layer: number): void
  select(selection: Selection | null): void
  assign(code: number): Promise<void>
  undo(): Promise<void>
  redo(): Promise<void>
  setLayoutChoice(option: number, choice: number): Promise<void>
  /** The current keymap as a .vil file. */
  backupText(): string
  /** Restores a .vil file, or asks first when it was saved from another keyboard. */
  openBackup(text: string): Promise<void>
  confirmRestore(): Promise<void>
  cancelRestore(): void
  /** Locks the keyboard again so it refuses risky changes. */
  lock(): Promise<void>
  view: View
  setView(view: View): void
  /** The simulated keyboard behind demo mode. */
  demo: FakeKeyboard | null
  /** Demo mode only: holds or releases the demo key that types this KeyboardEvent.code. */
  pressDemoKey(code: string, down: boolean): void
  /** Shows the unlock wizard if needed. Resolves to whether the keyboard is unlocked. */
  unlock(): Promise<boolean>
  /** Macros as edited in the app, not yet saved to the keyboard. */
  macroDrafts: Macro[]
  setMacroDraft(index: number, macro: Macro): void
  discardMacroDrafts(): void
  /** Writes the drafts to the keyboard, unlocking it first if needed. */
  saveMacros(): Promise<void>
  lights: LightingController | null
  /** Shows a lighting change on the keyboard right away. Fast slider moves send only the latest value. */
  setLighting(next: LightingState): void
  /** Keeps the current lighting after the keyboard is unplugged. */
  saveLighting(): Promise<void>
  /** QMK settings as edited in the app, not yet saved to the keyboard. */
  settingsDraft: QmkSettingValues
  setSettingDraft(field: SettingField, value: number | boolean): void
  discardSettingsDraft(): void
  saveSettings(): Promise<void>
  /** Puts every QMK setting back to the firmware's defaults. */
  resetSettings(): Promise<void>
  /** Writes one combo to the keyboard straight away, as vial-gui does. Resolves to whether it was saved. */
  setCombo(index: number, combo: Combo): Promise<boolean>
  /** Writes one tap dance to the keyboard straight away. Resolves to whether it was saved. */
  setTapDance(index: number, tapDance: TapDance): Promise<boolean>
}

export const useApp = create<AppState>((set, get) => {
  /** Runs one keymap change at a time and copies the result into state. */
  async function change(run: (editor: KeymapEditor) => Promise<string | null>) {
    const { editor, keyboard, busy } = get()
    if (!editor || !keyboard || busy) return
    set({ busy: true })
    try {
      const notice = await run(editor)
      set({
        keyboard: { ...get().keyboard!, keymap: editor.keymap, encoderKeymap: editor.encoders },
        canUndo: editor.canUndo,
        canRedo: editor.canRedo,
        ...(notice !== null && { notice }),
      })
    } catch (err) {
      set({ notice: `The change wasn't saved: ${err instanceof Error ? err.message : 'the keyboard did not answer.'}` })
    } finally {
      set({ busy: false })
    }
  }

  // Lighting writes run one at a time; while one runs, newer values replace older waiting ones.
  let pendingLighting: LightingState | null = null
  let writingLighting: Promise<boolean> | null = null
  /** Sends queued lighting changes. Resolves to false if one failed; later queued values are dropped. */
  function flushLighting(): Promise<boolean> {
    if (writingLighting) return writingLighting
    writingLighting = (async () => {
      try {
        while (pendingLighting) {
          const next = pendingLighting
          pendingLighting = null
          await get().lights?.update(next)
        }
        return true
      } catch (err) {
        pendingLighting = null
        set({ notice: `The lighting change wasn't sent: ${err instanceof Error ? err.message : 'the keyboard did not answer.'}` })
        return false
      } finally {
        writingLighting = null
      }
    })()
    return writingLighting
  }

  function opened(transport: HidTransport, keyboard: LoadedKeyboard, isDemo: boolean) {
    const client = new VialClient(transport)
    set({
      client,
      unlocking: null,
      unlocked: false,
      status: 'ready',
      error: null,
      keyboard,
      transport,
      isDemo,
      layer: 0,
      selected: null,
      editor: new KeymapEditor(client, keyboard.keymap, keyboard.encoderKeymap),
      lights: new LightingController(client, keyboard.lighting),
      macroDrafts: keyboard.macros,
      settingsDraft: keyboard.qmkSettings.values,
      view: 'keys',
      canUndo: false,
      canRedo: false,
      notice: null,
    })
    // An unlock started earlier (for example before a page reload) must be finished first, as in vial-gui.
    client.getUnlockStatus().then((status) => {
      if (status.unlocked) set({ unlocked: true })
      else if (status.inProgress) ensureUnlocked()
    })
  }

  /** Shows the unlock wizard until the person has held the unlock keys. Returns false if it failed. */
  async function ensureUnlocked(): Promise<boolean> {
    const { client, unlocked } = get()
    if (!client) return false
    if (unlocked) return true
    try {
      await unlockKeyboard(client, {
        onStart: (keys) => set({ unlocking: { keys, progress: 0 } }),
        onProgress: (progress) => set((s) => ({ unlocking: s.unlocking && { ...s.unlocking, progress } })),
      })
      set({ unlocked: true, unlocking: null })
      return true
    } catch (err) {
      set({ unlocking: null, notice: `Unlocking stopped: ${err instanceof Error ? err.message : 'the keyboard did not answer.'}` })
      return false
    }
  }

  /** Moves the view to what undo or redo changed, and says what it does now. */
  function follow(targets: Target[], verb: string): string | null {
    const { keyboard, editor } = get()
    if (!targets.length || !keyboard || !editor) return null
    if (targets.length > 1) return `${verb} ${targets.length} changes.`
    const { layer, ...selection } = targets[0]
    set({ layer, selected: selection })
    const name = keyboard.catalog.describe(editor.get(targets[0])).name
    return targets[0].kind === 'key'
      ? `${verb}: this key is ${name} again.`
      : `${verb}: ${KNOB_TURNS[targets[0].direction].toLowerCase()} is ${name} again.`
  }

  function backupSource() {
    const keyboard = get().keyboard!
    return {
      ...keyboard,
      layoutOptionsValue: keyboard.layoutOptions.length
        ? packLayoutChoices(keyboard.layoutOptions, keyboard.layoutChoices)
        : -1,
    }
  }

  /** Saves macros like vial-gui's macro recorder: unlock, then write the whole macro memory. */
  async function writeMacros(macros: Macro[]): Promise<string | null> {
    const { keyboard, client, macroDrafts: draftsAtStart } = get()
    if (!keyboard || !client) return null
    const data = serializeMacros(macros, keyboard.vialProtocol)
    if (data.length > keyboard.macroMemory) {
      return `The macros need ${data.length} bytes, but the keyboard only has room for ${keyboard.macroMemory}. Make some shorter.`
    }
    if (!(await ensureUnlocked())) return null
    try {
      await client.setMacroBuffer(data)
    } catch (err) {
      return `The macros weren't saved: ${err instanceof Error ? err.message : 'the keyboard did not answer.'}`
    }
    // The keyboard may have been unplugged while saving, and edits made meanwhile must survive.
    const now = get()
    if (!now.keyboard) return null
    const untouched = JSON.stringify(now.macroDrafts) === JSON.stringify(draftsAtStart)
    set({ keyboard: { ...now.keyboard, macros }, ...(untouched && { macroDrafts: macros }) })
    return 'Macros saved.'
  }

  /** Writes QMK settings that differ from the keyboard's. Returns a notice, or null if the keyboard went away. */
  async function writeSettings(values: QmkSettingValues): Promise<string | null> {
    const { keyboard, client, settingsDraft: draftAtStart } = get()
    if (!keyboard || !client) return null
    let error: unknown = null
    try {
      await writeQmkSettings(client, keyboard.qmkSettings.values, values)
    } catch (err) {
      error = err
    }
    // After a failure some settings may be written and others not, so ask the keyboard.
    let saved = values
    if (error) {
      try {
        saved = (await readQmkSettings(client, keyboard.vialProtocol)).values
      } catch {
        return `The settings weren't all saved: ${describe(error)}`
      }
    }
    const now = get()
    if (!now.keyboard) return null
    const untouched = JSON.stringify(now.settingsDraft) === JSON.stringify(draftAtStart)
    set({
      keyboard: { ...now.keyboard, qmkSettings: { ...now.keyboard.qmkSettings, values: saved } },
      ...(untouched ? { settingsDraft: saved } : {}),
    })
    return error ? `The settings weren't all saved: ${describe(error)}` : 'Settings saved.'
  }

  /**
   * Writes the combos or tap dances that differ from the keyboard's. One that uses the
   * bootloader key needs the keyboard unlocked (combo_set and tap_dance_set in vial-gui);
   * without it, that one is skipped. Returns a note about anything skipped, or null.
   */
  async function writeEntries<T>(
    kind: { field: 'combos' | 'tapDances'; name: string },
    entries: T[],
    usesBoot: (entry: T, boot: number | undefined) => boolean,
    write: (client: VialClient, index: number, entry: T) => Promise<void>,
  ): Promise<string | null> {
    const before = get()
    if (!before.keyboard || !before.client) return null
    const boot = before.keyboard.catalog.deserialize('QK_BOOT')
    const differs = (entry: T, i: number, kb: LoadedKeyboard) =>
      JSON.stringify(entry) !== JSON.stringify((kb[kind.field] as unknown[])[i])
    const needsUnlock = entries.some((e, i) => usesBoot(e, boot) && differs(e, i, before.keyboard!))
    const unlocked = !needsUnlock || (await ensureUnlocked())
    // Unlocking can take a while; the keyboard may have been unplugged or swapped meanwhile.
    const { keyboard, client } = get()
    if (!keyboard || !client || client !== before.client) return null
    let skipped = false
    for (const [i, entry] of entries.entries()) {
      if (!differs(entry, i, keyboard)) continue
      if (usesBoot(entry, boot) && !unlocked) {
        skipped = true
        continue
      }
      await write(client, i, entry)
      const now = get().keyboard
      if (!now || get().client !== client) return null
      set({ keyboard: { ...now, [kind.field]: (now[kind.field] as unknown[]).map((e, j) => (j === i ? entry : e)) } })
    }
    return skipped ? `A ${kind.name} with the bootloader key was skipped because the keyboard is still locked.` : null
  }

  const writeCombos = (combos: Combo[]) =>
    writeEntries({ field: 'combos', name: 'combo' }, combos, (c, boot) => c.output === boot, writeCombo)

  const writeTapDances = (tapDances: TapDance[]) =>
    writeEntries(
      { field: 'tapDances', name: 'tap dance' },
      tapDances,
      (td, boot) => TAP_DANCE_ACTIONS.some((a) => td[a] === boot),
      writeTapDance,
    )

  async function restore(plan: RestorePlan) {
    const keyboard = get().keyboard!
    const boot = keyboard.catalog.deserialize('QK_BOOT')
    const needsUnlock = plan.changes.some((c) => c.code === boot)
    const unlocked = !needsUnlock || (await ensureUnlocked())
    const changes = unlocked ? plan.changes : plan.changes.filter((c) => c.code !== boot)
    const skippedBoot = !unlocked
    const notRestored = get().pendingNotes

    await change(async (editor) => {
      await editor.setMany(changes)
      if (plan.layoutOptions !== null) {
        await editor.setLayoutOptions(plan.layoutOptions)
        set({ keyboard: { ...get().keyboard!, layoutChoices: unpackLayoutChoices(keyboard.layoutOptions, plan.layoutOptions) } })
      }
      const notes = [
        plan.unknownKeys && `${plan.unknownKeys} keys used names this app doesn't know, so they were left as they were.`,
        skippedBoot && 'The bootloader key was skipped because the keyboard is still locked.',
        notRestored.length && `This backup also has ${listOf(notRestored)}, which this app can't restore yet. Those stay as they are on the keyboard.`,
        ...plan.notes,
      ].filter(Boolean)
      return ['Restored the backup. Use Undo change to go back.', ...notes].join(' ')
    })
    // Macros and settings aren't part of undo, as in vial-gui; they're written only when they differ.
    // Busy stays on so Save or Reset can't run in between.
    set({ busy: true })
    try {
      if (plan.macros && JSON.stringify(plan.macros) !== JSON.stringify(get().keyboard?.macros)) {
        const result = await writeMacros(plan.macros)
        if (result && result !== 'Macros saved.') set((s) => ({ notice: `${s.notice ?? ''} ${result}`.trim() }))
      }
      if (plan.tapDances) {
        try {
          const result = await writeTapDances(plan.tapDances)
          if (result) set((s) => ({ notice: `${s.notice ?? ''} ${result}`.trim() }))
        } catch (err) {
          set((s) => ({ notice: `${s.notice ?? ''} The tap dances weren't all restored: ${describe(err)}`.trim() }))
        }
      }
      if (plan.combos) {
        try {
          const result = await writeCombos(plan.combos)
          if (result) set((s) => ({ notice: `${s.notice ?? ''} ${result}`.trim() }))
        } catch (err) {
          set((s) => ({ notice: `${s.notice ?? ''} The combos weren't all restored: ${describe(err)}`.trim() }))
        }
      }
      const live = get().keyboard?.qmkSettings.values
      if (plan.settings && live) {
        // Merged with the keyboard's values now, not when the plan was made, so saves since then stay.
        const result = await writeSettings({ ...live, ...plan.settings })
        if (result && result !== 'Settings saved.') set((s) => ({ notice: `${s.notice ?? ''} ${result}`.trim() }))
      }
    } finally {
      set({ busy: false })
    }
  }

  return {
    status: 'idle',
    error: null,
    view: 'keys',
    lights: null,
    demo: null,
    macroDrafts: [],
    settingsDraft: {},
    keyboard: null,
    isDemo: false,
    layer: 0,
    selected: null,
    transport: null,
    editor: null,
    client: null,
    unlocking: null,
    unlocked: false,
    canUndo: false,
    canRedo: false,
    notice: null,
    busy: false,
    pendingRestore: null,
    pendingNotes: [],
    knownDevices: [],

    async refreshKnownDevices() {
      if (isWebHidSupported()) set({ knownDevices: await WebHidTransport.known() })
    },

    async connect(device) {
      set({ status: 'connecting', error: null })
      let transport: WebHidTransport | null = null
      try {
        transport = device ? await WebHidTransport.open(device) : await WebHidTransport.request()
        if (!transport) {
          set({ status: 'idle' })
          return
        }
        const keyboard = await loadKeyboard(transport, transport.device.productName || 'Keyboard')
        opened(transport, keyboard, false)
        const stop = transport.onUnplug(() => {
          stop()
          if (get().transport !== transport) return
          set({
            ...CLOSED,
            status: 'error',
            error: 'The keyboard was unplugged. Your changes up to then are saved on it. Plug it back in to keep going.',
          })
          get().refreshKnownDevices()
        })
      } catch (err) {
        await transport?.close()
        set({ status: 'error', error: friendlyError(err), transport: null })
      }
    },

    async openDemo() {
      const { transport, keyboard, fake } = await openDemoKeyboard()
      opened(transport, keyboard, true)
      set({ demo: fake })
    },

    pressDemoKey(code, down) {
      const { demo, keyboard } = get()
      if (demo && keyboard) pressDemoKey(demo, keyboard.keymap, code, down)
    },

    unlock: () => ensureUnlocked(),

    setMacroDraft(index, macro) {
      set((s) => ({ macroDrafts: s.macroDrafts.map((m, i) => (i === index ? macro : m)), notice: null }))
    },

    discardMacroDrafts() {
      set((s) => ({ macroDrafts: s.keyboard?.macros ?? [], notice: 'Changes to macros were discarded.' }))
    },

    async saveMacros() {
      const { keyboard, macroDrafts, busy } = get()
      if (!keyboard || busy) return
      set({ busy: true })
      try {
        const notice = await writeMacros(macroDrafts)
        if (notice) set({ notice })
      } finally {
        set({ busy: false })
      }
    },

    async disconnect() {
      await get().transport?.close()
      set({ ...CLOSED, status: 'idle' })
      get().refreshKnownDevices()
    },

    setLayer(layer) {
      set({ layer })
    },

    select(selected) {
      set({ selected, notice: null })
    },

    async assign(code) {
      const { selected, layer, keyboard } = get()
      if (!selected || !keyboard) return
      // vial-gui unlocks before setting the bootloader key (set_key in keyboard_comm.py).
      if (code === keyboard.catalog.deserialize('QK_BOOT') && !(await ensureUnlocked())) return
      await change(async (editor) => {
        await editor.set({ layer, ...selected }, code)
        const name = keyboard.catalog.describe(code).name
        return selected.kind === 'key'
          ? `Saved. This key is now ${name}.`
          : `Saved. ${KNOB_TURNS[selected.direction]} is now ${name}.`
      })
    },

    async undo() {
      await change(async (editor) => follow(await editor.undo(), 'Undone'))
    },

    async redo() {
      await change(async (editor) => follow(await editor.redo(), 'Redone'))
    },

    backupText() {
      return createBackup(backupSource())
    },

    async openBackup(text) {
      let backup
      try {
        backup = parseBackup(text)
      } catch (err) {
        set({ notice: err instanceof Error ? err.message : String(err) })
        return
      }
      const plan = planRestore(backup, backupSource())
      set({ pendingNotes: backup.notRestored })
      if (plan.sameKeyboard) await restore(plan)
      else set({ pendingRestore: plan })
    },

    async confirmRestore() {
      const plan = get().pendingRestore
      set({ pendingRestore: null })
      if (plan) await restore(plan)
    },

    cancelRestore() {
      set({ pendingRestore: null, notice: 'Nothing was changed.' })
    },

    setView(view) {
      set({ view, notice: null })
    },

    setLighting(next) {
      const { keyboard } = get()
      if (!keyboard) return
      set({ keyboard: { ...keyboard, lighting: { ...keyboard.lighting, ...next } } })
      pendingLighting = { ...pendingLighting, ...next }
      if (!writingLighting) flushLighting()
    },

    async saveLighting() {
      const { lights } = get()
      if (!lights) return
      // Saving after a failed write would store something other than what the screen shows.
      if (!(await flushLighting())) return
      try {
        await lights.save()
        set({ notice: 'Lighting saved. It stays like this after unplugging.' })
      } catch (err) {
        set({ notice: `The lighting wasn't saved: ${err instanceof Error ? err.message : 'the keyboard did not answer.'}` })
      }
    },

    setSettingDraft(field, value) {
      set((s) => ({ settingsDraft: withFieldValue(s.settingsDraft, field, value), notice: null }))
    },

    discardSettingsDraft() {
      set((s) => ({ settingsDraft: s.keyboard?.qmkSettings.values ?? {}, notice: 'Changes to settings were discarded.' }))
    },

    async saveSettings() {
      const { keyboard, settingsDraft, busy } = get()
      if (!keyboard || busy) return
      set({ busy: true })
      try {
        const notice = await writeSettings(settingsDraft)
        if (notice) set({ notice })
      } finally {
        set({ busy: false })
      }
    },

    async setCombo(index, combo) {
      const { keyboard, busy } = get()
      if (!keyboard || busy) return false
      set({ busy: true })
      try {
        const skipped = await writeCombos(keyboard.combos.map((c, i) => (i === index ? combo : c)))
        const saved = get().keyboard?.combos[index]
        if (!saved) return false
        set({ notice: skipped ?? `Saved. Combo ${index + 1}: ${describeCombo(saved, keyboard.catalog)}.` })
        return JSON.stringify(saved) === JSON.stringify(combo)
      } catch (err) {
        set({ notice: `The combo wasn't saved: ${describe(err)}` })
        return false
      } finally {
        set({ busy: false })
      }
    },

    async setTapDance(index, tapDance) {
      const { keyboard, busy } = get()
      if (!keyboard || busy) return false
      set({ busy: true })
      try {
        const skipped = await writeTapDances(keyboard.tapDances.map((t, i) => (i === index ? tapDance : t)))
        const saved = get().keyboard?.tapDances[index]
        if (!saved) return false
        set({ notice: skipped ?? `Saved. Tap dance ${index + 1}: ${describeTapDance(saved, keyboard.catalog)}.` })
        return JSON.stringify(saved) === JSON.stringify(tapDance)
      } catch (err) {
        set({ notice: `The tap dance wasn't saved: ${describe(err)}` })
        return false
      } finally {
        set({ busy: false })
      }
    },

    async resetSettings() {
      const { keyboard, client, busy } = get()
      if (!keyboard || !client || busy) return
      set({ busy: true })
      try {
        try {
          await client.qmkSettingsReset()
        } catch (err) {
          set({ notice: `The settings weren't reset: ${describe(err)}` })
          return
        }
        try {
          const { values } = await readQmkSettings(client, keyboard.vialProtocol)
          const now = get().keyboard
          if (now) {
            set({
              keyboard: { ...now, qmkSettings: { ...now.qmkSettings, values } },
              settingsDraft: values,
              notice: "Every setting is back to the keyboard's default.",
            })
          }
        } catch (err) {
          set({
            notice: `The keyboard reset its settings, but they couldn't be read back: ${describe(err)} Reconnect the keyboard to see them.`,
          })
        }
      } finally {
        set({ busy: false })
      }
    },

    async lock() {
      const { client } = get()
      if (!client) return
      await client.lock()
      set({ unlocked: false, notice: 'The keyboard is locked again.' })
    },

    async setLayoutChoice(option, choice) {
      const { keyboard } = get()
      if (!keyboard) return
      const choices = keyboard.layoutChoices.map((c, i) => (i === option ? choice : c))
      await change(async (editor) => {
        await editor.setLayoutOptions(packLayoutChoices(keyboard.layoutOptions, choices))
        set({ keyboard: { ...get().keyboard!, layoutChoices: choices }, selected: null })
        return 'Saved the layout.'
      })
    },
  }
})

function friendlyError(err: unknown): string {
  // Chrome reports a keyboard that's in use and missing Linux permissions the same way.
  if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'InvalidStateError')) {
    return "The browser couldn't open the keyboard. Close other tabs or apps that use it, such as Vial or VIA. On Linux, also install the Vial udev rules. Then try again."
  }
  if (err instanceof SyntaxError) {
    return "The keyboard answered, but it doesn't look like Vial firmware. VIA-only keyboards aren't supported yet."
  }
  return err instanceof Error ? err.message : 'Something went wrong while reading the keyboard.'
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : 'the keyboard did not answer.'
}

/** "a", "a and b", "a, b and c" */
function listOf(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}
