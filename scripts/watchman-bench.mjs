#!/usr/bin/env node
/* Watchman matching benchmark — EXPERIMENTAL, shadow-only, PII-free.

   The second independent engine beside scripts/yente-bench.mjs. It scores
   moov-io/watchman (Apache-2.0, the Moov sanctions search server) against the
   repo's OWN frozen screening benchmark (test/fixtures/screening-benchmark):

   - every fixture `listed` name is uploaded through Watchman's custom file
     ingest (POST /v2/ingest/{fileType}, done with curl by the workflow);
   - every `subject` from the recall pairs (must match) and the hard negatives
     (must NOT match) is sent to GET /v2/search, restricted to that source.

   The fixtures carry no person/organisation label, so each listed name is
   ingested twice, once as a person and once as a business, and a subject's
   score is the better of the two searches. No sanctions data is downloaded:
   the workflow loads no government list. Nothing here touches screening state,
   cases, or Asana.

   Subcommands:
     dataset <outdir>    write hawkeye-bench.csv + watchman.yml (APP_CONFIG)
     run <watchman-url> [dir]  check the ingest responses saved in dir, run the
                         benchmark, print the report
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, URLSearchParams } from 'node:url';
import { evaluate } from './yente-bench.mjs';

const PAIRS_FILE = 'test/fixtures/screening-benchmark/recall-pairs.json';
const NEGS_FILE = 'test/fixtures/screening-benchmark/hard-negatives.json';
export const SOURCES = { person: 'hb-person', business: 'hb-business' };
// Watchman's documented lines: 0.80 for screening, ~0.59 for high recall.
export const THRESHOLDS = [0.59, 0.7, 0.8];

export function csvCell(v) {
  return '"' + String(v).replace(/"/g, '""') + '"';
}

export function buildCsv(listed) {
  /* listed: Map name → id. One row per distinct listed name. */
  const rows = ['name,source_id'];
  for (const [name, id] of listed) rows.push(`${csvCell(name)},${csvCell(id)}`);
  return rows.join('\n') + '\n';
}

export function buildConfig() {
  /* APP_CONFIG for the container: no downloaded lists (the workflow also sets
     DATA_REFRESH_INTERVAL=off), two ingest file types sharing one CSV shape. */
  const file = (kind) => [
    `      ${SOURCES[kind]}:`,
    '        format: csv',
    '        mapping:',
    '          name:',
    '            column: name',
    '          sourceID:',
    '            column: source_id',
    '          type:',
    `            default: "${kind}"`,
    `          ${kind}:`,
    '            name:',
    '              column: name',
  ];
  return [
    'Watchman:',
    '  Servers:',
    '    BindAddress: ":8084"',
    '    AdminAddress: ":9094"',
    '  Download:',
    '    IncludedLists: []',
    '  Ingest:',
    '    files:',
    ...file('person'),
    ...file('business'),
    '',
  ].join('\n');
}

export function loadFixtures() {
  const pairs = JSON.parse(readFileSync(PAIRS_FILE, 'utf8')).pairs;
  const negsRaw = JSON.parse(readFileSync(NEGS_FILE, 'utf8'));
  const negs = negsRaw.pairs || negsRaw.items || [];
  const listed = new Map();
  for (const p of pairs) listed.set(p.listed, p.id);
  for (const n of negs) listed.set(n.listed, n.id);
  return { pairs, negs, listed };
}

export function report(evals) {
  const L = ['# Watchman matching benchmark (experimental, shadow-only)', '',
    'Indexed: the repo\'s own benchmark fixtures, ingested as a custom file. No sanctions data downloaded.', '',
    '| minMatch | recall | false-positive rate |', '| --- | --- | --- |'];
  for (const e of evals) {
    L.push(`| ${e.threshold} | ${e.recall.hits}/${e.recall.total} (${(e.recall.rate * 100).toFixed(1)}%) `
      + `| ${e.false_positives.fps}/${e.false_positives.total} (${(e.false_positives.rate * 100).toFixed(1)}%) |`);
  }
  L.push('', 'Per-mechanism recall at the middle threshold:');
  const mid = evals[Math.floor(evals.length / 2)];
  for (const [m, v] of Object.entries(mid.recall.by_mechanism)) L.push(`- ${m}: ${v.hits}/${v.total}`);
  L.push('', 'Compare with test/fixtures/screening-benchmark/baseline.json (our matcher) and the '
    + 'yente benchmark before drawing conclusions. Adopting Watchman as PRIMARY would be a matcher '
    + 'change governed by the recall-monotone invariant.');
  return L.join('\n');
}

async function main(argv) {
  const cmd = argv[0];
  if (cmd === 'dataset') {
    const out = argv[1] || '.watchman';
    mkdirSync(out, { recursive: true });
    const { listed } = loadFixtures();
    writeFileSync(join(out, 'hawkeye-bench.csv'), buildCsv(listed));
    writeFileSync(join(out, 'watchman.yml'), buildConfig());
    console.log(`watchman-bench: wrote ${listed.size} names + config to ${out}/`);
    return 0;
  }
  if (cmd === 'run') {
    const base = (argv[1] || 'http://127.0.0.1:8084').replace(/\/$/, '');
    const dir = argv[2] || '.watchman';
    const { pairs, negs, listed } = loadFixtures();
    // The workflow uploads hawkeye-bench.csv with curl and saves each ingest
    // response here; this step only verifies them. Degrade loudly: an ingest
    // that parsed nothing would otherwise read as 0% recall.
    for (const kind of Object.keys(SOURCES)) {
      const d = JSON.parse(readFileSync(join(dir, `ingest-${SOURCES[kind]}.json`), 'utf8'));
      const n = (d.entities || []).length;
      if (n !== listed.size) throw new Error(`watchman ingest ${kind}: parsed ${n} of ${listed.size} names`);
    }
    const subjects = [...new Set([...pairs, ...negs].map(x => x.subject))];
    const results = new Map();
    for (const [i, s] of subjects.entries()) {
      let best = 0;
      for (const kind of Object.keys(SOURCES)) {
        const q = new URLSearchParams({ source: SOURCES[kind], type: kind, name: s, minMatch: '0', limit: '1' });
        const r = await fetch(`${base}/v2/search?${q}`);
        if (!r.ok) throw new Error(`watchman search http ${r.status}: ${(await r.text()).slice(0, 200)}`);
        const top = ((await r.json()).entities || [])[0];
        best = Math.max(best, top ? (top.match ?? 0) : 0);
      }
      results.set(s, best);
      if ((i + 1) % 25 === 0 || i + 1 === subjects.length) {
        console.error(`watchman-bench: searched ${i + 1}/${subjects.length}`);
      }
    }
    const md = report(THRESHOLDS.map(t => evaluate(pairs, negs, results, t)));
    writeFileSync('watchman-bench-report.md', md + '\n');
    console.log(md);
    return 0;
  }
  console.error('usage: watchman-bench.mjs dataset <outdir> | run <watchman-url> [dir]');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
}
