/* Screening accuracy benchmark — JS-backend CI gate (offline).
   Runs the labelled ground-truth corpus through the real JS engine via
   scripts/screening-benchmark.mjs and enforces the committed floors
   (test/fixtures/screening-benchmark/floors.json). Floors only ratchet UP —
   lowering one is a governance action, see
   docs/governance/screening-accuracy-benchmark.md.
   Usage: node test/screening-benchmark.test.mjs */
import { readFileSync } from 'node:fs';
import { computeAll, BACKEND } from '../scripts/screening-benchmark.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— screening accuracy benchmark (JS backend) —\n');

const floorsAll = JSON.parse(readFileSync(
  new URL('./fixtures/screening-benchmark/floors.json', import.meta.url), 'utf8'));
const floors = floorsAll.backends[BACKEND];
check('floors committed for backend ' + BACKEND, !!floors);

const m = computeAll();
const s = m.sanctions, a = m.adverse;
const eps = 1e-9;
const pct = x => (100 * x).toFixed(1) + '%';

console.log(`  recall ${s.recall.hits}/${s.recall.total} (${pct(s.recall.rate)}), ` +
  `negatives clear ${s.negatives.clear}/${s.negatives.total} (${pct(s.negatives.clear_rate)}), ` +
  `adverse ${a.classification.correct}/${a.classification.total} (${pct(a.classification.accuracy)})`);
if (s.recall.fn_ids.length) console.log('  missed: ' + s.recall.fn_ids.join(' '));
if (s.negatives.fp_ids.length) console.log('  false positives: ' + s.negatives.fp_ids.join(' '));
if (a.classification.wrong_ids.length) console.log('  misclassified: ' + a.classification.wrong_ids.join(' '));

if (floors) {
  check(`sanctions recall ${pct(s.recall.rate)} >= floor ${pct(floors.recall_min)}`,
    s.recall.rate + eps >= floors.recall_min);
  check(`hard-negative clear rate ${pct(s.negatives.clear_rate)} >= floor ${pct(floors.negative_clear_min)}`,
    s.negatives.clear_rate + eps >= floors.negative_clear_min);
  check(`adverse classification accuracy ${pct(a.classification.accuracy)} >= floor ${pct(floors.adverse_accuracy_min)}`,
    a.classification.accuracy + eps >= floors.adverse_accuracy_min);
  if (floors.fn_count_max != null) {
    check(`fn count ${s.recall.total - s.recall.hits} <= cap ${floors.fn_count_max}`,
      s.recall.total - s.recall.hits <= floors.fn_count_max);
  }
}

/* The corpus itself must stay structurally sound: every pair id unique, every
   item labelled with a known label — a malformed fixture must fail loudly here,
   never silently shrink the denominator. */
const recallFix = JSON.parse(readFileSync(new URL('./fixtures/screening-benchmark/recall-pairs.json', import.meta.url), 'utf8'));
const negFix = JSON.parse(readFileSync(new URL('./fixtures/screening-benchmark/hard-negatives.json', import.meta.url), 'utf8'));
const advFix = JSON.parse(readFileSync(new URL('./fixtures/screening-benchmark/adverse-headlines.json', import.meta.url), 'utf8'));
const ids = new Set();
let dup = 0;
for (const x of [...recallFix.pairs, ...negFix.pairs, ...advFix.items, ...advFix.repeat_scenarios]) {
  if (ids.has(x.id)) dup++;
  ids.add(x.id);
}
check('all fixture ids unique', dup === 0);
check('every recall pair has subject+listed+mechanism',
  recallFix.pairs.every(p => p.subject && p.listed && p.mechanism));
const LABELS = new Set(['adverse', 'noise', 'wrong-subject', 'clean']);
check('every adverse item carries a known label', advFix.items.every(i => LABELS.has(i.label)));
check('repeat scenarios all declare expected_repeat',
  advFix.repeat_scenarios.every(sc => typeof sc.expected_repeat === 'boolean' && sc.stories.length > 0));
check('benchmark reports the js backend', m.backend === BACKEND);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
