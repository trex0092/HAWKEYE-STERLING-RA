/* Unit tests for the Daily Compliance Brief pure logic (no network).
   Usage: node test/daily-brief.test.mjs */
import { categorize, buildBrief, totalItems, dateLabel } from '../scripts/daily-brief.mjs';

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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
