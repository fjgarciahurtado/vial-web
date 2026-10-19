// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test, type Page } from '@playwright/test'

const lessons = (page: Page) => page.getByRole('navigation', { name: 'Lessons' })
const modes = (page: Page) => page.getByRole('tablist', { name: 'Modes' })
const lessonTitle = (page: Page) => page.getByRole('heading', { level: 2 })

test('open Learn from the welcome page, read a lesson and try it on the demo keyboard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Learn how it works' }).click()
  await expect(page).toHaveURL(/#learn$/)
  await expect(page.getByRole('heading', { name: 'Learn', level: 1 })).toBeVisible()

  // Easy comes first, starting with its first lesson.
  await expect(modes(page).getByRole('tab', { name: 'Easy' })).toHaveAttribute('aria-selected', 'true')
  await expect(lessonTitle(page)).toHaveText('Change what a key does')
  await expect(page.getByRole('img', { name: /Change what a key does/ })).toBeVisible()

  await page.getByRole('button', { name: /^Next: Find a key by name/ }).click()
  await expect(page).toHaveURL(/#learn\/search-keys$/)
  await expect(lessons(page).getByRole('button', { name: /Find a key by name/ })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: 'Try it on the demo keyboard' }).click()
  await expect(page).not.toHaveURL(/#/)
  await expect(page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Easy' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Choose what the key does' })).toBeVisible()
})

test('a Musician lesson opens its section in Musician mode', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await page.getByRole('button', { name: 'Learn', exact: true }).click()

  // The demo starts in Advanced, so Learn starts there too.
  await expect(modes(page).getByRole('tab', { name: 'Advanced' })).toHaveAttribute('aria-selected', 'true')
  await modes(page).getByRole('tab', { name: 'Musician' }).click()
  await lessons(page).getByRole('button', { name: /Write a phrase/ }).click()
  await expect(lessonTitle(page)).toHaveText('Write a phrase')
  await page.screenshot({ path: 'test-results/learn.png' })

  await page.getByRole('button', { name: 'Try it on the demo keyboard' }).click()
  await expect(page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Musician' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: /^Macro \d+ phrase$/ })).toBeVisible()
})

test('lessons can be linked to, and Back closes Learn', async ({ page }) => {
  await page.goto('/')
  await page.goto('/#learn/combos')
  await expect(modes(page).getByRole('tab', { name: 'Advanced' })).toHaveAttribute('aria-selected', 'true')
  await expect(lessonTitle(page)).toHaveText('Combos: press keys together')

  await page.goBack()
  await expect(page.getByRole('button', { name: 'Learn how it works' })).toBeVisible()
})

test('choosing a section closes Learn', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Macros' }).click()
  await expect(page.getByRole('heading', { name: 'Learn', level: 1 })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Macros' })).toBeVisible()
})
