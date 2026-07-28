/* GRC metrics test — the measurement layer, kept honest.

   scripts/grc-metrics.mjs computes six management ratios from committed
   artefacts; data/grc-metrics.json is the snapshot a board pack can quote. The
   snapshot's freshness is enforced by the CI drift check
   (`node scripts/grc-metrics.mjs --check`, run locally by scripts/run-tests.mjs).
   THIS suite enforces the things a drift check cannot:

     1. every metric states its basis — a number without a denominator
        definition is not a metric, it is a claim;
     2. every KRI in data/risk-appetite.json resolves to a metric the script
        actually computes, with a threshold the evaluator understands;
     3. an uninstrumented KRI must say why, and must never score as passing;
     4. the appetite the register states matches the appetite the Advisor is
        told to enforce (ZERO_TOLERANCE in brain-soul.js).

   Usage: node test/grc-metrics.test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { computeMetrics, SCANNERS } from '../scripts/grc-metrics.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

console.log('\n— GRC metrics test —\n');

const METRICS = ['controlEffectivenessRate', 'complianceCompletionRate', 'kriBreachRate',
  'overdueIssueRate', 'thirdPartyAssessmentCoverage', 'auditFindingClosureRate'];

/* ── 1. Snapshot shape ──────────────────────────────────────────────────── */
check('snapshot exists (data/grc-metrics.json)', existsSync(join(ROOT, 'data/grc-metrics.json')));
const snap = json('data/grc-metrics.json');
check('snapshot declares it is generated, not hand-edited', /grc-metrics\.mjs/.test(snap.generated_by || ''));
for (const m of METRICS) {
  check('snapshot carries metric "' + m + '"', !!snap.metrics && snap.metrics[m] !== undefined);
  const row = (snap.metrics || {})[m] || {};
  check('metric "' + m + '" states its basis', typeof row.basis === 'string' && row.basis.length > 20);
  check('metric "' + m + '" is a percentage or an explained null',
    row.value === null || (typeof row.value === 'number' && row.value >= 0 && row.value <= 100));
  if (row.value === null) check('null metric "' + m + '" explains why', /not instrumented/i.test(row.basis));
}
/* A snapshot with a timestamp would drift on every run and train people to
   ignore the check. */
check('snapshot carries no generation timestamp', !/\d{4}-\d{2}-\d{2}T/.test(JSON.stringify(snap)));

/* ── 2-3. KRI wiring ────────────────────────────────────────────────────── */
const appetite = json('data/risk-appetite.json');
const computed = await computeMetrics(ROOT);
const computable = new Set([...Object.keys(computed.counters), ...METRICS.filter((m) => m !== 'kriBreachRate')]);

check('appetite register lists KRIs', Array.isArray(appetite.kris) && appetite.kris.length > 0);
for (const k of appetite.kris) {
  check('KRI "' + k.id + '" names an appetite position', appetite.appetite.some((a) => a.id === k.appetite_ref));
  check('KRI "' + k.id + '" gives a rationale', typeof k.rationale === 'string' && k.rationale.length > 0);
  if (k.instrumented) {
    check('instrumented KRI "' + k.id + '" keys on a metric the script computes (' + k.metric + ')', computable.has(k.metric));
    check('instrumented KRI "' + k.id + '" has an understood threshold',
      !!k.threshold && ['>=', '<='].includes(k.threshold.operator) && typeof k.threshold.value === 'number');
  } else {
    check('uninstrumented KRI "' + k.id + '" states why', typeof k.not_instrumented_reason === 'string' && k.not_instrumented_reason.length > 20);
  }
}
const evaluated = new Map(computed.kris.map((k) => [k.id, k]));
for (const k of appetite.kris) {
  const e = evaluated.get(k.id);
  check('KRI "' + k.id + '" is evaluated by the script', !!e);
  if (e && !k.instrumented) check('uninstrumented KRI "' + k.id + '" scores null, never pass', e.breached === null && e.value === null);
}
const measurable = computed.kris.filter((k) => k.instrumented && k.breached !== null);
check('KRI breach rate denominator equals the instrumented KRI count',
  computed.metrics.kriBreachRate.denominator === measurable.length);

/* The CommonJS copy of the scanner allowlist in test/ai-assets.test.js cannot
   import the ESM constant, so it is pinned here instead of left to drift. */
const cjsCopy = new Set([...(read('test/ai-assets.test.js').match(/const SCANNERS = new Set\(\[([^\]]*)\]\)/) || [, ''])[1]
  .matchAll(/'([^']+)'/g)].map((m) => m[1]));
check('the CommonJS scanner allowlist matches the shared SCANNERS set',
  cjsCopy.size === SCANNERS.size && [...SCANNERS].every((s) => cjsCopy.has(s)));

/* ── 4. Stated appetite vs enforced appetite ────────────────────────────── */
const soul = read('netlify/functions/brain-soul.js');
const block = (soul.match(/const ZERO_TOLERANCE = \[([\s\S]*?)\n\];/) || [])[1] || '';
const codeList = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
check('parsed ZERO_TOLERANCE from brain-soul.js (' + codeList.length + ' thresholds)', codeList.length > 0);
check('appetite register mirrors every enforced zero-tolerance threshold',
  codeList.every((t) => (appetite.advisor_zero_tolerance || []).includes(t)));
check('appetite register claims no zero-tolerance threshold the code does not enforce',
  (appetite.advisor_zero_tolerance || []).every((t) => codeList.includes(t)));

/* Appetite positions must be enforced by something that exists, and every
   obligation an appetite row claims must be a real obligation. */
const obligations = new Set(json('data/obligations.json').obligations.map((o) => o.id));
for (const a of appetite.appetite) {
  check('appetite "' + a.id + '" names an enforcing control', Array.isArray(a.enforced_by) && a.enforced_by.length > 0);
  for (const p of a.enforced_by || []) check('appetite "' + a.id + '" enforcing path exists (' + p + ')', existsSync(join(ROOT, p)));
  for (const o of a.obligations || []) check('appetite "' + a.id + '" references a real obligation (' + o + ')', obligations.has(o));
  check('appetite "' + a.id + '" states a position', ['ZERO', 'LOW', 'MEASURED', 'BANDED'].includes(a.position));
}
check('appetite records that ratification is a board act, not an assumed one',
  /DRAFT/i.test((appetite.approval || {}).status || ''));
/* The band cutoffs the statement publishes must be the cutoffs the engine
   applies — an appetite quoting different numbers from the scoring code is the
   classic paper-vs-practice gap. */
const bandLine = (read('app.js').match(/const numericBand = total<=(\d+) \? 'CDD' : total<=(\d+) \? 'SDD' : 'EDD'/) || []);
check('parsed the engine band cutoffs from app.js', bandLine.length === 3);
if (bandLine.length === 3) {
  const bands = Object.fromEntries((appetite.scale.bands || []).map((b) => [b.band, b.max]));
  check('appetite CDD ceiling matches the engine (' + bands.CDD + ' vs ' + bandLine[1] + ')', String(bands.CDD) === bandLine[1]);
  check('appetite SDD ceiling matches the engine (' + bands.SDD + ' vs ' + bandLine[2] + ')', String(bands.SDD) === bandLine[2]);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
