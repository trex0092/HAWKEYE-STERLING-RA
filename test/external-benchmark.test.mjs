/* External screening benchmark gate — the independent Cascade company/vessel
   name pairs must never score below their ratchet floors, and the vendored
   corpus must stay exactly as retrieved (licence, row counts, labels).
   Usage: node test/external-benchmark.test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { computeAll, parseCsv, LOTS } from '../scripts/external-benchmark.mjs';

let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
console.log('\n— external screening benchmark (Cascade name pairs) —\n');

const FIX = p => new URL('./fixtures/external-benchmark/' + p, import.meta.url);
const SHA = {
  'cascade-name-pairs.csv': '5c225b06bc1b1d6743b8569b4f9b6e9c15a3b6f8edb3b88f1c3ed87a84b54b72',
  'cascade-name-pairs-2.csv': 'ede72aaf261e9f71bb80ed2c0d2d13aeb9bb44dc36ff21d6594cb88e25f44676',
};
check('the MIT licence for the vendored pairs is present',
  existsSync(FIX('LICENSE-cascade-name-pairs')) && /MIT License/.test(readFileSync(FIX('LICENSE-cascade-name-pairs'), 'utf8'))
  && /Arslane Chaouche/.test(readFileSync(FIX('LICENSE-cascade-name-pairs'), 'utf8')));
for (const lot of LOTS) {
  const raw = readFileSync(FIX(lot));
  check(lot + ' is byte-identical to the retrieved upstream file', createHash('sha256').update(raw).digest('hex') === SHA[lot]);
}

const floors = JSON.parse(readFileSync(FIX('floors.json'), 'utf8')).lots;
const res = computeAll();
for (const lot of LOTS) {
  const r = res[lot], f = floors[lot];
  const rows = parseCsv(readFileSync(FIX(lot), 'utf8'));
  check(lot + ': labelled shape unchanged (' + r.rows + ' rows, ' + r.matches + ' matches, ' + r.non_matches + ' non-matches)',
    r.rows === f.rows && r.matches === f.matches && r.non_matches === f.non_matches
    && rows.every(x => x.is_match === 'true' || x.is_match === 'false') && rows.every(x => x.name1 && x.name2));
  check(lot + ': recall ' + r.recall_hits + '/' + r.matches + ' >= floor ' + f.recall_hits_min, r.recall_hits >= f.recall_hits_min);
  check(lot + ': negative clear ' + r.negative_clear + '/' + r.non_matches + ' >= floor ' + f.negative_clear_min, r.negative_clear >= f.negative_clear_min);
  if (r.recall_hits > f.recall_hits_min || r.negative_clear > f.negative_clear_min) {
    console.log('  ..  ' + lot + ' now beats its floor - ratchet floors.json up in the same PR');
  }
}
check('parseCsv handles quoted commas and doubled quotes',
  JSON.stringify(parseCsv('a,b\n"x, y","say ""hi"""\n')) === JSON.stringify([{ a: 'x, y', b: 'say "hi"' }]));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
