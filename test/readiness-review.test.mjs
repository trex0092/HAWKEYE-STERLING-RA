/* Readiness-review currency guard. The enterprise readiness review is a scored
   point-in-time document; its 2 July edition still said "37 workflows" while
   the estate had grown to 46, and nobody was forced to notice. This guard pins
   the review's most recent re-score to the repository it claims to describe:
   the "Verified at HEAD" line in the latest addendum must match the live
   workflow and docs counts, so any change to the estate forces a conscious
   re-verification (and, when warranted, a re-score) of the review.
   Usage: node test/readiness-review.test.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { countWorkflows, countDocs, countAutoDocs } from '../scripts/board-figures.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

console.log('\n— readiness-review currency guard —\n');

const review = readFileSync(join(ROOT, 'docs/governance/enterprise-readiness-review-2026.md'), 'utf8');

check('review contains a re-score addendum', /## 18 · Re-score addendum/.test(review));

const m = review.match(/Verified at HEAD: (\d+) workflows · (\d+) markdown documents under docs\/ \((\d+) excluding docs\/research\/auto\)/);
check('addendum carries a machine-readable "Verified at HEAD" line', !!m);

if (m) {
  const [, wfClaim, docsClaim, curatedClaim] = m.map(Number);

  // Counted with the same functions that generate data/board-figures.json, so
  // the addendum, the board figures and this guard can never disagree about
  // what "a workflow" or "a doc" is.
  const workflows = countWorkflows();
  check(`addendum workflow count matches disk (${wfClaim} vs ${workflows})`, wfClaim === workflows);

  const docsTotal = countDocs();
  const autoDocs = countAutoDocs();
  check(`addendum docs count matches disk (${docsClaim} vs ${docsTotal})`, docsClaim === docsTotal);
  check(`addendum curated-docs count matches disk (${curatedClaim} vs ${docsTotal - autoDocs})`, curatedClaim === docsTotal - autoDocs);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
