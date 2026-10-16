// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * QMK settings: timing and behaviour options the firmware lets people change
 * without rebuilding it. Ported from reload_settings(), qmk_settings_set() and
 * qmk_settings_reset() in vial-gui protocol/keyboard_comm.py, editor/qmk_settings.py
 * and resources/base/qmk_settings.json (whose qsid, bit, width and limits are kept).
 */
import type { VialClient } from './vial-client'

/** From protocol/constants.py. */
const VIAL_PROTOCOL_QMK_SETTINGS = 4
/** Ends the list of setting ids in a query reply. */
const END = 0xffff

export interface SettingField {
  /** QMK setting id. */
  qsid: number
  type: 'boolean' | 'integer'
  title: string
  /** A sentence that explains the setting to someone who hasn't met it before. */
  help?: string
  /** On/off settings that share a qsid each own one bit of its value. */
  bit?: number
  /** Bytes the firmware stores the value in. */
  width: number
  min?: number
  max?: number
  unit?: string
}

export interface SettingGroup {
  id: string
  title: string
  description: string
  fields: SettingField[]
}

/** Setting values by qsid. */
export type QmkSettingValues = Record<number, number>

export interface QmkSettings {
  /** Every setting id the firmware reports, including ones this app has no controls for. */
  supported: number[]
  /** Values of the supported settings this app knows. */
  values: QmkSettingValues
}

const on = (qsid: number, title: string, bit?: number, help?: string, width = 1): SettingField => ({
  qsid,
  type: 'boolean',
  title,
  width,
  ...(bit !== undefined && { bit }),
  ...(help && { help }),
})
const num = (qsid: number, title: string, max: number, width: number, unit?: string, help?: string): SettingField => ({
  qsid,
  type: 'integer',
  title,
  width,
  min: 0,
  max,
  ...(unit && { unit }),
  ...(help && { help }),
})
const swap = (title: string, bit: number, help?: string) => on(21, title, bit, help, 4)

export const QMK_SETTING_GROUPS: SettingGroup[] = [
  {
    id: 'tap-hold',
    title: 'Tap and hold keys',
    description:
      'Keys that do one thing when tapped and another when held, such as "tap for Space, hold for Layer 1". These settings decide when a press counts as a hold.',
    fields: [
      num(7, 'Hold time', 10000, 2, 'ms', 'How long to hold a key before it counts as held instead of tapped (Tapping Term).'),
      on(8, 'Hold when another key is tapped meanwhile', 0, 'Counts as held if you press and release another key while holding it, even before the hold time (Permissive Hold).'),
      on(8, "Don't hold just because another key is pressed", 1, "Pressing another key while holding doesn't make it count as held straight away (Ignore Mod Tap Interrupt)."),
      on(8, 'Tap then hold gives the hold action', 2,'Tapping a key and then holding it gives the hold action, not a repeated tap (Tapping Force Hold).'),
      on(8, 'Tap when released without pressing anything else', 3, 'Holding past the hold time and letting go still types the tap action (Retro Tapping).'),
      on(22, 'Hold when another key is tapped meanwhile', undefined, 'Counts as held if you press and release another key while holding it, even before the hold time (Permissive Hold).'),
      on(23, 'Hold as soon as another key is pressed', undefined, 'Counts as held the moment you press another key while holding it (Hold On Other Key Press).'),
      on(24, 'Tap when released without pressing anything else', undefined, 'Holding past the hold time and letting go still types the tap action (Retro Tapping).'),
      num(25, 'Repeat window', 10000, 2, 'ms', 'Tapping a key and then holding it within this time repeats the tap instead of holding (Quick Tap Term).'),
      num(18, 'Pause inside each tap', 1000, 2, 'ms', 'Time between press and release when the keyboard taps a key for you, for apps that miss fast taps (Tap Code Delay).'),
      num(19, 'Pause inside Caps Lock taps', 1000, 2, 'ms', 'The same pause, for Caps Lock, which some computers need longer (Tap Hold Caps Delay).'),
      num(20, 'Taps to lock a layer', 100, 1, 'taps', 'For keys that switch layer while held: tap this many times to keep the layer on (Tapping Toggle).'),
      on(26, 'Hold only with keys on the other hand', undefined, 'A tap-hold key counts as held only when the next key is on the other side of the keyboard (Chordal Hold).'),
      num(27, 'Typing streak', 10000, 2, 'ms', 'Tap-hold keys pressed within this time after another key always tap, so fast typing never triggers a hold (Flow Tap).'),
    ],
  },
  {
    id: 'key-swaps',
    title: 'Key swaps',
    description: 'Swap or turn off a few common keys without remapping them on every layer.',
    fields: [
      swap('Swap Caps Lock and Left Control', 0),
      swap('Make Caps Lock another Control', 1),
      swap('Swap Left Alt and Left GUI (Windows or Command key)', 2),
      swap('Swap Right Alt and Right GUI', 3),
      swap('Turn off the GUI keys', 4, 'Stops the Windows or Command keys working, for example while gaming.'),
      swap('Swap ` and Escape', 5),
      swap('Swap \\ and Backspace', 6),
      swap('Report every key at once (N-key rollover)', 7, 'Lets the computer see any number of keys held together. Turn it off if a computer or BIOS has trouble with the keyboard.'),
      swap('Swap Left Control and Left GUI', 8),
      swap('Swap Right Control and Right GUI', 9),
    ],
  },
  {
    id: 'grave-escape',
    title: 'Escape and ` key',
    description:
      'For the key that types Escape, or ` when Shift or GUI is held (Grave Escape). Choose when it should type Escape anyway.',
    fields: [
      on(1, 'Type Escape while Alt is held', 0),
      on(1, 'Type Escape while Control is held', 1),
      on(1, 'Type Escape while GUI is held', 2),
      on(1, 'Type Escape while Shift is held', 3),
    ],
  },
  {
    id: 'auto-shift',
    title: 'Auto Shift',
    description: 'Hold a key a little longer to type its shifted version, such as A instead of a, without pressing Shift.',
    fields: [
      on(3, 'Turn on Auto Shift', 0),
      num(4, 'Hold time', 1000, 2, 'ms', 'How long to hold a key to get the shifted version.'),
      on(3, 'Also for modifier keys', 1),
      on(3, "Not for symbols (such as - and /)", 2),
      on(3, 'Not for numbers', 3),
      on(3, 'Not for letters', 4),
      on(3, 'Repeat the key while held', 5),
      on(3, "Don't repeat once the hold time has passed", 6),
    ],
  },
  {
    id: 'combo',
    title: 'Combos',
    description: 'Combos type something when you press several keys together.',
    fields: [num(2, 'Time to press combo keys together', 10000, 2, 'ms', 'Keys pressed further apart than this count as separate presses.')],
  },
  {
    id: 'one-shot',
    title: 'One-shot keys',
    description: 'Tap a one-shot key, such as a one-shot Shift, and it applies to the next key you press only.',
    fields: [
      num(5, 'Taps to lock it on', 50, 1, 'taps', 'Tap a one-shot key this many times to keep it on until you tap it again.'),
      num(6, 'Wait before cancelling', 60000, 2, 'ms', 'A one-shot key turns itself off if no other key follows within this time.'),
    ],
  },
  {
    id: 'mouse',
    title: 'Mouse keys',
    description: 'For keys that move the mouse pointer or scroll.',
    fields: [
      num(9, 'Wait before the pointer moves', 10000, 2, 'ms'),
      num(10, 'Time between pointer steps', 10000, 2, 'ms'),
      num(11, 'Pointer step size', 1000, 2),
      num(12, 'Top pointer speed', 1000, 2),
      num(13, 'Steps to reach top pointer speed', 1000, 2),
      num(14, 'Wait before scrolling starts', 10000, 2, 'ms'),
      num(15, 'Time between scroll steps', 10000, 2, 'ms'),
      num(16, 'Top scroll speed', 1000, 2),
      num(17, 'Steps to reach top scroll speed', 1000, 2),
    ],
  },
]

const FIELDS_BY_QSID = new Map<number, SettingField>()
for (const field of QMK_SETTING_GROUPS.flatMap((g) => g.fields)) {
  if (!FIELDS_BY_QSID.has(field.qsid)) FIELDS_BY_QSID.set(field.qsid, field)
}

function widthOf(qsid: number): number {
  const field = FIELDS_BY_QSID.get(qsid)
  if (!field) throw new Error(`unknown QMK setting ${qsid}`)
  return field.width
}

/** Little-endian bytes, as many as the setting is wide (qsid_serialize). */
export function encodeSetting(qsid: number, value: number): number[] {
  return Array.from({ length: widthOf(qsid) }, (_, i) => Math.floor(value / 256 ** i) & 0xff)
}

/** Reads a value from the start of a reply (qsid_deserialize). */
export function decodeSetting(qsid: number, bytes: ArrayLike<number>): number {
  let value = 0
  for (let i = widthOf(qsid) - 1; i >= 0; i--) value = value * 256 + bytes[i]
  return value
}

export async function readQmkSettings(client: VialClient, vialProtocol: number): Promise<QmkSettings> {
  const supported: number[] = []
  const values: QmkSettingValues = {}
  if (vialProtocol < VIAL_PROTOCOL_QMK_SETTINGS) return { supported, values }

  // The firmware lists ids greater than the one asked for, as many as fit, padded with 0xFFFF.
  let after = 0
  while (after !== END) {
    const ids = await client.qmkSettingsQuery(after)
    const before = after
    for (const id of ids) {
      if (id <= before || supported.includes(id)) continue
      after = Math.max(after, id)
      if (id !== END) supported.push(id)
    }
    // A firmware that lists no new ids would otherwise be asked forever.
    if (after === before) break
  }

  for (const qsid of supported) {
    if (!FIELDS_BY_QSID.has(qsid)) continue
    const reply = await client.qmkSettingsGet(qsid)
    if (reply) values[qsid] = decodeSetting(qsid, reply)
  }
  return { supported, values }
}

/**
 * Brings a value from a backup within what the setting allows: numbers within their
 * limits, on/off settings only in the bits that mean something. Returns null for
 * settings this app doesn't know.
 */
export function clampSetting(qsid: number, value: number): number | null {
  const fields = QMK_SETTING_GROUPS.flatMap((g) => g.fields).filter((f) => f.qsid === qsid)
  if (!fields.length) return null
  const field = fields[0]
  if (field.type === 'integer') return Math.min(field.max ?? Infinity, Math.max(field.min ?? 0, Math.round(value)))
  const mask = fields.reduce((m, f) => m | (1 << (f.bit ?? 0)), 0)
  return (value & mask) >>> 0
}

/** Ids whose value differs between two sets of values. */
export function changedSettings(saved: QmkSettingValues, draft: QmkSettingValues): number[] {
  return Object.keys(draft)
    .map(Number)
    .filter((qsid) => draft[qsid] !== saved[qsid])
}

/** Writes the settings that changed. Throws if the keyboard refuses one. */
export async function writeQmkSettings(client: VialClient, saved: QmkSettingValues, draft: QmkSettingValues): Promise<void> {
  for (const qsid of changedSettings(saved, draft)) {
    if (!(await client.qmkSettingsSet(qsid, encodeSetting(qsid, draft[qsid])))) {
      const field = FIELDS_BY_QSID.get(qsid)
      throw new Error(`the keyboard refused the setting "${field?.title ?? qsid}".`)
    }
  }
}

/** The groups and fields the keyboard has, leaving out empty groups (recreate_gui). */
export function settingGroups(supported: number[]): SettingGroup[] {
  const has = new Set(supported)
  return QMK_SETTING_GROUPS.map((g) => ({ ...g, fields: g.fields.filter((f) => has.has(f.qsid)) })).filter(
    (g) => g.fields.length > 0,
  )
}

export function fieldValue(values: QmkSettingValues, field: SettingField): number | boolean {
  const value = values[field.qsid] ?? 0
  return field.type === 'boolean' ? (value & (1 << (field.bit ?? 0))) !== 0 : value
}

/** Sets one field, keeping numbers whole and within the field's limits. */
export function withFieldValue(values: QmkSettingValues, field: SettingField, next: number | boolean): QmkSettingValues {
  const current = values[field.qsid] ?? 0
  let value: number
  if (field.type === 'boolean') {
    const mask = 1 << (field.bit ?? 0)
    value = next ? current | mask : current & ~mask
  } else {
    value = Math.min(field.max ?? Infinity, Math.max(field.min ?? 0, Math.round(Number(next))))
  }
  return { ...values, [field.qsid]: value >>> 0 }
}
