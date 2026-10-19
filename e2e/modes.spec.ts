// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test, type Page } from '@playwright/test'

const sections = (page: Page) => page.getByRole('navigation', { name: 'Sections' }).getByRole('button')
const tabs = (page: Page) => page.getByRole('tablist', { name: 'Key categories' }).getByRole('tab')
const mode = (page: Page, name: string) => page.getByRole('group', { name: 'Mode' }).getByRole('button', { name })
const key = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: `Key ${name}`, exact: true })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
})

test('the demo starts in Advanced, with every section', async ({ page }) => {
  await expect(mode(page, 'Advanced')).toHaveAttribute('aria-pressed', 'true')
  await expect(sections(page)).toHaveText(['Keys', 'Lighting', 'Macros', 'Key tester', 'Advanced'])
})

test('Easy keeps to everyday keys, layers, macros and lighting', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Advanced' }).click()
  await mode(page, 'Easy').click()
  // The Advanced section isn't part of Easy, so the app goes back to Keys.
  await expect(sections(page)).toHaveText(['Keys', 'Lighting', 'Macros'])
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Keys' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await key(page, 'Q').click()
  await expect(tabs(page).first()).toHaveText('Letters & numbers')
  await expect(tabs(page).filter({ hasText: 'Layers' })).toHaveCount(1)
  await expect(tabs(page).filter({ hasText: /^(MIDI|Tap dance|Special)$/ })).toHaveCount(0)
  // Search finds only the keys Easy offers.
  await page.getByRole('searchbox', { name: 'Search keys' }).fill('sustain')
  await expect(page.getByRole('region', { name: 'Choose what the key does' }).getByRole('button', { name: /Sustain/ })).toHaveCount(0)
})

const pad = (page: Page, name: RegExp) => page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name })

test('Musician numbers the pads and shows on the piano which pad plays each note', async ({ page }) => {
  await mode(page, 'Musician').click()
  await expect(sections(page)).toHaveText(['Keys', 'Lighting', 'Macros'])
  await pad(page, /^Pad 16: Q$/).click()
  await expect(page.getByText('Pad 16 is Q. Choose what it should do instead.')).toBeVisible()
  await expect(tabs(page)).toHaveText(['Notes', 'Chords', 'Octave, pedals and more', 'Layers', 'Macros', 'Lighting', 'Blank'])

  const piano = page.getByRole('group', { name: 'Notes' })
  await piano.getByRole('button', { name: 'Note E4', exact: true }).click()
  await expect(pad(page, /^Pad 16: MIDI E4$/)).toBeVisible()
  await expect(piano.getByRole('button', { name: 'Note E4, on pad 16' })).toHaveAttribute('aria-pressed', 'true')

  // Pointing at a note lights the pads that play it.
  await pad(page, /^Pad 17: W$/).click()
  await piano.getByRole('button', { name: 'Note E4, on pad 16' }).hover()
  await expect(pad(page, /^Pad 16: MIDI E4$/)).toHaveAttribute('aria-pressed', 'true')

  // Picking a pad with a chord opens the chords.
  await page.getByRole('tab', { name: 'Chords' }).click()
  await page.getByRole('region', { name: 'Chords' }).getByRole('button', { name: /^Am/ }).click()
  await pad(page, /^Pad 16/).click()
  await pad(page, /^Pad 17/).click()
  await expect(page.getByRole('tab', { name: 'Chords' })).toHaveAttribute('aria-selected', 'true')

  // Typing keys aren't offered, but blank keys are.
  await page.getByRole('tab', { name: 'Blank' }).click()
  await expect(page.getByRole('list', { name: 'Keys' }).getByRole('button')).toHaveCount(2)
})

test('the mode is remembered for the keyboard', async ({ page }) => {
  await mode(page, 'Musician').click()
  await page.reload()
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await expect(mode(page, 'Musician')).toHaveAttribute('aria-pressed', 'true')
})
