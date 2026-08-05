#!/usr/bin/env node
/* Screening accuracy benchmark — JS engine backend.
   Runs the labelled ground-truth corpus (test/fixtures/screening-benchmark/)
   through the real matcher (scripts/sanctions-match.mjs) and the real
   adverse-media scorer (scripts/adverse-media.mjs), entirely offline, and
   computes recall / precision / adverse classification accuracy.

   Modes:
     node scripts/screening-benchmark.mjs            print the metric table and
                                                     compare against the frozen
                                                     baseline (informational —
                                                     the CI gate lives in
                                                     test/screening-benchmark.test.mjs)
     node scripts/screening-benchmark.mjs --freeze   write this backend's section
                                                     of baseline.json (one-time,
                                                     at the pre-hardening commit;
                                                     re-freezing after behaviour
                                                     changes is a governance
                                                     action — see
                                                     docs/governance/screening-accuracy-benchmark.md)

   Metric definitions (shared with test/benchmark_eval.py):
     recall            true-equivalent pairs the matcher links / all pairs
     negative_clear    hard-negative pairs left clear / all negatives
     adverse accuracy  headline items classified to their label / applicable
                       items ("actionable" = flagged AND not weak-tier-only;
                       ground truth actionable = label "adverse")
   Per-mechanism recall is reported so a regression in one recall path can not
   hide inside an average. */

import { readFileSync, writeFileSync } from 'node:fs';
import { buildIndex, screenName } from './sanctions-match.mjs';
import { scoreAdverseMedia, dedupItems, ALL_TERMS } from './adverse-media.mjs';

const FIX = p => new URL('../test/fixtures/screening-benchmark/' + p, import.meta.url);
const load = p => JSON.parse(readFileSync(FIX(p), 'utf8'));

export const BACKEND = 'js';

/* One subject screened against exactly its paired listed name — the same
   single-entry protocol test/bias_eval.py uses, so a pair's outcome is never
   confounded by cross-talk with another pair's designation. */
function pairHits(subject, listed) {
  const idx = buildIndex([{ id: 'bench', name: 'BENCH', names: [listed] }]);
  const r = screenName(subject, idx);
  /* A hit is a GENUINE LIST HIT — the exact definition test/benchmark_eval.py
     uses for the Python engine (any hit whose list is not MANUAL REVIEW).
     Weak-mechanism hits (subset/phonetic) now band review/medium instead of
     sanctions-match, but they are still recorded list hits: counting only
     `recommendation === 'sanctions-match'` here would misread the severity
     recalibration as a recall loss. Verified equivalent on the pre-change
     engine (identical 131/132 + 85/85 under both definitions). */
  return (r.lists || []).some(h => h.list === 'BENCH');
}

export function runSanctions() {
  const recall = load('recall-pairs.json');
  const negatives = load('hard-negatives.json');

  const byMech = {};
  const fnIds = [];
  for (const p of recall.pairs) {
    const hit = pairHits(p.subject, p.listed);
    const m = (byMech[p.mechanism] ||= { total: 0, hits: 0 });
    m.total++;
    if (hit) m.hits++;
    else fnIds.push(p.id);
  }
  const total = recall.pairs.length;
  const hits = total - fnIds.length;

  /* Entries carrying a "note" are accepted, budgeted exceptions (reviewed like
     code): a hit there is reported but does not count against the clear rate
     the floors gate — the floor stays ratchet-only while the budgeted cost of
     a recall gain remains visible in every report. */
  const fpIds = [], budgetedFpIds = [];
  for (const n of negatives.pairs) {
    if (pairHits(n.subject, n.listed)) (n.note ? budgetedFpIds : fpIds).push(n.id);
  }

  return {
    recall: { total, hits, rate: hits / total, by_mechanism: byMech, fn_ids: fnIds },
    negatives: {
      total: negatives.pairs.length,
      clear: negatives.pairs.length - fpIds.length,
      clear_rate: (negatives.pairs.length - fpIds.length) / negatives.pairs.length,
      fp_ids: fpIds,
      budgeted_fp_ids: budgetedFpIds
    }
  };
}

export function runAdverse() {
  const corpus = load('adverse-headlines.json');
  const items = corpus.items.filter(i => (i.engines || ['py', 'js']).includes('js'));

  let correct = 0;
  const wrong = [];
  for (const it of items) {
    const r = scoreAdverseMedia(it.subject,
      [{ title: it.title, link: it.url, source: it.source_domain, description: it.description }],
      ALL_TERMS);
    /* actionable = flagged and not weak-tier-only; before keyword tiers exist
       (r.tier undefined) every hit is actionable — that IS the pre-hardening
       behaviour being measured. */
    const actionable = !!r.hit && r.tier !== 'weak';
    const truth = it.label === 'adverse';
    if (actionable === truth) correct++;
    else wrong.push(it.id);
  }

  /* Syndication-collapse probe: the same article re-served under rotating
     tracking params must dedupe to ONE item once link canonicalization lands.
     Reported informationally; asserted by test/adverse-media.test.mjs. */
  const s02 = corpus.repeat_scenarios.find(s => s.id === 's02');
  const dedupCount = s02
    ? dedupItems(s02.stories.map(st => ({ title: st.title, link: st.url, source: st.source }))).length
    : null;

  return {
    classification: { total: items.length, correct, accuracy: correct / items.length, wrong_ids: wrong },
    syndication_dedup_count: dedupCount
  };
}

export function computeAll() {
  return { backend: BACKEND, sanctions: runSanctions(), adverse: runAdverse() };
}

function fmt(x) { return (100 * x).toFixed(1) + '%'; }

function printReport(m, baseline) {
  const s = m.sanctions, a = m.adverse;
  console.log(`screening-benchmark backend=${m.backend}`);
  console.log(`  sanctions recall        ${s.recall.hits}/${s.recall.total}  ${fmt(s.recall.rate)}`);
  for (const [mech, v] of Object.entries(s.recall.by_mechanism)) {
    console.log(`    ${mech.padEnd(16)} ${v.hits}/${v.total}`);
  }
  if (s.recall.fn_ids.length) console.log(`    missed: ${s.recall.fn_ids.join(' ')}`);
  console.log(`  hard-negatives clear    ${s.negatives.clear}/${s.negatives.total}  ${fmt(s.negatives.clear_rate)}`);
  if (s.negatives.fp_ids.length) console.log(`    false positives: ${s.negatives.fp_ids.join(' ')}`);
  if (s.negatives.budgeted_fp_ids && s.negatives.budgeted_fp_ids.length) {
    console.log(`    budgeted (noted) false positives: ${s.negatives.budgeted_fp_ids.join(' ')}`);
  }
  console.log(`  adverse classification  ${a.classification.correct}/${a.classification.total}  ${fmt(a.classification.accuracy)}`);
  if (a.classification.wrong_ids.length) console.log(`    misclassified: ${a.classification.wrong_ids.join(' ')}`);
  console.log(`  syndication dedup count ${a.syndication_dedup_count} (target 1)`);
  const base = baseline && baseline.backends && baseline.backends[m.backend];
  if (base) {
    console.log(`  vs frozen baseline: recall ${fmt(base.sanctions.recall.rate)} -> ${fmt(s.recall.rate)}; ` +
      `fn ${base.sanctions.recall.total - base.sanctions.recall.hits} -> ${s.recall.total - s.recall.hits}; ` +
      `adverse ${fmt(base.adverse.classification.accuracy)} -> ${fmt(a.classification.accuracy)}`);
  }
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (invokedDirectly) {
  const metrics = computeAll();
  let baseline = null;
  try { baseline = load('baseline.json'); } catch { /* not frozen yet */ }
  if (process.argv.includes('--freeze')) {
    const out = baseline || { version: 1, description: 'Frozen pre-hardening benchmark baseline, per backend. Written once by the runners\' --freeze mode; CI compares against it and never rewrites it. Re-freezing is a governance action (docs/governance/screening-accuracy-benchmark.md).', backends: {} };
    out.backends[BACKEND] = { sanctions: metrics.sanctions, adverse: metrics.adverse };
    writeFileSync(FIX('baseline.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(`baseline.json: ${BACKEND} section frozen`);
  }
  printReport(metrics, baseline);
}
