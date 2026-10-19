// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Takes the Learn section's pictures from the demo keyboard: one per lesson, saved as
 * public/learn/<lesson id>.jpg. Run `npm run learn:shots` after changing the UI, then
 * look through the pictures before committing them.
 */
import { test, type Locator, type Page } from '@playwright/test'
import { LESSONS } from '../src/learn/lessons'

const picker = (page: Page) => page.getByRole('region', { name: 'Choose what the key does' })
const key = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: `Key ${name}`, exact: true })
const pad = (page: Page, n: number) =>
  page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: new RegExp(`^Pad ${n}:`) })
const section = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name })
const piano = (page: Page) => page.getByRole('group', { name: 'Notes' })
const note = (page: Page, name: string) => piano(page).getByRole('button', { name: new RegExp(`^Note ${name}\\b`) })

/** Draws a ring around what the lesson is about. */
async function mark(...targets: Locator[]) {
  for (const t of targets) {
    await t.scrollIntoViewIfNeeded()
    await t.evaluate((el: HTMLElement) => {
      el.style.outline = '3px solid #f97316'
      el.style.outlineOffset = '3px'
    })
  }
}

async function shot(page: Page, id: string, { keepPointer = false } = {}) {
  if (!keepPointer) await page.mouse.move(0, 0)
  // Let colour transitions finish.
  await page.waitForTimeout(400)
  await page.screenshot({ path: `public/learn/${id}.jpg`, type: 'jpeg', quality: 80 })
}

async function demo(page: Page, mode: 'Easy' | 'Advanced' | 'Musician') {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: mode }).click()
}

const takes: Record<string, (page: Page) => Promise<void>> = {
  'change-a-key': async (page) => {
    await demo(page, 'Easy')
    await key(page, 'Q').click()
    await picker(page).getByRole('tab', { name: 'Media & mouse' }).click()
    await picker(page).getByRole('button', { name: 'Volume Up', exact: true }).click()
    await mark(key(page, 'Volume Up'), picker(page).getByRole('button', { name: 'Volume Up', exact: true }))
  },
  'search-keys': async (page) => {
    await demo(page, 'Easy')
    await key(page, 'Q').click()
    await picker(page).getByRole('searchbox', { name: 'Search keys' }).fill('copy')
    await mark(picker(page).getByRole('searchbox', { name: 'Search keys' }))
  },
  'shortcut-key': async (page) => {
    await demo(page, 'Easy')
    await key(page, 'Q').click()
    await picker(page).getByRole('tab', { name: 'Shortcuts & holds' }).click()
    await picker(page).getByRole('radio', { name: 'C', exact: true }).click()
    await mark(picker(page).getByRole('button', { name: 'Use on this key' }))
  },
  'tap-or-hold': async (page) => {
    await demo(page, 'Easy')
    await key(page, 'Caps Lock').click()
    await picker(page).getByRole('tab', { name: 'Shortcuts & holds' }).click()
    await picker(page).getByRole('radio', { name: 'Tap or hold: modifier' }).check()
    await picker(page).getByRole('searchbox', { name: 'Search for the key' }).fill('escape')
    await picker(page).getByRole('radio', { name: 'Escape', exact: true }).click()
    await mark(picker(page).getByRole('button', { name: 'Use on this key' }))
  },
  layers: async (page) => {
    await demo(page, 'Easy')
    // The demo already has a key that holds layer 1.
    await mark(key(page, 'Hold for layer 1'))
    await page.getByRole('tab', { name: 'Layer 1' }).click()
    await mark(page.getByRole('tablist', { name: 'Layers' }))
  },
  macro: async (page) => {
    await demo(page, 'Easy')
    await section(page, 'Macros').click()
    await page.getByRole('navigation', { name: 'Macros' }).getByRole('button', { name: /^Macro 2/ }).click()
    const steps = page.getByRole('region', { name: /^Macro \d+ steps$/ })
    await steps.getByRole('button', { name: 'Type text' }).click()
    await steps.getByPlaceholder('Text to type').fill('Best regards, Alex')
    await mark(steps.getByPlaceholder('Text to type'), page.getByRole('button', { name: 'Save macros' }))
  },
  lighting: async (page) => {
    await demo(page, 'Easy')
    await section(page, 'Lighting').click()
    const lights = page.getByRole('group', { name: 'Key lights' })
    await lights.getByRole('combobox', { name: 'Effect' }).selectOption({ label: 'Solid Color' })
    await mark(lights.getByRole('combobox', { name: 'Effect' }), page.getByRole('button', { name: 'Save lighting' }))
  },
  'key-tester': async (page) => {
    await demo(page, 'Easy')
    await section(page, 'Key tester').click()
    await page.getByRole('button', { name: 'Unlock to test' }).click()
    await page.getByRole('dialog', { name: 'Unlock your keyboard' }).waitFor({ state: 'hidden', timeout: 10_000 })
    for (const k of ['q', 'w', 'e', 'a', 's', 'd', 'Space']) await page.keyboard.press(k, { delay: 60 })
    await mark(page.getByText(/of \d+ keys work/))
  },
  backup: async (page) => {
    await demo(page, 'Easy')
    await mark(page.getByRole('button', { name: 'Save backup' }), page.getByRole('button', { name: 'Restore backup' }))
  },
  'pads-and-piano': async (page) => {
    await demo(page, 'Musician')
    for (const [n, name] of [
      [16, 'C4'],
      [17, 'E4'],
      [18, 'G4'],
      [30, 'E4'],
    ] as const) {
      await pad(page, n).click()
      await note(page, name).click()
    }
    await mark(piano(page))
    await note(page, 'E4').hover()
    await shot(page, 'pads-and-piano', { keepPointer: true })
  },
  'note-on-a-pad': async (page) => {
    await demo(page, 'Musician')
    await pad(page, 16).click()
    await note(page, 'C4').click()
    await mark(note(page, 'C4'))
  },
  'chord-on-a-pad': async (page) => {
    await demo(page, 'Musician')
    await pad(page, 16).click()
    await picker(page).getByRole('tab', { name: 'Chords' }).click()
    const chord = page.getByRole('region', { name: 'Chords' }).getByRole('button', { name: /^Am/ })
    await chord.click()
    await mark(chord)
  },
  'octave-and-pedals': async (page) => {
    await demo(page, 'Musician')
    await pad(page, 1).click()
    await picker(page).getByRole('tab', { name: 'Octave, pedals and more' }).click()
    await mark(picker(page).getByRole('button', { name: 'Octave up', exact: true }))
  },
  'musician-layers': async (page) => {
    await demo(page, 'Musician')
    await pad(page, 1).click()
    await picker(page).getByRole('tab', { name: 'Layers' }).click()
    await picker(page).getByRole('button', { name: 'Hold for layer 1', exact: true }).click()
    await mark(picker(page).getByRole('button', { name: 'Hold for layer 1', exact: true }), page.getByRole('tab', { name: 'Layer 1' }))
  },
  'write-a-phrase': async (page) => {
    await demo(page, 'Musician')
    await section(page, 'Macros').click()
    await page.getByRole('navigation', { name: 'Macros' }).getByRole('button', { name: /^Macro 2/ }).click()
    for (const name of ['C4', 'E4', 'G4', 'C5']) await note(page, name).click()
    const phrase = page.getByRole('region', { name: /^Macro \d+ phrase$/ })
    await phrase.getByRole('button', { name: 'Add a rest' }).click()
    await mark(phrase.getByRole('list', { name: 'Steps' }))
  },
  'tap-dance': async (page) => {
    await demo(page, 'Advanced')
    await section(page, 'Advanced').click()
    await page.getByRole('navigation', { name: 'Tap dances' }).getByRole('button', { name: 'New tap dance' }).click()
    await picker(page).getByRole('button', { name: 'A', exact: true }).click()
    await mark(page.getByRole('button', { name: 'Tap twice: empty' }))
  },
  combos: async (page) => {
    await demo(page, 'Advanced')
    await section(page, 'Advanced').click()
    await page.getByRole('tab', { name: 'Combos' }).click()
    await page.getByRole('navigation', { name: 'Combos' }).getByRole('button', { name: 'New combo' }).click()
    for (const name of ['D', 'F', 'Tab']) await picker(page).getByRole('button', { name, exact: true }).click()
    await page.getByRole('heading', { name: 'Advanced' }).scrollIntoViewIfNeeded()
    await mark(page.getByRole('navigation', { name: 'Combos' }).getByRole('button', { name: /Combo 2/ }))
  },
  'key-overrides': async (page) => {
    await demo(page, 'Advanced')
    await section(page, 'Advanced').click()
    await page.getByRole('tab', { name: 'Key overrides' }).click()
    await mark(page.getByRole('navigation', { name: 'Key overrides' }).getByRole('button', { name: /Key override 1/ }))
  },
  'alt-repeat': async (page) => {
    await demo(page, 'Advanced')
    await section(page, 'Advanced').click()
    await page.getByRole('tab', { name: 'Alt Repeat' }).click()
    await mark(page.getByRole('navigation', { name: 'Alt repeat keys' }).getByRole('button', { name: 'New pair' }))
  },
  'typing-settings': async (page) => {
    await demo(page, 'Advanced')
    await section(page, 'Advanced').click()
    await page.getByRole('tab', { name: 'Typing settings' }).click()
    const hold = page.getByRole('group', { name: /Tap and hold/ }).getByRole('spinbutton', { name: 'Hold time' })
    await hold.fill('220')
    await mark(hold)
  },
}

test.use({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })

for (const lesson of LESSONS) {
  test(lesson.id, async ({ page }) => {
    const take = takes[lesson.id]
    if (!take) throw new Error(`No picture steps for the lesson ${lesson.id}`)
    await take(page)
    if (lesson.id !== 'pads-and-piano') await shot(page, lesson.id)
  })
}
