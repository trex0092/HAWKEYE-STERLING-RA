/* Unit tests for the precious-metals daily report (no network).
   Usage: node test/trading-daily-report.test.mjs */
import { buildReport, validateQuotes, goldSilverRatio, ratioSignal, ddmmyyyy,
         reportTitle, money, pct, complianceFromScreenState, complianceSection,
         METALS } from '../scripts/trading-daily-report.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

const DAY = '2026-04-16';
const q = (spot, changePct, regime) => ({ spot, changePct, regime, asOf: DAY });
const good = {
  XAU: q(2335.05, 0.26, 'MEAN REVERSION'),
  XAG: q(29.16, 0.82, 'RANGING'),
  XPT: q(994.28, -0.50, 'MEAN REVERSION'),
  XPD: q(1039.60, 0.29, 'MEAN REVERSION')
};

/* Formatting must reproduce the delivered card (Asana 1214083981227257), not a
   near-miss — the report is read by people who know what it looked like. */
const r = buildReport({ day: DAY, generatedAt: '2026-04-16T10:00:55.636Z', quotes: good,
  compliance: { verified: true, sanctionsFlags: 0, thresholdBreaches: 0, rggStatus: 'Compliant' },
  portfolio: { initialCapital: 100000 },
  risk: { circuitBreakers: 'All OK', dailyLossLimit: 25000, maxDrawdownPct: 10, maxConcentrationPct: 60 } });

check('a complete quote set produces a report', r.ok === true);
check('header carries the report id and dd/mm/yyyy date',
  r.notes.includes('ID: TRADING-DAILY-20260416') && r.notes.includes('Report Date: 16/04/2026'));
check('spot lines match the delivered formatting exactly',
  r.notes.includes('    Spot:     $2,335.05  (+0.26%)')
  && r.notes.includes('    Spot:     $29.16  (+0.82%)')
  && r.notes.includes('    Spot:     $994.28  (-0.50%)'));
check('all four metals appear, in the delivered order',
  METALS.every(m => r.notes.includes(m.name + ' (' + m.code + ')'))
  && r.notes.indexOf('Gold (XAU)') < r.notes.indexOf('Silver (XAG)')
  && r.notes.indexOf('Silver (XAG)') < r.notes.indexOf('Platinum (XPT)')
  && r.notes.indexOf('Platinum (XPT)') < r.notes.indexOf('Palladium (XPD)'));
check('all four numbered sections are present',
  ['1. MARKET SUMMARY', '2. PORTFOLIO SNAPSHOT', '3. RISK DASHBOARD', '4. COMPLIANCE']
    .every(s => r.notes.includes(s)));
check('footer carries the standards and regulatory lines',
  r.notes.includes('LBMA | DMCC | COMEX Standards')
  && r.notes.includes('MoE Circular 08/AML/2021 | FDL No.10/2025 | LBMA RGG v9'));

/* The title is what shows in an Asana list, so the day's headline move belongs
   in it — that is how the delivered card read. */
check('title carries the date and the gold move',
  reportTitle(DAY, 0.14) === 'Trading Daily Report — 16/04/2026 | XAU +0.14%');
check('a report with no gold quote says so in the title rather than implying flat',
  reportTitle(DAY, null).includes('XAU unavailable'));

check('ratio is gold over silver to one decimal', goldSilverRatio(2335.05, 29.16) === 80.1);
check('ratio is unavailable rather than Infinity when silver is zero or absent',
  goldSilverRatio(2335.05, 0) === null && goldSilverRatio(2335.05, undefined) === null);
check('ratio bands are named, not magic', ratioSignal(80.1) === 'NEUTRAL'
  && ratioSignal(60) === 'GOLD CHEAP VS SILVER' && ratioSignal(90) === 'GOLD DEAR VS SILVER'
  && ratioSignal(null) === 'UNAVAILABLE');
check('money and percent render the delivered way',
  money(2335.05) === '$2,335.05' && money(100000) === '$100,000.00'
  && pct(0.26) === '+0.26%' && pct(-0.5) === '-0.50%');
check('a malformed date does not become a plausible-looking one',
  ddmmyyyy('not-a-date') === 'unknown' && ddmmyyyy('') === 'unknown');

/* THE ONE RULE: no invented, blank or carried-over prices, ever. */
const partial = { ...good }; delete partial.XPD;
const rp = buildReport({ day: DAY, generatedAt: 'x', quotes: partial });
check('a missing metal stops the report — it is not rendered with a gap',
  rp.ok === false && rp.title.includes('SOURCE UNAVAILABLE') && rp.notes.includes('XPD'));
check('the not-produced card prints no prices at all',
  !/\$[\d,]+\.\d\d/.test(rp.notes));

const stale = { ...good, XAG: { ...good.XAG, asOf: '2026-04-15' } };
const rs = buildReport({ day: DAY, generatedAt: 'x', quotes: stale });
check('yesterday\'s quote is refused, not passed off as today\'s',
  rs.ok === false && rs.notes.includes('XAG (2026-04-15)'));

check('a quote missing its own asOf is unusable',
  validateQuotes({ ...good, XAU: { spot: 1, changePct: 1 } }, DAY).missing.includes('XAU'));
check('a non-numeric price is unusable, not coerced',
  validateQuotes({ ...good, XPT: { spot: 'n/a', changePct: 0, asOf: DAY } }, DAY).missing.includes('XPT'));
check('an empty source yields every metal missing and no report',
  validateQuotes({}, DAY).missing.length === METALS.length
  && buildReport({ day: DAY, generatedAt: 'x', quotes: {} }).ok === false);

/* Section 4 must never assert a control passed that nothing verified — the same
   rule the screening engine lives by. */
const unver = complianceSection({ verified: false }).join('\n');
check('unverified compliance reports the gap, never a zero',
  unver.includes('UNVERIFIED') && !/Sanctions Flags: 0\b/.test(unver)
  && unver.includes('NOT a clean result'));
check('verified compliance reports the real count',
  complianceSection({ verified: true, sanctionsFlags: 3, thresholdBreaches: 0, rggStatus: 'Compliant' })
    .join('\n').includes('Sanctions Flags: 3'));

const st = { updated: DAY, subjects: {
  a: { recommendation: 'sanctions-match' }, b: { recommendation: 'review' },
  c: { recommendation: 'sanctions-match' } } };
check('screening state from today counts only sanctions matches',
  complianceFromScreenState(st, DAY).sanctionsFlags === 2);
check('screening state from another day is unverified, not zero',
  complianceFromScreenState({ ...st, updated: '2026-04-15' }, DAY).verified === false);
check('missing or shapeless screening state is unverified, not zero',
  complianceFromScreenState(null, DAY).verified === false
  && complianceFromScreenState({}, DAY).verified === false);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
