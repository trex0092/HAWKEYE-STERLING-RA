/* Readiness-review currency guard. The enterprise readiness review is a scored
   point-in-time document; its 2 July edition still said "37 workflows" while
   the estate had grown to 46, and nobody was forced to notice. This guard pins
   the review's most recent re-score to the repository it claims to describe:
   the "Verified at HEAD" line in the latest addendum must match the live
   workflow and docs counts, so any change to the estate forces a conscious
   re-verification (and, when warranted, a re-score) of the review.
   Usage: node test/readiness-review.test.mjs */
import { readFileSync, existsSync } from 'node:fs';
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

/* ── §5 anti-rot guard ───────────────────────────────────────────────────
   The §5 gap table marked six artefacts ✗ (missing) for weeks after they
   shipped — model cards, the architecture set, the KPI dashboard, the demo
   pack, the executive brief, the committee charter — because nothing tied a
   ✗ verdict to the disk it described. This fails any row still claiming ✗
   whose backticked docs/ path exists. Bare-filename proposals (e.g. "extend
   ai-frameworks-crosswalk-2026.md") stay legal: the FILE existing is not the
   EXTENSION existing, so only docs/-prefixed paths are treated as the claim
   "this artefact does not exist". */
const gapRows = review.split('\n').filter((l) => /^\|.*\|\s*✗\s*\|/.test(l));
for (const row of gapRows) {
  const label = (row.match(/^\|\s*([^|]+?)\s*\|/) || [, 'unlabelled'])[1];
  const claimed = [...row.matchAll(/`(docs\/[^`]+)`/g)].map((m) => m[1]);
  const existing = claimed.filter((p) => existsSync(join(ROOT, p)));
  check('§5 row "' + label + '" marked ✗ names no docs/ path that already exists' +
    (existing.length ? ' — stale: ' + existing.join(', ') : ''), existing.length === 0);
}

/* ── README honesty section ──────────────────────────────────────────────
   The system's declared limitations live in the register and the AIMS pack,
   but the README is what a first reader actually opens. This pins the
   "System state & known limitations" section so the front door can never
   again describe a system with no inert engine, no draft policies and no
   unauthenticated endpoints. */
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const stateSect = (readme.split(/^## System state & known limitations$/m)[1] || '').split(/\n## /)[0];
check('README carries a "System state & known limitations" section', stateSect.length > 0);
check('README system-state section links the open-actions register', stateSect.includes('docs/governance/open-actions-register.md'));
check('README system-state section names the inert transaction monitor', /txn_monitor\.py/.test(stateSect) && /INACTIVE/.test(stateSect));
check('README system-state section states the endpoints-are-public limitation', /effectively public/.test(stateSect));
check('README system-state section states the on-device persistence limit', /localStorage/.test(stateSect));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
