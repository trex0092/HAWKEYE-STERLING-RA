/* Delivery watchdog — did TODAY's Daily AML/CFT Screening Report actually
   reach Asana, independent of whether the run that produced it exited 0?

   WHY THIS EXISTS, AND WHY FRESHNESS CHECK DOES NOT ALREADY COVER IT
   -------------------------------------------------------------------
   screen.py's EOCN review gate (enforce_eocn_review_gate) deliberately
   sys.exit(3)s AFTER a fully successful screening + delivery, so the
   weekly-adverse-media.yml run conclusion is "failure" on a day that
   delivered fine. Freshness Check asks the Actions API for a SUCCESSFUL run
   inside the cadence window -- which the EOCN gate makes permanently false
   regardless of delivery, for as long as the EOCN review stays overdue. That
   is already known and intentionally left as-is pending the EOCN
   reconciliation. This watchdog checks the actual deliverable instead of the
   exit code: did a "Daily AML/CFT Screening Report" task get FILED in Asana
   today? That signal is independent of the gate, and of which attempt
   (scheduled or a control-retry.yml self-healing pass) produced it.

   CONTEXT (2026-09-08 sample)
   ----------------------------
   The run that files this report was killed mid-flight ("the runner has
   received a shutdown signal") on 12 of 18 recent attempts (67%). Cause not
   identified: job timeout (350min, not close), step timeout (none exists),
   console silence (ruled out directly -- a heartbeat-instrumented run was
   still killed), a public GitHub incident (no record at any failure
   timestamp), and harden-runner egress volume (a longer, heavier run
   completed with a clean egress audit) were all checked and ruled out.
   Every sampled day still delivered, via the self-healing retry passes. This
   watchdog exists for the day that doesn't -- a killed run alone produces no
   distinct alert beyond the red badges that are already expected daily
   because of the EOCN gate, so without this check a true delivery gap would
   look identical to an ordinary day.

   Runs once, late in the UTC day (see the workflow's cron comment) so every
   scheduled run and both self-healing retry passes have had their chance.

   DEADLINE: modeled on asana-alert.mjs's own bound (hardened 2026-08-02
   after this exact class of issue -- a stalled Asana call silently eating
   the job's timeout instead of failing fast). The project this reads from
   accumulates tasks daily and pagination is uncapped in practice, so this
   check gets the same explicit deadline rather than trusting the job-level
   timeout-minutes to be the only backstop.

   The matching logic is exported and unit-tested offline
   (test/delivery-watchdog.test.mjs), same split as advisor-bias-eval.mjs's
   level(): the network call runs only as main. */
import { listProjectTasks, asana } from './asana-notify.mjs';

// HAWKEYE STERLING APP -- where screen.py now files the daily report (see
// screen.py's ASANA_ONGOING_MON_GID). RETIRED 2026-09-15: this used to read
// the separate "Sanctions/Media/PEP - Monitoring" project (old value
// '1213914392047129'), which was merged into HAWKEYE STERLING APP -- the
// watchdog is repointed here so it reads the report's actual current home
// instead of a deleted project (which would always show as "never delivered").
export const PROJECT_GID = process.env.SCREENING_PROJECT_GID || '1216203370612914';
export const TITLE_PREFIX = 'Daily AML/CFT Screening Report';

/* Pure: which tasks are a screening report filed on `today` (UTC date
   string, e.g. "2026-09-08")? Split out so this can be unit-tested without
   a live Asana project -- the exact same reasoning advisor-bias-eval.mjs
   gives for exporting level() rather than only testing it via main(). */
export function findTodaysReports(tasks, today, titlePrefix = TITLE_PREFIX) {
  return (tasks || []).filter(t => {
    const name = String((t && t.name) || '');
    if (!name.startsWith(titlePrefix)) return false;
    return String((t && t.created_at) || '').slice(0, 10) === today;
  });
}

/* Which UTC day's report is DUE at `nowMs`? The report is due once the
   scheduled run and both self-healing retry passes have had their chance --
   the hour the workflow's own cron fires (18:00 UTC). control-retry.yml
   (scripts/workflow-recovery.mjs) also dispatches this watchdog whenever it
   has no successful run "today", which happens just after 00:00 UTC. Judging
   TODAY's report then raised "NO DAILY SCREENING REPORT FILED TODAY" alarms
   in Asana for a report that was not due yet (2026-09-30 00:44, 2026-10-01
   01:28 UTC; both days' reports were filed within hours). Before the due
   hour the check verifies the PREVIOUS UTC day instead: a day that IS due,
   so the result is never green on unverified state, and a genuinely missing
   report still fails loudly. */
export const REPORT_DUE_UTC_HOUR = 18;
export function reportDayToVerify(nowMs, dueHourUtc = REPORT_DUE_UTC_HOUR) {
  const now = new Date(nowMs);
  const day = now.getUTCHours() >= dueHourUtc ? now : new Date(nowMs - 86400000);
  return day.toISOString().slice(0, 10);
}

/* FULL RESULTS: from 2 Oct 2026 every report task carries the complete report
   and the results register as attachments (#727) — the card itself is capped by
   Asana's notes limit, so a report without them delivered only its top
   findings. A report filed WITHOUT both attachments is therefore not a complete
   delivery. Days before the cutover pre-date the feature and are judged on the
   report alone (no false alarm on history). Pure — unit-tested. */
export const FULL_RESULTS_SINCE = '2026-10-02';
export const FULL_REPORT_RE = /^full-screening-report-\d{4}-\d{2}-\d{2}\.txt$/;
export const REGISTER_RE = /^screening-results-register-\d{4}-\d{2}-\d{2}\.csv$/;
export function fullResultsRequired(day, since = FULL_RESULTS_SINCE) {
  return String(day) >= since;
}
export function hasFullResults(attachmentNames) {
  const names = (attachmentNames || []).map(n => String(n || ''));
  return names.some(n => FULL_REPORT_RE.test(n)) && names.some(n => REGISTER_RE.test(n));
}

const DEADLINE_MS = 90000; // same bound as asana-alert.mjs, same rationale

/* Evidence for one UTC day: was the report filed and, from the full-results
   cutover, does one of that day's reports carry BOTH full-results files?
   Shared by this watchdog and the 09:00-UAE deadline guard
   (workflow-recovery.mjs --guard), so both judge delivery identically.
   Resolves { delivered, reason, url }; THROWS when Asana cannot be read --
   an unread day is unverifiable, never "delivered" and never "missing".
   Dependencies are injectable for the offline tests. */
export async function reportEvidence(day, {
  listTasks = listProjectTasks, listAttachments = gid => asana('/attachments?parent=' + gid + '&limit=100&opt_fields=name'),
  project = PROJECT_GID, deadlineMs = DEADLINE_MS,
} = {}) {
  let timer;
  // clearTimeout in the finally below is required, not cosmetic: an
  // uncleared timer keeps Node alive until it fires, so a FAST successful
  // check would otherwise still hang for the full deadline before exiting.
  const timedOut = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('exceeded ' + deadlineMs + 'ms deadline')), deadlineMs);
  });
  let tasks;
  try {
    tasks = await Promise.race([listTasks(project), timedOut]);
  } catch (e) {
    throw new Error('could not read Asana project ' + project + ' (' + String(e && e.message || e).slice(0, 200)
      + ') -- delivery is UNVERIFIABLE, which is not the same as delivered');
  } finally {
    clearTimeout(timer);
  }
  if (!Array.isArray(tasks)) throw new Error('Asana project ' + project + ' returned no task list -- delivery is UNVERIFIABLE');

  const todays = findTodaysReports(tasks, day);
  if (!todays.length) {
    return { delivered: false, reason: 'NO "' + TITLE_PREFIX + '" task found for ' + day + ' (UTC) in project ' + project };
  }
  if (!fullResultsRequired(day)) {
    return { delivered: true, reason: todays.length + ' report(s) filed for ' + day + ' (UTC)',
      url: todays.map(t => t.permalink_url || t.name).join(', ') };
  }
  // At least one of the day's reports must carry BOTH full-results files.
  for (const t of todays) {
    let res;
    try {
      res = await listAttachments(t.gid);
    } catch (e) {
      throw new Error('could not list attachments of ' + (t.permalink_url || t.gid) + ' ('
        + String(e && e.message || e).slice(0, 200) + ') -- full-results delivery is UNVERIFIABLE');
    }
    const names = (res && Array.isArray(res.data) ? res.data : []).map(a => a && a.name);
    if (hasFullResults(names)) {
      return { delivered: true, reason: 'report with full results filed for ' + day + ' (UTC)',
        url: t.permalink_url || t.name };
    }
  }
  return { delivered: false, reason: 'report(s) filed for ' + day + ' (UTC) but NONE carries the full-results '
    + 'attachments (full-screening-report-*.txt + screening-results-register-*.csv) -- only the capped '
    + 'card reached Asana: ' + todays.map(t => t.permalink_url || t.name).join(', ') };
}

async function main() {
  if (!process.env.ASANA_ACCESS_TOKEN) {
    console.error('delivery-watchdog: ASANA_ACCESS_TOKEN missing -- cannot verify delivery; treating as a failure (an unread day is not a delivered day).');
    process.exit(2);
  }

  const today = reportDayToVerify(Date.now()); // the UTC day whose report is due (matches Asana's created_at)
  let ev;
  try {
    ev = await reportEvidence(today);
  } catch (e) {
    console.error('delivery-watchdog: ' + String(e && e.message || e));
    process.exitCode = 2;
    return;
  }
  if (ev.delivered) {
    console.log('delivery-watchdog: OK -- ' + ev.reason + ': ' + ev.url);
    return;
  }
  console.error('delivery-watchdog: ' + ev.reason + ' -- the daily sanctions/PEP/adverse-media screening has NOT '
    + 'been evidenced as fully delivered.');
  process.exitCode = 1;
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
