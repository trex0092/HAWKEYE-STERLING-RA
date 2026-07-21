/* Offline unit tests for the pure parts of scripts/compliance-calendar.mjs
   and the shape of the data/compliance-calendar.json registry. */
import {
  daysBetween, addMonths, dueOccurrences, buildTaskTitle, buildTaskNotes,
  loadCalendar, todayUtc, SECTION_NAME, DEFAULT_GRACE_DAYS
} from '../scripts/compliance-calendar.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

/* ── date arithmetic ─────────────────────────────────────────────────────── */
check('daysBetween: future positive, past negative, same day zero',
  daysBetween('2026-07-01', '2026-07-15') === 14
  && daysBetween('2026-07-15', '2026-07-01') === -14
  && daysBetween('2026-07-01', '2026-07-01') === 0);
check('daysBetween: garbage input returns null, never NaN',
  daysBetween('not-a-date', '2026-07-01') === null);

check('addMonths: plain month step and year rollover',
  addMonths('2026-07-15', 12) === '2027-07-15'
  && addMonths('2026-11-10', 3) === '2027-02-10');
check('addMonths: month-end clamp (Jan 31 → Feb 28, leap Feb 29)',
  addMonths('2027-01-31', 1) === '2027-02-28'
  && addMonths('2028-01-31', 1) === '2028-02-29');
check('addMonths: computed from the given date, so a clamp never sticks',
  addMonths('2027-01-31', 2) === '2027-03-31');

/* ── one-off window logic ────────────────────────────────────────────────── */
const oneOff = { id: 'x', title: 'X', date: '2026-10-23', leadDays: 14 };
check('one-off: silent before the lead window opens',
  dueOccurrences(oneOff, '2026-10-01').length === 0);
check('one-off: due at window open, mid-window, and on the day',
  dueOccurrences(oneOff, '2026-10-09').length === 1
  && dueOccurrences(oneOff, '2026-10-15')[0] === '2026-10-23'
  && dueOccurrences(oneOff, '2026-10-23').length === 1);
check('one-off: grace tail files late but loudly (default 7 days)',
  dueOccurrences(oneOff, '2026-10-30').length === 1
  && dueOccurrences(oneOff, '2026-10-31').length === 0);
check('one-off: graceDays: 0 disables the tail',
  dueOccurrences({ ...oneOff, graceDays: 0 }, '2026-10-24').length === 0);

/* ── recurring window logic ──────────────────────────────────────────────── */
const annual = { id: 'r', title: 'R', anchor: '2027-07-15', everyMonths: 12, leadDays: 30 };
check('recurring: silent far from any occurrence',
  dueOccurrences(annual, '2026-08-01').length === 0
  && dueOccurrences(annual, '2027-01-01').length === 0);
check('recurring: next occurrence enters via the lead window',
  dueOccurrences(annual, '2027-06-20')[0] === '2027-07-15'
  && dueOccurrences(annual, '2028-06-20')[0] === '2028-07-15');
check('recurring: just-past occurrence still files inside the grace tail',
  dueOccurrences(annual, '2027-07-20')[0] === '2027-07-15'
  && dueOccurrences(annual, '2027-07-23').length === 0);
check('recurring: occurrences step from the anchor across years',
  dueOccurrences(annual, '2030-07-01')[0] === '2030-07-15');
check('recurring: month-end anchor stays clamped per occurrence',
  dueOccurrences({ id: 'c', title: 'C', anchor: '2027-01-31', everyMonths: 1, leadDays: 0, graceDays: 0 },
    '2027-02-28')[0] === '2027-02-28');
check('recurring: bad shape (no anchor/everyMonths) yields nothing, never throws',
  dueOccurrences({ id: 'b', title: 'B', leadDays: 5 }, '2027-01-01').length === 0
  && dueOccurrences({ id: 'b2', title: 'B2', anchor: '2027-01-01', leadDays: 5 }, '2027-01-01').length === 0);

/* ── task title + notes ──────────────────────────────────────────────────── */
const ev = {
  id: 'fatf-plenary-2026-10', title: 'FATF Plenary (October 2026) — MLRO pre-brief',
  date: '2026-10-23', leadDays: 14, provisional: true, owner: 'MLRO',
  notes: ['Confirm the plenary dates on fatf-gafi.org.'],
};
check('title embeds the occurrence date (the forever-dedup key)',
  buildTaskTitle(ev, '2026-10-23').includes('2026-10-23')
  && buildTaskTitle(ev, '2026-10-23').startsWith(ev.title));
const notes = buildTaskNotes(ev, '2026-10-23', 'https://example/run');
check('notes carry the due date, owner and checklist',
  notes.includes('2026-10-23') && notes.includes('MLRO') && notes.includes('☐ Confirm'));
check('notes flag a provisional (externally set) date',
  notes.includes('PROVISIONAL'));
check('notes point back at the registry entry, not the workflow',
  notes.includes('data/compliance-calendar.json') && notes.includes('id: fatf-plenary-2026-10'));
check('run link is embedded when provided', notes.includes('https://example/run'));
check('no provisional line for a firm internal date',
  !buildTaskNotes({ ...ev, provisional: false }, '2026-10-23', null).includes('PROVISIONAL'));

/* ── registry shape ──────────────────────────────────────────────────────── */
const events = loadCalendar();
check('registry loads and is non-empty', events.length > 0);
check('every event: id + title + leadDays > 0 + non-empty notes',
  events.every(e => e.id && e.title && Number(e.leadDays) > 0
    && Array.isArray(e.notes) && e.notes.length > 0));
check('every event is one-off (date) or recurring (anchor + everyMonths), never both',
  events.every(e => (!!e.date) !== (!!e.anchor && Number(e.everyMonths) > 0)));
check('event ids are unique',
  new Set(events.map(e => e.id)).size === events.length);
check('every date/anchor parses as YYYY-MM-DD',
  events.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date || e.anchor)
    && !Number.isNaN(Date.parse((e.date || e.anchor) + 'T00:00:00Z'))));
check('external (FATF) dates are marked provisional; internal anchors are not',
  events.filter(e => e.id.startsWith('fatf-')).every(e => e.provisional === true)
  && events.filter(e => e.anchor).every(e => !e.provisional));
check('every registry event yields a due occurrence on some day (window is reachable)',
  events.every(e => dueOccurrences(e, e.date || e.anchor).length > 0));

/* ── constants ───────────────────────────────────────────────────────────── */
check('section constant routes to the calendar column', SECTION_NAME === 'Compliance Calendar');
check('default grace covers a weekly cron gap', DEFAULT_GRACE_DAYS === 7);
check('todayUtc formats YYYY-MM-DD',
  /^\d{4}-\d{2}-\d{2}$/.test(todayUtc(new Date(Date.UTC(2026, 6, 21, 12))))
  && todayUtc(new Date(Date.UTC(2026, 6, 21, 12))) === '2026-07-21');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
