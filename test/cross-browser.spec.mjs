import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/* Cross-browser functional smoke for the three screens. Unlike visual.spec.mjs
   (chromium-only screenshot diff), this runs in Chromium, Firefox and WebKit and
   asserts the page actually boots — title renders, substantial content paints,
   and crucially NO uncaught JS exception fires. That catches browser-specific
   script/CSS breakage (e.g. a WebKit-incompatible API) that a single-engine
   screenshot test cannot. No baselines, so it is portable and self-contained. */
for (const file of ['index.html', 'console.html', 'advisor.html']) {
  test(`cross-browser smoke: ${file}`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    /* console.error is the quieter failure mode: a caught-but-broken code path
       (failed asset decode, CSP report, bad JSON) logs instead of throwing, so
       the pageerror hook alone lets it ship. Same allowance for file:// noise:
       the SW cannot register off file://, which some engines log as an error. */
    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/service.?worker|serviceworker/i.test(t)) return; // expected off file://
      consoleErrors.push(t);
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load' });
    await page.waitForTimeout(1500); // let inline scripts run (gauge/HUD/clock)

    // The document booted and has a title.
    expect((await page.title()).trim().length).toBeGreaterThan(0);

    // Substantial content actually painted (not a blank/error page).
    const textLen = (await page.locator('body').innerText()).trim().length;
    expect(textLen).toBeGreaterThan(200);

    // No uncaught JS exception in any engine — the real cross-browser signal.
    expect(pageErrors, `uncaught errors in ${file}: ${pageErrors.join(' | ')}`).toEqual([]);

    // …and no console.error either (broken-but-caught paths must not ship).
    expect(consoleErrors, `console errors in ${file}: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
}
