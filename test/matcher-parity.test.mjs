/* Cross-engine matcher parity — screen.py vs scripts/sanctions-match.mjs.
 *
 * WHY THIS EXISTS. The sanctions matcher is implemented twice: screen.py
 * (rapidfuzz) and scripts/sanctions-match.mjs (a zero-dependency JS
 * reimplementation that drives the live screen in sanctions-screen.yml).
 * Parity was maintained by hand — eighteen "mirrors screen.py" comments in
 * sanctions-match.mjs — and it has failed twice, both times as a SILENT
 * FALSE NEGATIVE on the JS side:
 *
 *   1. Turkish dotless "ı" was not folded, so "Kılıç" and "Kilic" normalized
 *      to different strings (fixed in normalizeName).
 *   2. Two-letter name tokens were dropped from the candidate index, so
 *      "Yu Li Pang" against listed "YU LI PING" had no candidate path at all
 *      and cleared, while screen.py scored it 90 (fixed in sigTokens).
 *
 * Neither was caught by the accuracy benchmarks, because those score each
 * engine against its OWN floor — test/benchmark_eval.py: "every floor is
 * enforced per backend — the two are NOT comparable." Nothing compared the
 * engines to EACH OTHER. That is the gap this file closes.
 *
 * WHAT IT ASSERTS, and what it deliberately does not:
 *
 *   - lost-script predicate: EXACT parity. This is the gate that stops a
 *     Cyrillic/Arabic/CJK subject from silently clearing against Latin-indexed
 *     lists, so the two engines must agree on it for every name.
 *   - normalize: EXACT parity (case-folded) for names that are not lost-script.
 *     Both historical bugs lived in this class. Lost-script names legitimately
 *     diverge — screen.py folds to an ASCII residue, the JS engine keeps the
 *     original script — so they are asserted on the `lost` flag instead.
 *   - significant tokens: DIRECTIONAL. screen.py's tokens must be a SUBSET of
 *     the JS engine's. The JS engine may keep more (it does not treat name
 *     particles "BIN"/"AL" as stopwords, where screen.py does) because extra
 *     tokens only ever ADD candidates — the recall-safe direction, and the one
 *     the committed floors already account for (JS negative_clear 0.964 vs
 *     Python 1.0, "the Python engine is the precision reference"). Keeping
 *     FEWER is the silent-miss direction, and that is what fails this test.
 *   - true-match pairs: DIRECTIONAL. If screen.py reaches a hit, the JS engine
 *     must too. Scores are NOT compared: rapidfuzz and the JS Levenshtein
 *     legitimately differ by a point or two (measured 93 vs 94), and CI's main
 *     test job runs Python on the difflib backend while the fuzz job runs
 *     rapidfuzz. Asserting the direction keeps this valid under either backend.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process'; // nosemgrep: hawkeye-no-child-process
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  normalizeName, sigTokens, lostScriptLetters, buildIndex, screenName
} from '../scripts/sanctions-match.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpus = JSON.parse(
  readFileSync(join(ROOT, 'test/fixtures/matcher-parity/corpus.json'), 'utf8')
);

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (detail ? '\n      ' + detail : '')); }
}

/* ── run the screen.py half ────────────────────────────────────────────────
   Fixed interpreter, repo-controlled argv, payload over stdin — nothing
   user-supplied reaches the spawn (same shape as scripts/run-tests.mjs). */
const probe = spawnSync(
  process.env.PYTHON || 'python3',
  [join(ROOT, 'scripts/matcher-parity-probe.py')],
  { cwd: ROOT, input: JSON.stringify({ names: corpus.names, pairs: corpus.pairs }),
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
);

if (probe.status !== 0) {
  /* A missing interpreter must never read as "parity holds". Fail loudly —
     the same principle the screening engine applies to a list it cannot load:
     DEGRADED is reported, never a silent clear. */
  console.log('FAIL  screen.py parity probe did not run');
  console.log('      exit=' + probe.status + ' ' + String(probe.stderr || probe.error || '').trim().split('\n').slice(-4).join('\n      '));
  process.exit(1);
}

const py = JSON.parse(probe.stdout);
console.log(`— cross-engine matcher parity (screen.py backend: ${py.backend}) —\n`);

/* ── 1. lost-script predicate: exact parity, every name ──────────────────── */
const lostDiffs = corpus.names.filter(
  (n) => py.names[n].lost !== lostScriptLetters(n)
);
check(
  'lost-script predicate agrees on every name (the anti-silent-clear gate)',
  lostDiffs.length === 0,
  lostDiffs.map((n) => `${JSON.stringify(n)}: py=${py.names[n].lost} js=${lostScriptLetters(n)}`).join('\n      ')
);

/* ── 2. normalize: exact parity on the non-lost-script class ─────────────── */
const latin = corpus.names.filter((n) => !py.names[n].lost);
const normDiffs = latin.filter((n) => py.names[n].norm !== normalizeName(n).toUpperCase());
check(
  `normalize agrees on all ${latin.length} foldable names (Turkish-ı regression class)`,
  normDiffs.length === 0,
  normDiffs.map((n) => `${JSON.stringify(n)}: py=${JSON.stringify(py.names[n].norm)} js=${JSON.stringify(normalizeName(n).toUpperCase())}`).join('\n      ')
);

/* ── 3. significant tokens: screen.py ⊆ sanctions-match.mjs ────────────────
   Pure-digit tokens are excluded from the comparison: the JS engine drops them
   from the FUZZY index on purpose, and compensates on both sides — a
   digit-identical name still matches through the exact-name path, and a name
   left with no screenable token routes to MANUAL REVIEW. Assertion 3b pins
   that compensation so the exclusion here can never quietly become a hole. */
const tokDiffs = [];
for (const n of latin) {
  const jsToks = sigTokens(normalizeName(n)).map((t) => t.toUpperCase());
  const missing = py.names[n].core
    .filter((t) => !/^\d+$/.test(t))
    .filter((t) => !jsToks.includes(t));
  if (missing.length) {
    tokDiffs.push(`${JSON.stringify(n)}: screen.py keeps [${missing}] that the JS index drops (py=[${py.names[n].core}] js=[${jsToks}])`);
  }
}
check(
  'every screen.py significant token survives into the JS candidate index (two-letter-token regression class)',
  tokDiffs.length === 0,
  tokDiffs.join('\n      ')
);

/* ── 3b. …and the pure-digit exclusion stays compensated, not a hole ─────── */
const digitIdx = buildIndex([{ id: 'd', name: 'PARITY', names: ['12345'] }]);
check(
  'a digit-only name still matches exactly, and an unmatched one routes to review not clear',
  screenName('12345', digitIdx, 85).recommendation === 'sanctions-match' &&
  screenName('99999', digitIdx, 85).recommendation === 'review',
  'the JS engine drops pure-digit tokens from the fuzzy index; without the exact path and the manual-review gate that is a silent clear'
);

/* ── 4. true-match pairs: a screen.py hit implies a JS hit ───────────────── */
const pairDiffs = [];
corpus.pairs.forEach((pair, i) => {
  const pyHit = py.pairs[i].hit;
  if (!pyHit) return;   // difflib backend may score under threshold; not a JS defect
  const idx = buildIndex([{ id: 'p', name: 'PARITY', names: [pair.listed] }]);
  const js = screenName(pair.subject, idx, 85);
  const jsHit = js.recommendation === 'sanctions-match' || js.recommendation === 'review';
  if (!jsHit) {
    pairDiffs.push(`${JSON.stringify(pair.subject)} vs listed ${JSON.stringify(pair.listed)}: screen.py HIT (${py.pairs[i].score}) but JS ${js.recommendation} — ${pair.why}`);
  }
});
const pyHitCount = py.pairs.filter((p) => p.hit).length;
check(
  `every screen.py hit is reached by the JS engine too (${pyHitCount}/${corpus.pairs.length} pairs hit on ${py.backend})`,
  pairDiffs.length === 0,
  pairDiffs.join('\n      ')
);

/* ── 5. the corpus itself must keep covering both regression classes ─────── */
check(
  'corpus still pins both historical parity failures',
  corpus.pairs.some((p) => /dotless/i.test(p.why)) &&
  corpus.pairs.some((p) => /two-letter/i.test(p.why)),
  'a regression pin was removed from test/fixtures/matcher-parity/corpus.json'
);
check(
  'corpus covers the lost-script class on both sides of the gate',
  corpus.names.some((n) => py.names[n].lost) && corpus.names.some((n) => !py.names[n].lost),
  'corpus no longer exercises both lost-script and foldable names'
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
