// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Plain-language names for keycodes. vial-gui labels are short keycap legends
 * ("Bksp", "LShift"); these are what the app says in sentences and search.
 * Anything not listed here falls back to its legend joined into one line.
 */
export const NAMES: Record<string, string> = {
  KC_NO: 'Nothing',
  KC_TRNS: 'Same as the layer below',
  KC_ENTER: 'Enter',
  KC_ESCAPE: 'Escape',
  KC_BSPACE: 'Backspace',
  KC_DELETE: 'Delete',
  KC_PGUP: 'Page Up',
  KC_PGDOWN: 'Page Down',
  KC_RIGHT: 'Right arrow',
  KC_LEFT: 'Left arrow',
  KC_DOWN: 'Down arrow',
  KC_UP: 'Up arrow',
  KC_APPLICATION: 'Menu',
  KC_LCTRL: 'Left Ctrl',
  KC_LSHIFT: 'Left Shift',
  KC_LALT: 'Left Alt',
  KC_LGUI: 'Left Win/Cmd',
  KC_RCTRL: 'Right Ctrl',
  KC_RSHIFT: 'Right Shift',
  KC_RALT: 'Right Alt (AltGr)',
  KC_RGUI: 'Right Win/Cmd',
  KC_VOLU: 'Volume Up',
  KC_VOLD: 'Volume Down',
  KC_MUTE: 'Mute',
  KC_MPLY: 'Play/Pause',
  KC_MNXT: 'Next Track',
  KC_MPRV: 'Previous Track',
  KC_MSTP: 'Stop Media',
  KC_CALC: 'Calculator',
  KC_MYCM: 'This PC',
  KC_BRIU: 'Screen Brightness Up',
  KC_BRID: 'Screen Brightness Down',
  KC_WFAV: 'Browser Favorites',
  KC_PWR: 'Power Off',
  KC_GESC: 'Escape, or ~ with Shift',
  QK_BOOT: 'Bootloader (for firmware updates)',
  QK_CAPS_WORD_TOGGLE: 'Caps Word',
  QK_LAYER_LOCK: 'Layer Lock',
  FN_MO13: 'Fn1 (Fn3 with Fn2)',
  FN_MO23: 'Fn2 (Fn3 with Fn1)',
}

/** Extra words people might type when searching. */
export const KEYWORDS: Record<string, string[]> = {
  KC_ENTER: ['return'],
  KC_BSPACE: ['delete back'],
  KC_LGUI: ['windows', 'command', 'super', 'meta'],
  KC_RGUI: ['windows', 'command', 'super', 'meta'],
  KC_LALT: ['option'],
  KC_RALT: ['option', 'altgr'],
  KC_LCTRL: ['control'],
  KC_RCTRL: ['control'],
  KC_VOLU: ['louder', 'sound'],
  KC_VOLD: ['quieter', 'sound'],
  KC_MUTE: ['sound', 'silence'],
  KC_MPLY: ['music', 'pause', 'media'],
  KC_MNXT: ['music', 'skip', 'media'],
  KC_MPRV: ['music', 'back', 'media'],
  KC_PSCREEN: ['screenshot'],
  KC_APPLICATION: ['context'],
  KC_GRAVE: ['tilde', 'backtick'],
  KC_TRNS: ['transparent', 'fall through'],
  KC_NO: ['none', 'disable', 'blank'],
}

/** Modifier combinations used in masked keycodes like LSFT(kc) and LSFT_T(kc). */
export const MODIFIERS: Record<string, string> = {
  LSFT: 'Shift',
  LCTL: 'Ctrl',
  LALT: 'Alt',
  LGUI: 'Win/Cmd',
  RSFT: 'Right Shift',
  RCTL: 'Right Ctrl',
  RALT: 'Right Alt',
  RGUI: 'Right Win/Cmd',
  C_S: 'Ctrl + Shift',
  LCA: 'Ctrl + Alt',
  LCG: 'Ctrl + Win/Cmd',
  LSA: 'Shift + Alt',
  LAG: 'Alt + Win/Cmd',
  SGUI: 'Shift + Win/Cmd',
  LCAG: 'Ctrl + Alt + Win/Cmd',
  RCG: 'Right Ctrl + Right Win/Cmd',
  RCAG: 'Right Ctrl + Right Alt + Right Win/Cmd',
  MEH: 'Ctrl + Shift + Alt',
  HYPR: 'Ctrl + Shift + Alt + Win/Cmd',
  ALL: 'Ctrl + Shift + Alt + Win/Cmd',
}

const LAYER_ACTIONS: Record<string, (n: string) => string> = {
  MO: (n) => `Hold for layer ${n}`,
  TG: (n) => `Turn layer ${n} on or off`,
  TO: (n) => `Switch to layer ${n}`,
  DF: (n) => `Make layer ${n} the default`,
  PDF: (n) => `Make layer ${n} the default, even after unplugging`,
  TT: (n) => `Hold for layer ${n}, tap several times to keep it on`,
  OSL: (n) => `Layer ${n} for the next key only`,
}

/** Names for layer keys such as MO(1), or undefined when the id isn't one. */
export function layerKeyName(id: string): string | undefined {
  const match = /^([A-Z]+)\((\d+)\)$/.exec(id)
  const action = match && LAYER_ACTIONS[match[1]]
  return action ? action(match[2]) : undefined
}

/** Names for masked keycodes like LSFT(kc), LCTL_T(kc) and LT2(kc), given the inner key's name. */
export function maskedKeyName(outerId: string, inner: string): string | undefined {
  const prefix = outerId.replace('(kc)', '')
  const layerTap = /^LT(\d+)$/.exec(prefix)
  if (layerTap) return `Hold for layer ${layerTap[1]}, tap for ${inner}`
  if (prefix.endsWith('_T')) {
    const mods = MODIFIERS[prefix.slice(0, -2)]
    return mods && `${mods} when held, ${inner} when tapped`
  }
  const mods = MODIFIERS[prefix]
  return mods && `${mods} + ${inner}`
}
