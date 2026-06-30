/* Unit tests for the freshness-check pure logic (offline; no network).
   Usage: node test/freshness-check.test.mjs */
import { staleControls, utcDay, buildReport, MANDATORY } from '../scripts/freshness-check.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— freshness-check unit tests —\n');

// utcDay
check('utcDay extracts UTC date', utcDay('2026-06-25T05:01:33Z') === '2026-06-25');
check('utcDay null on empty', utcDay(null) === null);
check('utcDay null on garbage', utcDay('not-a-date') === null);

const today = '2026-06-25';

// all fresh -> nothing stale
const allFresh = MANDATORY.map(c => ({ ...c, lastSuccessDay: today }));
check('no stale when all ran today', staleControls(allFresh, today).length === 0);

// one never ran
const oneNull = allFresh.map((s, i) => i === 0 ? { ...s, lastSuccessDay: null } : s);
let r = staleControls(oneNull, today);
check('flags a control that never succeeded', r.length === 1 && r[0].id === MANDATORY[0].id);
check('reports null lastSuccessDay as null', r[0].lastSuccessDay === null);

// one stale (yesterday)
const oneStale = allFresh.map((s, i) => i === 1 ? { ...s, lastSuccessDay: '2026-06-24' } : s);
r = staleControls(oneStale, today);
check('flags a control whose last success was an earlier day', r.length === 1 && r[0].name === MANDATORY[1].name);

// a control that is mid-run today (no success yet, but it fired) is NOT stale —
// the long daily screen must not trip a false "did not run" alarm while running.
const onePending = allFresh.map((s, i) => i === 1 ? { ...s, lastSuccessDay: '2026-06-24', pendingToday: true } : s);
check('an in-progress-today control is not flagged stale', staleControls(onePending, today).length === 0);
// but a control that never succeeded AND is not running today is still stale.
const pendingElsewhere = allFresh.map((s, i) => i === 1 ? { ...s, lastSuccessDay: null, pendingToday: false } : s);
check('a control neither successful nor running today is still stale', staleControls(pendingElsewhere, today).length === 1);

// report content
check('green report mentions all controls fresh', /successful run today/.test(buildReport([], today, MANDATORY.length)));
check('alarm report lists the stale control', /Sanctions Watch/.test(buildReport([{ id: 'sanctions-watch.yml', name: 'Sanctions Watch', lastSuccessDay: null }], today, MANDATORY.length)));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
