/* Freshness Check — silent-failure alarm for the mandatory scheduled controls.

   A scheduled compliance control that silently stops running is a regulatory
   breach, not just a red check. GitHub does not tell you when a *scheduled*
   workflow simply never fires (a bad cron, a disabled workflow, a runner
   outage) — there is no failure, just nothing. This guard closes that gap: it
   asks the GitHub Actions API when each mandatory control last SUCCEEDED and
   fails loudly (red + the normal Actions email, plus an Asana alert from the
   workflow) if any control has no success inside its cadence window:

     daily     — a successful run dated today (UTC)
     weekly    — a successful run within the last 8 days
     quarterly — a successful run within the last 96 days

   The windows carry one scheduling-slack day (weekly) / four days (quarterly,
   the 1 Jul → 1 Oct gap is 92 days) so an on-schedule control never alarms.

   Why not read `checkedAt` from data/sanctions-state.json? Because the watcher
   only COMMITS that file on a list change, so on a normal no-change day the
   committed `checkedAt` is legitimately stale — it cannot distinguish "nothing
   changed" from "the watcher never ran". Run success is the honest signal.

   The decision logic (staleControls) is pure and offline-tested; only the
   runner block touches the network. Usage: node scripts/freshness-check.mjs */
import { pathToFileURL } from 'node:url';

/* The mandatory scheduled controls to verify. id = workflow file name (the API
   accepts the file name as the workflow identifier); name = human label;
   cadence is documentation, maxAgeDays is the enforced window (0 = a success
   dated today). Every *scheduled* workflow in .github/workflows must appear
   either here or in the justified exempt list in test/freshness-check.test.mjs
   — the test fails otherwise, so a new scheduled control cannot silently sit
   outside the alarm the way the weekly/quarterly evals once did. */
export const CONTROLS = [
  { id: 'sanctions-watch.yml',      name: 'Sanctions Watch',                                       cadence: 'daily',     maxAgeDays: 0 },
  { id: 'weekly-adverse-media.yml', name: 'Daily Screening (Sanctions + Adverse Media + PEP)',     cadence: 'daily',     maxAgeDays: 0 },
  { id: 'regulatory-watch.yml',     name: 'Regulatory Watch',                                      cadence: 'daily',     maxAgeDays: 0 },
  { id: 'sanctions-screen.yml',     name: 'Sanctions Screen (case engine)',                        cadence: 'daily',     maxAgeDays: 0 },
  { id: 'fatf-watchdog.yml',        name: 'FATF Watchdog (country lists)',                         cadence: 'daily',     maxAgeDays: 0 },
  { id: 'onboarding-screen.yml',    name: 'Onboarding Screen (6-hourly)',                          cadence: 'daily',     maxAgeDays: 0 },
  { id: 'advisor-eval.yml',         name: 'Advisor Guardrail Eval (weekly)',                       cadence: 'weekly',    maxAgeDays: 8 },
  { id: 'advisor-bias-eval.yml',    name: 'Advisor Bias Eval (quarterly)',                         cadence: 'quarterly', maxAgeDays: 96 },
  { id: 'quarterly-review.yml',     name: 'Quarterly Screening Review',                            cadence: 'quarterly', maxAgeDays: 96 },
];

/* Deprecated alias kept for one release so external references keep working. */
export const MANDATORY = CONTROLS;

/* UTC calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function utcDay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/* Whole days from `fromDay` to `toDay` (YYYY-MM-DD each). null/garbage → null. */
export function daysBetween(fromDay, toDay) {
  if (!fromDay || !toDay) return null;
  const a = Date.parse(fromDay + 'T00:00:00Z');
  const b = Date.parse(toDay + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/* Pure decision: is a control with this last-success day outside its window? */
export function isStale(lastSuccessDay, today, maxAgeDays) {
  const age = daysBetween(lastSuccessDay, today);
  if (age === null) return true;            // never succeeded (or unparseable)
  return age > (maxAgeDays || 0);
}

/* Pure decision: given each control's last successful-run day, return the
   controls whose latest success falls outside the control's cadence window
   (never ran, ran but failed, or last succeeded too long ago). A control with
   a run that STARTED today but is still in progress is NOT stale — the alarm
   is for a control that did not FIRE inside its window (bad cron / disabled /
   runner outage), not one that is mid-run (the daily full-coverage screen
   legitimately takes ~45 min). Its own failure path alerts separately if that
   run later fails, and the next check re-verifies.
   statuses: [{ id, name, cadence, maxAgeDays, lastSuccessDay, pendingToday? }]. */
export function staleControls(statuses, today) {
  return statuses
    .filter(s => isStale(s.lastSuccessDay, today, s.maxAgeDays) && !s.pendingToday)
    .map(s => ({ id: s.id, name: s.name, cadence: s.cadence || 'daily',
                 maxAgeDays: s.maxAgeDays || 0, lastSuccessDay: s.lastSuccessDay || null }));
}

export function buildReport(stale, today, total) {
  const lines = [`# Freshness Check — ${today}`, ''];
  if (!stale.length) {
    lines.push(`All ${total} mandatory scheduled controls have a successful run inside their cadence window. ✅`);
  } else {
    lines.push(`**${stale.length} of ${total} mandatory scheduled control(s) have NO successful run inside their cadence window.**`, '');
    lines.push('| Control | Cadence | Window | Last successful run |', '| --- | --- | --- | --- |');
    for (const s of stale) {
      const window = (s.maxAgeDays || 0) === 0 ? 'today' : `${s.maxAgeDays} days`;
      lines.push(`| ${s.name} | ${s.cadence} | ${window} | ${s.lastSuccessDay || 'never'} |`);
    }
    lines.push('', 'A mandatory control outside its cadence window is a potential regulatory breach (e.g. UNSC / EOCN ingestion must run daily without delay; the Advisor evals evidence the AI assurance cadence). Investigate the schedule, the workflow status, and the runner before relying on the affected control.');
  }
  return lines.join('\n');
}

/* ── Network (runner only; not imported by tests) ── */
async function lastSuccessDay(repo, token, workflowId) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/runs`
    + `?status=success&per_page=1`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'hawkeye-freshness-check',
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${workflowId}`);
  const data = await res.json();
  const run = (data.workflow_runs || [])[0];
  return run ? utcDay(run.run_started_at || run.created_at) : null;
}

/* Whether the workflow has a run that STARTED today and is still executing
   (queued / in_progress / waiting) — i.e. the control fired today and is mid-run.
   Used so a long screen or an eval running right now doesn't trip a false
   "did not run" alarm while it is still running. */
async function pendingToday(repo, token, workflowId, today) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/runs`
    + `?per_page=1`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'hawkeye-freshness-check',
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${workflowId}`);
  const data = await res.json();
  const run = (data.workflow_runs || [])[0];
  if (!run) return false;
  const active = ['queued', 'in_progress', 'requested', 'waiting', 'pending'].includes(run.status);
  return active && utcDay(run.run_started_at || run.created_at) === today;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!repo || !token) {
    console.error('freshness-check: GITHUB_REPOSITORY and GITHUB_TOKEN are required');
    process.exitCode = 1;
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const statuses = [];
  for (const c of CONTROLS) {
    let day = null, pending = false;
    try { day = await lastSuccessDay(repo, token, c.id); }
    catch (e) { console.error(`  warn: could not query ${c.id} — ${e.message}`); }
    if (isStale(day, today, c.maxAgeDays)) {
      // Only need the extra call when there's no success in-window — is it mid-run?
      try { pending = await pendingToday(repo, token, c.id, today); }
      catch (e) { console.error(`  warn: could not query in-progress ${c.id} — ${e.message}`); }
    }
    statuses.push({ ...c, lastSuccessDay: day, pendingToday: pending });
  }
  const stale = staleControls(statuses, today);
  const report = buildReport(stale, today, CONTROLS.length);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n'); } catch { /* best effort */ }
  }
  if (stale.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
