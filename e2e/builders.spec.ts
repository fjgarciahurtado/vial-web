// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test, type Page } from '@playwright/test'

const key = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: `Key ${name}`, exact: true })
const picker = (page: Page) => page.getByRole('region', { name: 'Choose what the key does' })
const openBuilder = (page: Page) => picker(page).getByRole('tab', { name: 'Shortcuts & holds' }).click()

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
})

test('make Caps Lock tap for Escape and hold for Ctrl', async ({ page }) => {
  await key(page, 'Caps Lock').click()
  await openBuilder(page)
  await picker(page).getByRole('radio', { name: 'Tap or hold: modifier' }).check()
  await picker(page).getByRole('searchbox', { name: 'Search for the key' }).fill('escape')
  await picker(page).getByRole('radio', { name: 'Escape', exact: true }).click()
  await expect(picker(page).getByText('This key will be: Ctrl when held, Escape when tapped.')).toBeVisible()
  await picker(page).getByRole('button', { name: 'Use on this key' }).click()

  await expect(key(page, 'Ctrl when held, Escape when tapped')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/builder.png' })

  // Selecting it again reopens the builder with its settings.
  await key(page, 'A').click()
  await key(page, 'Ctrl when held, Escape when tapped').click()
  await expect(picker(page).getByRole('radio', { name: 'Tap or hold: modifier' })).toBeChecked()
})

test('make a Ctrl + Shift + C shortcut key', async ({ page }) => {
  await key(page, 'Q').click()
  await openBuilder(page)
  await picker(page).getByRole('checkbox', { name: 'Shift' }).check()
  await picker(page).getByRole('radio', { name: 'C', exact: true }).click()
  await picker(page).getByRole('button', { name: 'Use on this key' }).click()
  await expect(key(page, 'Ctrl + Shift + C')).toBeVisible()
})

test('make Space hold for layer 1', async ({ page }) => {
  await key(page, 'Space').click()
  await openBuilder(page)
  await picker(page).getByRole('radio', { name: 'Tap or hold: layer' }).check()
  await picker(page).getByRole('button', { name: 'Use on this key' }).click()
  await expect(key(page, 'Hold for layer 1, tap for Space')).toBeVisible()
})

test('explain modifier mixes keyboards cannot use', async ({ page }) => {
  await key(page, 'Q').click()
  await openBuilder(page)
  await picker(page).getByRole('checkbox', { name: 'Shift' }).check()
  await picker(page).getByRole('checkbox', { name: 'Win/Cmd' }).check()
  await expect(picker(page).getByText("Keyboards can't use this mix of keys. Try fewer of them.")).toBeVisible()
  await expect(picker(page).getByRole('button', { name: 'Use on this key' })).toBeDisabled()
})
