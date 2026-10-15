// SPDX-License-Identifier: GPL-2.0-or-later
import { defineConfig } from '@playwright/test'

/**
 * Runs the production build under the Content-Security-Policy from netlify.toml,
 * so a policy change that breaks the app is caught before deploying.
 * Use `npm run test:csp`, which builds first.
 */
export default defineConfig({
  testDir: './e2e-csp',
  outputDir: './test-results/csp',
  use: { baseURL: 'http://localhost:5299' },
  webServer: {
    command: 'npx vite preview --port 5299 --strictPort',
    url: 'http://localhost:5299',
    reuseExistingServer: false,
  },
})
