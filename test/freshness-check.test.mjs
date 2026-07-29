/* Unit tests for the freshness-check pure logic (offline; no network).
   Usage: node test/freshness-check.test.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { staleControls, unknownControls, isStale, daysBetween, utcDay, buildReport, CONTROLS, EXEMPT } from '../scripts/freshness-check.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— freshness-check unit tests —\n');

// utcDay / daysBetween
check('utcDay extracts UTC date', utcDay('2026-06-25T05:01:33Z') === '2026-06-25');
check('utcDay null on empty', utcDay(null) === null);
check('utcDay null on garbage', utcDay('not-a-date') === null);
check('daysBetween counts whole days', daysBetween('2026-06-20', '2026-06-25') === 5);
check('daysBetween is 0 for the same day', daysBetween('2026-06-25', '2026-06-25') === 0);
check('daysBetween null on missing input', daysBetween(null, '2026-06-25') === null);

const today = '2026-06-25';

// isStale per cadence window
check('daily: success today is fresh', isStale(today, today, 0) === false);
check('daily: success yesterday is stale', isStale('2026-06-24', today, 0) === true);
check('weekly: success 6 days ago is fresh', isStale('2026-06-19', today, 8) === false);
check('weekly: success 9 days ago is stale', isStale('2026-06-16', today, 8) === true);
check('quarterly: success 92 days ago is fresh', isStale('2026-03-25', today, 96) === false);
check('quarterly: success 100 days ago is stale', isStale('2026-03-17', today, 96) === true);
check('never-succeeded is stale at any cadence', isStale(null, today, 96) === true);

// all fresh -> nothing stale
const allFresh = CONTROLS.map(c => ({ ...c, lastSuccessDay: today }));
check('no stale when all ran today', staleControls(allFresh, today).length === 0);

// one never ran
const oneNull = allFresh.map((s, i) => i === 0 ? { ...s, lastSuccessDay: null } : s);
let r = staleControls(oneNull, today);
check('flags a control that never succeeded', r.length === 1 && r[0].id === CONTROLS[0].id);
check('reports null lastSuccessDay as null', r[0].lastSuccessDay === null);

// one daily control stale (yesterday)
const oneStale = allFresh.map((s, i) => i === 1 ? { ...s, lastSuccessDay: '2026-06-24' } : s);
r = staleControls(oneStale, today);
check('flags a daily control whose last success was an earlier day', r.length === 1 && r[0].name === CONTROLS[1].name);

// weekly/quarterly controls inside their window are NOT stale even without a run today.
// This is the regression case for the original gap: the weekly guardrail eval and the
// quarterly bias eval sat entirely outside the old daily-only alarm.
const weekly = CONTROLS.find(c => c.cadence === 'weekly');
const quarterly = CONTROLS.find(c => c.cadence === 'quarterly');
check('the control set includes a weekly eval control', !!weekly && weekly.id === 'advisor-eval.yml');
check('the control set includes the quarterly bias eval',
  !!quarterly && CONTROLS.some(c => c.id === 'advisor-bias-eval.yml'));
const cadenceMix = CONTROLS.map(c => ({
  ...c,
  lastSuccessDay: c.cadence === 'weekly' ? '2026-06-20'      // 5 days ago: fresh
    : c.cadence === 'quarterly' ? '2026-04-01'               // 85 days ago: fresh
    : today,
}));
check('in-window weekly/quarterly controls are not flagged', staleControls(cadenceMix, today).length === 0);
const evalDead = CONTROLS.map(c => ({
  ...c,
  lastSuccessDay: c.id === 'advisor-bias-eval.yml' ? '2026-01-02' : today,  // 174 days: dormant
}));
r = staleControls(evalDead, today);
check('a dormant quarterly eval IS flagged', r.length === 1 && r[0].id === 'advisor-bias-eval.yml');

// a control that is mid-run today (no in-window success yet, but it fired) is NOT stale —
// the long daily screen must not trip a false "did not run" alarm while running.
const onePending = allFresh.map((s, i) => i === 1 ? { ...s, lastSuccessDay: '2026-06-24', pendingToday: true } : s);
check('an in-progress-today control is not flagged stale', staleControls(onePending, today).length === 0);
// but a control that never succeeded AND is not running today is still stale.
const pendingElsewhere = allFresh.map((s, i) => i === 1 ? { ...s, lastSuccessDay: null, pendingToday: false } : s);
check('a control neither successful nor running today is still stale', staleControls(pendingElsewhere, today).length === 1);

// a failed API query is UNKNOWN, never "stale/never ran" - the old behavior
// (caught error, lastSuccessDay left null) reported a transient GitHub API
// error as a control with no successful run on record, a false claim.
const oneErrored = allFresh.map((s, i) => i === 0
  ? { ...s, lastSuccessDay: null, queryError: 'GitHub API 500 for ' + s.id } : s);
check('a query error is not reported stale', staleControls(oneErrored, today).length === 0);
const unk = unknownControls(oneErrored);
check('a query error is reported unknown, carrying its error',
  unk.length === 1 && unk[0].id === CONTROLS[0].id && /500/.test(unk[0].error));
check('no unknowns when every query succeeded', unknownControls(allFresh).length === 0);

// report content
check('green report mentions all controls fresh', /successful run inside their cadence window/.test(buildReport([], today, CONTROLS.length)));
const alarmReport = buildReport([{ id: 'sanctions-watch.yml', name: 'Sanctions Watch', cadence: 'daily', maxAgeDays: 0, lastSuccessDay: null }], today, CONTROLS.length);
check('alarm report lists the stale control', /Sanctions Watch/.test(alarmReport));
check('alarm report shows the cadence window', /daily/.test(alarmReport) && /today/.test(alarmReport));
const unknownReport = buildReport([], today, CONTROLS.length, unk);
check('unknown report says UNKNOWN and never claims "never ran"',
  /could not be verified/.test(unknownReport) && /UNKNOWN/.test(unknownReport)
  && !/never ran/.test(unknownReport) && !/\| never \|/.test(unknownReport));
check('unknown report is not the green all-fresh report',
  !/cadence window\. ✅/.test(unknownReport));
check('a run with both stale and unknown reports both sections',
  (r => /NO successful run/.test(r) && /could not be verified/.test(r))(
    buildReport(staleControls(oneStale, today), today, CONTROLS.length, unk)));

/* ── Coverage meta-test ─────────────────────────────────────────────────────
   Every workflow with a `schedule:` cron must be either a monitored control
   (CONTROLS) or explicitly exempted (EXEMPT, exported beside CONTROLS so the
   whole classification reads in one place). This is the guard that would have
   caught the original gap: advisor-eval.yml / advisor-bias-eval.yml were
   scheduled compliance controls monitored by nothing. A new scheduled
   workflow now forces a deliberate classification. */
check('EXEMPT is a justified map (every entry carries a reason)',
  Object.keys(EXEMPT).length > 0
  && Object.values(EXEMPT).every(v => typeof v === 'string' && v.length > 10));

/* A workflow is "scheduled" if it declares a schedule trigger in any YAML
   spelling: block style (schedule: alone on its line, optionally with a
   trailing comment), a flow-style value (schedule: [...] / {...}), or a
   flow-style on: mapping (on: { schedule: [...] }). The previous regex
   required the colon to END the line, so a trailing comment or flow style
   would have silently dropped a scheduled workflow out of this
   classification. */
const isScheduled = (text) =>
  /^\s*schedule:\s*(#.*)?$/m.test(text)
  || /^\s*schedule:\s*[\[{]/m.test(text)
  || /^\s*on:\s*\{[^}]*\bschedule\b/m.test(text);
check('detects block-style schedule', isScheduled('on:\n  schedule:\n    - cron: "0 1 * * *"'));
check('detects schedule with a trailing comment', isScheduled('on:\n  schedule:  # daily\n    - cron: "0 1 * * *"'));
check('detects a flow-style schedule value', isScheduled('on:\n  schedule: [{cron: "0 1 * * *"}]'));
check('detects a flow-style on: mapping', isScheduled('on: { schedule: [ { cron: "0 1 * * *" } ] }'));
check('ignores an unscheduled workflow', !isScheduled('on:\n  workflow_dispatch:\n'));
check('ignores a commented-out schedule', !isScheduled('on:\n  workflow_dispatch:\n  # schedule:\n'));

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wfDir = join(ROOT, '.github', 'workflows');
const scheduled = readdirSync(wfDir)
  .filter(f => /\.ya?ml$/.test(f))
  .filter(f => isScheduled(readFileSync(join(wfDir, f), 'utf8')));
check('found scheduled workflows to classify', scheduled.length > 0);
const controlIds = new Set(CONTROLS.map(c => c.id));
for (const f of scheduled) {
  check(`scheduled workflow ${f} is a monitored control or justified-exempt`,
    controlIds.has(f) || typeof EXEMPT[f] === 'string');
}
// and every monitored control must actually exist and be scheduled
for (const c of CONTROLS) {
  check(`monitored control ${c.id} exists and is scheduled`, scheduled.includes(c.id));
}
// no workflow may be BOTH monitored and exempt (one classification each)
for (const f of Object.keys(EXEMPT)) {
  check(`exempt workflow ${f} is not also a monitored control`, !controlIds.has(f));
}

/* ── Cadence pinning ────────────────────────────────────────────────────────
   The maxAgeDays windows in CONTROLS assume each workflow's cron cadence.
   Pin the exact cron lines so a cadence change (a daily control quietly
   becoming monthly, say) fails here and forces a deliberate review of the
   control's window, instead of the alarm silently tolerating stale runs. */
const EXPECTED_CRONS = {
  'sanctions-watch.yml':      ['7 5 * * *'],
  // 03:07 and 06:07 are self-healing retry firings (preflight no-ops them
  // whenever the day already has a successful run) — the control is still
  // daily and its maxAgeDays window is unchanged; the retries can only ADD a
  // run on days an earlier firing died (as on 24-25 Jul, runner-VM
  // shutdowns). 06:07 exists because the first two slots sit 3h apart, so a
  // single 3-4h outage window could still cost the whole day.
  'weekly-adverse-media.yml': ['7 0 * * *', '7 3 * * *', '7 6 * * *'],
  'regulatory-watch.yml':     ['19 6 * * *'],
  'sanctions-screen.yml':     ['37 5 * * *'],
  'fatf-watchdog.yml':        ['7 6 * * *'],
  'onboarding-screen.yml':    ['11 */6 * * *'],
  'advisor-eval.yml':         ['9 8 * * 1'],
  'advisor-bias-eval.yml':    ['9 9 1 */3 *'],
  'quarterly-review.yml':     ['9 6 1 1,4,7,10 *'],
};
check('every monitored control has a pinned cron', CONTROLS.every(c => EXPECTED_CRONS[c.id]));
for (const c of CONTROLS) {
  const body = readFileSync(join(wfDir, c.id), 'utf8');
  const crons = [...body.matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)].map(m => m[1]);
  check(`control ${c.id} runs on its pinned cadence (${crons.join(' | ') || 'none'})`,
    JSON.stringify(crons) === JSON.stringify(EXPECTED_CRONS[c.id]));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
