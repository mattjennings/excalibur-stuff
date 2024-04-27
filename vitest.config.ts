// vitest.config.ts
import { defineConfig } from 'vitest/config'
import type { Browser, LaunchOptions } from 'playwright'

interface BrowserProviderOptions {
  launch?: LaunchOptions
  page?: Parameters<Browser['newPage']>[0]
}

export default defineConfig({
  test: {
    globals: true,
    reporters: process.env.GITHUB_ACTIONS
    ? ['dot', 'github-actions']
    : ['default'],
  browser: {
    enabled: true,
    isolate: true,
    headless: true, // uncomment to debug
    name: 'chromium',
    provider: 'playwright',
    providerOptions: {
      launch: {
        channel: 'chrome',
        devtools: true,
      },
    } as BrowserProviderOptions,
  },
  },
})