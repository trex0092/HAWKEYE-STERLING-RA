/* Unit tests for the freshness-check pure logic (offline; no network).
   Usage: node test/freshness-check.test.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { staleControls, isStale, daysBetween, utcDay, buildReport, CONTROLS } from '../scripts/freshness-check.mjs';

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
check('the control set includes the quarterly bias eval', CONTROLS.some(c => c.id === 'advisor-bias-eval.yml'));
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

// report content
check('green report mentions all controls fresh', /successful run inside their cadence window/.test(buildReport([], today, CONTROLS.length)));
const alarmReport = buildReport([{ id: 'sanctions-watch.yml', name: 'Sanctions Watch', cadence: 'daily', maxAgeDays: 0, lastSuccessDay: null }], today, CONTROLS.length);
check('alarm report lists the stale control', /Sanctions Watch/.test(alarmReport));
check('alarm report shows the cadence window', /daily/.test(alarmReport) && /today/.test(alarmReport));

/* ── Coverage meta-test ─────────────────────────────────────────────────────
   Every workflow with a `schedule:` cron must be either a monitored control
   (CONTROLS) or explicitly exempted here with a reason. This is the guard that
   would have caught the original gap: advisor-eval.yml / advisor-bias-eval.yml
   were scheduled compliance controls monitored by nothing. A new scheduled
   workflow now forces a deliberate classification. */
const EXEMPT = {
  'a11y.yml': 'accessibility scan; quality gate, not an ingestion/eval duty',
  'anomaly-watch.yml': 'meta-monitor over run metrics; opens its own issues on anomaly',
  'asana-reconcile.yml': 'mirror reconciliation; self-alerting on divergence',
  'codeql.yml': 'security scanner; also gates every push/PR',
  'daily-brief.yml': 'reporting digest; absence is recipient-noticed, no ingestion duty',
  'dast-zap.yml': 'security scan of the deployed site',
  'freshness-check.yml': 'this alarm itself',
  'function-health.yml': 'site operations probe; self-alerting',
  'governance-report.yml': 'reports ON control state; the controls it reads are monitored individually',
  'link-check.yml': 'documentation hygiene',
  'osv-scanner.yml': 'security scan',
  'scorecard.yml': 'security posture scan',
  'site-health.yml': 'site operations probe; self-alerting',
  'stale.yml': 'repository housekeeping',
  'weekly-summary.yml': 'MLRO digest; absence is recipient-noticed each Monday, no ingestion duty',
};
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wfDir = join(ROOT, '.github', 'workflows');
const scheduled = readdirSync(wfDir)
  .filter(f => /\.ya?ml$/.test(f))
  .filter(f => /^\s*schedule:\s*$/m.test(readFileSync(join(wfDir, f), 'utf8')));
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

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
