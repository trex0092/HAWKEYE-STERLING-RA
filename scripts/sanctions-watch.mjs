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
export const TFS_LOG_FILE = 'data/tfs-update-log.json';
/* The full-base screening workflows whose next successful run after a detected
   list change IS the re-screen of the customer base against the new list. */
export const SCREEN_WORKFLOWS = ['weekly-adverse-media.yml', 'sanctions-screen.yml'];
export const TFS_LOG_CAP = 200;

/* Approximate record count for the report: count a per-record marker if the
   source defines one, else count CSV data rows (lines minus header). Returns
   null when the format gives no reliable count. */
export function countEntries(body, type, marker, noHeader) {
  if (typeof body !== 'string' || !body) return null;
  if (marker) return body.split(marker).length - 1;
  if (type === 'csv') {
    const lines = body.split(/\r?\n/).filter(l => l.trim().length);
    // Headerless CSVs (registry `noHeader: true`, e.g. OFAC sdn.csv) count every
    // data row; subtracting a header that isn't there undercounts by one.
    return Math.max(0, lines.length - (noHeader ? 0 : 1));
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
/* Per-source consecutive-error streak. A permanently-dead list URL (e.g. OFAC
   moves sdn.csv → daily 404) must not decay silently inside a "no action" note
   forever: track the streak in state and, once it crosses the threshold, treat
   it as an actionable change (alert + commit). state_dirty ensures the streak is
   PERSISTED even on a no-list-change run (else it would reset every run).
   Entries carry status/detail like reg-watch's: without them, watch-notify
   counts the entry as "content changed" and the Asana card tells the MLRO a
   designation list CHANGED when it is actually unmonitored/blind.
   Mutates stateSources[id].errStreak; exported for unit tests. */
export function trackErrorStreaks(sources, fetched, stateSources, threshold) {
  const persistentErrors = [];
  let anyError = false;
  for (const s of sources) {
    const f = fetched[s.id];
    const rec = stateSources[s.id] || (stateSources[s.id] = {});
    if (f && f.ok) { rec.errStreak = 0; }
    else {
      anyError = true;
      rec.errStreak = (Number(rec.errStreak) || 0) + 1;
      if (rec.errStreak >= threshold) persistentErrors.push({
        name: s.name, id: s.id, url: s.url, streak: rec.errStreak,
        status: 'unreachable', errorStreak: rec.errStreak,
        detail: 'unreachable ' + rec.errStreak + ' consecutive runs — change-detection is blind'
      });
    }
  }
  return { persistentErrors, anyError };
}

/* ── TFS timeline log: publication → ingestion → re-screen ──────────────────
   TFS duties are timed: when a designation list changes, the firm must be able
   to EVIDENCE how quickly it ingested the update and re-screened the customer
   base against it. This log records one entry per detected list change:
     publicationDate — the list's own machine-readable publish date when the
                       format carries one (UN consolidated.xml dateGenerated);
                       null otherwise (most feeds publish no date; the MLRO can
                       complete it from the official notice)
     detectedAt      — when this watcher ingested the change (fingerprint moved)
     rescreen        — the first successful full-base screening run that STARTED
                       after detection (resolved on a later watch run via the
                       Actions API), with the latency in hours
   The log lives beside the fingerprint state on the sanctions-watch-state
   branch; entries are pure data (offline-tested), only the run lookup touches
   the network. */

/* Best-effort machine-readable publication date from a fetched list body.
   Only the UN consolidated XML carries one (dateGenerated); others → null. */
export function extractPublishedDate(body) {
  if (typeof body !== 'string' || !body) return null;
  const m = body.match(/dateGenerated="([^"]{10,})"/);
  return m ? m[1].slice(0, 10) : null;
}

/* Build pending log entries for this run's content changes. */
export function tfsNewEntries(moved, counts, fetched, nowIso) {
  return (moved || []).map(mv => {
    const c = (counts || {})[mv.id] || {};
    const f = (fetched || {})[mv.id] || {};
    return {
      id: mv.id,
      list: mv.name,
      change: mv.status === 'new' ? 'first snapshot' : 'list changed',
      publicationDate: f.ok ? extractPublishedDate(f.body) : null,
      detectedAt: nowIso,
      prevCount: typeof c.prev === 'number' ? c.prev : null,
      newCount: typeof c.now === 'number' ? c.now : null,
      rescreen: null,
      status: 'pending-rescreen',
    };
  });
}

/* Resolve pending entries against successful screening runs: the re-screen is
   the EARLIEST success that started at or after detection, across any of the
   full-base screening workflows. runsByWorkflow: {file: [{id, startedAt}]}
   (successful runs only). Mutates entries; returns how many were resolved. */
export function resolveRescreens(entries, runsByWorkflow) {
  let resolved = 0;
  for (const e of entries || []) {
    if (e.status !== 'pending-rescreen') continue;
    const detected = Date.parse(e.detectedAt);
    if (Number.isNaN(detected)) continue;
    let best = null;
    for (const [wf, runs] of Object.entries(runsByWorkflow || {})) {
      for (const r of runs || []) {
        const started = Date.parse(r.startedAt);
        if (Number.isNaN(started) || started < detected) continue;
        if (!best || started < best.started) best = { workflow: wf, runId: r.id, startedAt: r.startedAt, started };
      }
    }
    if (best) {
      e.rescreen = { workflow: best.workflow, runId: best.runId, startedAt: best.startedAt };
      e.latencyHours = Math.round((best.started - detected) / 3600000 * 10) / 10;
      e.status = 'complete';
      resolved++;
    }
  }
  return resolved;
}

/* Keep the newest `cap` entries (the log is an audit trail, not unbounded). */
export function capTfsEntries(entries, cap = TFS_LOG_CAP) {
  const a = entries || [];
  return a.length > cap ? a.slice(a.length - cap) : a;
}

export function loadTfsLog() {
  const empty = {
    _README: 'TFS list-update timeline: one entry per detected designation-list change, recording publicationDate (machine-readable when the feed carries one, else null; the MLRO completes it from the official notice), detectedAt (ingestion into monitoring), and rescreen (the first successful full-base screening run after detection, with latency in hours). Maintained by scripts/sanctions-watch.mjs on the sanctions-watch-state branch; entries are append-only, capped at the newest ' + TFS_LOG_CAP + '.',
    entries: [],
  };
  if (!existsSync(TFS_LOG_FILE)) return empty;
  try {
    const parsed = JSON.parse(readFileSync(TFS_LOG_FILE, 'utf8'));
    if (parsed && Array.isArray(parsed.entries)) return { _README: empty._README, entries: parsed.entries };
    return empty;
  } catch (e) {
    console.warn('tfs-log: unreadable, starting fresh (' + e.message + ')');
    return empty;
  }
}

/* ── Network (runner only; not imported by tests) ── */
async function fetchScreenRuns(repo, token, workflowId, perPage = 20) {
  const url = 'https://api.github.com/repos/' + repo + '/actions/workflows/' + workflowId
    + '/runs?status=success&per_page=' + perPage;
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'hawkeye-sanctions-watch',
    },
  });
  if (!res.ok) throw new Error('GitHub API ' + res.status + ' for ' + workflowId);
  const data = await res.json();
  return (data.workflow_runs || []).map(r => ({ id: r.id, startedAt: r.run_started_at || r.created_at }));
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
    const now = (f && f.ok && typeof f.body === 'string') ? countEntries(f.body, s.type, s.marker, s.noHeader) : null;
    const prevCount = prev[s.id] && typeof prev[s.id].count === 'number' ? prev[s.id].count : null;
    if (typeof now === 'number') state.sources[s.id].count = now;
    else if (typeof prevCount === 'number' && state.sources[s.id]) state.sources[s.id].count = prevCount;
    counts[s.id] = { prev: prevCount, now };
  }

  const ERROR_STREAK_ALERT = Number(process.env.SANCTIONS_ERROR_STREAK) || 3;
  const { persistentErrors, anyError } = trackErrorStreaks(sources, fetched, state.sources, ERROR_STREAK_ALERT);

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

  /* TFS timeline: append an entry per content change, then try to resolve any
     pending re-screen linkages via the Actions API (needs GITHUB_TOKEN with
     actions:read; skipped gracefully offline). Failures never break the watch:
     the log is evidence, the alerting above is the control. */
  let logChanged = false;
  try {
    const logObj = loadTfsLog();
    const before = JSON.stringify(logObj.entries);
    if (mode !== 'seed' && moved.length) {
      logObj.entries.push(...tfsNewEntries(moved, counts, fetched, new Date().toISOString()));
    }
    const repo = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (repo && token && logObj.entries.some(e => e.status === 'pending-rescreen')) {
      const runsByWorkflow = {};
      for (const wf of SCREEN_WORKFLOWS) {
        try { runsByWorkflow[wf] = await fetchScreenRuns(repo, token, wf); }
        catch (e) { console.warn('tfs-log: could not query ' + wf + ' runs — ' + e.message); }
      }
      const resolved = resolveRescreens(logObj.entries, runsByWorkflow);
      if (resolved) console.log('tfs-log: resolved re-screen linkage for ' + resolved + ' entr' + (resolved === 1 ? 'y' : 'ies'));
    }
    logObj.entries = capTfsEntries(logObj.entries);
    logChanged = JSON.stringify(logObj.entries) !== before || !existsSync(TFS_LOG_FILE);
    writeFileSync(TFS_LOG_FILE, JSON.stringify(logObj, null, 2) + '\n');
  } catch (e) {
    console.warn('tfs-log: update skipped this run — ' + e.message);
  }

  console.log(report);
  console.log('\nmode=' + mode + '  list-changes=' + moved.length + '  persistent-errors=' + persistentErrors.length
    + '  errors=' + changes.filter(x => x.status === 'error').length);
  setOutput('has_changes', flagged.length ? 'true' : 'false');
  setOutput('state_dirty', (stateDirty || logChanged) ? 'true' : 'false');
  setOutput('persistent_errors', String(persistentErrors.length));
  setOutput('changed_count', String(count));
  setOutput('pr_title', prTitle);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
