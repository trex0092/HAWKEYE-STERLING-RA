import { defineConfig, devices } from '@playwright/test';

/* Cross-browser functional config. Runs (no screenshots) across the three major
   engines plus a mobile viewport, covering:
     - cross-browser.spec.mjs  : boot / paint / no-uncaught-error smoke
     - keyboard.spec.mjs       : keyboard-only flow + visible focus (WCAG 2.1.1/2.4.7)
     - print-report.spec.mjs   : print/PDF report build (Chromium-only; self-skips)
     - csp-runtime.spec.mjs    : real-browser CSP verification (served with the
                                 netlify.toml header; zero securitypolicyviolations)
   Separate from playwright.config.mjs (viewport screenshot diff). */
export default defineConfig({
  testDir: './test',
  testMatch: /(cross-browser|keyboard|print-report|csp-runtime)\.spec\.mjs/,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  retries: 1, // absorb cold-start flakiness; a real failure still repeats
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile',   use: { ...devices['Pixel 7'] } },
  ],
});
