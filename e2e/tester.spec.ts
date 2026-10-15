// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test } from '@playwright/test'

test('test keys after unlocking, using the computer keyboard in demo mode', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Key tester' }).click()

  await page.getByRole('button', { name: 'Unlock to test' }).click()
  await expect(page.getByRole('dialog', { name: 'Unlock your keyboard' })).toBeHidden({ timeout: 10_000 })
  await expect(page.getByText('0 of 61 keys work')).toBeVisible()

  await page.keyboard.down('a')
  await expect(page.getByText('1 of 61 keys work')).toBeVisible()
  await page.keyboard.up('a')
  for (const k of ['s', 'd', 'Space']) await page.keyboard.press(k, { delay: 80 })
  await expect(page.getByText('4 of 61 keys work')).toBeVisible()
  await page.screenshot({ path: 'test-results/tester.png' })

  await page.getByRole('button', { name: 'Start again' }).click()
  await expect(page.getByText('0 of 61 keys work')).toBeVisible()
})
