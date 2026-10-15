// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test } from '@playwright/test'

// Common laptop and desktop windows.
for (const viewport of [
  { width: 700, height: 900 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`keyboard and picker keys fit a ${viewport.width}x${viewport.height} window`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.getByRole('button', { name: 'Try a demo keyboard' }).click()

    await expect(page.getByRole('group', { name: 'Keyboard layout' })).toBeVisible()
    await page.screenshot({ path: `test-results/fit-${viewport.width}x${viewport.height}.png` })

    const board = await page.getByRole('group', { name: 'Keyboard layout' }).boundingBox()
    const keys = page.getByRole('region', { name: 'Choose what the key does' }).getByRole('list', { name: 'Keys' })
    const firstRow = await keys.getByRole('button').first().boundingBox()
    expect(board!.y).toBeGreaterThanOrEqual(0)
    expect(firstRow!.y + firstRow!.height).toBeLessThanOrEqual(viewport.height)
    // At least two rows of picker keys are visible without scrolling the page.
    const listBox = await keys.boundingBox()
    expect(Math.min(listBox!.y + listBox!.height, viewport.height) - listBox!.y).toBeGreaterThan(2 * firstRow!.height)

  })
}

test('categories sit under the search box on wide screens and become a bar on narrow ones', async ({ page }) => {
  const tabs = () => page.getByRole('tablist', { name: 'Key categories' }).getByRole('tab')

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  const search = await page.getByRole('searchbox', { name: 'Search keys' }).boundingBox()
  const [first, second, third] = await Promise.all([0, 1, 2].map((i) => tabs().nth(i).boundingBox()))
  expect(first!.y).toBeGreaterThan(search!.y + search!.height - 1)
  expect(third!.y).toBeGreaterThan(first!.y) // wraps into rows, not one long bar
  expect(second!.x).toBeGreaterThan(first!.x)

  await page.setViewportSize({ width: 700, height: 900 })
  const [a, b] = await Promise.all([0, 1, 2].map((i) => tabs().nth(i).boundingBox()))
  const c = await tabs().nth(2).boundingBox()
  expect(b!.y).toBe(a!.y)
  expect(c!.y).toBe(a!.y) // one row
})

