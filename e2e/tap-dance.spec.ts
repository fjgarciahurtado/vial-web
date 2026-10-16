// SPDX-License-Identifier: GPL-2.0-or-later
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const list = (page: Page) => page.getByRole('navigation', { name: 'Tap dances' })
const picker = (page: Page) => page.getByRole('region', { name: 'Choose what the key does' })
const pick = (page: Page, name: string) => picker(page).getByRole('button', { name, exact: true }).click()
const sections = (page: Page) => page.getByRole('navigation', { name: 'Sections' })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await sections(page).getByRole('button', { name: 'Advanced' }).click()
  await expect(page.getByRole('tab', { name: 'Tap dance', selected: true })).toBeVisible()
})

test('set up a tap dance, change its timing, put it on a key', async ({ page }) => {
  await expect(list(page).getByRole('button', { name: /Tap dance 1/ })).toContainText('Tap: Escape, hold: Left Ctrl')

  await list(page).getByRole('button', { name: 'New tap dance' }).click()
  await expect(page.getByText('Choose what a tap does below.')).toBeVisible()
  await pick(page, 'A')
  await expect(page.getByText('Saved. Tap dance 2: Tap: A.')).toBeVisible()
  // Empty actions explain what the keyboard does instead.
  await expect(page.getByText('Holds A.', { exact: true })).toBeVisible()
  await expect(page.getByText('Types A twice.', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Tap twice: empty' }).click()
  await pick(page, 'Caps Lock')
  await expect(list(page).getByRole('button', { name: /Tap dance 2/ })).toContainText('Tap: A, double tap: Caps Lock')

  const wait = page.getByRole('spinbutton', { name: 'Wait time' })
  await wait.fill('250')
  await wait.press('Enter')
  await expect(page.getByText(/Saved\. Tap dance 2/)).toBeVisible()
  await expect(wait).toHaveValue('250')
  await expect(page.getByText('Not on any key yet. In Keys, choose Tap dance, then Tap dance 2.')).toBeVisible()
  await page.getByRole('heading', { name: 'Advanced' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/tap-dance.png' })

  await sections(page).getByRole('button', { name: 'Keys' }).click()
  await page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: 'Key Caps Lock', exact: true }).click()
  await picker(page).getByRole('tab', { name: 'Tap dance' }).click()
  await pick(page, 'Tap dance 2')
  await expect(page.getByText('Saved. This key is now Tap dance 2.')).toBeVisible()

  await sections(page).getByRole('button', { name: 'Advanced' }).click()
  await list(page).getByRole('button', { name: /Tap dance 2/ }).click()
  await expect(page.getByText('On 1 key of your keymap.')).toBeVisible()
})

test('delete a tap dance', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete tap dance' }).click()
  await expect(list(page).getByRole('button', { name: /Tap dance 1/ })).toContainText('Not set up')
})

test('tap dances are saved in backups', async ({ page }) => {
  await sections(page).getByRole('button', { name: 'Keys' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save backup' }).click()
  const saved = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(saved.tap_dance[0]).toEqual(['KC_ESCAPE', 'KC_LCTRL', 'KC_NO', 'KC_NO', 200])
  expect(saved.tap_dance).toHaveLength(4)
})
