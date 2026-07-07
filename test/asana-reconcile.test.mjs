/* Unit tests for the pure diff logic in scripts/asana-reconcile.mjs — the weekly
   RA ↔ Asana drift check. No network: only the exported pure helpers are used.
   Usage: node test/asana-reconcile.test.mjs */
import { reconcile, taskRef, taskBandScore, renderReport, isAssessmentTask } from '../scripts/asana-reconcile.mjs';

let passed = 0, failed = 0;
const check = (n, c) => { if (c) { passed++; console.log('  ok  ' + n); } else { failed++; console.log('FAIL  ' + n); } };

/* taskRef: external id (stamped by asana-task.js) wins; else the name prefix. */
check('taskRef prefers the external id', taskRef({ external: { gid: 'R-1' }, name: 'R-9 · X · CDD 5' }) === 'R-1');
check('taskRef falls back to the name prefix', taskRef({ name: 'R-9 · X Co · CDD 5' }) === 'R-9');
check('taskRef is empty for a delimiter-less name', taskRef({ name: 'No delimiter here' }) === '');

check('taskBandScore parses "· EDD 24"', (() => { const b = taskBandScore({ name: 'R · X · EDD 24' }); return b.band === 'EDD' && b.score === '24'; })());
check('taskBandScore parses a tokenised name "R · CDD 19"', (() => { const b = taskBandScore({ name: 'R · CDD 19' }); return b.band === 'CDD' && b.score === '19'; })());

/* isAssessmentTask: only real deliveries (external id, or a band-shaped name) are
   reconciled — housekeeping mirrors and governance/report/manual cards are not. */
check('isAssessmentTask true for an external-id delivery', isAssessmentTask({ name: 'R-1 · Co · CDD 19', external: { gid: 'R-1' } }) === true);
check('isAssessmentTask true for a band-shaped name (pre-external-id delivery)', isAssessmentTask({ name: 'R-2 · Co · EDD 24' }) === true);
check('isAssessmentTask false for a housekeeping mirror', isAssessmentTask({ name: 'ASSESSMENT REGISTER (auto-backup)' }) === false);
check('isAssessmentTask false for a governance ratification card', isAssessmentTask({ name: '✅ RATIFIED 2026-07-02 — AI Policy v1.0 · Stakeholder Impact Assessment · DPIA §6 (Luisa Fernanda, MLRO)' }) === false);
check('isAssessmentTask false for a delimiter-less manual note', isAssessmentTask({ name: 'Board deck slide 26 follow-up' }) === false);

const register = [
  { ref: 'A-1', entity: 'Alpha', outcome: 'CDD', total: 19, complete: true },
  { ref: 'A-2', entity: 'Beta',  outcome: 'EDD', total: 24, complete: true },   // delivery gap
  { ref: 'A-3', entity: 'Gamma', outcome: 'SDD', total: 21, complete: true },   // band mismatch
  { ref: 'A-4', entity: 'Delta', outcome: 'CDD', total: 19, complete: false }   // draft → not a gap
];
const tasks = [
  { gid: '1', name: 'A-1 · Alpha · CDD 19', external: { gid: 'A-1' } },
  { gid: '2', name: 'A-3 · Gamma · EDD 30', external: { gid: 'A-3' } },         // app SDD → mismatch
  { gid: '3', name: 'A-9 · Orphan · CDD 5', external: { gid: 'A-9' } },         // orphan
  { gid: '4', name: 'A-1 · Alpha · CDD 19', external: { gid: 'A-1' } },         // duplicate of A-1
  { gid: '5', name: 'ASSESSMENT REGISTER (auto-backup)' }                       // housekeeping → ignored
];
const d = reconcile(register, tasks);

check('flags the delivery gap (A-2 complete, no task)', d.deliveryGaps.length === 1 && d.deliveryGaps[0].ref === 'A-2');
check('a draft with no task is NOT a delivery gap (A-4)', !d.deliveryGaps.some(g => g.ref === 'A-4'));
check('flags the orphan (A-9 in Asana, not in the register)', d.orphans.some(o => o.ref === 'A-9'));
check('ignores housekeeping tasks (auto-backup) as orphans', !d.orphans.some(o => String(o.ref).includes('auto-backup')));
check('flags the band mismatch (A-3 app SDD vs Asana EDD)', d.mismatches.some(m => m.ref === 'A-3' && m.field === 'band' && m.app === 'SDD' && m.asana === 'EDD'));
check('flags the duplicate (A-1 has two tasks)', d.duplicates.some(x => x.ref === 'A-1' && x.count === 2));
check('summarises counts (register 4, non-housekeeping tasks 4)', d.counts.register === 4 && d.counts.tasks === 4);
check('total discrepancy count is correct', d.total === (d.deliveryGaps.length + d.orphans.length + d.mismatches.length + d.duplicates.length));

const report = renderReport(d);
check('report leaks no customer entity names (PII-free)', !report.includes('Alpha') && !report.includes('Beta') && !report.includes('Gamma'));
check('report names every discrepancy category present', /Delivery gaps/.test(report) && /Orphans/.test(report) && /mismatch/i.test(report) && /Duplicates/.test(report));

/* A clean state → no discrepancies, no card. */
const clean = reconcile(
  [{ ref: 'B-1', outcome: 'CDD', total: 19, complete: true }],
  [{ gid: '9', name: 'B-1 · Co · CDD 19', external: { gid: 'B-1' } }]
);
check('a fully-reconciled state reports zero discrepancies', clean.total === 0);

/* Regression (2026-07-06 run): a governance ratification card filed by a human into
   the app project — no external id, no risk-band token, but a " · " in its name —
   must NOT be reported as an orphan. Previously taskRef() took its leading name
   segment as a "ref" and the empty register made it a phantom discrepancy. */
const govCard = reconcile([], [
  { gid: 'g1', name: '✅ RATIFIED 2026-07-02 — AI Policy v1.0 · Stakeholder Impact Assessment · DPIA §6 (Luisa Fernanda, MLRO)', completed: true }
]);
check('a governance ratification card is not an orphan', govCard.orphans.length === 0);
check('a governance ratification card is not counted as a task', govCard.counts.tasks === 0);
check('empty register + only a governance card → zero discrepancies', govCard.total === 0);

/* A genuine assessment orphan (real delivery shape) is still caught even with an
   empty register — the reconciliation loses no real signal. */
const realOrphan = reconcile([], [{ gid: 'o1', name: 'Z-1 · Co · EDD 30', external: { gid: 'Z-1' } }]);
check('a real assessment delivery with no register entry is still an orphan', realOrphan.orphans.some(o => o.ref === 'Z-1'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
