/* Delivery watchdog unit tests. Exercises findTodaysReports() -- the pure
   matching logic -- offline, the same split advisor-bias-eval.mjs uses for
   level(): no live Asana project needed, no ASANA_ACCESS_TOKEN needed.
   Usage: node test/delivery-watchdog.test.mjs */
import { readFileSync } from 'node:fs';
import { findTodaysReports, TITLE_PREFIX, reportDayToVerify, REPORT_DUE_UTC_HOUR,
  hasFullResults, fullResultsRequired, FULL_RESULTS_SINCE, reportEvidence } from '../scripts/delivery-watchdog.mjs';

let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

console.log('\n— delivery-watchdog unit tests —\n');

const TODAY = '2026-09-08';
const YESTERDAY = '2026-09-07';

const matching = { name: TITLE_PREFIX + ' — ACTION REQUIRED — Sanctions 48 · Adverse Media 158 · PEP 5 — 08 Sep 2026', created_at: TODAY + 'T08:52:15.370Z', permalink_url: 'https://app.asana.com/x/1' };
const wrongDay = { name: TITLE_PREFIX + ' — 07 Sep 2026', created_at: YESTERDAY + 'T04:29:56.000Z' };
const wrongTitle = { name: 'Adverse-media case: Example Trading Co LLC', created_at: TODAY + 'T08:52:16.000Z' };
const noise = { name: 'PRODUCTION DRIFT: the live site is serving an older build', created_at: TODAY + 'T07:54:56.705Z' };

check('finds a report filed today', findTodaysReports([matching], TODAY).length === 1);
check('excludes a report from a different day', findTodaysReports([wrongDay], TODAY).length === 0);
check('excludes a same-day task with an unrelated title', findTodaysReports([wrongTitle], TODAY).length === 0);
check('excludes an unrelated task even filed today', findTodaysReports([noise], TODAY).length === 0);
check('empty task list finds nothing', findTodaysReports([], TODAY).length === 0);
check('handles multiple matches on the same day (a scheduled + a manual dispatch both delivering)',
  findTodaysReports([matching, { ...matching, permalink_url: 'https://app.asana.com/x/2' }], TODAY).length === 2);
check('a mix of matching and non-matching returns only the matches',
  findTodaysReports([matching, wrongDay, wrongTitle, noise], TODAY).length === 1);
check('tolerates null/undefined entries in the list without throwing',
  findTodaysReports([matching, null, undefined], TODAY).length === 1);
check('tolerates a missing created_at field (never matches, never throws)',
  findTodaysReports([{ name: TITLE_PREFIX + ' — no date' }], TODAY).length === 0);
check('tolerates an undefined tasks argument (returns empty, never throws)',
  findTodaysReports(undefined, TODAY).length === 0);
check('title match is prefix-based, not exact (real titles carry a stats suffix)',
  findTodaysReports([matching], TODAY, TITLE_PREFIX).length === 1
  && matching.name !== TITLE_PREFIX);
check('a custom titlePrefix argument is honoured (site-currency style reuse)',
  findTodaysReports([{ name: 'Custom Report XYZ', created_at: TODAY }], TODAY, 'Custom Report').length === 1);

/* The report is due at REPORT_DUE_UTC_HOUR (the workflow's 18:00 UTC cron).
   control-retry dispatched this watchdog just after midnight UTC and it judged
   a report that was not due yet, filing false "NO DAILY SCREENING REPORT
   FILED TODAY" alarms (2026-09-30 00:44, 2026-10-01 01:28 UTC). Before the
   due hour it must verify the PREVIOUS day, which is due. */
check('the due hour matches the workflow cron (18:00 UTC)', REPORT_DUE_UTC_HOUR === 18);
check('just after midnight UTC verifies the previous day (the regression: 2026-09-30 00:44)',
  reportDayToVerify(Date.parse('2026-09-30T00:44:00Z')) === '2026-09-29');
check('before the due hour verifies the previous day',
  reportDayToVerify(Date.parse('2026-10-01T17:59:59Z')) === '2026-09-30');
check('at the due hour verifies today', reportDayToVerify(Date.parse('2026-10-01T18:00:00Z')) === '2026-10-01');
check('late in the day verifies today', reportDayToVerify(Date.parse('2026-10-01T23:59:59Z')) === '2026-10-01');
check('the previous-day rollover crosses a month boundary',
  reportDayToVerify(Date.parse('2026-10-01T01:28:00Z')) === '2026-09-30');

// Full results (#727): from the cutover, a report must carry BOTH attachments.
check('full results: both attachments present → complete',
  hasFullResults(['full-screening-report-2026-10-02.txt', 'screening-results-register-2026-10-02.csv']));
check('full results: the report text alone is NOT complete',
  !hasFullResults(['full-screening-report-2026-10-02.txt']));
check('full results: the register alone is NOT complete',
  !hasFullResults(['screening-results-register-2026-10-02.csv', 'analyst-notes.csv']));
check('full results: no attachments is NOT complete', !hasFullResults([]) && !hasFullResults(null));
check('full results: required from the cutover day onward, never for history (no false alarm on 1 Oct)',
  FULL_RESULTS_SINCE === '2026-10-02' && fullResultsRequired('2026-10-02') && fullResultsRequired('2026-11-15')
  && !fullResultsRequired('2026-10-01'));

// reportEvidence (shared with the 09:00-UAE deadline guard): injected Asana.
{
  const DAY = '2026-10-02';
  const rep = gid => ({ gid, name: TITLE_PREFIX + ' — 02 Oct 2026', created_at: DAY + 'T01:00:00Z', permalink_url: 'https://app.asana.com/x/' + gid });
  const full = { data: [{ name: 'full-screening-report-2026-10-02.txt' }, { name: 'screening-results-register-2026-10-02.csv' }] };
  const ev = (tasks, atts = {}) => reportEvidence(DAY, { listTasks: async () => tasks,
    listAttachments: async gid => { const a = atts[gid]; if (a instanceof Error) throw a; return a || { data: [] }; } });
  const rejects = async p => { try { await p; return false; } catch { return true; } };

  check('evidence: a report with both full-results files is delivered', (await ev([rep('1')], { 1: full })).delivered === true);
  check('evidence: a capped card without its attachments is NOT delivered', (await ev([rep('1')])).delivered === false);
  check('evidence: any one of the day\'s reports carrying full results suffices',
    (await ev([rep('1'), rep('2')], { 2: full })).delivered === true);
  check('evidence: no report for the day is NOT delivered', (await ev([wrongDay, noise])).delivered === false);
  check('evidence: a pre-cutover day is judged on the report alone',
    (await reportEvidence('2026-09-08', { listTasks: async () => [matching], listAttachments: async () => { throw new Error('not called'); } })).delivered === true);
  check('evidence: an unreadable project THROWS (unverifiable, never "missing" or "delivered")',
    await rejects(reportEvidence(DAY, { listTasks: async () => { throw new Error('HTTP 503'); } })));
  check('evidence: a non-list project response THROWS', await rejects(ev(null)));
  check('evidence: an unreadable attachment list THROWS', await rejects(ev([rep('1')], { 1: new Error('HTTP 500') })));
  check('evidence: a hung Asana call is bounded by the deadline',
    await rejects(reportEvidence(DAY, { listTasks: () => new Promise(() => {}), deadlineMs: 20 })));
}

// The 09:00-UAE deadline guard is wired: only the dispatching firing guards,
// it holds the Asana token for evidence, and it alerts in Asana when it fails.
{
  const wf = readFileSync(new URL('../.github/workflows/screening-morning-dispatch.yml', import.meta.url), 'utf8');
  const guardJob = wf.slice(wf.indexOf('\n  guard:'));
  check('guard: a second job runs after the dispatch', wf.includes('\n  guard:') && /needs: dispatch/.test(guardJob));
  check('guard: runs only for the firing that dispatched (guard_day output)',
    /guard_day: \$\{\{ steps\.morning\.outputs\.guard_day \}\}/.test(wf)
    && /needs\.dispatch\.outputs\.guard_day != ''/.test(guardJob));
  check('guard: runs the guard mode with the Asana token and the day',
    /node scripts\/workflow-recovery\.mjs --guard/.test(guardJob)
    && /ASANA_ACCESS_TOKEN: \$\{\{ secrets\.ASANA_ACCESS_TOKEN \}\}/.test(guardJob)
    && /GUARD_DAY: \$\{\{ needs\.dispatch\.outputs\.guard_day \}\}/.test(guardJob));
  check('guard: may re-dispatch (actions: write) and outlives the 00:05→05:00 window',
    /actions: write/.test(guardJob) && Number((guardJob.match(/timeout-minutes: (\d+)/) || [])[1]) >= 320);
  check('guard: alerts in Asana on failure', /if: failure\(\)[\s\S]*asana-alert\.mjs[\s\S]*09:00 UAE/.test(guardJob));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
