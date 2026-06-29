/* Link / citation health check.

   Collects every source URL from data/reg-sources.json and
   data/sanctions-sources.json (and any http(s) link in the docs/ markdown),
   resolves each one, and reports the dead links. Protects the product's
   "every answer cited" promise — a citation that 404s is a credibility bug.

   The weekly workflow opens/updates a tracking issue when links are dead; on a
   pull request it reports to the job summary without failing (external links
   are flaky and should not block merges).

   Pure helpers (collectUrls / buildReport / summarize) are exported and tested
   offline; network probing lives in the runner.
*/
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REPORT_FILE = 'link-check-report.md';

const URL_RE = /https?:\/\/[^\s"'<>)\]}]+/g;
/* Strip trailing punctuation AND stray markdown delimiters (backtick / asterisk)
   so a URL written as `https://x/` in markdown isn't probed with the backtick. */
function trimUrl(u) { return u.replace(/[.,;:`*]+$/, ''); }

/* Verified-good sources that are actively fetched by the screening engine but
   are hostile to a lightweight link probe (anti-bot / method-sensitive), so the
   probe's result is not authoritative. Excluded from the dead-link report. */
export const ALLOWLIST = new Set([
  'https://scsanctions.un.org/resources/xml/en/consolidated.xml', // UN consolidated list — fetched by the sanctions engine
]);

/* Gather unique URLs from the JSON registries + markdown docs. Accepts an
   object map of { path: text } so tests can supply fixtures without fs. */
export function collectUrls(files) {
  const found = new Map(); // url -> [sources]
  for (const [path, text] of Object.entries(files)) {
    let urls = [];
    if (path.endsWith('.json')) {
      try {
        const data = JSON.parse(text);
        const list = Array.isArray(data) ? data : (data.sources || []);
        for (const s of list) if (s && typeof s.url === 'string') urls.push(s.url);
      } catch { /* fall through to regex */ }
    }
    if (!urls.length) urls = (text.match(URL_RE) || []).map(trimUrl);
    for (const u of urls) {
      const key = trimUrl(u);
      if (!found.has(key)) found.set(key, []);
      if (!found.get(key).includes(path)) found.get(key).push(path);
    }
  }
  return [...found.entries()].map(([url, sources]) => ({ url, sources })).sort((a, b) => a.url.localeCompare(b.url));
}

/* A result is dead when the probe could not get a final 2xx/3xx (or an
   allowed-by-default 401/403 anti-bot status). */
/* Statuses where the server clearly answered but rejected the bot/method/format
   (or geo-blocked) rather than "not found" — the link is live, so not dead. */
const ANTIBOT_OK = new Set([401, 403, 405, 406, 415, 418, 429, 451]);
export function isDead(result) {
  if (!result) return true;
  if (result.ok) return false;
  if (typeof result.status === 'number' && ANTIBOT_OK.has(result.status)) return false;
  return true;
}

export function summarize(results) {
  const dead = results.filter(r => isDead(r) && !ALLOWLIST.has(r.url));
  return { total: results.length, dead: dead.length, ok: results.length - dead.length, deadList: dead };
}

export function buildReport(results, today) {
  const { total, dead, deadList } = summarize(results);
  const lines = ['# Link / citation health — ' + today, ''];
  if (!dead) {
    lines.push('All ' + total + ' links resolved. No dead citations.');
    return lines.join('\n');
  }
  lines.push('**' + dead + ' of ' + total + ' links failed to resolve.** Fix or replace them in `data/reg-sources.json`, `data/sanctions-sources.json`, or the docs.', '');
  lines.push('| URL | Status | Referenced in |', '| --- | --- | --- |');
  for (const r of deadList) {
    lines.push('| ' + r.url + ' | ' + (r.status || r.error || 'unreachable') + ' | ' + (r.sources || []).join(', ') + ' |');
  }
  return lines.join('\n');
}

/* ── Network (runner only) ── */
async function probe(url, timeoutMs = 20000) {
  for (const method of ['HEAD', 'GET']) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 HawkeyeSterling-LinkCheck/1.0' } });
      clearTimeout(t);
      if (res.ok || method === 'GET') return { ok: res.ok, status: res.status };
      if (res.status === 405 || res.status === 501) continue; // HEAD not allowed → try GET
      return { ok: res.ok, status: res.status };
    } catch (e) {
      clearTimeout(t);
      if (method === 'GET') return { ok: false, status: null, error: String(e && e.message || e).slice(0, 120) };
    }
  }
  return { ok: false, status: null, error: 'unreachable' };
}

function readFiles() {
  const files = {};
  for (const p of ['data/reg-sources.json', 'data/sanctions-sources.json']) {
    if (existsSync(p)) files[p] = readFileSync(p, 'utf8');
  }
  const docsDir = 'docs';
  const walk = dir => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) files[p] = readFileSync(p, 'utf8');
    }
  };
  if (existsSync(docsDir)) walk(docsDir);
  return files;
}
function setOutput(key, val) {
  if (process.env.GITHUB_OUTPUT) { try { writeFileSync(process.env.GITHUB_OUTPUT, key + '=' + val + '\n', { flag: 'a' }); } catch {} }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = collectUrls(readFiles());
  const results = [];
  /* small concurrency pool to be polite */
  const pool = 6;
  for (let i = 0; i < urls.length; i += pool) {
    const batch = urls.slice(i, i + pool);
    const probed = await Promise.all(batch.map(async u => ({ ...u, ...(await probe(u.url)) })));
    results.push(...probed);
  }
  const { dead } = summarize(results);
  const report = buildReport(results, today);
  writeFileSync(REPORT_FILE, report + '\n');
  console.log(report);
  console.log('\nchecked=' + results.length + '  dead=' + dead);
  setOutput('dead_count', String(dead));
  setOutput('has_dead', dead ? 'true' : 'false');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
