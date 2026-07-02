/* Offline unit tests for the pure parts of scripts/quarterly-review.mjs. */
import { quarterLabel, buildReviewTitle, buildReviewNotes, SECTION_NAME } from '../scripts/quarterly-review.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

check('quarter label: Jan→Q1, Mar→Q1, Apr→Q2, Jul→Q3, Oct→Q4, Dec→Q4',
  quarterLabel(new Date(Date.UTC(2026, 0, 1))) === 'Q1 2026'
  && quarterLabel(new Date(Date.UTC(2026, 2, 31))) === 'Q1 2026'
  && quarterLabel(new Date(Date.UTC(2026, 3, 1))) === 'Q2 2026'
  && quarterLabel(new Date(Date.UTC(2026, 6, 2))) === 'Q3 2026'
  && quarterLabel(new Date(Date.UTC(2026, 9, 1))) === 'Q4 2026'
  && quarterLabel(new Date(Date.UTC(2026, 11, 31))) === 'Q4 2026');

check('title is quarter-unique (the forever-dedup key)',
  buildReviewTitle('Q3 2026') === 'Adverse-media methodology review — Q3 2026');

const notes = buildReviewNotes('Q3 2026', 'https://example/run');
check('checklist covers keywords, typologies, sources, evidence log, thresholds and FP sample',
  ['KEYWORD SETS', 'TYPOLOGY BUCKETS', 'SOURCES', 'EVIDENCE LOG', 'THRESHOLDS', 'FALSE-POSITIVE REVIEW']
    .every(h => notes.includes(h)));
check('checklist names both keyword sets and both sources',
  notes.includes('ADVERSE_KEYWORDS_AR') && notes.includes('GDELT') && notes.includes('Google News'));
check('sign-off line and model-validation linkage present',
  notes.includes('Sign-off') && notes.includes('model-validation-2026.md'));
check('run link is embedded when provided', notes.includes('https://example/run'));
check('section constant is the AM/PEP monitoring column', SECTION_NAME === 'Adverse Media & PEP Monitoring');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
