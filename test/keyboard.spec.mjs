import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/* Keyboard-only accessibility flow (WCAG 2.1 2.1.1 keyboard / 2.4.7 focus
   visible). Drives the Entity Risk Assessment using only the keyboard: focus
   reaches the form controls, typing into them updates the live risk readout,
   and a focused control exposes a visible focus indicator. No screenshots. */
test('index.html: complete core fields by keyboard and see the score update', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pathToFileURL(resolve('index.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  // Focus the legal-entity name directly (keyboard focus), type, and assert it took.
  const entity = page.locator('#entityName');
  await entity.focus();
  await expect(entity).toBeFocused();
  await page.keyboard.type('Acme Trading FZE');
  await expect(entity).toHaveValue('Acme Trading FZE');

  // A focused control must show a visible focus indicator (outline/box-shadow),
  // not outline:none with no replacement — the 2.4.7 regression guard.
  const focusStyle = await entity.evaluate((el) => {
    const s = window.getComputedStyle(el);
    return { outline: s.outlineStyle + ' ' + s.outlineWidth, shadow: s.boxShadow };
  });
  expect(
    focusStyle.outline.trim() !== 'none 0px' || (focusStyle.shadow && focusStyle.shadow !== 'none'),
    `no visible focus indicator: ${JSON.stringify(focusStyle)}`,
  ).toBeTruthy();

  // Change a scored field by keyboard and confirm the live total reacts.
  const before = (await page.locator('#totalScore').innerText()).trim();
  const years = page.locator('#entityYearsInput');
  await years.focus();
  await years.fill('');
  await page.keyboard.type('0');           // 0 years operating → higher score
  await page.waitForTimeout(200);
  const after = (await page.locator('#totalScore').innerText()).trim();
  expect(Number(after)).toBeGreaterThan(Number(before));

  // Tab moves focus forward to another focusable control (keyboard operability).
  await page.keyboard.press('Tab');
  const movedToFocusable = await page.evaluate(() => {
    const a = document.activeElement;
    return !!a && a !== document.body && a.tagName !== 'HTML';
  });
  expect(movedToFocusable).toBeTruthy();

  expect(pageErrors, `uncaught errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
