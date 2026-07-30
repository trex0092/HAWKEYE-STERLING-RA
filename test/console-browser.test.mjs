/* Console browser check — a FAILED Asana refresh is visible on screen.

   The console's refresh button reported its outcome through the button's
   `title` attribute and nothing else. A tooltip has no touch equivalent, so on
   a phone — which is where this console is actually read — a failed refresh was
   completely silent: the spinner stopped, the stale register stayed on display,
   and nothing said the figures were of unknown age.

   A console showing old figures without saying they are old is the same fault
   class as a health panel reporting "healthy" after a failed call: the thing
   whose job is to surface the problem is hiding it.

   So this drives a real Chromium against the real page, stubs the Asana mirror
   endpoint, and asserts what is ON SCREEN — for the failure AND for the success,
   because a warning that also fires on success is noise operators learn to
   ignore.

   Skips loudly (exit 0) when Playwright or a browser is unavailable — the same
   contract as test/advisor-browser.test.mjs.

   Usage: node test/console-browser.test.mjs */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname, normalize } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

console.log('\n— Console browser check (refresh outcome is visible) —\n');

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.log('  SKIP  playwright not installed — browser check not run\n'); process.exit(0); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  try {
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(500); res.end('error'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;

const FALLBACKS = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
];
let browser;
try {
  try { browser = await chromium.launch(); }
  catch (first) {
    const exe = FALLBACKS.find((f) => existsSync(f));
    if (!exe) throw first;
    browser = await chromium.launch({ executablePath: exe });
  }
} catch (e) {
  console.log('  SKIP  could not launch Chromium (' + (e.message || e).slice(0, 80) + ') — browser check not run\n');
  server.close(); process.exit(0);
}

/* Drive the real button, exactly as an operator does. `fulfil` decides what the
   Asana mirror endpoint returns for this run. */
async function refresh(fulfil) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/.netlify/functions/asana-mirror', fulfil);
  await page.goto(base + '/console.html', { waitUntil: 'domcontentloaded' });
  const btn = await page.$('#asanaRefresh');
  if (!btn) { await page.close(); return { skipped: true, errors }; }
  await btn.click();
  /* Wait for the status region to say something, rather than a fixed sleep. */
  await page.waitForFunction(
    () => {
      const el = document.getElementById('asanaRefreshStatus');
      return el && el.textContent && !/Refreshing/i.test(el.textContent);
    }, null, { timeout: 10000 },
  ).catch(() => {});
  const status = await page.textContent('#asanaRefreshStatus').catch(() => '');
  const cls = await page.getAttribute('#asanaRefreshStatus', 'class').catch(() => '');
  const live = await page.getAttribute('#asanaRefreshStatus', 'aria-live').catch(() => '');
  const role = await page.getAttribute('#asanaRefreshStatus', 'role').catch(() => '');
  await page.close();
  return { status: status || '', cls: cls || '', live: live || '', role: role || '', errors };
}

const json = (body, status = 200) => (route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/* ── 1. A failed refresh says so, on screen ──────────────────────────────── */
const bad = await refresh(json({ ok: false, error: 'nope' }));
if (bad.skipped) {
  console.log('  SKIP  console refresh button not found — page shape changed\n');
} else {
  check('page rendered without a JavaScript error', bad.errors.length === 0);
  check('a failed refresh is visible on screen, not only in a tooltip', /refresh failed/i.test(bad.status));
  check('the failure names the CONSEQUENCE (figures are not up to date)',
    /not up to date/i.test(bad.status));
  check('the failure is marked so it cannot read as routine', /\bfailed\b/.test(bad.cls));
  check('the failure is announced to assistive tech', bad.role === 'status' && bad.live === 'polite');

  /* ── 2. A network failure is reported too, not swallowed by .catch ────── */
  const netErr = await refresh((route) => route.abort());
  check('a network-level failure is also surfaced', /refresh failed/i.test(netErr.status));
  check('the network failure also names the consequence', /not up to date/i.test(netErr.status));

  /* ── 3. The negative: a SUCCESSFUL refresh must not look like a failure ─ */
  const good = await refresh(json({ ok: true, register: [
    { ref: 'HS-1', entity: 'Alpha Trading LLC', outcome: 'CDD', date: '2026-07-01', jurisdiction: 'AE' },
  ] }));
  check('a successful refresh reports success', /refreshed 1/i.test(good.status));
  check('a successful refresh is NOT marked as failed', !/\bfailed\b/.test(good.cls));
}

await browser.close();
server.close();

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
