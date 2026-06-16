/* Generate the "sources and their narrative" table in docs/regulatory-watch.md
   from data/reg-sources.json, so the registry is the single source of truth.

   Usage:
     node scripts/reg-sources-doc.mjs           # rewrite the section in place
     node scripts/reg-sources-doc.mjs --check    # exit 1 if the doc is stale (CI)
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { loadSources } from './reg-watch.mjs';

const DOC = 'docs/regulatory-watch.md';
const BEGIN = '<!-- BEGIN:reg-sources -->';
const END = '<!-- END:reg-sources -->';

const HEADINGS = { UAE: 'UAE (primary focus)', Global: 'Global' };
const cell = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function buildSection(sources) {
  const order = [];                                   // jurisdictions in first-seen order, UAE then Global first
  for (const j of ['UAE', 'Global']) if (sources.some(s => s.jurisdiction === j)) order.push(j);
  for (const s of sources) if (s.jurisdiction && !order.includes(s.jurisdiction)) order.push(s.jurisdiction);

  const out = [BEGIN,
    '<!-- Auto-generated from data/reg-sources.json by scripts/reg-sources-doc.mjs. Do not edit by hand; run `node scripts/reg-sources-doc.mjs`. -->',
    '',
    'Worldwide, UAE-weighted. The narrative is what each source is, why it is watched, and what it feeds in the app. _Edit the set in `data/reg-sources.json`; this table regenerates from it._',
    ''];
  for (const j of order) {
    out.push('### ' + (HEADINGS[j] || j), '', '| Source | Narrative |', '| --- | --- |');
    for (const s of sources.filter(x => x.jurisdiction === j)) {
      out.push('| **' + cell(s.name) + '** | ' + cell(s.narrative) + ' |');
    }
    out.push('');
  }
  out.push(END);
  return out.join('\n');
}

const sources = loadSources(readFileSync(SOURCES_PATH(), 'utf8'));
function SOURCES_PATH() { return new URL('../data/reg-sources.json', import.meta.url); }

const doc = readFileSync(DOC, 'utf8');
const b = doc.indexOf(BEGIN), e = doc.indexOf(END);
if (b === -1 || e === -1 || e < b) { console.error('Markers ' + BEGIN + ' / ' + END + ' not found in ' + DOC); process.exit(2); }
const next = doc.slice(0, b) + buildSection(sources) + doc.slice(e + END.length);

const check = process.argv.includes('--check');
if (check) {
  if (next !== doc) { console.error('STALE: ' + DOC + ' is out of sync with data/reg-sources.json. Run: node scripts/reg-sources-doc.mjs'); process.exit(1); }
  console.log('reg-sources-doc: ' + DOC + ' is in sync (' + sources.length + ' sources).');
} else {
  if (next !== doc) { writeFileSync(DOC, next); console.log('reg-sources-doc: regenerated table in ' + DOC + ' (' + sources.length + ' sources).'); }
  else console.log('reg-sources-doc: no change (' + sources.length + ' sources).');
}
