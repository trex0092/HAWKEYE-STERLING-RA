/* Property-based / fuzz tests for the in-repo sanctions matcher (no network).
   Complements sanctions-match.test.mjs (fixed cases) by asserting algebraic
   invariants over thousands of randomised, adversarial inputs — the kind of
   transliteration / unicode / control-character edge cases that break naive
   name matching. Deterministic: a seeded PRNG (no Math.random/Date) so a CI
   failure always reproduces locally.
   Usage: node test/sanctions-match-fuzz.test.mjs */
import {
  normalizeName, sigTokens, screenableTokens, parseDelimited, levenshtein, similarity,
  buildIndex, screenName
} from '../scripts/sanctions-match.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.log('FAIL  ' + name); }
}

/* ── deterministic PRNG (mulberry32) — reproducible fuzzing ── */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x5A17C0DE);
const ri = (n) => Math.floor(rnd() * n);

/* Adversarial alphabet: ASCII letters/digits, punctuation, whitespace, quotes,
   combining diacritics, Arabic/Cyrillic letters, and control chars. */
const ALPHABET = (
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' +
  '   .,-_/\\\'"()[]&;:\n\r\t' +
  'éüñİşğ' +   // é ü ñ İ ş ğ
  '̧́̈' +                     // combining accent, cedilla, diaeresis
  'المحمد' +   // Arabic letters
  'Владим'     // Cyrillic letters
);
function randStr(maxLen) {
  const n = ri(maxLen + 1);
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[ri(ALPHABET.length)];
  return s;
}

/* ── normalizeName: total, idempotent, output charset bounded ── */
for (let i = 0; i < 4000; i++) {
  const s = randStr(40);
  let n1, n2;
  try { n1 = normalizeName(s); n2 = normalizeName(n1); }
  catch { check('normalizeName never throws on input #' + i, false); continue; }
  check('normalizeName returns a string', typeof n1 === 'string');
  check('normalizeName is idempotent', n1 === n2);
  /* Letters/digits in ANY script (non-Latin names must survive folding — the
     old [a-z0-9]-only contract was the Arabic/Cyrillic silent-clear bug),
     no combining marks, no uppercase, single-spaced, trimmed. */
  check('normalizeName emits only letters/digits/spaces (any script), mark-free and trimmed',
    /^[\p{L}\p{N} ]*$/u.test(n1) && !/[\p{M}\p{Lu}]/u.test(n1) && n1 === n1.trim() && !/\s\s/.test(n1));
}

/* ── sigTokens: every token significant (len>=2 — screen.py core_tokens parity
   — not pure-digit); screenableTokens is the same set at the stricter len>=3,
   so it is always a SUBSET. That subset relation is the invariant that keeps
   widening candidate recall from ever quietly widening the auto-screenable
   gate: sigTokens may grow, screenableTokens may not grow with it. ── */
for (let i = 0; i < 2000; i++) {
  const norm = normalizeName(randStr(50));
  let toks, screenable;
  try {
    toks = sigTokens(norm);
    screenable = screenableTokens(norm);
  } catch { check('sigTokens never throws #' + i, false); continue; }
  check('sigTokens returns an array of qualifying tokens',
    Array.isArray(toks) && toks.every(t => t.length >= 2 && !/^\d+$/.test(t) && t.indexOf(' ') === -1));
  check('screenableTokens is the len>=3 subset of sigTokens',
    Array.isArray(screenable)
    && screenable.every(t => t.length >= 3 && toks.includes(t))
    && screenable.length === toks.filter(t => t.length >= 3).length);
}

/* ── levenshtein: a true metric (identity, symmetry, bounds, triangle) ── */
for (let i = 0; i < 3000; i++) {
  const a = randStr(18), b = randStr(18), c = randStr(18);
  const ab = levenshtein(a, b), ba = levenshtein(b, a);
  const ac = levenshtein(a, c), bc = levenshtein(b, c);
  check('levenshtein identity', levenshtein(a, a) === 0);
  check('levenshtein symmetry', ab === ba);
  check('levenshtein non-negative integer <= max length',
    Number.isInteger(ab) && ab >= 0 && ab <= Math.max(a.length, b.length));
  check('levenshtein triangle inequality', ac <= ab + bc);
}

/* ── similarity: bounded 0..100, symmetric, self==100, empty==0 ── */
for (let i = 0; i < 3000; i++) {
  const a = normalizeName(randStr(30)), b = normalizeName(randStr(30));
  const s = similarity(a, b);
  check('similarity in [0,100]', s >= 0 && s <= 100);
  check('similarity symmetric', Math.abs(s - similarity(b, a)) < 1e-9);
  if (a) check('similarity of identical non-empty names is 100', similarity(a, a) === 100);
  check('similarity with an empty operand is 0', similarity(a, '') === 0 && similarity('', b) === 0);
}

/* ── screenName: total on garbage, shape valid, exact members recalled ── */
const designated = [];
for (let i = 0; i < 300; i++) {
  const nm = randStr(30);
  if (normalizeName(nm)) designated.push(nm);
}
const index = buildIndex([{ id: 'fuzz', name: 'FUZZ LIST', names: designated }]);

for (let i = 0; i < 2000; i++) {
  const subj = randStr(35);
  let r;
  try { r = screenName(subj, index, 85); }
  catch { check('screenName never throws on adversarial input #' + i, false); continue; }
  check('screenName returns a well-formed row',
    typeof r.topScore === 'number' && r.topScore >= 0 && r.topScore <= 100 &&
    Array.isArray(r.lists) && r.hitCount === r.lists.length &&
    (r.recommendation === 'clear' || r.recommendation === 'sanctions-match' || r.recommendation === 'review'));
  check('screenName: a clear result carries no hits and low band',
    r.recommendation !== 'clear' || (r.hitCount === 0 && r.band === 'low'));
  check('screenName: a review result is exactly the MANUAL REVIEW marker (score 0, one pseudo-hit)',
    r.recommendation !== 'review' || (r.hitCount === 1 && r.topScore === 0 && r.lists[0].list === 'MANUAL REVIEW'));
  /* Unscreenable ⇒ never a silent clear: a non-empty raw name that folds to no
     significant token has no candidate path — it must route to MANUAL REVIEW
     (or be an exact designated-name hit), the property behind the "Yu Li" /
     symbols-only silent-clear regression. */
  const norm = normalizeName(subj);
  if (subj.trim() && sigTokens(norm).length === 0) {
    check('screenName never silently clears an unscreenable name',
      r.recommendation === 'review' || (r.recommendation === 'sanctions-match' && r.topScore === 100));
  }
}

/* Recall guarantee: any designated name screened against its own index must be
   an exact hit (topScore 100) — the property that stops a list member slipping
   through. */
for (const nm of designated) {
  const r = screenName(nm, index, 85);
  check('screenName recalls an exact list member at 100', r.topScore === 100 && r.hitCount >= 1);
}

/* ── parseDelimited: total on arbitrary bytes, always rows of string fields ── */
for (let i = 0; i < 1500; i++) {
  const text = randStr(60);
  const delim = rnd() < 0.5 ? ',' : ';';
  let rows;
  try { rows = parseDelimited(text, delim); } catch { check('parseDelimited never throws #' + i, false); continue; }
  check('parseDelimited returns rows of string fields',
    Array.isArray(rows) && rows.every(row => Array.isArray(row) && row.every(f => typeof f === 'string')));
}

console.log('\n' + passed + ' property checks passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
