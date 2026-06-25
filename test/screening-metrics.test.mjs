/* Unit tests for screening-metrics pure logic (offline).
   Usage: node test/screening-metrics.test.mjs */
import { computeMetrics, buildReport } from '../scripts/screening-metrics.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— screening-metrics unit tests —\n');

const state = {
  updated: '2026-06-25',
  subjects: {
    a: { name: 'UYA ENERJİ ÜRETİM', band: 'high', topScore: 94, recommendation: 'sanctions-match', lists: ['OFAC SDN', 'UN'] },
    b: { name: 'Plain Co Ltd',      band: 'clear', topScore: 41, recommendation: 'clear',          lists: [] },
    c: { name: 'ŞIRKET A.Ş.',       band: 'medium', topScore: 82, recommendation: 'review',        lists: ['EU FSF'] },
  },
};

const m = computeMetrics(state);
check('counts all subjects', m.total === 3);
check('matches = high band + any list hit (a and c)', m.matches === 2);
check('multi-list hit counted (a has 2 lists)', m.multiList === 1);
check('diacritic folding detected on non-ASCII names (a and c)', m.diacriticFolded === 2);
check('score bucket 90-100 has one', m.scoreBuckets['90-100'] === 1);
check('score bucket 80-89 has one', m.scoreBuckets['80-89'] === 1);
check('score bucket <70 has one', m.scoreBuckets['<70'] === 1);
check('band distribution counts high', m.byBand.high === 1);
check('recommendation distribution counts clear', m.byRecommendation.clear === 1);

// empty / malformed input must not throw
const empty = computeMetrics({});
check('empty state yields zero total', empty.total === 0);
check('buildReport renders without throwing', /Screening Metrics/.test(buildReport(m)));
check('report notes the licensed-feed scope caveat', /World-Check/.test(buildReport(m)));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
