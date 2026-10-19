// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test, type Page } from '@playwright/test'

const lessons = (page: Page) => page.getByRole('navigation', { name: 'Lessons' })
const mode = (page: Page, name: string) => page.getByRole('group', { name: 'Modes' }).getByRole('button', { name })
const lessonTitle = (page: Page) => page.getByRole('heading', { level: 2 })
const learnHeading = (page: Page) => page.getByRole('heading', { name: 'Learn', level: 1 })

test('open Learn from the welcome page, read a lesson and try it on the demo keyboard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Learn how it works' }).click()
  await expect(learnHeading(page)).toBeVisible()

  // Easy comes first, starting with its first lesson; the address says so.
  await expect(mode(page, 'Easy')).toHaveAttribute('aria-pressed', 'true')
  await expect(lessonTitle(page)).toHaveText('Change what a key does')
  await expect(page).toHaveURL(/#learn\/easy\/change-a-key$/)
  await expect(page.getByRole('img', { name: /Change what a key does/ })).toBeVisible()

  await page.getByRole('button', { name: /^Next: Find a key by name/ }).click()
  await expect(page).toHaveURL(/#learn\/easy\/search-keys$/)
  await expect(lessons(page).getByRole('button', { name: /Find a key by name/ })).toHaveAttribute('aria-current', 'page')
  // The new lesson's title takes the focus.
  await expect(lessonTitle(page)).toBeFocused()

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
  await expect(mode(page, 'Advanced')).toHaveAttribute('aria-pressed', 'true')
  await mode(page, 'Musician').click()
  await lessons(page).getByRole('button', { name: /Write a phrase/ }).click()
  await expect(lessonTitle(page)).toHaveText('Write a phrase')
  await page.screenshot({ path: 'test-results/learn.png' })

  await page.getByRole('button', { name: 'Try it on the demo keyboard' }).click()
  await expect(page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Musician' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: /^Macro \d+ phrase$/ })).toBeVisible()
})

test('a shared lesson stays in the mode it was opened from', async ({ page }) => {
  await page.goto('/#learn/musician/lighting')
  await expect(mode(page, 'Musician')).toHaveAttribute('aria-pressed', 'true')
  await expect(lessonTitle(page)).toHaveText('Change the lights')
})

test('lessons can be linked to, and Back leaves Learn in one step', async ({ page }) => {
  await page.goto('/')
  await page.goto('/#learn/combos')
  await expect(mode(page, 'Advanced')).toHaveAttribute('aria-pressed', 'true')
  await expect(lessonTitle(page)).toHaveText('Combos: press keys together')
  await expect(page).toHaveURL(/#learn\/advanced\/combos$/)

  await page.goBack()
  await expect(page.getByRole('button', { name: 'Learn how it works' })).toBeVisible()
})

test('moving between lessons and closing Learn leave one history entry', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Learn how it works' }).click()
  await page.getByRole('button', { name: /^Next:/ }).click()
  await mode(page, 'Musician').click()
  await page.goBack()
  await expect(learnHeading(page)).toBeHidden()

  // Closing goes back too, so Back afterwards doesn't reopen Learn.
  await page.getByRole('button', { name: 'Learn how it works' }).click()
  await page.getByRole('button', { name: 'Close Learn' }).click()
  await expect(learnHeading(page)).toBeHidden()
  await expect(page).not.toHaveURL(/#/)
})

test('unknown or broken addresses show the first lesson', async ({ page }) => {
  await page.goto('/#learn/nonsense')
  await expect(lessonTitle(page)).toHaveText('Change what a key does')
  await expect(page).toHaveURL(/#learn\/easy\/change-a-key$/)

  await page.goto('/#learn/%E0%A4%A')
  await expect(lessonTitle(page)).toHaveText('Change what a key does')
})

test('choosing a section closes Learn', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await page.getByRole('button', { name: 'Learn', exact: true }).click()
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Macros' }).click()
  await expect(learnHeading(page)).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Macros' })).toBeVisible()
})
