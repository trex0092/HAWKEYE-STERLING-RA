/* Weekly Compliance Summary — every Monday 09:00 UAE (05:03 UTC cron).

   One consolidated Asana card carrying ALL the week's information:
     · pipeline health (last run of every monitoring workflow)
     · regulatory-source health (x/21, failures with streaks and provenance)
     · which sources changed in the past 7 days + links to the AI drafts
     · FATF black/grey list position
     · sanctions-list movement (OFAC×2, UN, OFSI, EU)
     · customer-screening flags currently open (by recommendation)

   Reads the fingerprint state, snapshots and drafts that the Regulatory
   Watch persists on the reg-watch-state branch (the workflow overlays them
   before running) plus the other pipelines' state files on main. Pipeline
   run status comes from the GitHub Actions API with the default token.

   Delivery: Asana (Ongoing Monitoring project); the workflow opens a
   labelled GitHub issue instead if Asana is unreachable — a weekly summary
   is never silently lost. Pure builder exported for offline unit tests. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { notifyAsana, asanaEnabled, runUrl, esc, REG_PROJECT_GID } from './asana-notify.mjs';

export const WINDOW_DAYS = 7;

/* Monitoring pipelines shown on the card (file → label). */
export const PIPELINES = [
  { file: 'regulatory-watch.yml',     label: 'Regulatory Watch (21 sources)' },
  { file: 'fatf-watchdog.yml',        label: 'FATF Watchdog (black/grey lists)' },
  { file: 'sanctions-watch.yml',      label: 'Sanctions Watch (5 lists)' },
  { file: 'weekly-adverse-media.yml', label: 'Daily Screening (Sanctions + Adverse Media + PEP)' },
  { file: 'onboarding-screen.yml',    label: 'Onboarding Screening' },
  { file: 'anomaly-watch.yml',        label: 'Anomaly Watch' },
  { file: 'freshness-check.yml',      label: 'Freshness Check' },
];

export function inWindow(isoDay, today, days = WINDOW_DAYS) {
  if (!isoDay || !today) return false;
  const t = Date.parse(today), d = Date.parse(String(isoDay).slice(0, 10));
  if (Number.isNaN(t) || Number.isNaN(d)) return false;
  const age = (t - d) / 86400000;
  return age >= 0 && age < days;
}

/* Pure card builder — every input is plain data so tests never touch the
   network or the filesystem. Returns { title, html, plain }. */
export function buildWeeklySummary({ today, regState, fatf, sanctions, screen, regDocs = [], pipelines = [], repo = '' }) {
  const srcs = (regState && regState.sources) || {};
  const entries = Object.entries(srcs);
  const healthy = entries.filter(([, v]) => v.status === 200 && !v.error);
  const failing = entries.filter(([, v]) => v.error);
  const viaArchive = healthy.filter(([, v]) => v.via);
  const changed = entries.filter(([, v]) => !v.error && inWindow(v.changedAt, today));

  const title = '📅 Weekly Compliance Summary — ' + today + ' (past ' + WINDOW_DAYS + ' days)';
  const h = [];
  h.push('<h1>Weekly Compliance Summary</h1>');
  h.push('<strong>Week ending ' + esc(today) + ' — every monitoring pipeline, source, list and screening flag in one place.</strong>');

  h.push('<h2>Pipeline health</h2><ul>');
  for (const p of pipelines) {
    const okp = p.conclusion === 'success';
    h.push('<li>' + (okp ? '✅' : '❌') + ' <strong>' + esc(p.label) + '</strong> — last run ' + esc(p.conclusion || 'never ran')
      + (p.date ? ' (' + esc(String(p.date).slice(0, 10)) + ')' : '') + '</li>');
  }
  h.push('</ul>');

  h.push('<h2>Regulatory sources — ' + healthy.length + '/' + entries.length + ' healthy</h2><ul>');
  for (const [id, v] of failing) {
    h.push('<li>❌ <strong>' + esc(id) + '</strong> — ' + esc(v.error || 'failing') + ' — failing ' + (v.errorStreak || '?') + ' consecutive runs</li>');
  }
  for (const [id, v] of viaArchive) {
    h.push('<li>🔷 <strong>' + esc(id) + '</strong> — healthy via ' + esc(v.via) + '</li>');
  }
  if (!failing.length && !viaArchive.length) h.push('<li>✅ all sources fetching directly</li>');
  h.push('</ul>');

  h.push('<h2>Regulatory changes this week — ' + changed.length + ' source(s)</h2>');
  if (changed.length) {
    h.push('<ul>');
    for (const [id, v] of changed) h.push('<li><strong>' + esc(id) + '</strong> — content changed ' + esc(v.changedAt) + '</li>');
    h.push('</ul>');
  }
  if (regDocs.length) {
    h.push('<ul>');
    for (const f of regDocs) {
      const url = repo ? 'https://github.com/' + repo + '/blob/reg-watch-state/docs/research/auto/' + f : '';
      h.push('<li>📝 ' + (url ? '<a href="' + esc(url) + '">' + esc(f) + '</a>' : esc(f)) + ' — AI-drafted review for the MLRO</li>');
    }
    h.push('</ul>');
  }
  if (!changed.length && !regDocs.length) h.push('<ul><li>No regulatory content changes detected this week.</li></ul>');

  if (fatf) {
    h.push('<h2>FATF lists</h2><ul>');
    h.push('<li><strong>Black:</strong> ' + esc((fatf.black || []).join(', ') || 'none') + '</li>');
    h.push('<li><strong>Grey:</strong> ' + (fatf.grey || []).length + ' jurisdictions</li>');
    h.push('<li>' + (inWindow(fatf.updated, today) ? '⚠️ LIST MOVED this week (' + esc(fatf.updated) + ') — review the FATF list moves card' : 'No moves this week (last change ' + esc(fatf.updated || 'unknown') + ')') + '</li>');
    h.push('</ul>');
  }

  const lists = (sanctions && sanctions.sources) || {};
  if (Object.keys(lists).length) {
    h.push('<h2>Sanctions lists</h2><ul>');
    for (const [id, v] of Object.entries(lists)) {
      const movedNow = inWindow(v.changedAt, today);
      h.push('<li>' + (v.error ? '❌' : movedNow ? '⚠️' : '✅') + ' <strong>' + esc(id) + '</strong> — '
        + (v.error ? esc(v.error) : movedNow ? 'changed ' + esc(v.changedAt) : 'no change this week') + '</li>');
    }
    h.push('</ul>');
  }

  const subjects = Object.values((screen && screen.subjects) || {});
  h.push('<h2>Customer screening — ' + subjects.length + ' open flag(s)</h2>');
  if (subjects.length) {
    h.push('<ul>');
    for (const s of subjects) {
      h.push('<li>' + (s.recommendation === 'sanctions-match' ? '⛔' : '⚠️') + ' <strong>' + esc(s.name) + '</strong> ('
        + esc(s.jurisdiction || '') + ') — ' + esc(s.recommendation || 'review') + ' · ' + esc((s.lists || []).join(', '))
        + ' · last seen ' + esc(s.lastSeen || '') + '</li>');
    }
    h.push('</ul>');
  } else {
    h.push('<ul><li>✅ no open screening flags</li></ul>');
  }

  h.push('<em>Delivered every Monday 09:00 UAE. Detection is automatic; applying any wording change stays a reviewed decision.</em>');
  const link = runUrl();
  if (link) h.push('<a href="' + esc(link) + '">View the workflow run</a>');

  const html = '<body>' + h.join('') + '</body>';
  const plain = title + '\n\nPipelines: ' + pipelines.filter(p => p.conclusion === 'success').length + '/' + pipelines.length + ' green'
    + '\nSources healthy: ' + healthy.length + '/' + entries.length
    + '\nChanged this week: ' + changed.length
    + '\nOpen screening flags: ' + subjects.length
    + (link ? '\n\nWorkflow run: ' + link : '');
  return { title, html, plain };
}

/* ── Runner ── */
function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

async function latestRuns(repo, token) {
  const out = [];
  for (const p of PIPELINES) {
    let conclusion = null, date = null;
    try {
      const r = await fetch('https://api.github.com/repos/' + repo + '/actions/workflows/' + p.file + '/runs?per_page=1&status=completed', {
        headers: { 'authorization': 'Bearer ' + token, 'accept': 'application/vnd.github+json', 'user-agent': 'HawkeyeSterling-WeeklySummary' }
      });
      if (r.ok) {
        const j = await r.json();
        const run = j.workflow_runs && j.workflow_runs[0];
        if (run) { conclusion = run.conclusion; date = run.run_started_at; }
      } else {
        console.warn('runs API ' + p.file + ': HTTP ' + r.status);
      }
    } catch (e) {
      console.warn('runs API ' + p.file + ': ' + String(e && e.message || e).slice(0, 120));
    }
    out.push({ ...p, conclusion, date });
  }
  return out;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const repo = process.env.GITHUB_REPOSITORY || '';
  const token = process.env.GITHUB_TOKEN || '';

  const regState = readJson('data/reg-watch-state.json');
  const fatf = readJson('data/fatf-state.json');
  const sanctions = readJson('data/sanctions-state.json');
  const screen = readJson('data/sanctions-screen-state.json');
  const regDocs = existsSync('docs/research/auto')
    ? readdirSync('docs/research/auto')
        .filter(f => /^REG-UPDATE-\d{4}-\d{2}-\d{2}\.md$/.test(f) && inWindow(f.slice(11, 21), today))
        .sort()
    : [];
  const pipelines = (repo && token) ? await latestRuns(repo, token) : [];

  const { title, html, plain } = buildWeeklySummary({ today, regState, fatf, sanctions, screen, regDocs, pipelines, repo });
  console.log(plain);
  writeFileSync('weekly-summary.md', plain + '\n'); /* for the issue fallback */

  if (!asanaEnabled()) {
    console.error('weekly-summary: ASANA_ACCESS_TOKEN not set — cannot deliver; falling back to a GitHub issue.');
    process.exit(3);
  }
  try {
    const section = process.env.ASANA_WEEKLY_SECTION_GID || undefined;
    const url = await notifyAsana(title, plain, { project: REG_PROJECT_GID, html, section });
    console.log('weekly-summary: Asana card created' + (url ? ' — ' + url : ''));
  } catch (e) {
    console.error('weekly-summary: Asana delivery failed (' + (e && e.message || e) + '); falling back to a GitHub issue.');
    process.exit(3);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
