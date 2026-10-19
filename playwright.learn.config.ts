// SPDX-License-Identifier: GPL-2.0-or-later
import { defineConfig } from '@playwright/test'

/**
 * Takes the Learn section's pictures (public/learn/*.jpg) from the demo keyboard.
 * Use `npm run learn:shots`. Not part of `npm run test:e2e`.
 */
export default defineConfig({
  testDir: './e2e-learn',
  testMatch: '*.shots.ts',
  outputDir: './test-results/learn',
  use: { baseURL: 'http://localhost:5399' },
  webServer: {
    command: 'npx vite --port 5399 --strictPort',
    url: 'http://localhost:5399',
    reuseExistingServer: false,
  },
})
