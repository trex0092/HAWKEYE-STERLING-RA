/* Delivery watchdog unit tests. Exercises findTodaysReports() -- the pure
   matching logic -- offline, the same split advisor-bias-eval.mjs uses for
   level(): no live Asana project needed, no ASANA_ACCESS_TOKEN needed.
   Usage: node test/delivery-watchdog.test.mjs */
import { readFileSync } from 'node:fs';
import { TITLE as FALLBACK_TITLE, sanitizedAlert, findOpenDuplicate,
  deliverSecondaryAlert } from '../scripts/github-fallback-alert.mjs';
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
  // The guard's Sanctions Screen evidence is keyed on the delivery step's NAME:
  // renaming the step must fail here, not silently turn every day "not delivered".
  const { SANCTIONS_DELIVERY_STEP } = await import('../scripts/workflow-recovery.mjs');
  const ss = readFileSync(new URL('../.github/workflows/sanctions-screen.yml', import.meta.url), 'utf8');
  check('guard: sanctions-screen.yml still has the delivery step the guard reads',
    ss.includes('      - name: ' + SANCTIONS_DELIVERY_STEP + '\n        id: delivery\n'));
}


/* GitHub secondary delivery path is intentionally opt-in, separately from
   the Asana notifier. All tests mock the network and use generic context. */
{
  const env = { GITHUB_REPOSITORY: 'example-org/example-repo', GITHUB_RUN_ID: '12345',
    GITHUB_TOKEN: 'synthetic-test-token-123456', SECONDARY_ALERT_ENABLED: 'true' };
  const now = new Date('2026-10-08T08:00:00Z');
  const payload = sanitizedAlert(env, now);
  check('fallback alert contains run link without names, tokens or financial case data',
    payload.title === FALLBACK_TITLE &&
    payload.body.includes('https://github.com/example-org/example-repo/actions/runs/12345') &&
    !payload.body.includes(env.GITHUB_TOKEN) && /Do not post customer names/.test(payload.body));
  check('fallback rejects malformed trusted workflow context',
    (() => { try { sanitizedAlert({ ...env, GITHUB_REPOSITORY: '../evil' }, now); return false; }
      catch { return true; } })());
  check('existing open issue matches title but a PR with same title does not',
    findOpenDuplicate([{ state: 'open', title: FALLBACK_TITLE, number: 7 }])?.number === 7 &&
    findOpenDuplicate([{ state: 'open', title: FALLBACK_TITLE, pull_request: {} }]) === null);
  const success = (obj, status = 200) => ({
    ok: status >= 200 && status < 300, status, json: async () => obj
  });
  let called = 0;
  const fakeFetch = async (url, opts) => {
    called++;
    if (opts.method === 'GET') return success([]);
    return success({ number: 99, html_url: 'https://github.com/example-org/example-repo/issues/99' }, 201);
  };
  const off = await deliverSecondaryAlert({
    env: { ...env, SECONDARY_ALERT_ENABLED: 'false' }, fetchImpl: fakeFetch, now
  });
  check('fallback DISABLED by default sends no request and needs no token',
    off.state === 'DISABLED' && called === 0);
  const created = await deliverSecondaryAlert({ env, fetchImpl: fakeFetch, now });
  check('fallback creates one generic issue only after a successful no-duplicate lookup',
    created.state === 'CREATED' && created.number === 99 && called === 2);
  const exists = await deliverSecondaryAlert({ env, now, fetchImpl: async (_url, opts) => {
    called++;
    if (opts.method !== 'GET') throw Error('duplicate issue creation blocked');
    return success([{ state: 'open', title: FALLBACK_TITLE, number: 7 }]);
  } });
  check('fallback never creates duplicate while an existing alert is open',
    exists.state === 'ALREADY_OPEN' && exists.number === 7 && called === 3);
  let wroteOnFailedLookup = false;
  let failedClosed = false;
  try {
    await deliverSecondaryAlert({ env, now, fetchImpl: async (_url, opts) => {
      if (opts.method === 'POST') wroteOnFailedLookup = true;
      return success({ message: 'unavailable' }, 503);
    } });
  } catch { failedClosed = true; }
  check('failed GitHub list/authorization never falls through to a speculative POST',
    failedClosed && !wroteOnFailedLookup);
  let missingTokenDenied = false;
  try {
    await deliverSecondaryAlert({ env: { ...env, GITHUB_TOKEN: '' }, now,
      fetchImpl: fakeFetch });
  } catch { missingTokenDenied = true; }
  check('enabled fallback without a GitHub token fails loudly',
    missingTokenDenied);
  const workflow = readFileSync(new URL('../.github/workflows/delivery-watchdog.yml', import.meta.url), 'utf8');
  const fallback = workflow.slice(workflow.indexOf('\n  github-secondary-alert:'));
  check('independent issue notifier executes only after failed watchdog and explicit operator opt-in',
    fallback.includes("needs.check.result == 'failure'") &&
    fallback.includes("vars.SECONDARY_ALERT_ENABLED == 'true'") &&
    fallback.includes('needs: check'));
  check('fallback job uses scoped issues:write and avoids Asana token',
    /^\s{4}issues: write\s*$/m.test(fallback) &&
    /node scripts\/github-fallback-alert\.mjs/.test(fallback) &&
    !fallback.includes('ASANA_ACCESS_TOKEN'));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
