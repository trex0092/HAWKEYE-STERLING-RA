/* Schema guard for data/translit-groups.json — the shared transliteration
   source of truth both engines load (ai.py + scripts/sanctions-match.mjs).
   A malformed file fails the engines LOUDLY at import; this guard catches the
   subtler corruption classes a loader can't: overlapping groups (which member
   wins becomes load-order dependent), deliberately-separate names collapsing
   into one group, and drift between the two engines' load paths.
   Usage: node test/translit-data.test.mjs */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— translit-groups data schema —\n');

const data = JSON.parse(readFileSync(new URL('../data/translit-groups.json', import.meta.url), 'utf8'));

check('version is a positive integer', Number.isInteger(data.version) && data.version >= 1);
check('groups is a non-empty array', Array.isArray(data.groups) && data.groups.length > 0);

let shapeOk = true, charsetOk = true, dupInGroup = 0;
for (const g of data.groups) {
  if (!Array.isArray(g) || g.length < 2) shapeOk = false;
  const seen = new Set();
  for (const m of g) {
    if (typeof m !== 'string' || !/^[a-z]+( [a-z]+)*$/.test(m)) charsetOk = false;
    if (seen.has(m)) dupInGroup++;
    seen.add(m);
  }
}
check('every group has >= 2 members', shapeOk);
check('members are lowercase a-z words/phrases (single spaces only)', charsetOk);
check('no duplicate member inside a group', dupInGroup === 0);

/* Pairwise disjoint: a member in two groups makes canonicalisation load-order
   dependent — the exact defect that made abdool/abdul resolve differently
   before the groups were merged. */
const owner = new Map();
let overlaps = 0;
for (const g of data.groups) {
  for (const m of g) {
    if (owner.has(m)) overlaps++;
    owner.set(m, g);
  }
}
check('groups are pairwise disjoint', overlaps === 0);

/* Distinct-name firewalls: pairs that LOOK like variants but are different
   underlying names must never share a group — collapsing any of these is a
   precision regression the fuzzy layer can't undo. */
const sameGroup = (a, b) => owner.has(a) && owner.get(a) === owner.get(b);
check('salah/saleh stay separate (different names)', !sameGroup('salah', 'saleh'));
check('sayed/said stay separate (different names)', !sameGroup('sayed', 'said'));
check('selim/salim stay separate (different names)', !sameGroup('selim', 'salim'));
check('hassan/hussein stay separate (different names)', !sameGroup('hassan', 'hussein'));

/* Continuity: every group of the original in-code table must survive in the
   shared file — the migration may only ADD equivalences, never lose one. */
const legacy = [
  ['mohammed', 'muhammad', 'mohamed', 'mohammad', 'muhammed', 'mohd'],
  ['abdul', 'abdel', 'abd al', 'abdal', 'abd el'],
  ['bin', 'ibn', 'ben'], ['al', 'el'], ['ahmed', 'ahmad'],
  ['yousef', 'yusuf', 'yousuf', 'youssef'],
  ['hussein', 'husain', 'hussain', 'husein'],
  ['sheikh', 'shaikh', 'shaykh'],
  ['abdulrahman', 'abdul rahman', 'abdelrahman'],
  ['ismail', 'ismael', 'esmail'],
];
let legacyOk = true;
for (const g of legacy) {
  const home = owner.get(g[0]);
  if (!home || !g.every(m => home.includes(m))) legacyOk = false;
}
check('every legacy in-code group survives intact in the shared file', legacyOk);

/* Both engines must load THIS file — if either falls back to an in-code table
   the single-source-of-truth property is silently gone. */
const aiSrc = readFileSync(new URL('../ai.py', import.meta.url), 'utf8');
const jsSrc = readFileSync(new URL('../scripts/sanctions-match.mjs', import.meta.url), 'utf8');
check('ai.py loads data/translit-groups.json', aiSrc.includes('translit-groups.json'));
check('sanctions-match.mjs loads data/translit-groups.json', jsSrc.includes('translit-groups.json'));
check('ai.py no longer carries an in-code group literal', !aiSrc.includes('"mohammed", "muhammad"'));
check('sanctions-match.mjs no longer carries an in-code group literal', !jsSrc.includes("'mohammed', 'muhammad'"));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
