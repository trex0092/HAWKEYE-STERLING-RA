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
  'https://www.un.org/securitycouncil/content/un-sc-consolidated-list', // UN SC Consolidated List landing page — live but heavy/slow, the probe times out (abort) on this canonical un.org page
]);

/* Hosts that block ALL datacenter/CI connections outright (connection failure,
   status null — indistinguishable from a dead host to the probe) but are the
   canonical, verified-in-a-browser citations. The UAE Ministry of Economy
   domains do this (verified 2026-07, issue #225): both the legacy moec.gov.ae
   pages cited in the research notes and the current moet.gov.ae watched source.
   Regulatory Watch monitors the moet.gov.ae source via its Internet Archive
   fallback — see the `uae-moe` narrative in data/reg-sources.json. amluae.com
   (the AML UAE research citations in docs/research/) does the same (verified
   2026-07-20: pages live in a browser and freshly search-indexed, while every
   CI probe dies at connection level — the 2026-07-20 link-check report).
   These are skipped at probe time (a guaranteed 2×20s timeout buys no
   information) and never counted dead. */
export const ALLOWLIST_HOSTS = new Set([
  'www.moec.gov.ae', 'moec.gov.ae',
  'www.moet.gov.ae', 'moet.gov.ae',
  'www.amluae.com', 'amluae.com',
]);

/* True when the URL's host is on the datacenter-blocked allowlist. Unparseable
   URLs are not allowlisted (they are also not probeable — see isProbeable). */
export function allowlistedHost(url) {
  try { return ALLOWLIST_HOSTS.has(new URL(url).hostname.toLowerCase()); }
  catch { return false; }
}

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

/* Non-probeable URLs: loopback / dev-server hosts and the RFC-2606/6761 reserved
   documentation domains that intentionally never resolve — e.g. the
   `http://localhost:8000` quick-start example in the README, or `example.com`
   placeholders. They are legitimately in the docs but must never be network-probed
   (a connection-refused localhost would otherwise be mis-reported as a dead
   citation). Filtered out of the probe set in the runner; collectUrls stays pure. */
const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)$/i;
const RESERVED_TLD = /\.(test|example|invalid|localhost)$/i;
const RESERVED_EXAMPLE_DOMAIN = /(^|\.)example\.(com|net|org)$/i;
export function isProbeable(url) {
  let host, hostname;
  try { const u = new URL(url); host = u.host; hostname = u.hostname; }
  catch { return false; } // unparseable → not something we can probe
  const bareHost = host.replace(/:\d+$/, '');
  if (LOOPBACK_HOST.test(bareHost) || LOOPBACK_HOST.test(hostname)) return false;
  if (RESERVED_TLD.test(hostname)) return false;
  if (RESERVED_EXAMPLE_DOMAIN.test(hostname)) return false;
  return true;
}

/* A result is dead when the probe could not get a final 2xx/3xx (or an
   allowed-by-default 401/403 anti-bot status). */
/* Statuses where the server clearly answered but rejected the bot/method/format
   (or geo-blocked) rather than "not found" — the link is live, so not dead.
   Includes transient gateway/availability errors (502/503/504): the origin is up
   but timed out or was briefly unavailable to an automated probe (e.g. the UN
   Security Council consolidated-list page intermittently 504s) — that is an
   availability hiccup, not a rotted citation, so it must not block. */
const ANTIBOT_OK = new Set([401, 403, 405, 406, 415, 418, 429, 451, 502, 503, 504]);
export function isDead(result) {
  if (!result) return true;
  if (result.ok) return false;
  if (typeof result.status === 'number' && ANTIBOT_OK.has(result.status)) return false;
  return true;
}

export function summarize(results) {
  const dead = results.filter(r => isDead(r) && !ALLOWLIST.has(r.url) && !allowlistedHost(r.url));
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
export async function probe(url, timeoutMs = 20000) {
  for (const method of ['HEAD', 'GET']) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 HawkeyeSterling-LinkCheck/1.0' } });
      clearTimeout(t);
      // GET is authoritative; a successful HEAD is conclusive. Any NON-OK HEAD
      // (not only 405/501) retries with GET before judging — some servers
      // 404/403/5xx a HEAD but serve the resource on GET, so returning the HEAD
      // status here would mis-report a live link as dead.
      if (res.ok || method === 'GET') return { ok: res.ok, status: res.status };
      continue; // non-OK HEAD → fall through to GET
    } catch (e) {
      clearTimeout(t);
      if (method === 'GET') return { ok: false, status: null, error: String(e && e.message || e).slice(0, 120) };
    }
  }
  return { ok: false, status: null, error: 'unreachable' };
}

function readFiles() {
  const files = {};
  const roots = [
    'data/reg-sources.json', 'data/sanctions-sources.json',
    // Top-level docs carry externally-visible links (badges, code of conduct,
    // changelog, security policy) that were previously unchecked.
    'README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SUPPORT.md', 'CHANGELOG.md',
  ];
  for (const p of roots) {
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
  const all = collectUrls(readFiles());
  /* Skip loopback / reserved-example URLs (README quick-start localhost, etc.):
     they are intentionally non-resolvable and would be false "dead" links.
     Also skip the datacenter-blocked allowlisted hosts — each would burn a
     guaranteed 2×20s timeout to learn nothing (the block is unconditional). */
  const urls = all.filter(u => isProbeable(u.url) && !allowlistedHost(u.url));
  const skipped = all.length - urls.length;
  if (skipped) console.log('(skipped ' + skipped + ' non-probeable/allowlisted URL(s): localhost/example placeholders + datacenter-blocked hosts — see ALLOWLIST_HOSTS)');
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
