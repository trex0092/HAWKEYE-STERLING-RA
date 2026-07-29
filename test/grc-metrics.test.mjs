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
  /* ── 5. Appetite → tolerance ───────────────────────────────────────────────
     A position is a direction; a tolerance is a boundary someone is told about
     when it is crossed. Each of the three is required separately because each
     fails separately: a ceiling with no owner has nobody to breach to, an owner
     with no SLA has no clock, and a position with neither is a paragraph. */
  check('appetite "' + a.id + '" states a numeric residual ceiling (1-25)',
    Number.isInteger(a.residual_ceiling) && a.residual_ceiling >= 1 && a.residual_ceiling <= 25);
  check('appetite "' + a.id + '" names an operational owner', typeof a.owner === 'string' && a.owner.length > 0);
  check('appetite "' + a.id + '" states an escalation SLA', typeof a.escalation_sla === 'string' && a.escalation_sla.length > 20);
}
check('the appetite register explains how the residual ceilings were derived',
  typeof appetite.residual_ceiling_basis === 'string' && appetite.residual_ceiling_basis.length > 100);
/* Ceilings must be consistent per position type, or "ZERO" means one thing for
   sanctions and another for privacy and the vocabulary carries no information. */
const byPosition = new Map();
for (const a of appetite.appetite) {
  if (!byPosition.has(a.position)) byPosition.set(a.position, a.residual_ceiling);
  check('appetite "' + a.id + '" ceiling matches every other ' + a.position + ' position (' + a.residual_ceiling + ')',
    byPosition.get(a.position) === a.residual_ceiling);
}
/* A tighter appetite may not carry a looser ceiling. */
const zero = byPosition.get('ZERO'), low = byPosition.get('LOW');
check('ZERO carries a tighter ceiling than LOW (' + zero + ' < ' + low + ')', zero < low);

/* ── 6. Every risk is claimed by exactly one appetite position ─────────────
   An unclaimed risk is not scored against any ceiling, and an unscored risk is
   indistinguishable from a compliant one in a count. A risk claimed twice is
   scored against two different ceilings and the count double-reports it. */
const registerMd = read('docs/aims/ai-risk-register.md');
const registerIds = [...new Set([...registerMd.matchAll(/^\|\s*(R-\d+)\s*\|/gm)].map((m) => m[1]))];
check('parsed the AI risk register (' + registerIds.length + ' risks)', registerIds.length > 0);
const claims = new Map();
for (const a of appetite.appetite) {
  check('appetite "' + a.id + '" lists the risks it owns', Array.isArray(a.risks));
  for (const r of a.risks || []) claims.set(r, [...(claims.get(r) || []), a.id]);
}
for (const r of registerIds) {
  check('risk "' + r + '" is claimed by exactly one appetite position (' + (claims.get(r) || []).join(', ') + ')',
    (claims.get(r) || []).length === 1);
}
for (const [r] of claims) check('appetite claims a risk the register actually carries (' + r + ')', registerIds.includes(r));
check('no risk sits outside the appetite framework', computed.counters.risksWithoutAppetitePosition === 0);

/* The register states the residual score AND its likelihood/impact factors; a
   stated score that is not the product of its own factors is a transcription
   error that would silently move a row above or below its ceiling. */
const header = (registerMd.match(/^\|\s*ID\s*\|.*$/m) || [''])[0].split('|').map((c) => c.trim().toLowerCase());
const iRes = header.indexOf('residual');
for (const m of registerMd.matchAll(/^\|\s*(R-\d+)\s*\|.*$/gm)) {
  const cells = m[0].split('|');
  const score = Number((String(cells[iRes] || '').match(/\d+/) || [])[0]);
  const l = Number(String(cells[iRes - 2] || '').trim()), i = Number(String(cells[iRes - 1] || '').trim());
  check('risk "' + m[1] + '" residual score equals likelihood x impact (' + l + 'x' + i + '=' + score + ')', l * i === score);
}

/* ── 7. The snapshot carries the tolerance layer, not just the appetite ────
   The KRI block in the snapshot is a PROJECTION: a field added to
   data/risk-appetite.json and not copied into it never reaches a board pack.
   This is the check that catches that silent loss. */
for (const k of snap.kris || []) {
  check('snapshot KRI "' + k.id + '" carries its owner', typeof k.owner === 'string' && k.owner.length > 0);
  check('snapshot KRI "' + k.id + '" carries the escalation SLA of the position it measures',
    typeof k.escalation_sla === 'string' && k.escalation_sla.length > 20);
}
for (const k of appetite.kris) {
  check('KRI "' + k.id + '" names an owner', typeof k.owner === 'string' && k.owner.length > 0);
  if (k.threshold_amber) {
    check('KRI "' + k.id + '" amber band uses the same operator as its red line',
      k.threshold_amber.operator === k.threshold.operator && typeof k.threshold_amber.value === 'number');
    /* Amber must fire BEFORE red, or it is decoration. */
    check('KRI "' + k.id + '" amber band is reached before the red line',
      k.threshold.operator === '>=' ? k.threshold_amber.value > k.threshold.value : k.threshold_amber.value < k.threshold.value);
  }
}
check('snapshot names the risks above appetite rather than only counting them',
  Array.isArray((snap.appetite_scoring || {}).above_appetite)
  && snap.appetite_scoring.above_appetite.length === snap.counters.residualAboveAppetite);
check('every appetite position lists at least one KRI',
  appetite.appetite.every((a) => Array.isArray(a.kris) && a.kris.length > 0));
const kriIds = new Set(appetite.kris.map((k) => k.id));
for (const a of appetite.appetite) {
  for (const k of a.kris || []) check('appetite "' + a.id + '" references a real KRI (' + k + ')', kriIds.has(k));
}
/* Both directions: a KRI naming a position the position does not name back is
   a measure nobody has agreed measures them. */
for (const k of appetite.kris) {
  const pos = appetite.appetite.find((a) => a.id === k.appetite_ref);
  check('KRI "' + k.id + '" is listed by the position it claims to measure (' + k.appetite_ref + ')',
    !!pos && (pos.kris || []).includes(k.id));
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

/* ── 8. The breach ledger quotes lines that are still in force ─────────────
   The ledger is the history the snapshot cannot carry (it holds no timestamp by
   design). Its value depends entirely on the KRI IDs and metric names in it
   still meaning what they meant when the row was written, so both are pinned.
   Every currently-breached KRI must also appear in it — a breach the dashboard
   shows and the ledger does not is a breach with no recorded escalation. */
const ledger = read('docs/governance/kri-breach-ledger.md');
for (const m of ledger.matchAll(/\|\s*(KRI-\d+)\s*\|\s*`([A-Za-z]+)`/g)) {
  const k = appetite.kris.find((x) => x.id === m[1]);
  check('breach ledger row "' + m[1] + '" names a KRI still in the register', !!k);
  if (k) check('breach ledger row "' + m[1] + '" quotes the metric that KRI keys on (' + m[2] + ')', k.metric === m[2]);
}
for (const k of computed.kris.filter((x) => x.breached)) {
  check('breached KRI "' + k.id + '" is recorded in the breach ledger', ledger.includes(k.id));
}
check('breach ledger states the append-only rule', /append-only/i.test(ledger));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
