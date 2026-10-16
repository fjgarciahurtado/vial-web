// SPDX-License-Identifier: GPL-2.0-or-later
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const list = (page: Page) => page.getByRole('navigation', { name: 'Alt repeat keys' })
const picker = (page: Page) => page.getByRole('region', { name: 'Choose what the key does' })
const pick = (page: Page, name: string) => picker(page).getByRole('button', { name, exact: true }).click()
const sections = (page: Page) => page.getByRole('navigation', { name: 'Sections' })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await sections(page).getByRole('button', { name: 'Advanced' }).click()
  await page.getByRole('tab', { name: 'Alt Repeat' }).click()
})

test('pair Left with Right both ways, then put Alt Repeat on a key', async ({ page }) => {
  await expect(list(page).getByRole('button', { name: /Pair 1/ })).toContainText('Up arrow ↔ Down arrow')
  await expect(page.getByText('To use it, put Alt Repeat on a key in Keys, under Special.')).toBeVisible()

  await list(page).getByRole('button', { name: 'New pair' }).click()
  await picker(page).getByRole('searchbox').fill('left arrow')
  await pick(page, 'Left arrow')
  await expect(page.getByText('Choose what Alt Repeat sends.')).toBeVisible()
  await page.getByRole('button', { name: 'Alt Repeat sends: empty' }).click()
  await picker(page).getByRole('searchbox').fill('right arrow')
  await pick(page, 'Right arrow')
  await expect(list(page).getByRole('button', { name: /Pair 2/ })).toContainText('Left arrow → Right arrow')

  await page.getByRole('checkbox', { name: /Works both ways: after Right arrow/ }).click()
  await expect(list(page).getByRole('button', { name: /Pair 2/ })).toContainText('Left arrow ↔ Right arrow')
  await page.getByRole('group', { name: 'Modifiers that may be held' }).getByRole('button', { name: 'Left Shift' }).click()
  await expect(
    page.getByRole('group', { name: 'Modifiers that may be held' }).getByRole('button', { name: 'Left Shift' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('heading', { name: 'Advanced' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/alt-repeat.png', fullPage: true })

  await sections(page).getByRole('button', { name: 'Keys' }).click()
  await page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: 'Key Caps Lock', exact: true }).click()
  await picker(page).getByRole('searchbox').fill('alt repeat')
  await pick(page, 'Alt Repeat')
  await sections(page).getByRole('button', { name: 'Advanced' }).click()
  await page.getByRole('tab', { name: 'Alt Repeat' }).click()
  await expect(page.getByText('To use it, put Alt Repeat on a key in Keys, under Special.')).toHaveCount(0)
})

test('turn a pair off and delete it', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Turned on' }).click()
  await expect(list(page).getByRole('button', { name: /Pair 1/ })).toContainText('Off: Up arrow ↔ Down arrow')
  await expect(page.getByText('This pair is turned off.')).toBeVisible()
  await page.getByRole('button', { name: 'Delete pair' }).click()
  await expect(list(page).getByRole('button', { name: /Pair 1/ })).toContainText('Not set up')
})

test('alt repeat keys are saved in backups', async ({ page }) => {
  await sections(page).getByRole('button', { name: 'Keys' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save backup' }).click()
  const saved = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(saved.alt_repeat_key[0]).toEqual({ keycode: 'KC_UP', alt_keycode: 'KC_DOWN', allowed_mods: 0, options: 0b1010 })
  expect(saved.alt_repeat_key).toHaveLength(4)
})
