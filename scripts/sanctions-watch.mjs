/* Sanctions Watch — daily check of the major consolidated designation lists
   (OFAC SDN + non-SDN, UN Security Council, UK OFSI, EU FSF).

   Fingerprints each machine-readable list and, on any change, opens a pull
   request (falling back to an issue when PR creation is disabled) so the
   sanctions answers, escalation/CFA logic and risk data can be reviewed.
   Detection is automatic; entity-level action stays a reviewed decision.

   Country black/grey LIST moves are handled by the FATF Watchdog; regulations
   and guidance by the Regulatory Watch. This watcher covers designation lists.

   Reuses the tested pure helpers from reg-watch.mjs (loadSources, fingerprint,
   computeChanges, contentChanges); adds an approximate entry-count delta and a
   sanctions-specific report. Network fetching is isolated from the pure logic
   so test/sanctions-watch.test.mjs runs fully offline.

   Modes: check (default) | seed (record baselines, flag nothing).
*/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadSources, fingerprint, computeChanges, contentChanges } from './reg-watch.mjs';

export const SOURCES_FILE = 'data/sanctions-sources.json';
export const STATE_FILE   = 'data/sanctions-state.json';
export const REPORT_FILE  = 'sanctions-watch-report.md';
export const CHANGES_FILE = 'sanctions-watch-changes.json';

/* Approximate record count for the report: count a per-record marker if the
   source defines one, else count CSV data rows (lines minus header). Returns
   null when the format gives no reliable count. */
export function countEntries(body, type, marker) {
  if (typeof body !== 'string' || !body) return null;
  if (marker) return body.split(marker).length - 1;
  if (type === 'csv') {
    const lines = body.split(/\r?\n/).filter(l => l.trim().length);
    return Math.max(0, lines.length - 1);
  }
  return null;
}

function deltaStr(prev, now) {
  if (typeof now !== 'number') return '';
  if (typeof prev !== 'number') return ' (' + now + ' entries)';
  const d = now - prev;
  return ' (' + now + ' entries, ' + (d > 0 ? '+' : '') + d + ')';
}

export function buildReport(changes, today, mode, counts) {
  const moved = contentChanges(changes);
  const errors = changes.filter(c => c.status === 'error');
  const seeded = changes.filter(c => c.status !== 'error').length;
  const c = counts || {};
  const lines = [];
  if (mode === 'seed') {
    lines.push('# Sanctions Watch — baseline — ' + today, '');
    lines.push('Recorded baseline fingerprints for **' + seeded + '** of ' + changes.length + ' consolidated list(s). Future daily runs compare against this baseline.');
  } else {
    lines.push('# Sanctions Watch — ' + today, '');
    if (!moved.length) {
      lines.push('No designation-list changes detected across ' + changes.length + ' lists.');
    } else {
      lines.push('**' + moved.length + ' list(s) changed.** Review designations and update `index.html` (country / risk data) and the sanctions answers / escalation logic in `assets/super-data.js` as needed.', '');
      lines.push('| List | Jurisdiction | Change | Link |', '| --- | --- | --- | --- |');
      for (const m of moved) {
        const label = (m.status === 'new' ? 'first snapshot' : 'list changed') + deltaStr(c[m.id] && c[m.id].prev, c[m.id] && c[m.id].now);
        lines.push('| ' + m.name + ' | ' + (m.jurisdiction || '') + ' | ' + label + ' | ' + m.url + ' |');
      }
    }
  }
  if (errors.length) {
    lines.push('', '<details><summary>' + errors.length + ' list(s) could not be fetched (no action — re-checked next run)</summary>', '');
    for (const e of errors) lines.push('- ' + e.name + ' — ' + e.detail + ' (' + e.url + ')');
    lines.push('', '</details>');
  }
  lines.push('', '_Detection is automatic; designation action stays a reviewed decision. Country black/grey list moves are handled by the FATF Watchdog._');
  return lines.join('\n');
}

/* ── Network (runner only; not imported by tests) ── */
async function fetchSource(s, timeoutMs = 45000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(s.url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'HawkeyeSterling-SanctionsWatch/1.0' } });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: res.ok ? body : '', error: res.ok ? null : ('HTTP ' + res.status) };
  } catch (e) {
    return { ok: false, status: 'error', body: '', error: String(e && e.message || e).slice(0, 200) };
  } finally { clearTimeout(t); }
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { updated: null, sources: {} };
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return { updated: null, sources: {} }; }
}
function setOutput(key, val) {
  if (process.env.GITHUB_OUTPUT) { try { writeFileSync(process.env.GITHUB_OUTPUT, key + '=' + val + '\n', { flag: 'a' }); } catch {} }
}

async function main() {
  const mode = process.argv[2] || 'check';
  const sources = loadSources(readFileSync(SOURCES_FILE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const prevState = loadState();
  const prev = (prevState && prevState.sources) || {};

  const fetched = {};
  await Promise.all(sources.map(async s => { fetched[s.id] = await fetchSource(s); }));

  const { changes, state } = computeChanges(sources, prevState, fetched, today);

  /* attach approximate counts to state + a prev/now map for the report */
  const counts = {};
  for (const s of sources) {
    const f = fetched[s.id];
    const now = (f && f.ok && typeof f.body === 'string') ? countEntries(f.body, s.type, s.marker) : null;
    const prevCount = prev[s.id] && typeof prev[s.id].count === 'number' ? prev[s.id].count : null;
    if (typeof now === 'number') state.sources[s.id].count = now;
    else if (typeof prevCount === 'number' && state.sources[s.id]) state.sources[s.id].count = prevCount;
    counts[s.id] = { prev: prevCount, now };
  }

  const moved = contentChanges(changes);
  const report = buildReport(changes, today, mode, counts);
  const flagged = mode === 'seed' ? [] : moved;
  const seeded = changes.filter(x => x.status !== 'error').length;
  const count = mode === 'seed' ? seeded : moved.length;
  const prTitle = mode === 'seed'
    ? 'Sanctions Watch — baseline (' + seeded + ' list' + (seeded === 1 ? '' : 's') + ')'
    : 'Sanctions Watch — ' + count + ' list change' + (count === 1 ? '' : 's');

  mkdirSync('data', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  writeFileSync(REPORT_FILE, report + '\n');
  writeFileSync(CHANGES_FILE, JSON.stringify({ date: today, mode, changes: flagged }, null, 2) + '\n');

  console.log(report);
  console.log('\nmode=' + mode + '  list-changes=' + moved.length + '  errors=' + changes.filter(x => x.status === 'error').length);
  setOutput('has_changes', flagged.length ? 'true' : 'false');
  setOutput('changed_count', String(count));
  setOutput('pr_title', prTitle);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
