// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Keymap backups in vial-gui's .vil format (save_layout / restore_layout in
 * protocol/keyboard_comm.py), so files move freely between the two apps.
 *
 * vial-web writes only what it manages: keys, knobs, layout options, macros,
 * combos and QMK settings. vial-gui skips missing sections when restoring, so a
 * vial-web backup never clears tap dance or other features in vial-gui.
 */
import { isEmptyCombo, loadSavedCombo, saveCombo, type Combo } from './combos'
import type { KeycodeCatalog } from './keycodes/catalog'
import type { EncoderKeymap, Target } from './keymap-editor'
import type { LayoutEncoder, LayoutKey } from './layout'
import { loadSavedMacro, macroProblem, saveMacro, type Macro } from './macros'
import { clampSetting, type QmkSettings, type QmkSettingValues } from './qmk-settings'
import type { Keymap } from './vial-client'

export interface BackupSource {
  keyboardId: bigint
  viaProtocol: number
  vialProtocol: number
  rows: number
  cols: number
  layers: number
  keys: LayoutKey[]
  encoders: LayoutEncoder[]
  keymap: Keymap
  encoderKeymap: EncoderKeymap
  /** Packed layout options, or -1 when the keyboard has none (as in vial-gui). */
  layoutOptionsValue: number
  macros: Macro[]
  qmkSettings: QmkSettings
  combos: Combo[]
  catalog: KeycodeCatalog
}

type SavedCode = string | number

export interface Backup {
  uid: bigint | null
  layout: SavedCode[][][]
  encoderLayout: SavedCode[][][]
  layoutOptions: number
  /** The "macro" section, still in .vil form, or null when the file has none. */
  macros: unknown[][] | null
  /** The "combo" section, still in .vil form, or null when the file has none. */
  combos: unknown[] | null
  /** The "settings" section by qsid, or null when the file has none. */
  settings: Record<string, unknown> | null
  /** Saved sections this app can't restore yet, in plain words. */
  notRestored: string[]
}

export interface RestorePlan {
  changes: { target: Target; code: number }[]
  layoutOptions: number | null
  /** Every macro, ready to write, or null when the backup has no macros to restore. */
  macros: Macro[] | null
  /** Every combo slot, as it should be after restoring, or null when the backup has none. */
  combos: Combo[] | null
  /** The backup's QMK settings that this keyboard has, or null when there are none to restore. */
  settings: QmkSettingValues | null
  /** Plain-language notes about parts of the backup that won't be restored. */
  notes: string[]
  /** Keycode names in the backup this app doesn't recognise. */
  unknownKeys: number
  sameKeyboard: boolean
}

const UID_PLACEHOLDER = '"__uid__"'
const NOT_A_BACKUP = "This file isn't a Vial keymap backup."

/** Sections vial-gui saves that later phases will restore, with names people understand. */
const OTHER_SECTIONS: [string, string][] = [
  ['tap_dance', 'tap dance'],
  ['key_override', 'key overrides'],
  ['alt_repeat_key', 'alt repeat keys'],
]

export function createBackup(kb: BackupSource): string {
  const used = new Set(kb.keys.map((k) => `${k.row},${k.col}`))
  const layout = kb.keymap.map((rows) =>
    rows.map((cols, r) => cols.map((code, c) => (used.has(`${r},${c}`) ? kb.catalog.serialize(code) : -1))),
  )
  const encoderLayout = kb.encoderKeymap.map((encoders) =>
    encoders.map(([left, right]) => [kb.catalog.serialize(left), kb.catalog.serialize(right)]),
  )

  // The keyboard id is 64 bits, more than a JSON number holds exactly in JavaScript.
  const json = JSON.stringify(
    {
      version: 1,
      uid: '__uid__',
      layout,
      encoder_layout: encoderLayout,
      layout_options: kb.layoutOptionsValue,
      ...(kb.macros.length && { macro: kb.macros.map((m) => saveMacro(m, kb.catalog)) }),
      ...(kb.combos.length && { combo: kb.combos.map((c) => saveCombo(c, kb.catalog)) }),
      ...(Object.keys(kb.qmkSettings.values).length && { settings: kb.qmkSettings.values }),
      vial_protocol: kb.vialProtocol,
      via_protocol: kb.viaProtocol,
    },
    null,
    1,
  )
  return json.replace(UID_PLACEHOLDER, kb.keyboardId.toString())
}

export function parseBackup(text: string): Backup {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(NOT_A_BACKUP)
  }
  if (typeof data !== 'object' || data === null || !Array.isArray(data.layout)) throw new Error(NOT_A_BACKUP)

  const uid = /"uid"\s*:\s*(\d+)/.exec(text)
  return {
    uid: uid ? BigInt(uid[1]) : null,
    layout: data.layout as SavedCode[][][],
    encoderLayout: Array.isArray(data.encoder_layout) ? (data.encoder_layout as SavedCode[][][]) : [],
    layoutOptions: typeof data.layout_options === 'number' ? data.layout_options : -1,
    macros: Array.isArray(data.macro) ? (data.macro as unknown[]).map((m) => (Array.isArray(m) ? m : [])) : null,
    combos: Array.isArray(data.combo) ? data.combo : null,
    settings: isRecord(data.settings) ? data.settings : null,
    notRestored: OTHER_SECTIONS.filter(([key]) => hasContent(data[key])).map(([, name]) => name),
  }
}

/** Works out which writes bring the keyboard to the backup's state. */
export function planRestore(backup: Backup, kb: BackupSource): RestorePlan {
  const changes: RestorePlan['changes'] = []
  let unknownKeys = 0
  const read = (saved: SavedCode): number | undefined => {
    if (saved === -1) return undefined
    const code = typeof saved === 'number' ? saved : kb.catalog.deserialize(saved)
    if (code === undefined) unknownKeys++
    return code
  }

  const used = new Set(kb.keys.map((k) => `${k.row},${k.col}`))
  backup.layout.slice(0, kb.layers).forEach((rows, layer) =>
    rows.slice(0, kb.rows).forEach((cols, row) =>
      cols.slice(0, kb.cols).forEach((saved, col) => {
        if (!used.has(`${row},${col}`)) return
        const code = read(saved)
        if (code !== undefined) changes.push({ target: { kind: 'key', layer, row, col }, code })
      }),
    ),
  )

  const encoderCount = kb.encoderKeymap[0]?.length ?? 0
  backup.encoderLayout.slice(0, kb.layers).forEach((encoders, layer) =>
    encoders.slice(0, encoderCount).forEach((directions, index) =>
      directions.slice(0, 2).forEach((saved, direction) => {
        const code = read(saved)
        if (code !== undefined) changes.push({ target: { kind: 'encoder', layer, index, direction }, code })
      }),
    ),
  )

  // Like restore_macros in vial-gui: fill missing macros with empty ones, drop extras.
  const notes: string[] = []
  const backupHasMacros = backup.macros?.some((m) => m.length > 0) ?? false
  let macros: Macro[] | null = null
  if (backup.macros && kb.macros.length) {
    macros = kb.macros.map((_, i) => loadSavedMacro(backup.macros![i] ?? [], kb.catalog, () => unknownKeys++))
    const problem = macros.map(macroProblem).find(Boolean)
    if (problem) {
      // Writing it could shift every later macro in memory, so leave the keyboard's macros alone.
      notes.push(`The macros in this backup weren't restored: ${problem}`)
      macros = null
    }
  } else if (backupHasMacros) {
    notes.push('This keyboard has no macros, so the macros in this backup were left out.')
  }

  // Like restore_combo in vial-gui: fill slots from the backup, keep the rest.
  let combos: Combo[] | null = null
  const savedCombos = backup.combos ?? []
  const inUse = (c: unknown) => {
    const combo = loadSavedCombo(c, kb.catalog, () => {})
    return combo === null || !isEmptyCombo(combo)
  }
  if (savedCombos.length && kb.combos.length) {
    // A slot with a key this app can't read keeps what the keyboard has.
    combos = kb.combos.map((current, i) =>
      i < savedCombos.length ? (loadSavedCombo(savedCombos[i], kb.catalog, () => unknownKeys++) ?? current) : current,
    )
    const extra = savedCombos.slice(kb.combos.length).filter(inUse).length
    if (extra) {
      notes.push(
        `${extra} combo${extra === 1 ? '' : 's'} in this backup didn't fit, because this keyboard has room for ${kb.combos.length}.`,
      )
    }
  } else if (savedCombos.some(inUse)) {
    notes.push('This keyboard has no combos, so the combos in this backup were left out.')
  }

  // Like restore_layout in vial-gui: set each saved setting the keyboard has, leave the rest.
  let settings: QmkSettingValues | null = null
  const saved = Object.entries(backup.settings ?? {})
  if (saved.length && Object.keys(kb.qmkSettings.values).length) {
    settings = {}
    let skipped = 0
    for (const [key, value] of saved) {
      const qsid = Number(key)
      const clamped = typeof value === 'number' && qsid in kb.qmkSettings.values ? clampSetting(qsid, value) : null
      if (clamped === null) skipped++
      else settings[qsid] = clamped
    }
    if (skipped) {
      notes.push(
        skipped === 1
          ? "1 setting in this backup doesn't fit this keyboard, so it was left out."
          : `${skipped} settings in this backup don't fit this keyboard, so they were left out.`,
      )
    }
  } else if (saved.length) {
    notes.push('This keyboard has no QMK settings, so the settings in this backup were left out.')
  }

  return {
    changes,
    macros,
    combos,
    settings,
    notes,
    layoutOptions: backup.layoutOptions !== -1 && kb.layoutOptionsValue !== -1 ? backup.layoutOptions : null,
    unknownKeys,
    sameKeyboard: backup.uid === kb.keyboardId,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * vial-gui saves every slot, even unused ones (["KC_NO", "KC_NO", ..., 200]).
 * A section counts as used when it holds a key other than KC_NO, or settings.
 */
function hasContent(value: unknown): boolean {
  if (typeof value === 'string') return value !== '' && value !== 'KC_NO' && value !== '0x0'
  if (Array.isArray(value)) return value.some(hasContent)
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  return false
}
