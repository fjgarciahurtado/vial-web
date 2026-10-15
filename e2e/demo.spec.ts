// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test } from '@playwright/test'

test('welcome screen offers connect and demo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Connect keyboard' })).toBeVisible()
  await page.screenshot({ path: 'test-results/welcome.png', fullPage: true })
})

test('demo keyboard shows keys, layers and selection', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()

  await expect(page.getByRole('heading', { name: 'Demo 60% keyboard' })).toBeVisible()
  await page.getByRole('button', { name: 'Key Q', exact: true }).click()
  await expect(page.getByText('This key is Q. Choose what it should do instead.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Key Q', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/demo-main.png', fullPage: true })

  await page.getByRole('tab', { name: 'Layer 1' }).click()
  await expect(page.getByRole('button', { name: 'Key F1', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/demo-layer1.png', fullPage: true })

  await page.getByRole('button', { name: 'Leave demo' }).click()
  await expect(page.getByRole('button', { name: 'Connect keyboard' })).toBeVisible()
})

test('dark mode follows the system setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: 'Key Q', exact: true }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/dark.png', fullPage: true })
})
