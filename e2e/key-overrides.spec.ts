// SPDX-License-Identifier: GPL-2.0-or-later
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const list = (page: Page) => page.getByRole('navigation', { name: 'Key overrides' })
const picker = (page: Page) => page.getByRole('region', { name: 'Choose what the key does' })
const pick = (page: Page, name: string) => picker(page).getByRole('button', { name, exact: true }).click()
const sections = (page: Page) => page.getByRole('navigation', { name: 'Sections' })
const holdMods = (page: Page) => page.getByRole('group', { name: 'Hold these modifiers' })
const letGo = (page: Page) => page.getByRole('group', { name: 'Let go of these modifiers while sending it' })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await sections(page).getByRole('button', { name: 'Advanced' }).click()
  await page.getByRole('tab', { name: 'Key overrides' }).click()
})

test('make Ctrl + Escape send Tab', async ({ page }) => {
  await expect(list(page).getByRole('button', { name: /Key override 1/ })).toContainText('Shift + Backspace → Delete')

  await list(page).getByRole('button', { name: 'New key override' }).click()
  await expect(page.getByText('Choose the modifiers to hold and the key, then what it sends instead.')).toBeVisible()

  await holdMods(page).getByRole('button', { name: 'Left Ctrl' }).click()
  await expect(page.getByText(/Saved\. Key override 2/)).toBeVisible()
  // The modifiers held are let go of while sending, unless chosen otherwise.
  await expect(letGo(page).getByRole('button', { name: 'Left Ctrl' })).toHaveAttribute('aria-pressed', 'true')

  await pick(page, 'Escape')
  await page.getByRole('button', { name: 'Sends instead: empty' }).click()
  await pick(page, 'Tab')
  await expect(list(page).getByRole('button', { name: /Key override 2/ })).toContainText('Left Ctrl + Escape → Tab')
  await expect(page.getByText('This key override works on every layer.')).toBeVisible()
  await page.getByRole('heading', { name: 'Advanced' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/key-overrides.png', fullPage: true })

  // Saved to the keyboard first, then shown.
  await page.getByRole('checkbox', { name: 'Layer 1' }).click()
  await expect(page.getByText('This key override is ready to use.')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Main layer' }).click()
  await expect(page.getByText('Choose at least one layer for it to work on.')).toBeVisible()

  await page.getByRole('checkbox', { name: 'Turned on' }).click()
  await expect(list(page).getByRole('button', { name: /Key override 2/ })).toContainText('Off: Left Ctrl + Escape → Tab')

  await page.getByRole('button', { name: 'Delete key override' }).click()
  await expect(list(page).getByRole('button', { name: /Key override 2/ })).toContainText('Not set up')
})

test('key overrides are saved in backups', async ({ page }) => {
  await sections(page).getByRole('button', { name: 'Keys' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save backup' }).click()
  const saved = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(saved.key_override[0]).toEqual({
    trigger: 'KC_BSPACE',
    replacement: 'KC_DELETE',
    layers: 0xffff,
    trigger_mods: 0x22,
    negative_mod_mask: 0,
    suppressed_mods: 0x22,
    options: 0x87,
  })
  expect(saved.key_override).toHaveLength(4)
})
