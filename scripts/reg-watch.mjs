/* Regulatory Watch — worldwide, UAE-weighted.

   Fingerprints each source in data/reg-sources.json and, on any change,
   produces a change report. The GitHub Actions workflow
   (.github/workflows/regulatory-watch.yml) then opens a PULL REQUEST carrying
   the updated state + report (and, if an ANTHROPIC_API_KEY secret is present,
   an AI-drafted update proposal) for MLRO review. Detection is automatic;
   updating the regulator-grade wording stays a reviewed decision.

   Country black/grey LIST changes are handled by the FATF Watchdog
   (scripts/fatf-watchdog.mjs); this watcher covers regulations, circulars,
   procedures and guidance across the wider source set.

   Modes:  check (default — compare + write report)  |  seed (record current
   fingerprints, no change flagged).

   Pure logic is exported for offline unit tests (test/reg-watch.test.mjs);
   network fetching is injected so tests never hit the network.
*/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const SOURCES_FILE = 'data/reg-sources.json';
export const STATE_FILE   = 'data/reg-watch-state.json';
export const REPORT_FILE  = 'reg-watch-report.md';
export const CHANGES_FILE = 'reg-watch-changes.json';

/* ── Registry ── */
export function loadSources(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  const list = Array.isArray(data) ? data : data.sources;
  if (!Array.isArray(list)) throw new Error('reg-sources: no sources array');
  const ids = new Set();
  for (const s of list) {
    if (!s.id || !s.name || !s.url) throw new Error('reg-sources: each source needs id, name, url (offender: ' + JSON.stringify(s) + ')');
    if (ids.has(s.id)) throw new Error('reg-sources: duplicate id ' + s.id);
    ids.add(s.id);
    if (!/^https?:\/\//.test(s.url)) throw new Error('reg-sources: ' + s.id + ' url must be http(s)');
  }
  return list;
}

/* ── Content normalisation + fingerprint ──
   Strip script/style/comments and tags, collapse whitespace, lowercase, so
   that only meaningful text changes move the fingerprint (not markup churn or
   one-off whitespace). Imperfect by design — the PR review gate absorbs the
   occasional false positive; we never auto-publish. */
export function extractText(raw) {
  return denoise(String(raw || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/* Strip volatile-but-meaningless tokens so a page's timestamps, session ids,
   nonces and cache-busters don't shift the fingerprint on every fetch and open
   a spurious PR. Tuned to leave real regulatory figures intact: only digit runs
   of 8+ are removed, so thresholds like 55,000 / 60,000 still register. */
export function denoise(text) {
  return text
    .replace(/\d{4}-\d{2}-\d{2}t\d{2}:\d{2}(:\d{2})?(\.\d+)?z?/g, ' ')   // ISO datetimes
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')                                   // ISO dates
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, ' ')                           // d/m/y dates
    .replace(/\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?/g, ' ')                   // clock times
    .replace(/(©|copyright)\s*\d{4}(\s*[-–]\s*\d{4})?/g, ' ')             // copyright years
    .replace(/\b[0-9a-f]{20,}\b/g, ' ')                                   // long hex / nonces
    .replace(/(csrf|nonce|token|sessionid|sid|jsessionid|phpsessid|_ga|_gid|utm_[a-z]+|requestid|request-id|cache[-_]?bust|build|ver|v|ts)=[a-z0-9._-]+/g, ' ')
    .replace(/\d{8,}/g, ' ');                                             // long digit runs (timestamps/ids)
}
export function fingerprint(raw) {
  return createHash('sha256').update(extractText(raw), 'utf8').digest('hex');
}

/* ── Diff fetched content against stored state ──
   fetched: object (or Map) id -> { ok, status, body, error }
   Returns { changes:[...], state }. Each change has a status:
     new        — first time we see a brand-new source (counts as a change)
     changed    — text moved versus the last good snapshot (counts)
     recovered  — first good snapshot after a prior fetch error (does NOT count)
     unchanged  — text identical to last snapshot
     error      — fetch failed OR an "ok" response had empty content
   Errors and empty 200s never count as content changes and never overwrite a
   known-good hash, so a 404, a flaky network, or an empty gateway page cannot
   raise a false PR. */
export function computeChanges(sources, prevState, fetched, today) {
  const prev = (prevState && prevState.sources) || {};
  const stateSources = {};
  const changes = [];
  const base = s => ({ id: s.id, name: s.name, jurisdiction: s.jurisdiction, url: s.url });
  for (const s of sources) {
    const f = fetched[s.id] || fetched.get?.(s.id);
    const old = prev[s.id];
    const okResponse = f && f.ok !== false && !f.error && typeof f.body === 'string';
    const text = okResponse ? extractText(f.body) : '';
    if (!okResponse || text.length === 0) {
      const detail = okResponse ? 'empty response (no text content)'
        : (f && (f.error || ('HTTP ' + (f && f.status)))) || 'fetch failed';
      const status = (f && f.status) || 'error';
      stateSources[s.id] = old
        ? { ...old, checkedAt: today, status, error: detail }
        : { hash: null, bytes: 0, checkedAt: today, changedAt: null, status, error: detail };
      changes.push({ ...base(s), status: 'error', detail });
      continue;
    }
    const hash = fingerprint(f.body);
    const bytes = text.length;
    if (!old) {
      stateSources[s.id] = { hash, bytes, checkedAt: today, changedAt: today, status: f.status || 200 };
      changes.push({ ...base(s), status: 'new', newHash: hash });
    } else if (old.hash == null) {
      /* first good snapshot after a prior error — record silently, no PR */
      stateSources[s.id] = { hash, bytes, checkedAt: today, changedAt: today, status: f.status || 200 };
      changes.push({ ...base(s), status: 'recovered', newHash: hash });
    } else if (old.hash !== hash) {
      stateSources[s.id] = { hash, bytes, checkedAt: today, changedAt: today, status: f.status || 200, prevHash: old.hash };
      changes.push({ ...base(s), status: 'changed', prevHash: old.hash, newHash: hash, prevBytes: old.bytes, newBytes: bytes });
    } else {
      stateSources[s.id] = { ...old, checkedAt: today, status: f.status || 200 };
      changes.push({ ...base(s), status: 'unchanged' });
    }
  }
  return { changes, state: { updated: today, sources: stateSources } };
}

export function contentChanges(changes) {
  return changes.filter(c => c.status === 'new' || c.status === 'changed');
}

/* ── Human-readable report (PR body + committed artifact) ── */
export function buildReport(changes, today, mode) {
  const moved = contentChanges(changes);
  const errors = changes.filter(c => c.status === 'error');
  const seeded = changes.filter(c => c.status !== 'error').length;
  const lines = [];
  if (mode === 'seed') {
    lines.push('# Regulatory Watch — baseline — ' + today);
    lines.push('');
    lines.push('Recorded baseline fingerprints for **' + seeded + '** of ' + changes.length + ' monitored source(s). A seed run flags no changes; future weekly runs compare against this baseline.');
    if (errors.length) appendErrors(lines, errors);
    lines.push('');
    lines.push('_Detection is automatic; wording changes are a reviewed decision. Country black/grey list moves are handled by the FATF Watchdog._');
    return lines.join('\n');
  }
  lines.push('# Regulatory Watch — ' + today);
  lines.push('');
  if (!moved.length) {
    lines.push('No regulatory content changes detected across ' + changes.length + ' monitored sources.');
  } else {
    lines.push('**' + moved.length + ' source(s) changed** out of ' + changes.length + ' monitored. Review and apply any needed updates to `assets/super-data.js` (Q&A answers / tool citations) and `index.html` (country / risk data).');
    lines.push('');
    lines.push('| Source | Jurisdiction | Change | Link |');
    lines.push('| --- | --- | --- | --- |');
    for (const c of moved) {
      lines.push('| ' + c.name + ' | ' + (c.jurisdiction || '') + ' | ' + (c.status === 'new' ? 'first snapshot' : 'content changed') + ' | ' + c.url + ' |');
    }
  }
  if (errors.length) appendErrors(lines, errors);
  lines.push('');
  lines.push('_Detection is automatic; wording changes are a reviewed decision. Country black/grey list moves are handled by the FATF Watchdog._');
  return lines.join('\n');
}

function appendErrors(lines, errors) {
  lines.push('');
  lines.push('<details><summary>' + errors.length + ' source(s) could not be fetched (no action — re-checked next run)</summary>');
  lines.push('');
  for (const e of errors) lines.push('- ' + e.name + ' — ' + e.detail + ' (' + e.url + ')');
  lines.push('');
  lines.push('</details>');
}

/* ── Network (only used by the runner, not by tests) ── */
async function fetchSource(s, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(s.url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'HawkeyeSterling-RegWatch/1.0 (+compliance monitor)', 'accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8' }
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: res.ok ? body : '' , error: res.ok ? null : ('HTTP ' + res.status) };
  } catch (e) {
    return { ok: false, status: 'error', body: '', error: String(e && e.message || e).slice(0, 200) };
  } finally {
    clearTimeout(t);
  }
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { updated: null, sources: {} };
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { console.warn('reg-watch: state file unreadable, starting fresh (' + e.message + ')'); return { updated: null, sources: {} }; }
}

function setOutput(key, val) {
  /* Sanitize before writing to GITHUB_OUTPUT: a CR/LF in the value (e.g. an upstream
     error message folded into a title) could inject additional output lines; cap the
     length so a pathological message can't bloat the step context. */
  const clean = String(val == null ? '' : val).replace(/[\r\n]+/g, ' ').slice(0, 300);
  if (process.env.GITHUB_OUTPUT) { try { writeFileSync(process.env.GITHUB_OUTPUT, key + '=' + clean + '\n', { flag: 'a' }); } catch {} }
}

async function main() {
  const mode = process.argv[2] || 'check';
  const sources = loadSources(readFileSync(SOURCES_FILE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const prevState = loadState();

  const fetched = {};
  await Promise.all(sources.map(async s => { fetched[s.id] = await fetchSource(s); }));

  const { changes, state } = computeChanges(sources, prevState, fetched, today);
  const moved = contentChanges(changes);
  const errors = changes.filter(c => c.status === 'error');
  const seeded = changes.filter(c => c.status !== 'error').length;
  const report = buildReport(changes, today, mode);

  mkdirSync('data', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  writeFileSync(REPORT_FILE, report + '\n');

  const flagged = mode === 'seed' ? [] : moved;
  writeFileSync(CHANGES_FILE, JSON.stringify({ date: today, mode, changes: flagged }, null, 2) + '\n');

  const count = mode === 'seed' ? seeded : moved.length;
  const prTitle = mode === 'seed'
    ? 'Regulatory Watch — baseline (' + seeded + ' source' + (seeded === 1 ? '' : 's') + ')'
    : 'Regulatory Watch — ' + count + ' source change' + (count === 1 ? '' : 's');

  console.log(report);
  console.log('\nmode=' + mode + '  content-changes=' + moved.length + '  errors=' + errors.length + '  seeded=' + seeded);
  setOutput('has_changes', flagged.length ? 'true' : 'false');
  setOutput('changed_count', String(count));
  setOutput('pr_title', prTitle);
  setOutput('report_file', REPORT_FILE);
}

/* Run only when invoked directly (node scripts/reg-watch.mjs), never when
   imported by a test or by reg-draft.mjs. pathToFileURL handles path encoding
   and avoids the substring false-match that endsWith() would allow. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
