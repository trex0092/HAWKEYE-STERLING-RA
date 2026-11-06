#!/usr/bin/env node
/* Aho-Corasick benchmark: EXPERIMENTAL, shadow-only, dependency-free.

   Question: can one pass over an article find every screened name at once, in
   place of one substring search per name? The candidate is the Aho-Corasick
   automaton (the idea behind WojciechMula/pyahocorasick, BSD-3-Clause), written
   here from the published algorithm with no third-party code, so it carries no
   dependency and no licence obligation.

   What it measures, on a deterministic synthetic corpus built from the repo's
   own frozen screening benchmark names (test/fixtures/screening-benchmark):

   - CORRECTNESS: for every article the automaton must find exactly the same set
     of names as the plain one-name-at-a-time search. A single difference fails
     the run (exit code 1). This is the recall-monotone rule applied to a new
     scanning strategy: it may be faster, but it must never find less.
   - PLANTED RECALL: names planted at known places must all be found.
   - SPEED: wall time of both strategies and their ratio. Timings vary between
     machines and runs, so they are reported, never asserted.

   Nothing here touches the live matcher, screening state, cases or Asana. */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PAIRS_FILE = 'test/fixtures/screening-benchmark/recall-pairs.json';
const NEGS_FILE = 'test/fixtures/screening-benchmark/hard-negatives.json';

/* Same folding for both strategies, so any difference comes from the scan. */
export function fold(s) {
  return String(s).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function buildAutomaton(patterns) {
  /* patterns: array of strings. Empty patterns are ignored. Returns an object
     whose `patterns` array holds the folded, de-duplicated patterns. */
  const seen = new Map();
  const list = [];
  for (const raw of patterns) {
    const p = fold(raw);
    if (!p || seen.has(p)) continue;
    seen.set(p, list.length);
    list.push(p);
  }
  const next = [new Map()];
  const fail = [0];
  const out = [[]];   // pattern ids ending exactly at this state
  list.forEach((p, id) => {
    let s = 0;
    for (const ch of p) {
      let t = next[s].get(ch);
      if (t === undefined) {
        t = next.length;
        next.push(new Map()); fail.push(0); out.push([]);
        next[s].set(ch, t);
      }
      s = t;
    }
    out[s].push(id);
  });
  /* Breadth-first: failure links, and each state inherits the outputs of its
     failure state (so "ab" is reported when "b" is a suffix of the text read). */
  const queue = [];
  for (const t of next[0].values()) { fail[t] = 0; queue.push(t); }
  while (queue.length) {
    const s = queue.shift();
    for (const [ch, t] of next[s]) {
      let f = fail[s];
      while (f !== 0 && !next[f].has(ch)) f = fail[f];
      const g = next[f].get(ch);
      fail[t] = g !== undefined && g !== t ? g : 0;
      out[t] = out[t].concat(out[fail[t]]);
      queue.push(t);
    }
  }
  return { patterns: list, next, fail, out };
}

export function scan(automaton, text) {
  /* One pass. Returns the Set of pattern ids that occur anywhere in the text. */
  const { next, fail, out } = automaton;
  const found = new Set();
  let s = 0;
  for (const ch of fold(text)) {
    while (s !== 0 && !next[s].has(ch)) s = fail[s];
    const t = next[s].get(ch);
    s = t === undefined ? 0 : t;
    for (const id of out[s]) found.add(id);
  }
  return found;
}

export function naiveScan(patterns, text) {
  /* The reference: one substring search per name. */
  const folded = fold(text);
  const found = new Set();
  patterns.forEach((p, id) => { if (folded.includes(p)) found.add(id); });
  return found;
}

export function rng(seed) {
  /* mulberry32: small, deterministic, identical on every machine. */
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function loadNames() {
  const pairs = JSON.parse(readFileSync(PAIRS_FILE, 'utf8')).pairs;
  const negsRaw = JSON.parse(readFileSync(NEGS_FILE, 'utf8'));
  const negs = negsRaw.pairs || negsRaw.items || [];
  const names = new Set();
  for (const p of [...pairs, ...negs]) {
    if (p.listed) names.add(p.listed);
    if (p.subject) names.add(p.subject);
  }
  return [...names].sort();
}

const FILLER = ('the of and to in for on with by from at as is was were has had said report reports ' +
  'according officials company director meeting trade gold market bank court case filed review ' +
  'statement announced investigation authority regulator licence shipment customer payment').split(' ');

export function buildCorpus(names, articles, seed = 20261106) {
  /* Deterministic corpus. Each article is filler words drawn from the benchmark
     names' own tokens plus common words (so partial overlaps and near misses
     occur), and about one in six plants one full name. */
  const rand = rng(seed);
  const vocab = [...new Set(names.flatMap(n => fold(n).split(' ')))].concat(FILLER);
  const corpus = [];
  for (let i = 0; i < articles; i++) {
    const n = 40 + Math.floor(rand() * 41);
    const words = [];
    for (let k = 0; k < n; k++) words.push(vocab[Math.floor(rand() * vocab.length)]);
    let planted = null;
    if (rand() < 1 / 6) {
      planted = names[Math.floor(rand() * names.length)];
      words.splice(Math.floor(rand() * words.length), 0, planted);
    }
    corpus.push({ text: words.join(' '), planted });
  }
  return corpus;
}

export function evaluate(names, corpus) {
  const automaton = buildAutomaton(names);
  const index = new Map(automaton.patterns.map((p, id) => [p, id]));
  let t0 = process.hrtime.bigint();
  const naive = corpus.map(a => naiveScan(automaton.patterns, a.text));
  const naiveMs = Number(process.hrtime.bigint() - t0) / 1e6;
  t0 = process.hrtime.bigint();
  const ac = corpus.map(a => scan(automaton, a.text));
  const acMs = Number(process.hrtime.bigint() - t0) / 1e6;
  let differing = 0, matches = 0, planted = 0, plantedFound = 0;
  corpus.forEach((a, i) => {
    const x = naive[i], y = ac[i];
    matches += x.size;
    if (x.size !== y.size || [...x].some(id => !y.has(id))) differing++;
    if (a.planted) {
      planted++;
      if (y.has(index.get(fold(a.planted)))) plantedFound++;
    }
  });
  return { patterns: automaton.patterns.length, articles: corpus.length,
    matches, differing, planted, plantedFound, naiveMs, acMs,
    states: automaton.next.length };
}

export function report(r) {
  const ok = r.differing === 0 && r.plantedFound === r.planted;
  const speed = r.acMs > 0 ? (r.naiveMs / r.acMs).toFixed(1) : 'n/a';
  return [
    '# Aho-Corasick benchmark (experimental, shadow-only)', '',
    'A single-pass automaton is compared with one substring search per name, on a deterministic ' +
      'synthetic corpus built from the repo\'s own benchmark names. No external data is downloaded and ' +
      'the live matcher is unchanged.', '',
    '| Measure | Result |', '|---|---|',
    `| Names in the automaton | ${r.patterns} |`,
    `| Automaton states | ${r.states} |`,
    `| Articles scanned | ${r.articles} |`,
    `| Name occurrences found by the plain search | ${r.matches} |`,
    `| Articles where the two strategies disagree | ${r.differing} |`,
    `| Planted names found | ${r.plantedFound} of ${r.planted} |`,
    `| Plain search time | ${r.naiveMs.toFixed(1)} ms |`,
    `| Automaton time | ${r.acMs.toFixed(1)} ms |`,
    `| Plain search time divided by automaton time | ${speed} |`, '',
    ok ? '**Result: the automaton found exactly what the plain search found.**'
       : '**Result: FAILED. The automaton and the plain search disagree, or a planted name was missed. ' +
         'Do not adopt it.**', '',
    'Timings differ between machines and runs and are information only. Correctness is the test: ' +
      'any scanning change for the live matchers is governed by the recall-monotone rule ' +
      '(`test/fixtures/screening-benchmark/floors.json`) and must keep the Python and JavaScript ' +
      'matchers in agreement.', ''].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const articles = Number(process.argv[2]) || 4000;
  const r = evaluate(loadNames(), buildCorpus(loadNames(), articles));
  const md = report(r);
  writeFileSync('aho-corasick-bench-report.md', md);
  console.log(md);
  if (r.differing !== 0 || r.plantedFound !== r.planted) process.exit(1);
}
