import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/* axe-core accessibility assertions, run inside the real browser. This is
   complementary to the pa11y WCAG2AA pass (a11y.yml): axe-core runs in-page via
   CDP (so it is unaffected by the strict CSP / Trusted Types) and catches ARIA,
   name/role/value, and contrast issues with a different engine, in the same
   cross-browser run. We fail on serious/critical violations (the actionable
   tier); minor/moderate are surfaced in the attached report without blocking, to
   avoid engine-opinion churn gating merges. */
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

for (const file of ['index.html', 'console.html', 'advisor.html']) {
  test(`axe: ${file} has no serious/critical accessibility violations`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load' });
    await page.waitForTimeout(800);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Attach the full result set (all impacts) for inspection in the report.
    await testInfo.attach('axe-results.json', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });

    const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.has(v.impact));
    const summary = blocking
      .map((v) => `${v.impact} · ${v.id} (${v.nodes.length}) — ${v.help}`)
      .join('\n');
    expect(blocking, `serious/critical a11y violations on ${file}:\n${summary}`).toEqual([]);
  });
}
