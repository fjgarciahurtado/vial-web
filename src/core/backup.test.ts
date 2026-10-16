// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup, planRestore, type BackupSource } from './backup'
import v6Data from './keycodes/data/keycodes-v6.json'
import { KeycodeCatalog, type KeycodeData } from './keycodes/catalog'
import { parseLayout } from './layout'

const catalog = new KeycodeCatalog(v6Data as KeycodeData, {
  layers: 2,
  macroCount: 0,
  tapDanceCount: 0,
  features: new Set(),
})
const enc = (label: string) => `${label}\n\n\n\n\n\n\n\n\ne`

// 1 row, 3 columns, but column 2 has no key in the layout.
const source: BackupSource = {
  keyboardId: 0xf1f2f3f4f5f6f7f8n,
  viaProtocol: 9,
  vialProtocol: 6,
  rows: 1,
  cols: 3,
  layers: 2,
  ...parseLayout([['0,0', '0,1', enc('0,0'), enc('0,1')]]),
  keymap: [[[0x04, 0x0204, 0x00]], [[0x01, 0x5221, 0x00]]],
  encoderKeymap: [[[0xaa, 0xa9]], [[0x01, 0x01]]],
  layoutOptionsValue: -1,
  macros: [[{ type: 'text', text: 'hi' }], []],
  qmkSettings: { supported: [2, 7, 21, 999], values: { 2: 50, 7: 200, 21: 0x80 } },
  tapDances: [{ onTap: 0x29, onHold: 0xe0, onDoubleTap: 0, onTapHold: 0, tappingTerm: 180 }],
  altRepeats: [{ keycode: 0x52, altKeycode: 0x51, allowedMods: 0, options: 0b1010 }],
  keyOverrides: [{ trigger: 0x2a, replacement: 0x4c, layers: 0xffff, triggerMods: 0x22, negativeMods: 0, suppressedMods: 0x22, options: 0x87 }],
  combos: [
    { keys: [0x04, 0x16, 0, 0], output: 0x29 },
    { keys: [0, 0, 0, 0], output: 0 },
  ],
  catalog,
}

describe('createBackup', () => {
  const text = createBackup(source)
  const json = JSON.parse(text)

  it('writes the vial-gui .vil structure', () => {
    expect(json).toMatchObject({
      version: 1,
      layout: [[['KC_A', 'LSFT(KC_A)', -1]], [['KC_TRNS', 'MO(1)', -1]]],
      encoder_layout: [[['KC_VOLD', 'KC_VOLU']], [['KC_TRNS', 'KC_TRNS']]],
      layout_options: -1,
      vial_protocol: 6,
      via_protocol: 9,
    })
  })

  it('keeps the full 64-bit keyboard id', () => {
    expect(text).toContain('"uid": 17434265340928784376')
  })

  it('saves macros in vial-gui form', () => {
    expect(json.macro).toEqual([[['text', 'hi']], []])
  })

  it('saves QMK settings by id, as vial-gui does', () => {
    expect(json.settings).toEqual({ 2: 50, 7: 200, 21: 0x80 })
  })

  it('saves every tap dance slot, as vial-gui does', () => {
    expect(json.tap_dance).toEqual([['KC_ESCAPE', 'KC_LCTRL', 'KC_NO', 'KC_NO', 180]])
  })

  it('saves every key override slot, as vial-gui does', () => {
    expect(json.key_override).toEqual([
      { trigger: 'KC_BSPACE', replacement: 'KC_DELETE', layers: 0xffff, trigger_mods: 0x22, negative_mod_mask: 0, suppressed_mods: 0x22, options: 0x87 },
    ])
  })

  it('saves every combo slot, as vial-gui does', () => {
    expect(json.combo).toEqual([
      ['KC_A', 'KC_S', 'KC_NO', 'KC_NO', 'KC_ESCAPE'],
      ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'],
    ])
  })

  it('saves every alt repeat key slot, as vial-gui does', () => {
    expect(json.alt_repeat_key).toEqual([{ keycode: 'KC_UP', alt_keycode: 'KC_DOWN', allowed_mods: 0, options: 0b1010 }])
  })

  it('leaves out settings when the keyboard has none', () => {
    const none = JSON.parse(createBackup({ ...source, qmkSettings: { supported: [], values: {} } }))
    expect(none).not.toHaveProperty('settings')
  })
})

describe('parseBackup', () => {
  it('reads a backup back, including the exact keyboard id', () => {
    const backup = parseBackup(createBackup(source))
    expect(backup.uid).toBe(0xf1f2f3f4f5f6f7f8n)
    expect(backup.layout[0][0]).toEqual(['KC_A', 'LSFT(KC_A)', -1])
  })

  it('ignores sections that only hold empty slots', () => {
    const backup = parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], tap_dance: [['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 200]] }))
    expect(backup.notRestored).toEqual([])
  })

  it('restores every section vial-gui saves', () => {
    const backup = parseBackup(
      JSON.stringify({ version: 1, uid: 1, layout: [], macro: [[['text', 'hi']]], alt_repeat_key: [{ keycode: 'KC_A' }] }),
    )
    expect(backup.notRestored).toEqual([])
  })

  it('restores alt repeat keys, keeping slots it cannot read', () => {
    const saved = { keycode: 'KC_LEFT', alt_keycode: 'KC_RIGHT', allowed_mods: 0, options: 0b1000 }
    const plan = planRestore(parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], alt_repeat_key: [saved] })), source)
    expect(plan.altRepeats).toEqual([{ keycode: 0x50, altKeycode: 0x4f, allowedMods: 0, options: 0b1000 }])
    const bad = planRestore(
      parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], alt_repeat_key: [{ ...saved, keycode: 'NOPE' }] })),
      source,
    )
    expect(bad.altRepeats).toEqual(source.altRepeats)
  })

  it('rejects files that are not keymap backups', () => {
    expect(() => parseBackup('{"hello": 1}')).toThrow("This file isn't a Vial keymap backup.")
    expect(() => parseBackup('not json')).toThrow("This file isn't a Vial keymap backup.")
  })
})

describe('planRestore', () => {
  it('turns a backup into changes for keys and knobs that exist', () => {
    const backup = parseBackup(
      JSON.stringify({
        version: 1,
        uid: 1,
        layout: [[['KC_B', 'KC_C', 'KC_D']], [['KC_E', 'KC_F', 'KC_G']], [['KC_H', 'KC_I', 'KC_J']]],
        encoder_layout: [[['KC_MUTE', 'KC_MUTE']]],
        layout_options: -1,
      }),
    )
    const plan = planRestore(backup, source)
    expect(plan.changes).toEqual([
      { target: { kind: 'key', layer: 0, row: 0, col: 0 }, code: 0x05 },
      { target: { kind: 'key', layer: 0, row: 0, col: 1 }, code: 0x06 },
      { target: { kind: 'key', layer: 1, row: 0, col: 0 }, code: 0x08 },
      { target: { kind: 'key', layer: 1, row: 0, col: 1 }, code: 0x09 },
      { target: { kind: 'encoder', layer: 0, index: 0, direction: 0 }, code: 0xa8 },
      { target: { kind: 'encoder', layer: 0, index: 0, direction: 1 }, code: 0xa8 },
    ])
    expect(plan.unknownKeys).toBe(0)
  })

  it('accepts numeric keycodes and counts names it cannot read', () => {
    const backup = parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [[[4, 'NOT_A_KEY', -1]]] }))
    const plan = planRestore(backup, source)
    expect(plan.changes).toEqual([{ target: { kind: 'key', layer: 0, row: 0, col: 0 }, code: 0x04 }])
    expect(plan.unknownKeys).toBe(1)
  })

  it('restores layout options when both sides have them', () => {
    const backup = parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], layout_options: 3 }))
    expect(planRestore(backup, { ...source, layoutOptionsValue: 0 }).layoutOptions).toBe(3)
    expect(planRestore(backup, source).layoutOptions).toBeNull()
  })

  it('restores macros, sized to the keyboard’s macro count', () => {
    const backup = parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], macro: [[['tap', 'KC_A']], [], [['text', 'x']]] }))
    expect(planRestore(backup, source).macros).toEqual([[{ type: 'tap', keys: [0x04] }], []])
    expect(planRestore(parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [] })), source).macros).toBeNull()
  })

  it('counts macro key names it cannot read', () => {
    const backup = parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], macro: [[['tap', 'KC_A', 'NOPE']]] }))
    expect(planRestore(backup, source).unknownKeys).toBe(1)
  })

  it('skips macros that would corrupt macro memory, and says so', () => {
    const backup = parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], macro: [[['text', 'a\u0000b']]] }))
    const plan = planRestore(backup, source)
    expect(plan.macros).toBeNull()
    expect(plan.notes).toEqual([expect.stringMatching(/macros/)])
  })

  it('says when the keyboard has no room for the backup’s macros', () => {
    const backup = parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], macro: [[['text', 'x']]] }))
    const plan = planRestore(backup, { ...source, macros: [] })
    expect(plan.macros).toBeNull()
    expect(plan.notes).toEqual([expect.stringMatching(/no macros/)])
  })

  it('restores the QMK settings this keyboard has', () => {
    const backup = parseBackup(
      JSON.stringify({ version: 1, uid: 1, layout: [], settings: { 2: 99999, 7: 'x', 21: 0xf001, 30: 5 } }),
    )
    const plan = planRestore(backup, source)
    // 7 isn't a number and 30 isn't on this keyboard, so both are left out.
    // 2 is kept within its limit, and 21 keeps only the bits that mean something.
    expect(plan.settings).toEqual({ 2: 10000, 21: 1 })
    expect(plan.notes).toEqual(["2 settings in this backup don't fit this keyboard, so they were left out."])
    expect(planRestore(parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [] })), source).settings).toBeNull()
  })

  it('says when the keyboard has no QMK settings for the backup’s', () => {
    const backup = parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], settings: { 2: 60 } }))
    const plan = planRestore(backup, { ...source, qmkSettings: { supported: [], values: {} } })
    expect(plan.settings).toBeNull()
    expect(plan.notes).toEqual([expect.stringMatching(/no QMK settings/)])
  })

  it('restores tap dances, keeping slots it cannot read', () => {
    const backup = parseBackup(
      JSON.stringify({ version: 1, uid: 1, layout: [], tap_dance: [['KC_A', 'NOPE', 'KC_NO', 'KC_NO', 200], ['KC_B', 'KC_NO', 'KC_NO', 'KC_NO', 150]] }),
    )
    const plan = planRestore(backup, source)
    expect(plan.tapDances).toEqual([source.tapDances[0]])
    expect(plan.unknownKeys).toBe(1)
    expect(plan.notes).toEqual(["1 tap dance in this backup didn't fit, because this keyboard has room for 1."])
  })

  it('restores key overrides, keeping slots it cannot read', () => {
    const ko = { trigger: 'KC_A', replacement: 'KC_B', layers: 1, trigger_mods: 2, negative_mod_mask: 0, suppressed_mods: 2, options: 0x87 }
    const plan = planRestore(parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], key_override: [ko] })), source)
    expect(plan.keyOverrides).toEqual([
      { trigger: 0x04, replacement: 0x05, layers: 1, triggerMods: 2, negativeMods: 0, suppressedMods: 2, options: 0x87 },
    ])
    const bad = planRestore(parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], key_override: [{ ...ko, trigger: 'NOPE' }] })), source)
    expect(bad.keyOverrides).toEqual(source.keyOverrides)
    expect(bad.unknownKeys).toBe(1)
  })

  it('restores combos into the slots the keyboard has', () => {
    const backup = parseBackup(
      JSON.stringify({ version: 1, uid: 1, layout: [], combo: [['KC_B', 'KC_C', 'KC_NO', 'KC_NO', 'KC_D']] }),
    )
    // Slot 2 isn't in the backup, so it keeps what the keyboard has.
    expect(planRestore(backup, source).combos).toEqual([{ keys: [0x05, 0x06, 0, 0], output: 0x07 }, source.combos[1]])
    expect(planRestore(parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [] })), source).combos).toBeNull()
  })

  it('says when combos in the backup do not fit', () => {
    const combo = ['KC_B', 'KC_C', 'KC_NO', 'KC_NO', 'KC_D']
    const backup = parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], combo: [combo, combo, combo] }))
    expect(planRestore(backup, source).notes).toEqual([
      "1 combo in this backup didn't fit, because this keyboard has room for 2.",
    ])
    const plan = planRestore(backup, { ...source, combos: [] })
    expect(plan.combos).toBeNull()
    expect(plan.notes).toEqual(['This keyboard has no combos, so the combos in this backup were left out.'])
  })

  it('keeps the keyboard combo when the saved one has a name it cannot read', () => {
    const backup = parseBackup(JSON.stringify({ version: 1, uid: 1, layout: [], combo: [['KC_A', 'NOPE', 'KC_NO', 'KC_NO', 'KC_D']] }))
    const plan = planRestore(backup, source)
    expect(plan.unknownKeys).toBe(1)
    expect(plan.combos![0]).toEqual(source.combos[0])
  })

  it('notices backups from a different keyboard', () => {
    const other = parseBackup(JSON.stringify({ version: 1, uid: 5, layout: [] }))
    expect(planRestore(other, source).sameKeyboard).toBe(false)
    expect(planRestore(parseBackup(createBackup(source)), source).sameKeyboard).toBe(true)
  })
})
