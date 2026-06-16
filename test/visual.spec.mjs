import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/* Screenshot diff of the three screens. Animations are disabled and a small
   settle wait is applied so the gauge/HUD render deterministically. */
for (const file of ['index.html', 'console.html', 'advisor.html']) {
  test(`visual: ${file}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot(`${file}.png`, {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });
}
