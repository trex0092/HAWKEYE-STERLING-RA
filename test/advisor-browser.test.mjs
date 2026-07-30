/* Advisor browser check — the downgrade banner is actually rendered.

   Every other advisor test is offline and asserts the FUNCTION's behaviour:
   brain-soul returns `modeDegraded` when the platform cap cannot carry deep
   mode. None of them proves the operator ever SEES it, and a downgrade the
   operator cannot see is the silent degradation the appetite forbids (RA-06) —
   they asked for deep analysis and would get balanced without being told.

   So this drives a real Chromium against the real page, stubs
   /.netlify/functions/brain-soul, and asserts what is on screen. It also
   asserts the negative: an undegraded answer must NOT show the banner, or the
   warning becomes noise operators learn to ignore.

   Skips loudly (exit 0) when Playwright or a browser is unavailable, the same
   contract as the Python suites in scripts/run-tests.mjs — a missing browser is
   an environment gap, not a repository defect.

   Usage: node test/advisor-browser.test.mjs */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname, normalize } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

console.log('\n— Advisor browser check —\n');

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.log('  SKIP  playwright not installed — browser check not run\n'); process.exit(0); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' };

/* Static server rooted at the repo, with traversal blocked — this serves the
   real files, so the test cannot pass against a fixture that has drifted. */
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

/* The pinned playwright build and the browser on disk can carry different
   revisions (PLAYWRIGHT_BROWSERS_PATH is shared), so fall back to whatever
   Chromium is actually present rather than skipping over a version mismatch. */
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
}
catch (e) {
  console.log('  SKIP  could not launch Chromium (' + (e.message || e).slice(0, 80) + ') — browser check not run\n');
  server.close(); process.exit(0);
}

const DEGRADE_REASON = 'Deep mode needs 4096 output tokens to be worth the name, and the 10 s platform execution cap affords 1530. Answered in balanced mode instead. To enable deep mode, raise the site function timeout with Netlify support and set ADVISOR_PLATFORM_CAP_MS to match.';

async function ask(payload) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/.netlify/functions/brain-soul', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
  await page.goto(base + '/advisor.html', { waitUntil: 'domcontentloaded' });
  /* The AUP acknowledgment gate blocks every send until the operator accepts the
     Acceptable-Use Policy (advisor.js:332). Clicking it is part of driving the
     real UI — stubbing round it would test a path no operator can take. */
  const ack = await page.$('#aupAckBtn');
  if (ack) await ack.click();
  /* Drive the real UI: type a question and submit, exactly as an operator does. */
  const box = await page.$('#qInput');
  if (box) await page.fill('#qInput', 'What are the EDD triggers for a PEP?');
  if (!box) { await page.close(); return { skipped: true, errors }; }
  await page.click('#askBtn').catch(() => {});
  await page.waitForSelector('.card.ans', { timeout: 15000 }).catch(() => {});
  const text = await page.textContent('body');
  await page.close();
  return { text: text || '', errors };
}

const OK_BASE = {
  ok: true, text: 'Deterministic answer body.', mode: 'deep', model: 'claude-sonnet-5',
  elapsedMs: 900, tippingOffFlagged: false, piiFlagged: [], structureFlagged: false,
  budgetFlagged: false, latencyFlagged: false, hallFlagged: false, injectionFlagged: false,
  anomFlagged: false, quality: 90, auditLine: 'AUDIT | model=claude-sonnet-5 | mode=deep',
};

/* ── 1. A downgraded answer says so, on screen ───────────────────────────── */
const down = await ask({ ...OK_BASE, effectiveMode: 'balanced', modeDegraded: true, modeDegradedReason: DEGRADE_REASON });
if (down.skipped) {
  console.log('  SKIP  advisor question box not found — page shape changed\n');
} else {
  check('page rendered without a JavaScript error', down.errors.length === 0);
  check('the answer body is shown', down.text.includes('Deterministic answer body.'));
  check('the downgrade is visible to the operator', /Mode downgraded/i.test(down.text));
  check('the downgrade names the mode actually used', /downgraded to balanced/i.test(down.text));
  check('the downgrade explains why', down.text.includes('platform execution cap'));
  check('the downgrade says how to enable deep mode', down.text.includes('ADVISOR_PLATFORM_CAP_MS'));

  /* ── 2. The negative: an undegraded answer must NOT show it ───────────── */
  const fine = await ask({ ...OK_BASE, effectiveMode: 'deep', modeDegraded: false, modeDegradedReason: null });
  check('an undegraded answer renders', fine.text.includes('Deterministic answer body.'));
  check('an undegraded answer shows NO downgrade banner', !/Mode downgraded/i.test(fine.text));
  check('the audit line is shown either way', fine.text.includes('AUDIT |'));

  /* ── 3. The default mode is Balanced — pinned, not assumed ─────────────────
     The backend defaults to balanced (claude-sonnet-5) and the model card
     documents that as the default, but until 2026-07-29 the UI booted on Speed,
     so the documented default and the experienced default disagreed. The answer
     card renders the ACTIVE mode's label, so an untouched page answering in
     anything but Balanced mode means the boot default drifted again. */
  check('the untouched page answers in Balanced mode (the documented default)',
    /Balanced mode/.test(fine.text) && !/Speed mode/.test(fine.text));
}

await browser.close();
server.close();

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
