/* Offline unit tests for the pure logic of scripts/governance-report.mjs:
   control classification (incl. the STALE fail-safe), the register
   review-currency check, suite roll-up, GovernanceScore, task naming and the
   report body. No network. */
import { readFileSync } from 'node:fs';
import {
  CONTROL_GROUPS, classifyRun, classifyRegisterReview, summarise, addRow,
  governanceScore, previousScore, buildTaskName, buildReportNotes, dateLabel
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

/* ── register review currency ── */
check('recently-reviewed register passes',
  classifyRegisterReview({ last_reviewed: new Date(NOW - 10 * 86400000).toISOString().slice(0, 10) }, NOW).state === 'pass');
check('register unreviewed past the quarterly window is flagged REVIEW OVERDUE', (() => {
  const c = classifyRegisterReview({ last_reviewed: '2026-01-01' }, NOW);
  return c.state === 'attention' && c.detail.includes('REVIEW OVERDUE');
})());
check('register with a missing or unparseable review date is a straight fail',
  classifyRegisterReview({}, NOW).state === 'fail'
  && classifyRegisterReview({ last_reviewed: 'soon' }, NOW).state === 'fail');
check('the real register on disk currently classifies as pass or attention, never fail', (() => {
  const real = JSON.parse(readFileSync(new URL('../data/ai-assets.json', import.meta.url), 'utf8'));
  return classifyRegisterReview(real, Date.now()).state !== 'fail';
})());

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

check('addRow folds an extra row into its group, the counters and the verdict', (() => {
  const s = summarise(allGreen, NOW);
  addRow(s, '🤖 AI / ADVISOR GOVERNANCE', { label: 'reg', icon: '⚠', state: 'attention', detail: 'x' });
  return s.total === 28 && s.attention === 1
    && s.verdict.includes('NEEDS ATTENTION')
    && s.groups[0].rows.some(r => r.label === 'reg');
})());

/* ── GovernanceScore ── */
check('all-green suite scores 100', governanceScore(sGreen) === 100);
check('one red out of 27 scores 96 (26/27)', governanceScore(sRed) === 96);
check('attention counts half in the score',
  governanceScore({ pass: 1, fail: 0, attention: 1, info: 4 }) === 75);
check('score is null when only info rows exist',
  governanceScore({ pass: 0, fail: 0, attention: 0, info: 3 }) === null);

check('previousScore picks the latest prior scored report and ignores today', (() => {
  const names = [
    'AI Governance & Platform Report — 30 Jun 2026 — ✅ all green · score 100',
    'AI Governance & Platform Report — 1 Jul 2026 — ❌ 1 failing · score 96',
    'AI Governance & Platform Report — 2 Jul 2026 — ✅ all green · score 100',
    'Daily Compliance Brief — 1 Jul 2026'
  ];
  const p = previousScore(names, '2 Jul 2026');
  return !!p && p.label === '1 Jul 2026' && p.score === 96;
})());
check('previousScore is null when prior reports predate the score (never mis-parses)',
  previousScore(['AI Governance & Platform Report — 1 Jul 2026 — ✅ all green'], '2 Jul 2026') === null);

/* ── task name ── */
check('task name carries date, all-green flag and the composite score',
  buildTaskName('2 Jul 2026', sGreen) === 'AI Governance & Platform Report — 2 Jul 2026 — ✅ all green · score 100');
check('task name flags failures with the reduced score', (() => {
  const n = buildTaskName('2 Jul 2026', sRed);
  return n.includes('❌ 1 failing') && n.endsWith('· score 96');
})());
check('task name omits the score when nothing is scored',
  !buildTaskName('2 Jul 2026', { pass: 0, fail: 0, attention: 0, info: 3 }).includes('score'));

/* ── report body ── */
const notes = buildReportNotes({ label: '2 Jul 2026', summary: sGreen, alerts: { codeScanning: 0, dependabot: null }, runLink: 'https://example/run' });
check('report body carries all five pillar headings',
  ['🤖 AI / ADVISOR GOVERNANCE', '🔐 SECURITY & SUPPLY-CHAIN', '✅ CI / CODE QUALITY', '💓 APP / SITE HEALTH', '🚀 RELEASE & REPO HYGIENE']
    .every(h => notes.includes(h)));
check('report body states the overall verdict and the run link',
  notes.includes('OVERALL: ✅ ALL CONTROLS GREEN') && notes.includes('https://example/run'));
check('alert counts render, degrading to n/a without permission',
  notes.includes('Code-scanning alerts (CodeQL/Semgrep): 0 open') && notes.includes('Dependabot alerts:                     n/a (no permission)'));
check('report body carries the GovernanceScore with its method',
  notes.includes('GovernanceScore: 100/100 (pass=1 · attention=0.5 · fail=0; info excluded)'));
check('report body shows the delta against the previous report when one exists', (() => {
  const n = buildReportNotes({ label: '2 Jul 2026', summary: sGreen, alerts: {}, prev: { label: '1 Jul 2026', score: 96 } });
  return n.includes('GovernanceScore: 100/100') && n.includes('previous 96 on 1 Jul 2026 (Δ +4)');
})());
check('governance mapping cites ISO 42001, NIST AI RMF and FATF R.15',
  notes.includes('ISO/IEC 42001') && notes.includes('NIST AI RMF') && notes.includes('FATF R.15'));
check('report keeps the human-in-the-loop line',
  notes.includes('Detection is automatic; remediation stays a reviewed decision.'));

/* ── date label ── */
check('dateLabel renders a UTC date as D Mon YYYY', dateLabel(new Date(Date.UTC(2026, 6, 2))) === '2 Jul 2026');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
