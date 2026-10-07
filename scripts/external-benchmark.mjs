#!/usr/bin/env node
/* External screening benchmark: the independent, MIT-licensed Cascade company
   and vessel name pairs (test/fixtures/external-benchmark/) run through the
   production JS matcher, offline. Reports recall and negative-clear per lot and
   per upstream category. The CI gate is test/external-benchmark.test.mjs.
   Usage: node scripts/external-benchmark.mjs */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildIndex, screenName } from './sanctions-match.mjs';

export const LOTS = ['cascade-name-pairs.csv', 'cascade-name-pairs-2.csv'];
const FIX = p => new URL('../test/fixtures/external-benchmark/' + p, import.meta.url);

/* RFC 4180 CSV (quoted fields, doubled quotes, CRLF tolerant). Pure. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() || [];
  return rows.filter(r => r.length === header.length)
    .map(r => Object.fromEntries(header.map((k, i) => [k, r[i]])));
}

export function pairHits(subject, listed) {
  const idx = buildIndex([{ id: 'bench', name: 'BENCH', names: [listed] }]);
  return (screenName(subject, idx).lists || []).some(h => h.list === 'BENCH');
}

export function scoreLot(rows) {
  const out = { rows: rows.length, matches: 0, non_matches: 0, recall_hits: 0, negative_clear: 0, byCategory: {} };
  for (const r of rows) {
    const isMatch = String(r.is_match).toLowerCase() === 'true';
    const hit = pairHits(r.name1, r.name2);
    const cat = out.byCategory[r.category] || (out.byCategory[r.category] = { n: 0, correct: 0 });
    cat.n++;
    if (hit === isMatch) cat.correct++;
    if (isMatch) { out.matches++; if (hit) out.recall_hits++; }
    else { out.non_matches++; if (!hit) out.negative_clear++; }
  }
  return out;
}

export function computeAll() {
  const res = {};
  for (const lot of LOTS) res[lot] = scoreLot(parseCsv(readFileSync(FIX(lot), 'utf8')));
  return res;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%';
  for (const [lot, r] of Object.entries(computeAll())) {
    console.log(lot + ': recall ' + r.recall_hits + '/' + r.matches + ' (' + pct(r.recall_hits, r.matches) + '), negative clear '
      + r.negative_clear + '/' + r.non_matches + ' (' + pct(r.negative_clear, r.non_matches) + ')');
    const worst = Object.entries(r.byCategory).filter(([, c]) => c.correct < c.n)
      .sort((a, b) => (a[1].correct / a[1].n) - (b[1].correct / b[1].n)).slice(0, 8);
    for (const [k, c] of worst) console.log('   ' + k + ': ' + c.correct + '/' + c.n + ' correct');
  }
}
