import { defineConfig, devices } from '@playwright/test';

/* Visual-regression config. Screenshots are stored under
   test/__screenshots__/ and compared on each PR. Generate/refresh the baseline
   with: Actions -> Visual Regression -> Run workflow -> mode: baseline. */
export default defineConfig({
  testDir: './test',
  testMatch: /visual\.spec\.mjs/,
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
});
