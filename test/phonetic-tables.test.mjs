/* Schema and single-source guard for data/phonetic-tables.json — the shared
   phonetic-fold tables both engines load (screen.py phonetic_key +
   scripts/sanctions-match.mjs phoneticKey).

   These four tables were duplicated in code. A duplicated table in this repo has
   drifted twice already — the transliteration groups, then the corporate
   stopwords, the latter costing three hard-negative false positives — and before
   extracting these it was MEASURED that dropping one digraph ("kh") from the JS
   copy broke no test at all: full suite 74/74, parity 10/10, benchmark unmoved.
   The drift would have been silent, on the very class (Arabic خ: Khalid/Chalid,
   Khristos/Christos) the hard-ch recall pairs exist to protect.

   Usage: node test/phonetic-tables.test.mjs */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— phonetic-tables data schema —\n');

const data = JSON.parse(readFileSync(new URL('../data/phonetic-tables.json', import.meta.url), 'utf8'));

check('version is a positive integer', Number.isInteger(data.version) && data.version >= 1);
check('digraphs is a non-empty array', Array.isArray(data.digraphs) && data.digraphs.length > 0);

let shapeOk = true;
for (const g of data.digraphs) {
  if (!Array.isArray(g) || g.length !== 2) { shapeOk = false; continue; }
  if (typeof g[0] !== 'string' || !/^[a-z]+$/.test(g[0])) shapeOk = false;
  if (typeof g[1] !== 'string' || !/^[a-z]*$/.test(g[1])) shapeOk = false;
}
check('every digraph is a [lowercase pattern, lowercase replacement] pair', shapeOk);
check('no duplicate digraph pattern',
  new Set(data.digraphs.map(g => g[0])).size === data.digraphs.length);

/* ORDER IS THE WHOLE CONTRACT. Digraphs are applied in sequence as plain
   substring replacements, so a pattern that is a PREFIX of a later pattern would
   consume it first and silently change every key. "sh" before "shch" would make
   "shch" unreachable; "ch" before "tch" is what kept Tchaikovski and Chaykovskiy
   apart until r099 was closed. */
let orderOk = true;
const patterns = data.digraphs.map(g => g[0]);
for (let i = 0; i < patterns.length; i++) {
  for (let j = i + 1; j < patterns.length; j++) {
    if (patterns[j].startsWith(patterns[i])) { orderOk = false; }
  }
}
check('no digraph precedes a longer pattern it is a prefix of (order is load-bearing)', orderOk);

/* Spot-check the specific orderings whose violation has cost recall before. */
const pos = p => patterns.indexOf(p);
check('shch precedes sch precedes sh', pos('shch') < pos('sch') && pos('sch') < pos('sh'));
check('tch precedes ch (this ordering is what closed r099)', pos('tch') < pos('ch'));

/* kh must survive: it is what makes Arabic خ written "kh" fold with the same
   name written "ch". Dropping it broke NO test before this guard existed. */
check('the kh digraph is present (its silent loss was the motivating measurement)',
  patterns.includes('kh'));
check('the gh digraph is present', patterns.includes('gh'));

const isMap = o => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length > 0;
check('vowelClass is a non-empty map', isMap(data.vowelClass));
check('charMap is a non-empty map', isMap(data.charMap));
check('particles is a non-empty array of lowercase words',
  Array.isArray(data.particles) && data.particles.length > 0
  && data.particles.every(p => typeof p === 'string' && /^[a-z]+$/.test(p)));

/* Both engines must load THIS file — if either keeps an in-code table the
   single-source-of-truth property is silently gone and drift restarts. */
const pySrc = readFileSync(new URL('../screen.py', import.meta.url), 'utf8');
const jsSrc = readFileSync(new URL('../scripts/sanctions-match.mjs', import.meta.url), 'utf8');
check('screen.py loads data/phonetic-tables.json', pySrc.includes('phonetic-tables.json'));
check('sanctions-match.mjs loads data/phonetic-tables.json', jsSrc.includes('phonetic-tables.json'));
check('screen.py no longer carries an in-code digraph literal',
  !pySrc.includes('("shch", "s")'));
check('sanctions-match.mjs no longer carries an in-code digraph literal',
  !jsSrc.includes("['shch', 's']"));

/* Behavioural: the loaded tables must actually produce the folds they exist for.
   A schema check alone would pass on a well-formed but wrong table. */
const { phoneticKey } = await import('../scripts/sanctions-match.mjs');
const FOLDS = [
  ['chalid', 'khalid'],        // Arabic خ — the class the kh digraph protects
  ['chaled', 'khaled'],
  ['christos', 'khristos'],    // Greek χ
  ['zacharia', 'zakaria'],
  ['michail', 'mikhail'],
  ['tchaikovski', 'chaykovskiy'],  // r099
  ['ganouchi', 'ghannouchi'],
];
let foldsOk = true;
for (const [a, b] of FOLDS) if (phoneticKey(a) !== phoneticKey(b)) foldsOk = false;
check('every folding pair the tables exist for still keys alike', foldsOk);

/* ...and distinct names must NOT collapse: a fold table that merges everything
   would pass the check above trivially.

   NOT asserted here: salah/saleh. They DO share the phonetic key "sal", and the
   translit-groups file keeps them in separate groups — but those are different
   contracts. The group firewall says "never swap one spelling for the other when
   generating variants", so the equivalence is not spread across the corpus. It
   does not say the two must never score alike: "Mohammed Salah" and designated
   "Mohammed Saleh" are one letter apart and score 93 on FUZZY alone, phonetic
   layer or not. Surfacing that for MLRO review is correct behaviour, not a false
   positive, so asserting the keys differ would have pinned the wrong contract. */
const DISTINCT = [['hassan', 'hussein'], ['selim', 'salim'], ['omar', 'amir']];
let distinctOk = true;
for (const [a, b] of DISTINCT) if (phoneticKey(a) === phoneticKey(b)) distinctOk = false;
check('phonetically distinct names do not collapse to one key', distinctOk);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
