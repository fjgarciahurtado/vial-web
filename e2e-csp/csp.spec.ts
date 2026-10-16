// SPDX-License-Identifier: GPL-2.0-or-later
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
const csp = /Content-Security-Policy = "([^"]+)"/.exec(toml)?.[1]

test('the app works under the Content-Security-Policy in netlify.toml', async ({ page }) => {
  expect(csp, 'netlify.toml should set a Content-Security-Policy').toBeTruthy()

  const violations: string[] = []
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text())
  })
  // vite preview doesn't read netlify.toml, so add the header to every response here.
  await page.route('**/*', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp! } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Try a demo keyboard' }).click()
  await page.getByRole('group', { name: 'Keyboard layout' }).getByRole('button', { name: 'Key Q', exact: true }).click()
  const sections = page.getByRole('navigation', { name: 'Sections' })
  await sections.getByRole('button', { name: 'Lighting' }).click()
  await page.getByRole('slider', { name: 'Colour', exact: true }).fill('30')
  await sections.getByRole('button', { name: 'Macros' }).click()
  await expect(page.getByRole('heading', { name: 'Macros' })).toBeVisible()

  // Real keyboards send their definition xz-compressed, and the xz decoder is
  // WebAssembly. The demo skips it, so compile a module here the same way.
  const wasm = await page.evaluate(async () => {
    try {
      await WebAssembly.instantiate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
      return 'ok'
    } catch (err) {
      return String(err)
    }
  })
  expect(wasm).toBe('ok')

  expect(violations).toEqual([])
})
