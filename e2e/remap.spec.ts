// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
})

const key = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: `Key ${name}`, exact: true })
const picker = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Choose what the key does' })

test('picker waits until a key is selected', async ({ page }) => {
  await expect(picker(page).getByRole('button', { name: 'A', exact: true })).toBeDisabled()
})

test('change a key from a category, then undo and redo', async ({ page }) => {
  await key(page, 'Q').click()
  await picker(page).getByRole('tab', { name: 'Media & mouse' }).click()
  await picker(page).getByRole('button', { name: 'Volume Up', exact: true }).click()

  await expect(key(page, 'Volume Up')).toBeVisible()
  await expect(page.getByText('Saved. This key is now Volume Up.')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/remap.png', fullPage: true })

  await page.getByRole('button', { name: 'Undo change' }).click()
  await expect(key(page, 'Q')).toBeVisible()
  await expect(page.getByText('Undone: this key is Q again.')).toBeVisible()

  await page.keyboard.press('Control+y')
  await expect(key(page, 'Volume Up')).toBeVisible()
})

test('find a key by searching in plain words', async ({ page }) => {
  await key(page, 'Caps Lock').click()
  await picker(page).getByRole('searchbox', { name: 'Search keys' }).fill('copy')
  await picker(page).getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(key(page, 'Copy')).toBeVisible()
})

test('changes on another layer stay on that layer', async ({ page }) => {
  await page.getByRole('tab', { name: 'Layer 1' }).click()
  await key(page, 'F1').click()
  await picker(page).getByRole('tab', { name: 'Navigation' }).click()
  await picker(page).getByRole('button', { name: 'Home', exact: true }).click()
  await expect(key(page, 'Home')).toBeVisible()

  await page.getByRole('tab', { name: 'Main layer' }).click()
  await expect(key(page, '1')).toBeVisible()
})

test('change what turning the knob does', async ({ page }) => {
  await page.getByRole('button', { name: 'Knob turn right: Volume Up' }).click()
  await expect(page.getByText('Turning the knob right is Volume Up.')).toBeVisible()
  await picker(page).getByRole('searchbox', { name: 'Search keys' }).fill('next track')
  await picker(page).getByRole('button', { name: 'Next Track', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Knob turn right: Next Track' })).toBeVisible()
  await expect(page.getByText('Saved. Turn right is now Next Track.')).toBeVisible()
})

test('switch to a split backspace', async ({ page }) => {
  await expect(key(page, 'Delete')).toHaveCount(0)
  await page.getByText('Does the drawing match your keyboard?').click()
  await page.getByRole('checkbox', { name: 'Split Backspace' }).check()
  await expect(key(page, 'Delete')).toBeVisible()
  await expect(key(page, 'Backspace')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/layout-option.png', fullPage: true })
})

