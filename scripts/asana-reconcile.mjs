/* Weekly reconciliation of the RA app against Asana — turns the manual runbook
   in docs/asana-integration-audit.md into an automated drift check.

   It reads two things that both live in the HAWKEYE STERLING APP project:
     • the app's ASSESSMENT REGISTER (auto-backup) task (a JSON mirror of the
       on-device register, written by netlify/functions/asana-mirror.js), and
     • the per-assessment tasks delivered by netlify/functions/asana-task.js.
   It then diffs them by REFERENCE and reports:
     • delivery gaps — a completed register entry with no Asana task,
     • orphans       — an Asana task with no register entry,
     • mismatches    — band/score in the app disagree with the task, and
     • duplicates    — more than one task for the same reference.

   Drift is filed as a card in the Ongoing Monitoring project (same
   channel as the watchers); the GitHub Action opens an issue if Asana is
   unreachable. The token stays server-side (ASANA_ACCESS_TOKEN). No PII is
   printed — only references, tiers and scores.

   The diff itself is a pure function (reconcile) exported for unit tests. */
import { writeFileSync } from 'node:fs';
import { notifyAsana, esc, asanaEnabled, runUrl, isRetryable, retryDelayMs } from './asana-notify.mjs';

const RISK_PROJECT_GID = process.env.ASANA_PROJECT_GID || '1216203370612914';
const SHEET_OPEN = '===HS SHEET===';
const SHEET_CLOSE = '===END===';
const REG_TASK = 'ASSESSMENT REGISTER (auto-backup)';
/* Housekeeping mirrors are not per-assessment tasks — never treat them as orphans. */
const HOUSEKEEPING = new Set([
  'ASSESSMENT REGISTER (auto-backup)',
  'ACTIVITY LOG (auto-backup)',
  'RISK DATA SHEET (auto-backup)'
]);

/* ── pure helpers (exported for tests) ────────────────────────────────────── */

/* The stable reference for a task: its external id (stamped by asana-task.js) if
   present, else the leading segment of the display name ("<ref> · …"). */
export function taskRef(t) {
  if (t && t.external && t.external.gid) return String(t.external.gid);
  const name = String((t && t.name) || '');
  const i = name.indexOf(' · ');
  return i > 0 ? name.slice(0, i) : '';
}

/* Band + score parsed from the trailing "… · <BAND> <score>" segment of the name. */
export function taskBandScore(t) {
  const seg = String((t && t.name) || '').split(' · ').pop() || '';
  const m = seg.match(/\b(CDD|SDD|EDD|PROHIBITED)\b\s*(\d+)?/);
  return m ? { band: m[1], score: m[2] != null ? m[2] : '' } : { band: '', score: '' };
}

/* Diff the app register against the live Asana tasks. Pure — no I/O. */
export function reconcile(register, tasks) {
  const regByRef = new Map();
  for (const r of (register || [])) if (r && r.ref) regByRef.set(String(r.ref), r);

  const taskByRef = new Map();
  for (const t of (tasks || [])) {
    if (HOUSEKEEPING.has(String((t && t.name) || ''))) continue;
    const ref = taskRef(t);
    if (!ref) continue;
    if (!taskByRef.has(ref)) taskByRef.set(ref, []);
    taskByRef.get(ref).push(t);
  }

  const deliveryGaps = [], mismatches = [], duplicates = [], orphans = [];
  for (const [ref, r] of regByRef) {
    const ts = taskByRef.get(ref) || [];
    if (r.complete && ts.length === 0) { deliveryGaps.push({ ref, outcome: r.outcome || '' }); continue; }
    if (ts.length > 1) duplicates.push({ ref, count: ts.length });
    if (ts.length >= 1) {
      const bs = taskBandScore(ts[0]);
      const regBand = String(r.outcome || ''), regScore = (r.total == null ? '' : String(r.total));
      if (regBand && bs.band && regBand !== bs.band) mismatches.push({ ref, field: 'band', app: regBand, asana: bs.band });
      else if (regScore && bs.score && regScore !== bs.score) mismatches.push({ ref, field: 'score', app: regScore, asana: bs.score });
    }
  }
  for (const [ref, ts] of taskByRef) {
    if (!regByRef.has(ref)) orphans.push({ ref, count: ts.length });
  }

  const total = deliveryGaps.length + orphans.length + mismatches.length + duplicates.length;
  return {
    deliveryGaps, orphans, mismatches, duplicates, total,
    counts: { register: regByRef.size, tasks: [...taskByRef.values()].reduce((a, b) => a + b.length, 0) }
  };
}

/* Render a short, PII-free markdown report of the diff. */
export function renderReport(d) {
  const L = [];
  L.push(`Register entries: ${d.counts.register} · Asana tasks: ${d.counts.tasks} · discrepancies: ${d.total}`);
  const sec = (title, rows, fmt) => { if (rows.length) { L.push('', `### ${title} (${rows.length})`); rows.forEach(r => L.push('- ' + fmt(r))); } };
  sec('Delivery gaps — completed, not in Asana', d.deliveryGaps, r => `${r.ref} (${r.outcome || '?'})`);
  sec('Orphans — in Asana, not in the register', d.orphans, r => `${r.ref}${r.count > 1 ? ` ×${r.count}` : ''}`);
  sec('Duplicates — more than one task per reference', d.duplicates, r => `${r.ref} ×${r.count}`);
  sec('Field mismatches — app vs Asana', d.mismatches, r => `${r.ref}: ${r.field} app=${r.app} asana=${r.asana}`);
  return L.join('\n');
}

/* ── I/O (only runs as a script, not on import) ───────────────────────────── */

const ASANA_TIMEOUT_MS = Number(process.env.ASANA_TIMEOUT_MS) || 20000;
/* Reads are idempotent, so 429/5xx retry (shared policy) is always safe here —
   a rate-limit blip must not paint the reconciliation control red. */
const sleep = ms => new Promise(res => setTimeout(res, ms));
async function api(path) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ASANA_TIMEOUT_MS);
    try {
      const r = await fetch('https://app.asana.com/api/1.0' + path, {
        signal: ctrl.signal,
        headers: { Authorization: 'Bearer ' + process.env.ASANA_ACCESS_TOKEN, Accept: 'application/json' }
      });
      if (r.status === 401) throw new Error('Asana 401 Unauthorized — ASANA_ACCESS_TOKEN may have expired or been revoked. Rotate it in GitHub Settings → Secrets → ASANA_ACCESS_TOKEN.');
      const d = await r.json().catch(() => ({}));
      if (r.ok) return d;
      if (attempt < 2 && isRetryable(r.status)) {
        const delay = retryDelayMs(attempt, r.headers.get('retry-after'));
        console.warn('asana-reconcile: Asana ' + r.status + ' — retry in ' + delay + 'ms');
        await sleep(delay);
        continue;
      }
      throw new Error('Asana ' + r.status + ': ' + JSON.stringify(d.errors || d).slice(0, 300));
    } finally { clearTimeout(timer); }
  }
}

function parseSheet(notes) {
  const s = String(notes || '');
  const a = s.indexOf(SHEET_OPEN); if (a === -1) return [];
  const b = s.indexOf(SHEET_CLOSE, a + SHEET_OPEN.length); if (b === -1) return [];
  try { return JSON.parse(s.slice(a + SHEET_OPEN.length, b).trim()); } catch (e) { return []; }
}

async function listTasks(project) {
  const out = [];
  let path = '/projects/' + project + '/tasks?limit=100&opt_fields=name,external,completed';
  let it = 0;
  while (path && it < 100) {
    it++;
    const page = await api(path);
    for (const t of (page.data || [])) out.push(t);
    path = (page.next_page && page.next_page.offset)
      ? '/projects/' + project + '/tasks?limit=100&opt_fields=name,external,completed&offset=' + page.next_page.offset : null;
  }
  return out;
}

async function main() {
  if (!process.env.ASANA_ACCESS_TOKEN) throw new Error('ASANA_ACCESS_TOKEN is not configured');
  const tasks = await listTasks(RISK_PROJECT_GID);
  const regTask = tasks.find(t => String(t.name || '') === REG_TASK);
  let register = [];
  if (regTask) {
    const full = await api('/tasks/' + regTask.gid + '?opt_fields=notes');
    register = parseSheet(full.data && full.data.notes);
  }
  const diff = reconcile(register, tasks);
  const report = renderReport(diff);
  console.log(report);
  try { writeFileSync('asana-reconcile-report.md', report); } catch (e) { /* CI artifact only */ }

  if (diff.total > 0 && asanaEnabled()) {
    const link = runUrl();
    const html = '<body><h2>Asana ↔ RA reconciliation — ' + diff.total + ' discrepancy(ies)</h2>'
      + '<strong>' + esc(report.split('\n')[0]) + '</strong>'
      + '<code>' + esc(report) + '</code>'  /* Asana html_notes has no <pre>; an unsupported tag 400s the card exactly when drift is found */
      + (link ? '<a href="' + esc(link) + '">View the run</a>' : '') + '</body>';
    await notifyAsana('RA ↔ Asana reconciliation — ' + diff.total + ' discrepancy(ies)', report, { html });
  }
  /* Non-blocking: reconciliation is observational. The workflow inspects stdout /
     the filed card; it exits 0 so a drift finding is not a red build. */
}

/* Only run when invoked directly (so tests can import the pure helpers). */
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('asana-reconcile.mjs');
if (invokedDirectly) {
  main().catch(e => { console.error(String(e && e.message || e)); process.exit(1); });
}
