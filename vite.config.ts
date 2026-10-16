import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { parse } from 'smol-toml'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

interface NetlifyHeaderRule {
  for: string
  values: Record<string, string>
}

/**
 * Makes `vite preview` send the [[headers]] from netlify.toml, path by path, so the
 * built site can be tried locally exactly as Netlify would serve it.
 */
function netlifyHeaders(): Plugin {
  const toml = parse(readFileSync(path.resolve(import.meta.dirname, 'netlify.toml'), 'utf8'))
  const rules = (toml.headers ?? []) as unknown as NetlifyHeaderRule[]
  // Netlify paths use * as a wildcard for the rest of the path.
  const matchers = rules.map((rule) => ({
    test: new RegExp(`^${rule.for.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`),
    values: rule.values,
  }))

  return {
    name: 'netlify-headers',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '/').split('?')[0]
        const pathname = url === '/' ? '/index.html' : url
        for (const { test, values } of matchers) {
          if (test.test(pathname) || test.test(url)) {
            for (const [name, value] of Object.entries(values)) res.setHeader(name, value)
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), netlifyHeaders()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
