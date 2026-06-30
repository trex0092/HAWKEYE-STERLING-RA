/* Freshness Check — silent-failure alarm for the mandatory-daily controls.

   A daily compliance control that silently stops running is a regulatory
   breach, not just a red check. GitHub does not tell you when a *scheduled*
   workflow simply never fires (a bad cron, a disabled workflow, a runner
   outage) — there is no failure, just nothing. This guard closes that gap: it
   asks the GitHub Actions API whether each mandatory-daily watcher has a
   SUCCESSFUL run dated today (UTC) and fails loudly (red + the normal Actions
   email, plus an Asana alert from the workflow) if any of them is missing.

   Why not read `checkedAt` from data/sanctions-state.json? Because the watcher
   only COMMITS that file on a list change, so on a normal no-change day the
   committed `checkedAt` is legitimately stale — it cannot distinguish "nothing
   changed" from "the watcher never ran". Run success is the honest signal.

   The decision logic (staleControls) is pure and offline-tested; only the
   runner block touches the network. Usage: node scripts/freshness-check.mjs */
import { pathToFileURL } from 'node:url';

/* The mandatory-daily controls to verify. id = workflow file name (the API
   accepts the file name as the workflow identifier); name = human label. */
export const MANDATORY = [
  { id: 'sanctions-watch.yml',         name: 'Sanctions Watch' },
  { id: 'weekly-adverse-media.yml',    name: 'Daily Screening (Sanctions + Adverse Media + PEP)' },
  { id: 'regulatory-watch.yml',        name: 'Regulatory Watch' },
];

/* UTC calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function utcDay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/* Pure decision: given each control's last successful-run day, return the
   controls whose latest success is not `today` (never ran, ran but failed, or
   last succeeded on an earlier day). A control with a run that STARTED today but
   is still in progress is NOT stale — the alarm is for a control that did not
   FIRE today (bad cron / disabled / runner outage), not one that is mid-run (the
   daily full-coverage screen legitimately takes ~45 min). Its own failure path
   alerts separately if that run later fails, and tomorrow's check re-verifies.
   statuses: [{ id, name, lastSuccessDay, pendingToday? }]. */
export function staleControls(statuses, today) {
  return statuses
    .filter(s => s.lastSuccessDay !== today && !s.pendingToday)
    .map(s => ({ id: s.id, name: s.name, lastSuccessDay: s.lastSuccessDay || null }));
}

export function buildReport(stale, today, total) {
  const lines = [`# Freshness Check — ${today}`, ''];
  if (!stale.length) {
    lines.push(`All ${total} mandatory-daily controls have a successful run today. ✅`);
  } else {
    lines.push(`**${stale.length} of ${total} mandatory-daily control(s) have NO successful run today.**`, '');
    lines.push('| Control | Last successful run |', '| --- | --- |');
    for (const s of stale) lines.push(`| ${s.name} | ${s.lastSuccessDay || 'never'} |`);
    lines.push('', 'A mandatory-daily control that did not run today is a potential regulatory breach (e.g. UNSC / EOCN ingestion must run daily, without delay). Investigate the schedule, the workflow status, and the runner before relying on today\'s screening.');
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
   Used so the long daily screen doesn't trip a false "did not run" alarm while
   it is still running. */
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
  for (const c of MANDATORY) {
    let day = null, pending = false;
    try { day = await lastSuccessDay(repo, token, c.id); }
    catch (e) { console.error(`  warn: could not query ${c.id} — ${e.message}`); }
    if (day !== today) {
      // Only need the extra call when there's no success today — is it mid-run?
      try { pending = await pendingToday(repo, token, c.id, today); }
      catch (e) { console.error(`  warn: could not query in-progress ${c.id} — ${e.message}`); }
    }
    statuses.push({ id: c.id, name: c.name, lastSuccessDay: day, pendingToday: pending });
  }
  const stale = staleControls(statuses, today);
  const report = buildReport(stale, today, MANDATORY.length);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n'); } catch { /* best effort */ }
  }
  if (stale.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
