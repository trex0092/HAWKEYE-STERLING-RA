import { defineConfig, devices } from '@playwright/test';

/* Visual-regression config. Screenshots are stored under
   test/__screenshots__/<project>/ and compared on each PR. Two viewports are
   covered: desktop Chromium and a mobile profile (Pixel 7), so mobile-layout
   regressions are caught too. Generate/refresh baselines with:
   Actions -> Visual Regression -> Run workflow -> mode: baseline.

   Cross-ENGINE coverage (Firefox/WebKit) is handled functionally by
   playwright.cross-browser.config.mjs; screenshot diffs stay viewport-focused
   because pixel diffs across engines are brittle and low-signal. */
export default defineConfig({
  testDir: './test',
  testMatch: /visual\.spec\.mjs/,
  /* Per-project baselines so desktop and mobile snapshots don't collide. */
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
