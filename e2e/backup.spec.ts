// SPDX-License-Identifier: GPL-2.0-or-later
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const key = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: `Key ${name}`, exact: true })
const picker = (page: Page) => page.getByRole('region', { name: 'Choose what the key does' })
const restoreFile = (page: Page, name: string, text: string) =>
  page.getByLabel('Backup file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
})

test('save a backup, change a key, and restore the backup', async ({ page }) => {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save backup' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('demo-60-keyboard.vil')
  const saved = await readFile(await file.path(), 'utf8')
  expect(JSON.parse(saved)).toMatchObject({ version: 1, layout_options: 0 })

  await key(page, 'Q').click()
  await picker(page).getByRole('button', { name: 'Z', exact: true }).click()
  await expect(key(page, 'Q')).toHaveCount(0)

  await restoreFile(page, 'demo.vil', saved)
  await expect(key(page, 'Q')).toBeVisible()
  await expect(page.getByText('Restored the backup. Use Undo change to go back.')).toBeVisible()

  await page.getByRole('button', { name: 'Undo change' }).click()
  await expect(key(page, 'Q')).toHaveCount(0)
})

test('ask before restoring a backup from another keyboard', async ({ page }) => {
  const other = JSON.stringify({ version: 1, uid: 42, layout: [[['KC_B']]] })

  await restoreFile(page, 'other.vil', other)
  const dialog = page.getByRole('alertdialog', { name: 'This backup is from a different keyboard' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Nothing was changed.')).toBeVisible()
  await expect(key(page, 'Escape')).toBeVisible()

  await restoreFile(page, 'other.vil', other)
  await dialog.getByRole('button', { name: 'Restore anyway' }).click()
  await expect(key(page, 'Escape')).toHaveCount(0)
  await expect(key(page, 'B')).toHaveCount(2)
})

test('explain when a file is not a backup', async ({ page }) => {
  await restoreFile(page, 'notes.vil', 'hello')
  await expect(page.getByText("This file isn't a Vial keymap backup.")).toBeVisible()
})
