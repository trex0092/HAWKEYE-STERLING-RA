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
import { loadSources, computeChanges, contentChanges } from './reg-watch.mjs';

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
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch (e) { console.warn('sanctions-watch: state file unreadable, starting fresh (' + e.message + ')'); return { updated: null, sources: {} }; }
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

  // Per-source consecutive-error streak. A permanently-dead list URL (e.g. OFAC
  // moves sdn.csv → daily 404) must not decay silently inside a "no action" note
  // forever: track the streak in state and, once it crosses the threshold, treat
  // it as an actionable change (alert + commit). state_dirty ensures the streak is
  // PERSISTED even on a no-list-change run (else it would reset every run).
  const ERROR_STREAK_ALERT = Number(process.env.SANCTIONS_ERROR_STREAK) || 3;
  const persistentErrors = [];
  let anyError = false;
  for (const s of sources) {
    const f = fetched[s.id];
    const rec = state.sources[s.id] || (state.sources[s.id] = {});
    if (f && f.ok) { rec.errStreak = 0; }
    else {
      anyError = true;
      rec.errStreak = (Number(rec.errStreak) || 0) + 1;
      /* Carry status/detail like reg-watch does: without them, watch-notify
         counts this entry as "content changed" and the Asana card tells the
         MLRO a designation list CHANGED when it is actually unmonitored/blind. */
      if (rec.errStreak >= ERROR_STREAK_ALERT) persistentErrors.push({
        name: s.name, id: s.id, url: s.url, streak: rec.errStreak,
        status: 'unreachable', errorStreak: rec.errStreak,
        detail: 'unreachable ' + rec.errStreak + ' consecutive runs — change-detection is blind'
      });
    }
  }

  const moved = contentChanges(changes);
  let report = buildReport(changes, today, mode, counts);
  if (persistentErrors.length) {
    report += '\n\n⚠ PERSISTENT SOURCE FAILURES — a list has been unreachable for '
      + ERROR_STREAK_ALERT + '+ consecutive runs (its change-detection is BLIND):\n'
      + persistentErrors.map(e => '- ' + e.name + ' — unreachable ' + e.streak + ' run(s): ' + e.url).join('\n');
  }
  // Persistent errors are actionable (alert); any error/count change makes the
  // state dirty (commit) so the streak accumulates run-to-run.
  const flagged = mode === 'seed' ? [] : (persistentErrors.length ? [...moved, ...persistentErrors] : moved);
  const stateDirty = mode === 'seed' || flagged.length > 0 || anyError
    || Object.values(counts).some(c => typeof c.now === 'number' && c.now !== c.prev);
  const seeded = changes.filter(x => x.status !== 'error').length;
  const count = mode === 'seed' ? seeded : flagged.length;
  const prTitle = mode === 'seed'
    ? 'Sanctions Watch — baseline (' + seeded + ' list' + (seeded === 1 ? '' : 's') + ')'
    : 'Sanctions Watch — ' + count + ' list change' + (count === 1 ? '' : 's');

  mkdirSync('data', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  writeFileSync(REPORT_FILE, report + '\n');
  writeFileSync(CHANGES_FILE, JSON.stringify({ date: today, mode, changes: flagged }, null, 2) + '\n');

  console.log(report);
  console.log('\nmode=' + mode + '  list-changes=' + moved.length + '  persistent-errors=' + persistentErrors.length
    + '  errors=' + changes.filter(x => x.status === 'error').length);
  setOutput('has_changes', flagged.length ? 'true' : 'false');
  setOutput('state_dirty', stateDirty ? 'true' : 'false');
  setOutput('persistent_errors', String(persistentErrors.length));
  setOutput('changed_count', String(count));
  setOutput('pr_title', prTitle);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
