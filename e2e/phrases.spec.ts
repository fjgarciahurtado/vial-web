// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test, type Page } from '@playwright/test'

const phrase = (page: Page) => page.getByRole('region', { name: /^Macro \d+ phrase$/ })
const piano = (page: Page) => phrase(page).getByRole('group', { name: 'Notes' })
const macroList = (page: Page) => page.getByRole('navigation', { name: 'Macros' })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Musician' }).click()
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Macros' }).click()
})

test('write a phrase with the piano and save it', async ({ page }) => {
  await macroList(page).getByRole('button', { name: /^Macro 2/ }).click()
  await expect(phrase(page).getByText('No steps yet.')).toBeVisible()

  // Recording is on: each piano key adds a step.
  await piano(page).getByRole('button', { name: 'Note C4' }).click()
  await piano(page).getByRole('button', { name: 'Note G4' }).click()
  const steps = phrase(page).getByRole('list', { name: 'Steps' })
  await expect(steps.getByRole('listitem')).toHaveCount(2)

  // Choosing a step lets the piano build a chord in it.
  await steps.getByRole('button', { name: 'Step 1: C4' }).click()
  await piano(page).getByRole('button', { name: 'Note E4' }).click()
  await piano(page).getByRole('button', { name: 'Note G4' }).click()
  await expect(steps.getByRole('button', { name: 'Step 1: C4 + E4 + G4' })).toBeVisible()
  await steps.getByRole('combobox', { name: 'Length of step 1' }).selectOption('Half')

  // A rest after the chord.
  await phrase(page).getByRole('button', { name: 'Add a rest' }).click()
  await expect(steps.getByRole('button', { name: 'Step 2: Rest' })).toBeVisible()
  await expect(macroList(page).getByRole('button', { name: /^Macro 2/ })).toContainText('C4 + E4 + G4, rest, G4')

  // Twice the tempo halves every step; the note lengths stay.
  await phrase(page).getByRole('spinbutton', { name: 'Tempo' }).fill('240')
  await phrase(page).getByRole('spinbutton', { name: 'Tempo' }).press('Enter')
  await expect(steps.getByRole('combobox', { name: 'Length of step 1' })).toHaveValue('2')
  // An emptied or too-fast tempo isn't applied; the field shows the tempo in use.
  await phrase(page).getByRole('spinbutton', { name: 'Tempo' }).fill('')
  await phrase(page).getByRole('spinbutton', { name: 'Tempo' }).blur()
  await expect(phrase(page).getByRole('spinbutton', { name: 'Tempo' })).toHaveValue('240')
  await phrase(page).getByRole('spinbutton', { name: 'Tempo' }).fill('1000')
  await phrase(page).getByRole('spinbutton', { name: 'Tempo' }).press('Enter')
  await expect(phrase(page).getByRole('spinbutton', { name: 'Tempo' })).toHaveValue('300')
  await expect(steps.getByRole('combobox', { name: 'Length of step 1' })).toHaveValue('2')

  await page.getByRole('button', { name: 'Save macros' }).click()
  await expect(page.getByText('Macros saved.')).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: 'test-results/phrases.png' })
})

test('macros that do more than play notes are left for the other modes', async ({ page }) => {
  await macroList(page).getByRole('button', { name: /^Macro 1/ }).click()
  await expect(phrase(page).getByText(/does more than play notes/)).toBeVisible()
  await phrase(page).getByRole('button', { name: 'Clear it and write a phrase' }).click()
  await expect(phrase(page).getByText('No steps yet.')).toBeVisible()
})
