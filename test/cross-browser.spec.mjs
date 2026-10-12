import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

/* Test the deployed origin model, not a file:// document. WebKit rejects
   same-directory fetches from a null file origin; swallowing those errors
   would hide real application failures. Serve the unchanged app on loopback
   and keep both uncaught-exception and console-error assertions strict. */
const ROOT = resolve('.');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
let server, base;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405); res.end('method not allowed'); return;
      }
      const urlPath = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
      const file = resolve(ROOT, '.' + (urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath));
      if (!file.startsWith(ROOT + sep)) {
        res.writeHead(403); res.end('forbidden'); return;
      }
      let data;
      try { data = readFileSync(file); }
      catch { res.writeHead(404); res.end('not found'); return; }
      res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(400); res.end('bad request'); }
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  base = 'http://127.0.0.1:' + server.address().port;
});

test.afterAll(async () => {
  if (server) await new Promise(done => server.close(done));
});

for (const file of ['index.html', 'console.html', 'advisor.html']) {
  test(`cross-browser smoke: ${file}`, async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto(`${base}/${file}`, { waitUntil: 'load' });
    expect(response?.ok(), 'local application document must load successfully').toBe(true);
    await page.waitForTimeout(1500); // include post-load initialization failures

    expect((await page.title()).trim().length).toBeGreaterThan(0);
    const textLen = (await page.locator('body').innerText()).trim().length;
    expect(textLen).toBeGreaterThan(200);
    expect(pageErrors, `uncaught errors in ${file}: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `console errors in ${file}: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
}
