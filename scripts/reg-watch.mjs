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
  return String(raw || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}
export function fingerprint(raw) {
  return createHash('sha256').update(extractText(raw), 'utf8').digest('hex');
}

/* ── Diff fetched content against stored state ──
   fetched: Map/object id -> { ok, status, body, error }
   Returns { changes:[...], state } where each change has a status:
   new | changed | unchanged | error. Errors never count as content changes
   (a 404 or a flaky network must not raise a false PR). */
export function computeChanges(sources, prevState, fetched, today) {
  const prev = (prevState && prevState.sources) || {};
  const stateSources = {};
  const changes = [];
  for (const s of sources) {
    const f = fetched[s.id] || fetched.get?.(s.id);
    const old = prev[s.id];
    if (!f || f.ok === false || f.error || typeof f.body !== 'string') {
      stateSources[s.id] = old
        ? { ...old, checkedAt: today, status: (f && f.status) || 'error', error: (f && (f.error || ('HTTP ' + f.status))) || 'fetch failed' }
        : { hash: null, bytes: 0, checkedAt: today, changedAt: null, status: (f && f.status) || 'error', error: (f && (f.error || ('HTTP ' + f.status))) || 'fetch failed' };
      changes.push({ id: s.id, name: s.name, jurisdiction: s.jurisdiction, url: s.url, status: 'error', detail: stateSources[s.id].error });
      continue;
    }
    const hash = fingerprint(f.body);
    const bytes = extractText(f.body).length;
    if (!old || old.hash == null) {
      stateSources[s.id] = { hash, bytes, checkedAt: today, changedAt: today, status: f.status || 200 };
      changes.push({ id: s.id, name: s.name, jurisdiction: s.jurisdiction, url: s.url, status: old ? 'changed' : 'new', prevHash: old ? old.hash : null, newHash: hash });
    } else if (old.hash !== hash) {
      stateSources[s.id] = { hash, bytes, checkedAt: today, changedAt: today, status: f.status || 200, prevHash: old.hash };
      changes.push({ id: s.id, name: s.name, jurisdiction: s.jurisdiction, url: s.url, status: 'changed', prevHash: old.hash, newHash: hash, prevBytes: old.bytes, newBytes: bytes });
    } else {
      stateSources[s.id] = { ...old, checkedAt: today, status: f.status || 200 };
      changes.push({ id: s.id, name: s.name, jurisdiction: s.jurisdiction, url: s.url, status: 'unchanged' });
    }
  }
  return { changes, state: { updated: today, sources: stateSources } };
}

export function contentChanges(changes) {
  return changes.filter(c => c.status === 'new' || c.status === 'changed');
}

/* ── Human-readable report (PR body + committed artifact) ── */
export function buildReport(changes, today) {
  const moved = contentChanges(changes);
  const errors = changes.filter(c => c.status === 'error');
  const lines = [];
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
  if (errors.length) {
    lines.push('');
    lines.push('<details><summary>' + errors.length + ' source(s) could not be fetched (no action — re-checked next run)</summary>');
    lines.push('');
    for (const e of errors) lines.push('- ' + e.name + ' — ' + e.detail + ' (' + e.url + ')');
    lines.push('');
    lines.push('</details>');
  }
  lines.push('');
  lines.push('_Detection is automatic; wording changes are a reviewed decision. Country black/grey list moves are handled by the FATF Watchdog._');
  return lines.join('\n');
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
  catch { return { updated: null, sources: {} }; }
}

function setOutput(key, val) {
  if (process.env.GITHUB_OUTPUT) {
    try { writeFileSync(process.env.GITHUB_OUTPUT, key + '=' + val + '\n', { flag: 'a' }); } catch {}
  }
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
  const report = buildReport(changes, today);

  mkdirSync('data', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  writeFileSync(REPORT_FILE, report + '\n');

  const flagged = mode === 'seed' ? [] : moved;
  writeFileSync(CHANGES_FILE, JSON.stringify({ date: today, mode, changes: flagged }, null, 2) + '\n');
  console.log(report);
  console.log('\nmode=' + mode + '  content-changes=' + moved.length + '  errors=' + changes.filter(c => c.status === 'error').length);
  setOutput('has_changes', flagged.length ? 'true' : 'false');
  setOutput('changed_count', String(flagged.length));
  setOutput('report_file', REPORT_FILE);
}

/* Run only when invoked directly (not when imported by tests). */
if (import.meta.url === ('file://' + process.argv[1]) || process.argv[1]?.endsWith('reg-watch.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
