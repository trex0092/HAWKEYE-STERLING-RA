import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/* Print / PDF-export validation. The formal A4 report is built into #printReport
   and exported via the browser's print-to-PDF. page.pdf() is Chromium-only, so
   this spec self-skips on other engines. It asserts the report renders its key
   sections (letterhead, result/score, attestation, signature blocks), that
   print media hides the interactive controls (.no-print), and that a non-empty
   PDF is produced. */
test('index.html: print report builds and exports a PDF', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'page.pdf() is Chromium-only');

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(pathToFileURL(resolve('index.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // Give the report something to show, then build it directly (bypassing the
  // confirm() preflight + window.print() so headless never blocks).
  await page.locator('#entityName').fill('Acme Trading FZE');
  await page.evaluate(() => window.buildPrintReport());

  const report = page.locator('#printReport');
  const html = await report.innerHTML();
  expect(html.length, 'print report is empty').toBeGreaterThan(200);

  // Key report sections present.
  await expect(report.locator('.mast-name')).toContainText(/HAWKEYE STERLING/i);
  expect(await report.locator('.sign-line').count(), 'two signature blocks').toBeGreaterThanOrEqual(2);
  expect(html).toMatch(/Risk Assessment Policy/i);   // attestation statement
  expect(await report.locator('.gauge, .v-main').count()).toBeGreaterThan(0); // result/score block

  // Print media hides the interactive controls.
  await page.emulateMedia({ media: 'print' });
  const actionsVisible = await page.locator('.sp-actions').isVisible().catch(() => false);
  expect(actionsVisible, '.no-print controls should be hidden in print media').toBeFalsy();

  // A non-empty PDF is produced.
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  expect(pdf.length, 'generated PDF is empty').toBeGreaterThan(1000);

  expect(pageErrors, `uncaught errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
