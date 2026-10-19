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

test('Musician puts notes first and leaves out typing keys, and the mode is remembered', async ({ page }) => {
  await mode(page, 'Musician').click()
  await expect(sections(page)).toHaveText(['Keys', 'Lighting', 'Macros'])
  await key(page, 'Q').click()
  await expect(tabs(page)).toHaveText(['MIDI', 'Layers', 'Macros', 'Lighting', 'Blank'])
  await expect(page.getByRole('group', { name: 'Notes' })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await expect(mode(page, 'Musician')).toHaveAttribute('aria-pressed', 'true')
})
