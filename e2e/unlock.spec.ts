// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test, type Page } from '@playwright/test'

const key = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: `Key ${name}`, exact: true })
const picker = (page: Page) => page.getByRole('region', { name: 'Choose what the key does' })

test('setting the bootloader key walks through unlocking first', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()

  await key(page, 'Right Ctrl').click()
  await picker(page).getByRole('tab', { name: 'Special' }).click()
  await picker(page).getByRole('button', { name: 'Bootloader (for firmware updates)' }).click()

  const dialog = page.getByRole('dialog', { name: 'Unlock your keyboard' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('progressbar', { name: 'Unlock progress' })).toBeVisible()
  await page.screenshot({ path: 'test-results/unlock.png', fullPage: true })

  await expect(dialog).toBeHidden({ timeout: 10_000 })
  await expect(key(page, 'Bootloader (for firmware updates)')).toBeVisible()

  await page.getByRole('button', { name: 'Unlocked. Lock now' }).click()
  await expect(page.getByText('The keyboard is locked again.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unlocked. Lock now' })).toBeHidden()
})
