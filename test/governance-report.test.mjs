/* Offline unit tests for the pure logic of scripts/governance-report.mjs:
   control classification (incl. the STALE fail-safe), suite roll-up, task
   naming and the report body. No network. */
import {
  CONTROL_GROUPS, classifyRun, summarise, buildTaskName, buildReportNotes, dateLabel
} from '../scripts/governance-report.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

const NOW = Date.parse('2026-07-02T08:00:00Z');
const iso = (daysAgo) => new Date(NOW - daysAgo * 86400000).toISOString();

/* ── the control map itself ── */
const allFiles = CONTROL_GROUPS.flatMap(g => g.workflows.map(w => w.file));
check('control map covers all five pillars', CONTROL_GROUPS.length === 5);
check('control map lists 27 workflows with no duplicates',
  allFiles.length === 27 && new Set(allFiles).size === 27);
check('every control has a label and a cadence',
  CONTROL_GROUPS.every(g => g.workflows.every(w => w.label && w.cadence)));

/* ── classifyRun ── */
const daily = { file: 'x.yml', label: 'X', cadence: 'daily' };
const weekly = { file: 'y.yml', label: 'Y', cadence: 'weekly' };
const eventDriven = { file: 'z.yml', label: 'Z', cadence: 'push/PR' };

check('fresh successful daily run is a pass',
  classifyRun(daily, { status: 'completed', conclusion: 'success', created_at: iso(0) }, NOW).state === 'pass');
check('failed run is a fail with FAILED in the detail', (() => {
  const c = classifyRun(daily, { status: 'completed', conclusion: 'failure', created_at: iso(0) }, NOW);
  return c.state === 'fail' && c.detail.includes('FAILED');
})());
check('successful daily run older than 2 days is flagged STALE', (() => {
  const c = classifyRun(daily, { status: 'completed', conclusion: 'success', created_at: iso(4) }, NOW);
  return c.state === 'attention' && c.detail.includes('STALE');
})());
check('weekly run 8 days old is still inside its window',
  classifyRun(weekly, { status: 'completed', conclusion: 'success', created_at: iso(8) }, NOW).state === 'pass');
check('weekly run 10 days old is STALE',
  classifyRun(weekly, { status: 'completed', conclusion: 'success', created_at: iso(10) }, NOW).detail.includes('STALE'));
check('event-driven control is never stale',
  classifyRun(eventDriven, { status: 'completed', conclusion: 'success', created_at: iso(60) }, NOW).state === 'pass');
check('scheduled control with no run at all is a fail (never ran)',
  classifyRun(daily, null, NOW).state === 'fail');
check('REGRESSION: a FAILED run that is also stale stays a FAIL — staleness never softens red to amber', (() => {
  const c = classifyRun(daily, { status: 'completed', conclusion: 'failure', created_at: iso(5) }, NOW);
  return c.state === 'fail' && c.detail.includes('FAILED');
})());
check('event-driven control with no run is informational, not a failure',
  classifyRun(eventDriven, null, NOW).state === 'info');
check('in-progress run is informational',
  classifyRun(daily, { status: 'in_progress', created_at: iso(0) }, NOW).state === 'info');
check('cancelled run needs attention',
  classifyRun(daily, { status: 'completed', conclusion: 'cancelled', created_at: iso(0) }, NOW).state === 'attention');

/* ── summarise + verdict ── */
const allGreen = {};
for (const f of allFiles) allGreen[f] = { status: 'completed', conclusion: 'success', created_at: iso(0) };
const sGreen = summarise(allGreen, NOW);
check('all-green suite yields the ALL CONTROLS GREEN verdict',
  sGreen.fail === 0 && sGreen.verdict.includes('✅ ALL CONTROLS GREEN'));
check('summary counts every control once', sGreen.total === 27);

const oneRed = { ...allGreen, 'codeql.yml': { status: 'completed', conclusion: 'failure', created_at: iso(0) } };
const sRed = summarise(oneRed, NOW);
check('one failing control flips the verdict to FAILING',
  sRed.fail === 1 && sRed.verdict.includes('❌ 1 CONTROL FAILING'));

/* ── task name ── */
check('task name carries date and all-green flag',
  buildTaskName('2 Jul 2026', sGreen) === 'AI Governance & Platform Report — 2 Jul 2026 — ✅ all green');
check('task name flags failures', buildTaskName('2 Jul 2026', sRed).includes('❌ 1 failing'));

/* ── report body ── */
const notes = buildReportNotes({ label: '2 Jul 2026', summary: sGreen, alerts: { codeScanning: 0, dependabot: null }, runLink: 'https://example/run' });
check('report body carries all five pillar headings',
  ['🤖 AI / ADVISOR GOVERNANCE', '🔐 SECURITY & SUPPLY-CHAIN', '✅ CI / CODE QUALITY', '💓 APP / SITE HEALTH', '🚀 RELEASE & REPO HYGIENE']
    .every(h => notes.includes(h)));
check('report body states the overall verdict and the run link',
  notes.includes('OVERALL: ✅ ALL CONTROLS GREEN') && notes.includes('https://example/run'));
check('alert counts render, degrading to n/a without permission',
  notes.includes('Code-scanning alerts (CodeQL/Semgrep): 0 open') && notes.includes('Dependabot alerts:                     n/a (no permission)'));
check('governance mapping cites ISO 42001, NIST AI RMF and FATF R.15',
  notes.includes('ISO/IEC 42001') && notes.includes('NIST AI RMF') && notes.includes('FATF R.15'));
check('report keeps the human-in-the-loop line',
  notes.includes('Detection is automatic; remediation stays a reviewed decision.'));

/* ── date label ── */
check('dateLabel renders a UTC date as D Mon YYYY', dateLabel(new Date(Date.UTC(2026, 6, 2))) === '2 Jul 2026');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
