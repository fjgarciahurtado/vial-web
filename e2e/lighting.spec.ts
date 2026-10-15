// SPDX-License-Identifier: GPL-2.0-or-later
import { expect, test } from '@playwright/test'

test('change and save the key lights', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Lighting' }).click()

  const lights = page.getByRole('group', { name: 'Key lights' })
  const effect = lights.getByRole('combobox', { name: 'Effect' })
  await expect(effect).toHaveValue('6') // Breathing
  await expect(effect.getByRole('option')).toHaveText([
    'Off', 'Direct Control', 'Solid Color', 'Breathing', 'Cycle All', 'Raindrops', 'Typing Heatmap', 'Splash',
  ])

  await effect.selectOption({ label: 'Solid Color' })
  await expect(lights.getByRole('slider', { name: 'Speed' })).toHaveCount(0)
  await lights.getByRole('slider', { name: 'Colour', exact: true }).fill('20')
  await lights.getByRole('slider', { name: 'Brightness' }).fill('200')
  await expect(lights.getByText('100%')).toBeVisible()

  await page.getByRole('button', { name: 'Save lighting' }).click()
  await expect(page.getByText('Lighting saved. It stays like this after unplugging.')).toBeVisible()
  await page.screenshot({ path: 'test-results/lighting.png' })

  await effect.selectOption({ label: 'Cycle All' })
  await expect(lights.getByRole('slider', { name: 'Colour', exact: true })).toHaveCount(0)
  await expect(lights.getByRole('slider', { name: 'Speed' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Keys' }).click()
  await expect(page.getByRole('region', { name: 'Choose what the key does' })).toBeVisible()
})
