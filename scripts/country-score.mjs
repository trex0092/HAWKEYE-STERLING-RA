/* Suggested country risk score — a DRAFT method, generated, never applied.

   The app's country scores (COUNTRIES in app.js, 1 Low / 2 Medium / 3 High)
   are a baseline with no written derivation. This script computes a second,
   reproducible score for every country from public primary sources only, so
   the MLRO can compare the two and decide. It changes nothing by itself: the
   app and the screening report show it BESIDE the current score, labelled as
   pending MLRO approval, and the scoring engine never reads it.

   Inputs (each sourced and dated in its own file):
     - data/jurisdiction-risk.json    FATF call for action ("high") / grey list
     - data/country-indicators.json   FATF effectiveness ratings, US INCSR major
                                      money-laundering list, US TIP tier, EU
                                      tax list Annex I
   Licensed commercial reports (KnowYourCountry, OC Index) are NOT inputs; they
   were used only to cross-check the result by hand. Transparency
   International's CPI was in the first proposal but is left out: TI's terms
   (CC BY-ND 4.0, no commercial use of the website) do not allow it here.

   The weights and bands below were chosen by the maintainer's assistant when
   proposing the method; no source sets them. Changing them is a method change
   for the MLRO.

   Usage:
     node scripts/country-score.mjs           # print the differences
     node scripts/country-score.mjs --write   # refresh data/country-score-suggested.json
     node scripts/country-score.mjs --check   # exit 1 if the committed file drifted */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

export const OUT_FILE = 'data/country-score-suggested.json';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const METHOD = {
  version: 'draft-1 (2026-10-08)',
  status: 'DRAFT, pending MLRO approval. Weights chosen by the maintainer\'s assistant, not set by any source. Shown beside the current score; never changes it.',
  overrides: [
    'FATF call for action (data/jurisdiction-risk.json "high"): suggested 3',
    'FATF increased monitoring, grey list (data/jurisdiction-risk.json "grey"): suggested 3'
  ],
  points: [
    'FATF effectiveness, number of the 11 Immediate Outcomes rated High or Substantial: 0-1 = 3 pts, 2-3 = 2 pts, 4-6 = 1 pt, 7-11 = 0',
    'US INCSR major money-laundering jurisdiction: 2 pts',
    'US TIP Report: Tier 3 = 2 pts, Tier 2 Watch List = 1 pt',
    'EU tax non-cooperative list, Annex I: 1 pt'
  ],
  bands: '0-2 pts = 1 Low, 3-5 pts = 2 Medium, 6-8 pts = 3 High (the bands of the proposal the user approved; dropping the 2-point CPI factor lowers the maximum from 10 to 8)',
  not_rated: 'No suggestion when FATF has not rated the jurisdiction and it is not FATF-listed: the effectiveness factor carries most of the weight, so a score without it would mislead.',
  lower_than_current: 'A suggestion below the current score is not a recommendation to lower it: the method has no sanctions factor yet, and the MLRO may have reasons the method does not see.'
};

export function effectivenessPoints(n) {
  if (n <= 1) return 3;
  if (n <= 3) return 2;
  if (n <= 6) return 1;
  return 0;
}

export function band(points) {
  if (points <= 2) return 1;
  if (points <= 5) return 2;
  return 3;
}

export function readCountries(root = ROOT) {
  const src = readFileSync(join(root, 'app.js'), 'utf8');
  const m = src.match(/const COUNTRIES = (\[.*?\]);/);
  if (!m) throw new Error('COUNTRIES not found in app.js');
  return JSON.parse(m[1]);
}

/* Index each input by the app (COUNTRIES) name. Throws on a name the app does
   not know, so a typo can never silently drop a country from the method. */
export function loadInputs(root = ROOT, countries = readCountries(root)) {
  const known = new Set(countries.map(c => c.name));
  const need = (name, where) => {
    if (!known.has(name)) throw new Error(`${where}: "${name}" is not a COUNTRIES name in app.js`);
    return name;
  };
  const jr = JSON.parse(readFileSync(join(root, 'data/jurisdiction-risk.json'), 'utf8'));
  const ind = JSON.parse(readFileSync(join(root, 'data/country-indicators.json'), 'utf8')).indicators || {};
  const fatf = ind.fatf_effectiveness;
  if (!fatf || !Array.isArray(fatf.jurisdictions) || !fatf.jurisdictions.length) {
    throw new Error('data/country-indicators.json has no fatf_effectiveness ratings');
  }
  const high = new Set((jr.high || []).map(n => need(n, 'jurisdiction-risk high')));
  const grey = new Set((jr.grey || []).map(n => need(n, 'jurisdiction-risk grey')));
  const eff = new Map(fatf.jurisdictions.map(e => [need(e.app, 'fatf_effectiveness'), e]));
  const incsr = new Set((ind.incsr_major_ml?.jurisdictions || []).map(e => need(e.app, 'incsr_major_ml')));
  const tip = new Map();
  for (const [tier, list] of Object.entries(ind.tip_tier?.tiers || {})) {
    for (const e of list) tip.set(need(e.app, 'tip_tier'), tier);
  }
  const euTax = new Set((ind.eu_tax_noncooperative?.jurisdictions || []).map(e => need(e.app, 'eu_tax_noncooperative')));
  return { high, grey, eff, incsr, tip, euTax, editions: {
    fatf: fatf.edition, incsr: ind.incsr_major_ml?.edition, tip: ind.tip_tier?.edition, euTax: ind.eu_tax_noncooperative?.published
  } };
}

export function scoreCountry(country, inp) {
  const name = country.name;
  const row = { country: name, current: country.score, suggested: null, points: null, basis: 'not-rated', factors: [] };
  const e = inp.eff.get(name);
  if (inp.high.has(name)) {
    row.suggested = 3; row.basis = 'fatf-call-for-action';
    row.factors.push('FATF call for action (black list): suggested 3');
  } else if (inp.grey.has(name)) {
    row.suggested = 3; row.basis = 'fatf-grey-list';
    row.factors.push('FATF increased monitoring (grey list): suggested 3');
  } else if (e) {
    const n = Number(e.high_or_substantial);
    const parts = [];
    const ep = effectivenessPoints(n);
    parts.push([ep, `FATF effectiveness ${n} of 11 High/Substantial (${e.report} ${e.date}, ${e.body}): ${ep} ${ep === 1 ? 'pt' : 'pts'}`]);
    if (inp.incsr.has(name)) parts.push([2, 'US INCSR major money-laundering jurisdiction: 2 pts']);
    const t = inp.tip.get(name);
    if (t === 'Tier 3') parts.push([2, 'US TIP Tier 3: 2 pts']);
    else if (t === 'Tier 2 Watch List') parts.push([1, 'US TIP Tier 2 Watch List: 1 pt']);
    if (inp.euTax.has(name)) parts.push([1, 'EU tax list Annex I: 1 pt']);
    row.points = parts.reduce((s, [p]) => s + p, 0);
    row.suggested = band(row.points);
    row.basis = 'points';
    row.factors = parts.map(([, why]) => why);
  } else {
    row.factors.push('Not rated by FATF and not FATF-listed: no suggestion');
  }
  row.compare = row.suggested == null ? 'n/a'
    : row.suggested > row.current ? 'higher'
    : row.suggested < row.current ? 'lower' : 'same';
  return row;
}

export function build(root = ROOT) {
  const countries = readCountries(root);
  const inp = loadInputs(root, countries);
  const rows = countries.map(c => scoreCountry(c, inp)).sort((a, b) => a.country.localeCompare(b.country, 'en'));
  const count = (k) => rows.filter(r => r.compare === k).length;
  return {
    _README: 'GENERATED by scripts/country-score.mjs from app.js COUNTRIES, data/jurisdiction-risk.json and data/country-indicators.json; do not edit by hand (node scripts/country-score.mjs --write). A DRAFT suggested country score shown beside the current score in the app and the screening report for MLRO review. It never changes a score and no scoring code reads it.',
    method: METHOD,
    inputs: inp.editions,
    summary: { countries: rows.length, same: count('same'), higher: count('higher'), lower: count('lower'), not_rated: count('n/a') },
    countries: rows
  };
}

export const serialise = (o) => JSON.stringify(o, null, 2) + '\n';

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const out = build();
  const file = join(ROOT, OUT_FILE);
  if (process.argv.includes('--write')) {
    writeFileSync(file, serialise(out));
    console.log(`wrote ${OUT_FILE}: ${JSON.stringify(out.summary)}`);
  } else if (process.argv.includes('--check')) {
    let committed = '';
    try { committed = readFileSync(file, 'utf8'); } catch { /* missing counts as drift */ }
    if (committed !== serialise(out)) {
      console.error(`${OUT_FILE} is out of date — run: node scripts/country-score.mjs --write`);
      process.exit(1);
    }
    console.log(`${OUT_FILE} in sync (${JSON.stringify(out.summary)})`);
  } else {
    console.log(JSON.stringify(out.summary));
    for (const r of out.countries.filter(r => r.compare === 'higher' || r.compare === 'lower')) {
      console.log(`${r.compare.padEnd(6)} ${r.country}: current ${r.current}, suggested ${r.suggested}`);
    }
  }
}
