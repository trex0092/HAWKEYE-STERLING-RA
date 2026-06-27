import { defineConfig, devices } from '@playwright/test';

/* Cross-browser functional smoke (test/cross-browser.spec.mjs) across the three
   major engines. Separate from playwright.config.mjs (the chromium-only visual
   screenshot diff) so the screenshot baselines stay single-engine while the
   functional smoke runs everywhere. No snapshots are taken here. */
export default defineConfig({
  testDir: './test',
  testMatch: /cross-browser\.spec\.mjs/,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  retries: 1, // absorb cold-start flakiness; a real failure still repeats
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
  ],
});
