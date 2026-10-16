// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test, type Page } from '@playwright/test'

const tapHold = (page: Page) => page.getByRole('group', { name: /Tap and hold keys/ })
const holdTime = (page: Page) => tapHold(page).getByRole('spinbutton', { name: 'Hold time' })
const nkro = (page: Page) => page.getByRole('checkbox', { name: /Report every key at once/ })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await openSettings(page)
})

async function openSettings(page: Page) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Advanced' }).click()
  await page.getByRole('tab', { name: 'Typing settings' }).click()
}

test('change, save and discard QMK settings', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Advanced' })).toBeVisible()
  await expect(holdTime(page)).toHaveValue('200')
  await expect(nkro(page)).toBeChecked()

  await holdTime(page).fill('250')
  await expect(tapHold(page).getByText('Not saved')).toBeVisible()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Settings saved.')).toBeVisible()
  await expect(tapHold(page).getByText('Not saved')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save settings' })).toBeDisabled()
  await page.screenshot({ path: 'test-results/settings.png', fullPage: true })

  await nkro(page).uncheck()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(nkro(page)).toBeChecked()
  await expect(page.getByText('Changes to settings were discarded.')).toBeVisible()
})

test('keep numbers within limits', async ({ page }) => {
  await holdTime(page).fill('99999')
  await holdTime(page).blur()
  await expect(holdTime(page)).toHaveValue('10000')
})

test('reset settings to defaults after confirming', async ({ page }) => {
  await holdTime(page).fill('300')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Settings saved.')).toBeVisible()

  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(holdTime(page)).toHaveValue('300')

  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  await page.getByRole('button', { name: 'Reset settings' }).click()
  await expect(page.getByText("Every setting is back to the keyboard's default.")).toBeVisible()
  await expect(holdTime(page)).toHaveValue('200')
})

test('a backup restores QMK settings', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Keys' }).click()
  // The demo keyboard's id, written out because it is too big for a JavaScript number.
  const backup = '{"version": 1, "uid": 578437695752307201, "layout": [], "settings": {"7": 180}}'
  await page
    .getByLabel('Backup file')
    .setInputFiles({ name: 'demo.vil', mimeType: 'application/json', buffer: Buffer.from(backup) })
  await expect(page.getByText(/Restored the backup/)).toBeVisible()

  await openSettings(page)
  await expect(holdTime(page)).toHaveValue('180')
})
