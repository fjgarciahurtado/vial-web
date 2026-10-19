// SPDX-License-Identifier: GPL-2.0-or-later
import type { LoadedKeyboard } from '@/core/keyboard'
import { PROFILE_SECTIONS, type Profile, type Section } from '@/core/profiles'

export const SECTION_TITLES: Record<Section, string> = {
  keys: 'Keys',
  lighting: 'Lighting',
  macros: 'Macros',
  tester: 'Key tester',
  advanced: 'Advanced',
}

export type AdvancedTab = 'tapDance' | 'combos' | 'keyOverrides' | 'altRepeat' | 'settings'

/** The Advanced features this keyboard has. */
export function advancedTabs(keyboard: LoadedKeyboard): { id: AdvancedTab; title: string }[] {
  return [
    ...(keyboard.tapDances.length ? [{ id: 'tapDance' as const, title: 'Tap dance' }] : []),
    ...(keyboard.combos.length ? [{ id: 'combos' as const, title: 'Combos' }] : []),
    ...(keyboard.keyOverrides.length ? [{ id: 'keyOverrides' as const, title: 'Key overrides' }] : []),
    ...(keyboard.altRepeats.length ? [{ id: 'altRepeat' as const, title: 'Alt Repeat' }] : []),
    ...(keyboard.qmkSettings.supported.length ? [{ id: 'settings' as const, title: 'Typing settings' }] : []),
  ]
}

/**
 * The sections shown for this keyboard in this mode. The mode decides which sections
 * show, and Lighting, Macros and Advanced show only on keyboards that have them.
 */
export function sectionsFor(keyboard: LoadedKeyboard, profile: Profile): { id: Section; title: string }[] {
  const { backlight, rgblight, vialrgb } = keyboard.lightingKind
  const shown: Section[] = [
    'keys',
    ...(backlight || rgblight || vialrgb ? ['lighting' as const] : []),
    ...(keyboard.macros.length ? ['macros' as const] : []),
    'tester',
    ...(advancedTabs(keyboard).length ? ['advanced' as const] : []),
  ]
  return shown.filter((id) => PROFILE_SECTIONS[profile].includes(id)).map((id) => ({ id, title: SECTION_TITLES[id] }))
}
