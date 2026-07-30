/* Unit tests for the Daily Compliance Brief pure logic (no network).
   Usage: node test/daily-brief.test.mjs */
import { categorize, buildBrief, totalItems, dateLabel, resolveWindow, windowLabel } from '../scripts/daily-brief.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

check('dateLabel formats a UTC date', dateLabel(new Date('2026-06-20T07:00:00Z')) === '20 Jun 2026');

const tasks = [
  { name: 'FATF grey-list change (19 Jun 2026): +Iraq', permalink_url: 'u1' },
  { name: '⚠ Sanctions Screen — 5 customer matches', permalink_url: 'u2' },
  { name: 'Sanctions Watch — 1 list change', permalink_url: 'u3' },
  { name: 'Regulatory update: UAE MoE DPMS guidance', permalink_url: 'u4' },
  { name: 'FUNCTION DOWN: Netlify functions failed health check', permalink_url: 'u5' },
  { name: 'Daily Compliance Brief — 19 Jun 2026', permalink_url: 'u6' },  // must be ignored
  { name: 'RISK DATA SHEET (auto-backup)', permalink_url: 'u7' },         // must be ignored
  { name: 'Some unrelated card', permalink_url: 'u8' }
];
const b = categorize(tasks);
check('categorize routes each watcher by name prefix',
  b.fatf.length === 1 && b.screen.length === 1 && b.watch.length === 1
  && b.regulatory.length === 1 && b.health.length === 1 && b.other.length === 1);
/* The watchdog's monitoring-gap alert carries a ⚠ prefix — it must still file
   under FATF, not "Other monitoring" (regression: ^-anchored match missed it). */
const bGap = categorize([{ name: '⚠ FATF monitoring GAP — list source unreachable 3 consecutive run(s)', permalink_url: 'g1' }]);
check('emoji-prefixed FATF monitoring-gap alert files under FATF',
  bGap.fatf.length === 1 && bGap.other.length === 0);
check('categorize ignores the brief itself and the risk-data backup',
  !JSON.stringify(b).includes('u6') && !JSON.stringify(b).includes('u7'));
check('totalItems counts everything except the ignored tasks', totalItems(b) === 6);

const fatf = { black: ['Islamic Republic of Iran', 'Myanmar', 'North Korea'], grey: ['Iraq', 'Angola'], updated: '2026-06-20' };
const notesBusy = buildBrief(b, fatf, '20 Jun 2026', 24);
check('busy brief leads with the count and lists each category',
  notesBusy.includes('⚠ 6 new monitoring items in the last 24h')
  && notesBusy.includes('FATF list moves (1):')
  && notesBusy.includes('Sanctions — customer screening hits (1):')
  && notesBusy.includes('Site / function health (1):')
  && notesBusy.includes('u1'));
check('busy brief shows the FATF standing posture',
  notesBusy.includes('3 call-for-action') && notesBusy.includes('2 grey-listed jurisdictions')
  && notesBusy.includes('Last recorded list change 2026-06-20'));

const empty = categorize([{ name: 'Daily Compliance Brief — 19 Jun 2026' }]);
const notesClear = buildBrief(empty, fatf, '20 Jun 2026', 24);
check('quiet day reads ALL CLEAR and marks each category no change',
  notesClear.includes('✅ ALL CLEAR — no new monitoring alerts in the last 24h')
  && notesClear.includes('FATF list moves: no change')
  && notesClear.includes('Regulatory changes: no change'));

/* Routine scheduled reports share the REG project — they must not count as
   monitoring items (regression: they made ALL CLEAR unreachable on any day a
   sibling report ran). */
const routine = categorize([
  { name: '📅 Weekly Compliance Summary — 2026-07-20 (past 7 days)' },
  { name: 'Adverse-media methodology review — Q3 2026' },
  { name: 'AI Governance & Platform Report — 2026-07 — ✅ all green' },
  { name: '[TEST] FATF Watchdog connectivity check' },
  { name: 'EWRA annual refresh — due 2026-08-01' }
]);
check('routine scheduled reports and calendar reminders are not monitoring items',
  totalItems(routine) === 0);
const mixed = categorize([
  { name: '📅 Weekly Compliance Summary — 2026-07-20 (past 7 days)' },
  { name: '⚠ Sanctions Screen — 1 customer match' }
]);
check('a real alert still counts on a day a routine report also ran',
  totalItems(mixed) === 1 && mixed.screen.length === 1);

/* ---- Window anchoring ----------------------------------------------------
   A fixed now−24h cutoff loses every hour by which two consecutive briefs are
   more than 24h apart. That is not hypothetical: across 30 consecutive briefs,
   all of them successful runs, 14 of the 29 gaps exceeded 24h (max 25.93h) and
   8.37h of alert activity fell into no brief at all — while the next brief still
   read "✅ ALL CLEAR". These tests pin the contiguity that fixes it. */

const NOW = new Date('2026-07-30T09:45:00Z');
const brief = iso => ({ name: 'Daily Compliance Brief — x', created_at: iso });

const late = resolveWindow(NOW, [brief('2026-07-29T07:48:00Z')]);
check('a late-firing previous brief widens the window past 24h instead of dropping the excess',
  late.anchor === 'previous-brief' && Math.abs(late.hours - 25.95) < 0.01
  && late.cutoff === Date.parse('2026-07-29T07:48:00Z') && !late.capped);

const early = resolveWindow(NOW, [brief('2026-07-29T11:00:00Z')]);
check('an early-firing previous brief narrows the window rather than re-reporting a day',
  Math.abs(early.hours - 22.75) < 0.01);

/* The real invariant: whatever the jitter, consecutive windows must touch. Feed
   the measured 30-run schedule through and assert no instant is ever skipped. */
const SCHEDULE = [
  '2026-06-30T10:33:19Z', '2026-07-01T10:44:09Z', '2026-07-02T10:11:52Z', '2026-07-03T10:08:00Z',
  '2026-07-04T09:26:05Z', '2026-07-05T09:43:57Z', '2026-07-06T11:39:48Z', '2026-07-07T10:28:02Z',
  '2026-07-08T09:31:00Z', '2026-07-09T10:29:55Z', '2026-07-10T10:27:36Z', '2026-07-11T08:55:05Z',
  '2026-07-12T09:09:29Z', '2026-07-13T10:34:01Z', '2026-07-14T09:12:23Z', '2026-07-15T09:17:51Z',
  '2026-07-16T09:22:00Z', '2026-07-17T09:16:59Z', '2026-07-18T08:55:07Z', '2026-07-19T09:10:38Z',
  '2026-07-20T10:19:10Z', '2026-07-21T09:33:18Z', '2026-07-22T09:33:23Z', '2026-07-23T09:30:19Z',
  '2026-07-24T09:27:32Z', '2026-07-25T09:06:57Z', '2026-07-26T09:20:40Z', '2026-07-27T10:49:27Z',
  '2026-07-28T09:41:40Z', '2026-07-29T09:45:17Z'
];
let uncovered = 0, filed = [];
for (const at of SCHEDULE) {
  const w = resolveWindow(new Date(at), filed.map(brief));
  const prevRun = filed.length ? Date.parse(filed[filed.length - 1]) : null;
  /* Gap = time between where this window starts and where the last one ended. */
  if (prevRun !== null && w.cutoff > prevRun) uncovered += w.cutoff - prevRun;
  filed.push(at);
}
check('across the measured 30-run schedule no instant falls outside every window',
  uncovered === 0);

/* Same schedule, old fixed-24h rule — must show the loss the fix removes, so
   this test fails if the corpus ever stops exercising the defect. */
let uncoveredFixed = 0;
for (let i = 1; i < SCHEDULE.length; i++) {
  const cut = Date.parse(SCHEDULE[i]) - 24 * 3600 * 1000;
  if (cut > Date.parse(SCHEDULE[i - 1])) uncoveredFixed += cut - Date.parse(SCHEDULE[i - 1]);
}
check('the schedule really does defeat a fixed 24h cutoff (guards the corpus)',
  Math.abs(uncoveredFixed / 3600000 - 8.37) < 0.02);

/* A missed run must be absorbed, not skipped. */
const missed = resolveWindow(NOW, [brief('2026-07-28T09:41:40Z')]);
check('a skipped day is picked up by the next brief, not lost',
  Math.abs(missed.hours - 48.06) < 0.01 && !missed.capped);

/* No prior brief at all: fall back to the nominal cadence, and say it is nominal. */
const first = resolveWindow(NOW, [{ name: '⚠ Sanctions Screen — 1 match', created_at: '2026-07-30T08:00:00Z' }]);
check('with no previous brief the window falls back to the nominal cadence',
  first.anchor === 'no-prior-brief' && first.hours === 24 && first.priorBriefAt === null);
check('the fallback is stated, not passed off as a measured window',
  buildBrief(categorize([]), fatf, '30 Jul 2026', first).includes('No previous brief was found to anchor to'));
check('a normally-anchored brief carries no fallback or gap notice',
  !buildBrief(categorize([]), fatf, '30 Jul 2026', late).includes('No previous brief')
  && !buildBrief(categorize([]), fatf, '30 Jul 2026', late).includes('COVERAGE GAP'));

/* Only briefs anchor the window — an ordinary alert must not. */
check('an alert card is never mistaken for the previous brief',
  first.cutoff === NOW.getTime() - 24 * 3600 * 1000);

/* A future-stamped brief would yield a negative window; it must be ignored. */
const future = resolveWindow(NOW, [brief('2026-07-31T09:00:00Z'), brief('2026-07-29T09:45:00Z')]);
check('a future-dated brief does not anchor the window', Math.abs(future.hours - 24) < 0.01);

/* Long outage: the ceiling bites, and the brief must say so rather than
   presenting a truncated window as a clean one. */
const capped = resolveWindow(NOW, [brief('2026-05-01T09:00:00Z')], { maxHours: 168 });
check('a very old previous brief caps the window and flags it',
  capped.capped === true && Math.abs(capped.hours - 168) < 0.01);
const cappedNotes = buildBrief(categorize([]), fatf, '30 Jul 2026', capped);
check('a capped window prints a loud COVERAGE GAP, not a clean ALL CLEAR',
  cappedNotes.includes('⚠ COVERAGE GAP') && cappedNotes.includes('appears in NO brief')
  && cappedNotes.includes('2026-05-01T09:00:00.000Z'));

/* The header must state the window actually reported on. */
const wideNotes = buildBrief(categorize([]), fatf, '30 Jul 2026', late);
check('the brief reports the real window, not a nominal 24h',
  wideNotes.includes('26h (since the previous brief)') && !wideNotes.includes('last 24h'));
check('windowLabel names a previous-brief anchor',
  windowLabel({ hours: 25.95, anchor: 'previous-brief' }) === 'last 26h (since the previous brief)'
  && windowLabel({ hours: 24, anchor: 'nominal' }) === 'last 24h');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
