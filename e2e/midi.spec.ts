// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test, type Page } from '@playwright/test'

const picker = (page: Page) => page.getByRole('region', { name: 'Choose what the key does' })
const key = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: `Key ${name}`, exact: true })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await key(page, 'Q').click()
  await picker(page).getByRole('tab', { name: 'MIDI' }).click()
})

test('pick a note on the piano', async ({ page }) => {
  const piano = page.getByRole('group', { name: 'Notes' })
  await expect(piano.getByRole('button', { name: 'Note C4' })).toBeVisible()
  await piano.getByRole('button', { name: 'Note E4' }).click()
  await expect(page.getByText('Saved. This key is now MIDI E4.')).toBeVisible()
  await expect(piano.getByRole('button', { name: 'Note E4' })).toHaveAttribute('aria-pressed', 'true')
  // The keycap shows the note it plays.
  await expect(key(page, 'MIDI E4')).toBeVisible()

  await piano.getByRole('button', { name: 'Note F#4' }).click()
  await expect(page.getByText('Saved. This key is now MIDI F#4.')).toBeVisible()
  await page.screenshot({ path: 'test-results/midi-piano.png' })
})

test('chords light their notes and can be put on a key', async ({ page }) => {
  const chords = page.getByRole('region', { name: 'Chords' })
  const piano = page.getByRole('group', { name: 'Notes' })
  await expect(chords.getByRole('button')).toHaveCount(4)

  await chords.getByRole('button', { name: /^Am/ }).hover()
  // Lit notes show their names on the keys.
  await expect(piano.getByRole('button', { name: 'Note A3' })).toHaveText('A3')
  await expect(piano.getByRole('button', { name: 'Note E4' })).toHaveText('E4')

  await chords.getByRole('button', { name: /^Am/ }).click()
  await expect(page.getByText('Saved. This key is now A minor chord (A3 - C4 - E4).')).toBeVisible()
  await expect(page.getByText('This key plays the chord Am: A3, C4, E4.')).toBeVisible()
})

test('note names in Do Re Mi', async ({ page }) => {
  await page.getByRole('radio', { name: 'Do Re Mi' }).click()
  await expect(page.getByRole('group', { name: 'Notes' }).getByRole('button', { name: 'Note Do4' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await key(page, 'Q').click()
  await picker(page).getByRole('tab', { name: 'MIDI' }).click()
  // The choice is remembered.
  await expect(page.getByRole('radio', { name: 'Do Re Mi' })).toHaveAttribute('aria-checked', 'true')
})

test('other MIDI keys have plain names', async ({ page }) => {
  await page.getByRole('region', { name: 'Pedals and effects' }).getByRole('button', { name: 'Sustain pedal' }).click()
  await expect(page.getByText('Saved. This key is now MIDI Sustain pedal.')).toBeVisible()
})
