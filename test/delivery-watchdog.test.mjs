/* Delivery watchdog unit tests. Exercises findTodaysReports() -- the pure
   matching logic -- offline, the same split advisor-bias-eval.mjs uses for
   level(): no live Asana project needed, no ASANA_ACCESS_TOKEN needed.
   Usage: node test/delivery-watchdog.test.mjs */
import { findTodaysReports, TITLE_PREFIX } from '../scripts/delivery-watchdog.mjs';

let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

console.log('\n— delivery-watchdog unit tests —\n');

const TODAY = '2026-09-08';
const YESTERDAY = '2026-09-07';

const matching = { name: TITLE_PREFIX + ' — ACTION REQUIRED — Sanctions 48 · Adverse Media 158 · PEP 5 — 08 Sep 2026', created_at: TODAY + 'T08:52:15.370Z', permalink_url: 'https://app.asana.com/x/1' };
const wrongDay = { name: TITLE_PREFIX + ' — 07 Sep 2026', created_at: YESTERDAY + 'T04:29:56.000Z' };
const wrongTitle = { name: 'Adverse-media case: Italpreziosi S.P.A', created_at: TODAY + 'T08:52:16.000Z' };
const noise = { name: 'PRODUCTION DRIFT: the live site is serving an older build', created_at: TODAY + 'T07:54:56.705Z' };

check('finds a report filed today', findTodaysReports([matching], TODAY).length === 1);
check('excludes a report from a different day', findTodaysReports([wrongDay], TODAY).length === 0);
check('excludes a same-day task with an unrelated title', findTodaysReports([wrongTitle], TODAY).length === 0);
check('excludes an unrelated task even filed today', findTodaysReports([noise], TODAY).length === 0);
check('empty task list finds nothing', findTodaysReports([], TODAY).length === 0);
check('handles multiple matches on the same day (a scheduled + a manual dispatch both delivering)',
  findTodaysReports([matching, { ...matching, permalink_url: 'https://app.asana.com/x/2' }], TODAY).length === 2);
check('a mix of matching and non-matching returns only the matches',
  findTodaysReports([matching, wrongDay, wrongTitle, noise], TODAY).length === 1);
check('tolerates null/undefined entries in the list without throwing',
  findTodaysReports([matching, null, undefined], TODAY).length === 1);
check('tolerates a missing created_at field (never matches, never throws)',
  findTodaysReports([{ name: TITLE_PREFIX + ' — no date' }], TODAY).length === 0);
check('tolerates an undefined tasks argument (returns empty, never throws)',
  findTodaysReports(undefined, TODAY).length === 0);
check('title match is prefix-based, not exact (real titles carry a stats suffix)',
  findTodaysReports([matching], TODAY, TITLE_PREFIX).length === 1
  && matching.name !== TITLE_PREFIX);
check('a custom titlePrefix argument is honoured (site-currency style reuse)',
  findTodaysReports([{ name: 'Custom Report XYZ', created_at: TODAY }], TODAY, 'Custom Report').length === 1);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
