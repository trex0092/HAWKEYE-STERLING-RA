#!/usr/bin/env node
/* Yente matching benchmark — EXPERIMENTAL, shadow-only, PII-free.

   Evaluates the open-source yente matching engine (MIT; the code behind the
   OpenSanctions API) against this repo's OWN frozen screening benchmark:
   the fixtures' `listed` names are indexed as a CUSTOM yente dataset (no
   OpenSanctions data is downloaded — the published database carries a
   non-commercial licence; the fixtures are ours), then every `subject` name
   from the recall pairs (must match) and hard negatives (must NOT match) is
   sent to /match. Output: recall + false-positive rates side by side with
   the committed baseline, so the decision "does identifier-aware matching
   software add value over our matcher" is made from measurements, not
   marketing. Nothing here touches screening state, cases, or Asana.

   Subcommands:
     dataset <outdir>   write hawkeye-bench.ftm.json + manifest.yml for yente
     run <yente-url>    run the benchmark against a live yente, print report
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const PAIRS_FILE = 'test/fixtures/screening-benchmark/recall-pairs.json';
const NEGS_FILE = 'test/fixtures/screening-benchmark/hard-negatives.json';
export const DATASET = 'hawkeye_bench';

export function ftmEntity(name, idSeed) {
  /* Minimal FollowTheMoney entity yente can index: stable id, LegalEntity
     schema (matches both people and organisations for name-matching), the
     name, and the sanction topic so /match treats it as a designation. */
  const id = 'hb-' + createHash('sha1').update(String(idSeed || name)).digest('hex').slice(0, 16);
  return { id, schema: 'LegalEntity', properties: { name: [String(name)], topics: ['sanction'] } };
}

export function buildManifest(entitiesPath) {
  return [
    'datasets:',
    `  - name: ${DATASET}`,
    '    title: Hawkeye benchmark fixtures (self-generated, no external data)',
    `    path: ${entitiesPath}`,
    '',
  ].join('\n');
}

export function matchQuery(subject) {
  return { schema: 'LegalEntity', properties: { name: [String(subject)] } };
}

export function evaluate(pairs, negatives, resultsBySubject, threshold) {
  /* resultsBySubject: subject → top yente score (0..1) against the indexed
     listed names. A recall pair scores a hit when its top score ≥ threshold;
     a hard negative is a false positive under the same rule. */
  const hit = (s) => (resultsBySubject.get(s) ?? 0) >= threshold;
  const byMech = {};
  let hits = 0;
  for (const p of pairs) {
    const ok = hit(p.subject);
    if (ok) hits++;
    const m = p.mechanism || 'other';
    byMech[m] = byMech[m] || { total: 0, hits: 0 };
    byMech[m].total++;
    if (ok) byMech[m].hits++;
  }
  let fps = 0;
  for (const n of negatives) if (hit(n.subject)) fps++;
  return {
    threshold,
    recall: { total: pairs.length, hits, rate: pairs.length ? hits / pairs.length : 0, by_mechanism: byMech },
    false_positives: { total: negatives.length, fps, rate: negatives.length ? fps / negatives.length : 0 },
  };
}

export function report(evals) {
  const L = ['# Yente matching benchmark (experimental, shadow-only)', '',
    'Indexed: the repo\'s own benchmark fixtures — no external data downloaded.', ''];
  L.push('| threshold | recall | false-positive rate |');
  L.push('| --- | --- | --- |');
  for (const e of evals) {
    L.push(`| ${e.threshold} | ${e.recall.hits}/${e.recall.total} (${(e.recall.rate * 100).toFixed(1)}%) `
      + `| ${e.false_positives.fps}/${e.false_positives.total} (${(e.false_positives.rate * 100).toFixed(1)}%) |`);
  }
  L.push('');
  L.push('Per-mechanism recall at the middle threshold:');
  const mid = evals[Math.floor(evals.length / 2)];
  for (const [m, v] of Object.entries(mid.recall.by_mechanism)) {
    L.push(`- ${m}: ${v.hits}/${v.total}`);
  }
  L.push('');
  L.push('Compare with test/fixtures/screening-benchmark/baseline.json (our matcher) '
    + 'before drawing conclusions; a decision to adopt yente as a corroboration '
    + 'engine is an engineering act, adoption as PRIMARY would be a matcher change '
    + 'governed by the recall-monotone invariant.');
  return L.join('\n');
}

async function main(argv) {
  const cmd = argv[0];
  if (cmd === 'dataset') {
    const out = argv[1] || '.yente';
    mkdirSync(out, { recursive: true });
    const pairs = JSON.parse(readFileSync(PAIRS_FILE, 'utf8')).pairs;
    const negs = JSON.parse(readFileSync(NEGS_FILE, 'utf8')).pairs
      || JSON.parse(readFileSync(NEGS_FILE, 'utf8')).items || [];
    const listed = new Map();
    for (const p of pairs) listed.set(p.listed, p.id);
    for (const n of negs) listed.set(n.listed, n.id);
    const lines = [...listed.entries()].map(([name, id]) => JSON.stringify(ftmEntity(name, id)));
    writeFileSync(join(out, 'hawkeye-bench.ftm.json'), lines.join('\n') + '\n');
    writeFileSync(join(out, 'manifest.yml'), buildManifest('/data/hawkeye-bench.ftm.json'));
    console.log(`yente-bench: wrote ${lines.length} entities + manifest to ${out}/`);
    return 0;
  }
  if (cmd === 'run') {
    const base = (argv[1] || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const pairs = JSON.parse(readFileSync(PAIRS_FILE, 'utf8')).pairs;
    const negsRaw = JSON.parse(readFileSync(NEGS_FILE, 'utf8'));
    const negs = negsRaw.pairs || negsRaw.items || [];
    const subjects = [...new Set([...pairs, ...negs].map(x => x.subject))];
    const results = new Map();
    const BATCH = 20;
    for (let i = 0; i < subjects.length; i += BATCH) {
      const batch = subjects.slice(i, i + BATCH);
      const queries = Object.fromEntries(batch.map((s, k) => ['q' + k, matchQuery(s)]));
      const r = await fetch(`${base}/match/${DATASET}?algorithm=best`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries }),
      });
      if (!r.ok) throw new Error(`yente /match http ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const d = await r.json();
      batch.forEach((s, k) => {
        const res = (d.responses || {})['q' + k];
        const top = ((res && res.results) || [])[0];
        results.set(s, top ? (top.score ?? 0) : 0);
      });
      console.error(`yente-bench: matched ${Math.min(i + BATCH, subjects.length)}/${subjects.length}`);
    }
    const evals = [0.5, 0.6, 0.7].map(t => evaluate(pairs, negs, results, t));
    const md = report(evals);
    writeFileSync('yente-bench-report.md', md + '\n');
    console.log(md);
    return 0;
  }
  console.error('usage: yente-bench.mjs dataset <outdir> | run <yente-url>');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
}
