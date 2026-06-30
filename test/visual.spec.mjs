import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/* Screenshot diff of the three screens. Animations are disabled and a small
   settle wait is applied so the gauge/HUD render deterministically. */
for (const file of ['index.html', 'console.html', 'advisor.html']) {
  test(`visual: ${file}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load' });
    await page.waitForTimeout(2000);   // let fonts/gauge settle (no networkidle: the Google-Fonts link can hang)
    await expect(page).toHaveScreenshot(`${file}.png`, {
      fullPage: true,
      animations: 'disabled',
      // Cross-Chromium-build robustness: text glyphs antialias slightly
      // differently between Chromium releases (the baseline is captured on one
      // build, contributors/CI may run another), which shows up as faint
      // fringes on every glyph — heaviest on the text-dense advisor screen at
      // the Pixel 7 device scale. `threshold` (per-pixel YIQ distance) lets
      // those low-delta fringes fall below the "changed" cutoff, and
      // `maxDiffPixelRatio` keeps a small overall budget. A real structural
      // change (moved/missing/recoloured element) produces high-delta pixels
      // over a large area and still trips the check.
      threshold: 0.3,
      maxDiffPixelRatio: 0.05,
    });
  });
}
