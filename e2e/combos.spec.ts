// SPDX-License-Identifier: GPL-2.0-or-later
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const combos = (page: Page) => page.getByRole('navigation', { name: 'Combos' })
const picker = (page: Page) => page.getByRole('region', { name: 'Choose what the key does' })
const pick = (page: Page, name: string) => picker(page).getByRole('button', { name, exact: true }).click()

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Advanced' }).click()
  await page.getByRole('tab', { name: 'Combos' }).click()
})

test('build a combo, then delete it', async ({ page }) => {
  await expect(combos(page).getByRole('button', { name: /Combo 1/ })).toContainText('J + K → Escape')

  await combos(page).getByRole('button', { name: 'New combo' }).click()
  await expect(page.getByText('Choose the first key below.')).toBeVisible()

  // Each pick moves on to the next slot: key 1, key 2, then the result.
  await pick(page, 'D')
  await expect(page.getByText('A combo needs at least two keys pressed together.')).toBeVisible()
  await pick(page, 'F')
  await expect(page.getByText('Choose what the combo does.')).toBeVisible()
  await expect(page.getByText('Choose what the combo does:')).toBeVisible()
  await pick(page, 'Tab')
  await expect(page.getByText('Saved. Combo 2: D + F → Tab.')).toBeVisible()
  await expect(page.getByText('This combo is ready to use.')).toBeVisible()
  await expect(combos(page).getByRole('button', { name: /Combo 2/ })).toContainText('D + F → Tab')
  await page.getByRole('heading', { name: 'Advanced' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/combos.png' })

  await page.getByRole('button', { name: 'Key 2: F' }).click()
  await page.getByRole('button', { name: 'Clear key 2' }).click()
  await expect(combos(page).getByRole('button', { name: /Combo 2/ })).toContainText('D → Tab')

  await page.getByRole('button', { name: 'Delete combo' }).click()
  await expect(combos(page).getByRole('button', { name: /Combo 2/ })).toContainText('Not set up')
})

test('combos are saved in backups', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Keys' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save backup' }).click()
  const saved = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(saved.combo[0]).toEqual(['KC_J', 'KC_K', 'KC_NO', 'KC_NO', 'KC_ESCAPE'])
  expect(saved.combo).toHaveLength(8)
})

test('a backup restores combos', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Keys' }).click()
  // The demo keyboard's id, written out because it is too big for a JavaScript number.
  const backup =
    '{"version": 1, "uid": 578437695752307201, "layout": [], "combo": [["KC_Q", "KC_W", "KC_NO", "KC_NO", "KC_TAB"]]}'
  await page
    .getByLabel('Backup file')
    .setInputFiles({ name: 'demo.vil', mimeType: 'application/json', buffer: Buffer.from(backup) })
  await expect(page.getByText(/Restored the backup/)).toBeVisible()

  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Advanced' }).click()
  await page.getByRole('tab', { name: 'Combos' }).click()
  await expect(combos(page).getByRole('button', { name: /Combo 1/ })).toContainText('Q + W → Tab')
})
