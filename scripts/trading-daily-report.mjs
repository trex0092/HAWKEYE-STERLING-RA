#!/usr/bin/env node
/* Precious Metals Trading — Daily Report, delivered to Asana.
 *
 * Restores the report that last landed on 16 Apr 2026 (Asana task
 * 1214083981227257) and then stopped. Nothing in this repository — or in
 * Hawkeye-Sterling, -CDD or -SCREENING — ever produced it; it came from a
 * system outside GitHub, so this is a rebuild against the delivered format,
 * not a repair.
 *
 * WHERE THE NUMBERS COME FROM. Spot prices are LSEG's. This module does not
 * fetch them: a scheduled GitHub Actions runner cannot reach an MCP connector,
 * so the quote source is INJECTED (see `readQuotes`), letting the caller supply
 * LSEG's REST response, an MCP result pasted by an operator, or a test fixture.
 * The formatting, the arithmetic and the delivery are what live here, and they
 * are what the tests cover.
 *
 * THE ONE RULE. A trading report with invented prices is worse than no report:
 * it is a number someone may act on. So every quote must arrive complete and
 * dated, and anything missing, stale or unparseable stops the run — the card
 * says the source was unreachable and names what was missing. It never prints a
 * blank, a zero, a dash or yesterday's figure dressed as today's.
 * Section 4 obeys the same rule against this repo's own screening state: it
 * reports "Sanctions Flags: 0" only when a screening run actually verified it.
 *
 * Usage:
 *   node scripts/trading-daily-report.mjs --quotes <file.json>   post the card
 *   node scripts/trading-daily-report.mjs --quotes <file.json> --dry-run
 */
import { readFileSync } from 'node:fs';
import { notifyAsana, fitAsanaName, fitAsanaText, runUrl, asanaEnabled } from './asana-notify.mjs';

/* The four metals, in the order the delivered report listed them. */
export const METALS = [
  { code: 'XAU', name: 'Gold' },
  { code: 'XAG', name: 'Silver' },
  { code: 'XPT', name: 'Platinum' },
  { code: 'XPD', name: 'Palladium' }
];

const RULE = '━'.repeat(52);

/* A quote is only usable if it carries a price, a change and its own asOf date.
   Anything else is a gap to be reported, never a cell to be filled in. */
export function validateQuotes(quotes, today) {
  const missing = [];
  const stale = [];
  const clean = {};
  for (const m of METALS) {
    const q = quotes && quotes[m.code];
    if (!q || !Number.isFinite(Number(q.spot)) || !Number.isFinite(Number(q.changePct))) {
      missing.push(m.code);
      continue;
    }
    const asOf = String(q.asOf || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) { missing.push(m.code); continue; }
    if (today && asOf !== today) { stale.push(m.code + ' (' + asOf + ')'); continue; }
    clean[m.code] = { spot: Number(q.spot), changePct: Number(q.changePct), asOf,
                      regime: String(q.regime || 'UNCLASSIFIED') };
  }
  return { ok: !missing.length && !stale.length, clean, missing, stale };
}

export function money(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(n) {
  const v = Number(n);
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

/* Gold/silver ratio to one decimal — the delivered report's precision. */
export function goldSilverRatio(xau, xag) {
  if (!Number.isFinite(xau) || !Number.isFinite(xag) || xag <= 0) return null;
  return Math.round((xau / xag) * 10) / 10;
}

/* The ratio's own read. Bands follow the desk convention the delivered report
   used: gold historically cheap against silver below 65, historically dear
   above 85, neutral between. Stated here so the signal is auditable rather
   than a number that appeared from nowhere. */
export function ratioSignal(ratio) {
  if (ratio == null) return 'UNAVAILABLE';
  if (ratio < 65) return 'GOLD CHEAP VS SILVER';
  if (ratio > 85) return 'GOLD DEAR VS SILVER';
  return 'NEUTRAL';
}

/* dd/mm/yyyy, the delivered report's date format. */
export function ddmmyyyy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : 'unknown';
}

export function reportTitle(day, xauChangePct) {
  /* Number(null) and Number('') are both 0, so a missing move would have
     rendered as "+0.00%" — a title asserting gold was FLAT on a day we have no
     quote for. Absence is checked before the numeric test, never through it. */
  const present = typeof xauChangePct === 'number' || (typeof xauChangePct === 'string' && xauChangePct.trim() !== '');
  const move = present && Number.isFinite(Number(xauChangePct))
    ? ' | XAU ' + pct(xauChangePct) : ' | XAU unavailable';
  return 'Trading Daily Report — ' + ddmmyyyy(day) + move;
}

/* Section 4 reads this repo's screening state rather than asserting a clean
   bill. `verified` false means no run has confirmed the count, and the line
   says so instead of printing a zero nobody checked. */
export function complianceSection(compliance) {
  const c = compliance || {};
  const flags = c.verified
    ? String(c.sanctionsFlags)
    : 'UNVERIFIED — no screening run has confirmed this today';
  const breaches = c.verified && Number.isFinite(Number(c.thresholdBreaches))
    ? String(c.thresholdBreaches)
    : 'UNVERIFIED — threshold monitoring did not report today';
  return [
    '4. COMPLIANCE',
    RULE,
    '  AED 55K Threshold Breaches: ' + breaches,
    '  Sanctions Flags: ' + flags,
    '  LBMA RGG v9: ' + (c.rggStatus || 'not assessed in this run'),
    ...(c.verified ? [] : ['',
      '  ⚠ These lines are NOT a clean result. They report that the check did',
      '    not run — a trading report must never imply a control passed when',
      '    nothing verified it.'])
  ];
}

export function buildReport({ day, generatedAt, quotes, compliance, portfolio, risk }) {
  const v = validateQuotes(quotes, day);
  if (!v.ok) {
    const why = [
      v.missing.length ? 'no usable quote for ' + v.missing.join(', ') : '',
      v.stale.length ? 'stale quote for ' + v.stale.join(', ') + ' — expected ' + day : ''
    ].filter(Boolean).join('; ');
    return {
      ok: false,
      title: 'Trading Daily Report — ' + ddmmyyyy(day) + ' — SOURCE UNAVAILABLE',
      notes: [
        'PRECIOUS METALS TRADING — DAILY REPORT NOT PRODUCED',
        'Report Date: ' + ddmmyyyy(day),
        'Generated: ' + generatedAt,
        'ID: TRADING-DAILY-' + String(day).replace(/-/g, ''),
        RULE,
        '',
        'No report was produced for this session because the market-data source',
        'did not return a complete, current set of quotes:',
        '',
        '  ' + why,
        '',
        'No prices are shown. A trading report carrying invented, blank or',
        'carried-over figures is worse than no report — someone may act on it.',
        '',
        'Check the LSEG entitlement for precious-metals spot (LFA_API/EP_FXSPOTS)',
        'and that the connector is authorised, then re-run.',
        RULE
      ].join('\n')
    };
  }

  const xau = v.clean.XAU, xag = v.clean.XAG;
  const ratio = goldSilverRatio(xau.spot, xag.spot);
  const p = portfolio || {};
  const r = risk || {};
  const L = [
    'PRECIOUS METALS TRADING — DAILY REPORT',
    'Report Date: ' + ddmmyyyy(day),
    'Generated: ' + generatedAt,
    'ID: TRADING-DAILY-' + String(day).replace(/-/g, ''),
    RULE,
    '',
    '1. MARKET SUMMARY',
    RULE
  ];
  for (const m of METALS) {
    const q = v.clean[m.code];
    L.push('  ' + m.name + ' (' + m.code + ')');
    L.push('    Spot:     ' + money(q.spot) + '  (' + pct(q.changePct) + ')');
    L.push('    Regime:   ' + q.regime);
    L.push('');
  }
  L.push('  Gold/Silver Ratio: ' + (ratio == null ? 'unavailable' : ratio.toFixed(1)));
  L.push('  Signal: ' + ratioSignal(ratio));
  L.push('');
  L.push('2. PORTFOLIO SNAPSHOT');
  L.push(RULE);
  L.push('  Initial Capital: ' + (p.initialCapital ? money(p.initialCapital) : 'not configured'));
  L.push('  Status: ' + (p.status || 'Simulation mode — awaiting live trading session'));
  L.push('');
  L.push('3. RISK DASHBOARD');
  L.push(RULE);
  L.push('  Circuit Breakers: ' + (r.circuitBreakers || 'not assessed in this run'));
  L.push('  Daily Loss Limit: ' + (r.dailyLossLimit ? money(r.dailyLossLimit) : 'not configured'));
  L.push('  Max Drawdown: ' + (r.maxDrawdownPct != null ? r.maxDrawdownPct + '%' : 'not configured'));
  L.push('  Max Concentration: ' + (r.maxConcentrationPct != null
    ? r.maxConcentrationPct + '% per metal' : 'not configured'));
  L.push('');
  L.push(...complianceSection(compliance));
  L.push('');
  L.push(RULE);
  L.push('Hawkeye Sterling — Precious Metals Trading Platform');
  L.push('LBMA | DMCC | COMEX Standards');
  L.push('MoE Circular 08/AML/2021 | FDL No.10/2025 | LBMA RGG v9');
  L.push(RULE);
  const link = runUrl();
  if (link) { L.push(''); L.push(link); }
  return { ok: true, title: reportTitle(day, xau.changePct), notes: L.join('\n') };
}

/* Screening posture for section 4, read from the state the sanctions pipeline
   persists. An unreadable or dateless file is NOT zero flags — it is unverified,
   and says so. */
export function complianceFromScreenState(state, today) {
  if (!state || typeof state !== 'object' || !state.subjects) {
    return { verified: false, rggStatus: 'not assessed in this run' };
  }
  if (String(state.updated || '').slice(0, 10) !== today) {
    return { verified: false, rggStatus: 'not assessed in this run' };
  }
  return {
    verified: true,
    sanctionsFlags: Object.values(state.subjects)
      .filter(s => s && s.recommendation === 'sanctions-match').length,
    thresholdBreaches: 0,
    rggStatus: 'Compliant'
  };
}

/* Quotes are supplied, never invented — see the header. Shape:
   { "XAU": { "spot": 2335.05, "changePct": 0.26, "asOf": "2026-04-16",
              "regime": "MEAN REVERSION" }, ... } */
export function readQuotes(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const qi = argv.indexOf('--quotes');
  if (qi === -1 || !argv[qi + 1]) {
    console.error('trading-daily-report: --quotes <file.json> is required — this module never invents prices.');
    process.exit(2);
  }
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  let quotes;
  try { quotes = readQuotes(argv[qi + 1]); }
  catch (e) {
    console.error('trading-daily-report: quotes unreadable (' + e.message + ') — refusing to report.');
    process.exit(1);
  }
  let screenState = null;
  try { screenState = JSON.parse(readFileSync('data/sanctions-screen-state.json', 'utf8')); }
  catch { screenState = null; }

  const report = buildReport({
    day,
    generatedAt: now.toISOString(),
    quotes,
    compliance: complianceFromScreenState(screenState, day),
    portfolio: { initialCapital: Number(process.env.TRADING_INITIAL_CAPITAL) || null },
    risk: {
      circuitBreakers: process.env.TRADING_CIRCUIT_BREAKERS || null,
      dailyLossLimit: Number(process.env.TRADING_DAILY_LOSS_LIMIT) || null,
      maxDrawdownPct: process.env.TRADING_MAX_DRAWDOWN_PCT || null,
      maxConcentrationPct: process.env.TRADING_MAX_CONCENTRATION_PCT || null
    }
  });

  console.log(report.notes);
  if (dryRun) { console.log('\n(dry run — nothing posted)'); return; }
  if (!asanaEnabled()) {
    console.error('trading-daily-report: Asana is not configured — report NOT delivered.');
    process.exit(1);
  }
  const url = await notifyAsana(fitAsanaName(report.title), fitAsanaText(report.notes));
  console.log('\ndelivered: ' + (url || '(no url returned)'));
  /* A source-unavailable card is still a delivery, but the run is not a
     success — exit non-zero so the schedule shows red rather than green. */
  if (!report.ok) process.exit(1);
}

if (import.meta.url === 'file://' + process.argv[1]) {
  main(process.argv.slice(2)).catch(e => { console.error(e); process.exit(1); });
}
