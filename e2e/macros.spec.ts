// SPDX-License-Identifier: GPL-2.0-or-later
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const section = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name }).click()
const steps = (page: Page) => page.getByRole('region', { name: /^Macro \d+ steps$/ })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await section(page, 'Macros')
})

test('shows what each macro does', async ({ page }) => {
  const list = page.getByRole('navigation', { name: 'Macros' })
  await expect(list.getByRole('button')).toHaveCount(4)
  await expect(list.getByRole('button').first()).toContainText('Types “Best regards,”, presses Enter, types “Alex”')
})

test('build a macro, save it, put it on a key and back it up', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Macros' }).getByRole('button', { name: /^Macro 2/ }).click()

  await steps(page).getByRole('button', { name: 'Type text' }).click()
  await steps(page).getByPlaceholder('Text to type').fill('hello')
  await steps(page).getByRole('button', { name: 'Press a key' }).click()
  await steps(page).getByRole('button', { name: 'Choose a key' }).click()
  await steps(page).getByRole('searchbox', { name: 'Search for the key' }).fill('enter')
  await steps(page).getByRole('radio', { name: 'Enter', exact: true }).click()
  await expect(steps(page).getByText('Types “hello”, presses Enter.')).toBeVisible()
  await page.screenshot({ path: 'test-results/macros.png' })

  await page.getByRole('button', { name: 'Save macros' }).click()
  await expect(page.getByRole('dialog', { name: 'Unlock your keyboard' })).toBeVisible()
  await expect(page.getByText('Macros saved.')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Discard changes' })).toBeDisabled()

  await section(page, 'Keys')
  await page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: 'Key Caps Lock' }).click()
  const picker = page.getByRole('region', { name: 'Choose what the key does' })
  await picker.getByRole('tab', { name: 'Macros' }).click()
  await picker.getByRole('button', { name: 'Macro 2', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: 'Key Macro 2' })).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save backup' }).click()
  const saved = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(saved.macro[1]).toEqual([['text', 'hello'], ['tap', 'KC_ENTER']])
})

test('explain text keyboards cannot type, and discard changes', async ({ page }) => {
  await steps(page).getByPlaceholder('Text to type').first().fill('café')
  await expect(page.getByText(/so “é” won't work/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save macros' })).toBeDisabled()

  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(steps(page).getByPlaceholder('Text to type').first()).toHaveValue('Best regards,')
})
