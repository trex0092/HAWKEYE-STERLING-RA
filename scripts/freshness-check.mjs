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
   either here or in the justified EXEMPT list below;
   test/freshness-check.test.mjs fails otherwise, so a new scheduled control
   cannot silently sit outside the alarm the way the weekly/quarterly evals
   once did. */
export const CONTROLS = [
  { id: 'sanctions-watch.yml',      name: 'Sanctions Watch',                                       cadence: 'daily',     maxAgeDays: 0 },
  { id: 'weekly-adverse-media.yml', name: 'Daily Screening (Sanctions + Adverse Media + PEP)',     cadence: 'daily',     maxAgeDays: 0 },
  { id: 'regulatory-watch.yml',     name: 'Regulatory Watch',                                      cadence: 'daily',     maxAgeDays: 0 },
  { id: 'sanctions-screen.yml',     name: 'Sanctions Screen (case engine)',                        cadence: 'daily',     maxAgeDays: 0 },
  { id: 'fatf-watchdog.yml',        name: 'FATF Watchdog (country lists)',                         cadence: 'daily',     maxAgeDays: 0 },
  { id: 'onboarding-screen.yml',    name: 'Onboarding Screen (6-hourly)',                          cadence: 'daily',     maxAgeDays: 0 },
  { id: 'advisor-eval.yml',         name: 'Advisor Guardrail Eval (weekly)',                       cadence: 'weekly',    maxAgeDays: 8 },
  { id: 'pep-worldwide.yml',        name: 'PEP Worldwide Harvest (weekly)',                        cadence: 'weekly',    maxAgeDays: 8 },
  { id: 'advisor-bias-eval.yml',    name: 'Advisor Bias Eval (quarterly)',                         cadence: 'quarterly', maxAgeDays: 96 },
  { id: 'quarterly-review.yml',     name: 'Quarterly Screening Review',                            cadence: 'quarterly', maxAgeDays: 96 },
];

/* Scheduled workflows deliberately NOT freshness-monitored, with the reason.
   Lives beside CONTROLS so the classification of every scheduled workflow
   reads in one place; test/freshness-check.test.mjs fails whenever a
   scheduled workflow appears in neither set. */
export const EXEMPT = {
  'a11y.yml': 'accessibility scan; quality gate, not an ingestion/eval duty',
  'anomaly-watch.yml': 'meta-monitor over run metrics; opens its own issues on anomaly',
  'asana-reconcile.yml': 'mirror reconciliation; self-alerting on divergence',
  'attestation-verify.yml': 'supply-chain posture verification of the published image; red badge is the alarm, no ingestion duty',
  'codeql.yml': 'security scanner; also gates every push/PR',
  'compliance-calendar.yml': 'dated reminder feed from data/compliance-calendar.json; occurrences are title-deduped, due-dated Asana tasks filed inside a ≥14-day lead window with a 7-day grace tail — a missed weekly run delays a reminder inside its window and the overdue task surfaces in Asana; no ingestion duty',
  'container-scan.yml': 'security scan of the published image (post-publication CVE watch); red badge is the alarm',
  'control-retry.yml': 'self-healing dispatcher over the daily controls above; the controls themselves are what this alarm monitors, and a dead dispatcher just means a missing control stays missing — which this alarm then catches',
  'daily-brief.yml': 'reporting digest; absence is recipient-noticed, no ingestion duty — and the next brief anchors its window to the previous brief, so a missed or delayed run is absorbed into the following brief rather than leaving alerts in no brief at all',
  'dependabot-autorebase.yml': 'repo-hygiene sweep that asks Dependabot to rebase auto-merge-armed PRs stranded behind main; a missed firing only delays a bump until the next sweep or push-to-main, and a stalled bump stays owner-visible on the open-PR list — no ingestion/eval duty',
  'eocn-reconcile.yml': 'prepares the weekly EOCN review branch + files the sign-off task; the review duty itself is enforced by the daily screening review-age gate (exit 3 past 7 days), which is what this alarm monitors',
  'dast-zap.yml': 'security scan of the deployed site',
  'freshness-check.yml': 'this alarm itself',
  'function-health.yml': 'site operations probe; self-alerting',
  'governance-report.yml': 'reports ON control state; the controls it reads are monitored individually',
  'link-check.yml': 'documentation hygiene',
  'osv-scanner.yml': 'security scan',
  'scorecard.yml': 'security posture scan',
  'scorecard-milestone.yml': 'one-shot dated reminder (files the 2026-09-09 Scorecard 9.0 verification task); date-guarded and title-deduped, deleted after sign-off — no recurring ingestion/eval duty',
  'site-currency.yml': 'production-deploy currency probe (live APP_VERSION vs main); self-alerting to Asana on drift, red badge is the alarm',
  'site-health.yml': 'site operations probe; self-alerting',
  'stale.yml': 'repository housekeeping',
  'weekly-summary.yml': 'MLRO digest; absence is recipient-noticed each Monday, no ingestion duty',
};

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
   run later fails, and the next check re-verifies. A control whose API query
   FAILED (queryError set) is excluded here: a failed query is not evidence
   the control missed its window - unknownControls() reports those honestly.
   statuses: [{ id, name, cadence, maxAgeDays, lastSuccessDay, pendingToday?,
   queryError? }]. */
export function staleControls(statuses, today) {
  return statuses
    .filter(s => !s.queryError && isStale(s.lastSuccessDay, today, s.maxAgeDays) && !s.pendingToday)
    .map(s => ({ id: s.id, name: s.name, cadence: s.cadence || 'daily',
                 maxAgeDays: s.maxAgeDays || 0, lastSuccessDay: s.lastSuccessDay || null }));
}

/* Controls whose status could NOT be verified because the last-success API
   query failed. Kept apart from staleControls: reporting a failed query as
   "never ran / STALE" (the old behavior, since a caught error left
   lastSuccessDay null) put a false claim in a compliance report. Unknown
   still fails the check - fail-closed - but under an honest label. */
export function unknownControls(statuses) {
  return (statuses || [])
    .filter(s => s.queryError)
    .map(s => ({ id: s.id, name: s.name, cadence: s.cadence || 'daily',
                 error: String(s.queryError) }));
}

export function buildReport(stale, today, total, unknown = []) {
  const lines = [`# Freshness Check — ${today}`, ''];
  if (!stale.length && !unknown.length) {
    lines.push(`All ${total} mandatory scheduled controls have a successful run inside their cadence window. ✅`);
  }
  if (stale.length) {
    lines.push(`**${stale.length} of ${total} mandatory scheduled control(s) have NO successful run inside their cadence window.**`, '');
    lines.push('| Control | Cadence | Window | Last successful run |', '| --- | --- | --- | --- |');
    for (const s of stale) {
      const window = (s.maxAgeDays || 0) === 0 ? 'today' : `${s.maxAgeDays} days`;
      lines.push(`| ${s.name} | ${s.cadence} | ${window} | ${s.lastSuccessDay || 'never'} |`);
    }
    lines.push('', 'A mandatory control outside its cadence window is a potential regulatory breach (e.g. UNSC / EOCN ingestion must run daily without delay; the Advisor evals evidence the AI assurance cadence). Investigate the schedule, the workflow status, and the runner before relying on the affected control.');
  }
  if (unknown.length) {
    lines.push('', `**${unknown.length} of ${total} control(s) could not be verified: the GitHub API query failed. Status UNKNOWN - a failed query is not evidence the control ran, and not evidence it missed its window.**`, '');
    lines.push('| Control | Cadence | Query error |', '| --- | --- | --- |');
    for (const u of unknown) {
      lines.push(`| ${u.name} | ${u.cadence} | ${u.error} |`);
    }
    lines.push('', 'Re-run this check once the API is reachable; until then treat the affected controls as unverified, not as fresh.');
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
  // The controls are independent: query them concurrently (at most 2 calls
  // each) instead of up to 18 sequential round-trips.
  const statuses = await Promise.all(CONTROLS.map(async c => {
    let day = null, pending = false, queryError = null;
    try { day = await lastSuccessDay(repo, token, c.id); }
    catch (e) {
      // A failed query means UNKNOWN, never "never ran": leaving day null
      // here used to make the control indistinguishable from one that truly
      // has no success on record. unknownControls() reports it separately.
      queryError = e.message;
      console.error(`  warn: could not query ${c.id}: ${e.message}`);
    }
    if (!queryError && isStale(day, today, c.maxAgeDays)) {
      // Only need the extra call when there's no success in-window — is it mid-run?
      try { pending = await pendingToday(repo, token, c.id, today); }
      catch (e) { console.error(`  warn: could not query in-progress ${c.id}: ${e.message}`); }
    }
    return { ...c, lastSuccessDay: day, pendingToday: pending, queryError };
  }));
  const stale = staleControls(statuses, today);
  const unknown = unknownControls(statuses);
  const report = buildReport(stale, today, CONTROLS.length, unknown);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n'); } catch { /* best effort */ }
  }
  // Fail-closed on both: a verified-stale control AND an unverifiable one
  // (the run can't attest freshness it never observed).
  if (stale.length || unknown.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
