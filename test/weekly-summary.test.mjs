/* Offline unit tests for the Weekly Compliance Summary's pure logic
   (scripts/weekly-summary.mjs). No network, no filesystem.
   Usage: node test/weekly-summary.test.mjs */
import { buildWeeklySummary, inWindow, PIPELINES, WINDOW_DAYS } from '../scripts/weekly-summary.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

/* ── window filter ── */
check('inWindow accepts a date inside the past 7 days and today itself',
  inWindow('2026-07-02', '2026-07-08') && inWindow('2026-07-08', '2026-07-08'));
check('inWindow rejects dates outside the window, future dates and garbage',
  !inWindow('2026-07-01', '2026-07-08') && !inWindow('2026-07-09', '2026-07-08')
  && !inWindow(null, '2026-07-08') && !inWindow('junk', '2026-07-08'));
check('window is ' + WINDOW_DAYS + ' days and the pipeline list is non-empty',
  WINDOW_DAYS === 7 && PIPELINES.length >= 6);

/* ── card builder ── */
const fixture = {
  today: '2026-07-08',
  repo: 'trex0092/HAWKEYE-STERLING-RA',
  regState: { sources: {
    'uae-fiu': { status: 200, changedAt: '2026-07-08' },
    'uae-cbuae': { status: 200, changedAt: '2026-06-01' },
    'fatf-guidance': { status: 200, changedAt: '2026-06-27', via: 'web.archive.org save-page-now 20260627105659' },
    'uae-moe': { status: 'error', error: 'fetch failed (UND_ERR_CONNECT_TIMEOUT)', errorStreak: 10, changedAt: '2026-07-01' }
  } },
  fatf: { black: ['Iran', 'Myanmar', 'North Korea'], grey: ['A', 'B', 'C'], updated: '2026-06-20' },
  sanctions: { sources: {
    'ofac-sdn': { changedAt: '2026-07-07' },
    'un-consolidated': { changedAt: '2026-05-01' },
    'eu-fsf': { error: 'HTTP 500' }
  } },
  screen: { subjects: {
    'a|ubo|1': { name: 'Abdul Aziz Sultan', jurisdiction: 'Dominica', recommendation: 'sanctions-match', lists: ['UK OFSI'], lastSeen: '2026-07-03' },
    'b|ubo|2': { name: 'Dinesh Kumar', jurisdiction: 'India', recommendation: 'review', lists: ['Adverse media'], lastSeen: '2026-06-30' }
  } },
  regDocs: ['REG-UPDATE-2026-07-08.md'],
  pipelines: [
    { file: 'regulatory-watch.yml', label: 'Regulatory Watch (21 sources)', conclusion: 'success', date: '2026-07-08T05:00:00Z' },
    { file: 'anomaly-watch.yml', label: 'Anomaly Watch', conclusion: 'failure', date: '2026-07-07T05:00:00Z' }
  ]
};
const { title, html, plain } = buildWeeklySummary(fixture);

check('title carries the date and the window', title.includes('2026-07-08') && title.includes('7 days'));
check('single <body> root', /^<body>[\s\S]*<\/body>$/.test(html) && (html.match(/<body>/g) || []).length === 1);
check('pipeline health renders green and red states',
  html.includes('✅ <strong>Regulatory Watch (21 sources)</strong>') && html.includes('❌ <strong>Anomaly Watch</strong>'));
check('source health counts healthy vs total', html.includes('3/4 healthy'));
check('failing source carries the error and the streak',
  html.includes('uae-moe') && html.includes('UND_ERR_CONNECT_TIMEOUT') && html.includes('10 consecutive runs'));
check('archive provenance is shown', html.includes('save-page-now 20260627105659'));
check('only in-window changes are listed as changed this week',
  html.includes('<strong>uae-fiu</strong> — content changed 2026-07-08') && !html.includes('<strong>uae-cbuae</strong> — content changed'));
check('AI draft is linked on the reg-watch-state branch',
  html.includes('blob/reg-watch-state/docs/research/auto/REG-UPDATE-2026-07-08.md'));
check('FATF section reports position without a false move alert',
  html.includes('Iran, Myanmar, North Korea') && html.includes('No moves this week'));
check('sanctions list movement is per-list: moved, quiet and error all render',
  html.includes('⚠️ <strong>ofac-sdn</strong> — changed 2026-07-07')
  && html.includes('✅ <strong>un-consolidated</strong> — no change this week')
  && html.includes('❌ <strong>eu-fsf</strong> — HTTP 500'));
check('screening flags render with recommendation icons',
  html.includes('⛔ <strong>Abdul Aziz Sultan</strong>') && html.includes('⚠️ <strong>Dinesh Kumar</strong>'));
check('plain summary carries the headline counts for the fallback issue',
  plain.includes('Pipelines: 1/2 green') && plain.includes('Sources healthy: 3/4') && plain.includes('Open screening flags: 2'));

/* empty world still produces a deliverable card */
const empty = buildWeeklySummary({ today: '2026-07-08' });
check('empty inputs still build a valid card (never a crash, never silence)',
  empty.html.includes('0/0 healthy') && empty.html.includes('No regulatory content changes')
  && empty.html.includes('no open screening flags'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
