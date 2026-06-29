import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, normalize } from 'node:path';

/* Runtime CSP verification in a real browser. Serves the repo over HTTP with the
   EXACT Content-Security-Policy from netlify.toml (file:// loads don't apply the
   header), then loads each page, exercises a delegated handler and an input, and
   asserts the browser raised ZERO securitypolicyviolation events and no
   CSP-related console errors. This is the real-browser counterpart to the static
   guardrail in test/csp.test.mjs and proves 'unsafe-inline'-free script-src works. */

const ROOT = resolve('.');
const CSP = (readFileSync(resolve('netlify.toml'), 'utf8')
  .match(/Content-Security-Policy\s*=\s*"([^"]*)"/) || [])[1] || "default-src 'self'";

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

let server, base;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '').replace(/^\/+/, '');
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const file = resolve(ROOT, rel);
      if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.setHeader('Content-Security-Policy', CSP);
      res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
      res.end(readFileSync(file));
    } catch { res.writeHead(500); res.end('err'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => { await new Promise((r) => server.close(r)); });

for (const file of ['index.html', 'console.html', 'advisor.html']) {
  test(`runtime CSP: ${file} raises no violations`, async ({ page }) => {
    const consoleCsp = [];
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI}`);
      });
    });
    page.on('console', (m) => { if (/content security policy/i.test(m.text())) consoleCsp.push(m.text()); });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${base}/${file}`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    // Exercise a delegated handler + an input so any inline-execution path that
    // depended on 'unsafe-inline' would surface a violation here.
    const btn = page.locator('[data-act]').first();
    if (await btn.count()) await btn.click({ trial: false, force: true }).catch(() => {});
    const input = page.locator('input[type="text"]').first();
    if (await input.count()) await input.fill('CSP probe').catch(() => {});
    await page.waitForTimeout(300);

    const reported = await page.evaluate(() => window.__csp || []);
    expect(reported, `securitypolicyviolation in ${file}: ${reported.join(' | ')}`).toEqual([]);
    expect(consoleCsp, `CSP console errors in ${file}: ${consoleCsp.join(' | ')}`).toEqual([]);
  });
}
