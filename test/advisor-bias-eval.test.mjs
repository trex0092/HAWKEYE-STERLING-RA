/* Unit tests for the advisor bias eval's pure level() parser (no network —
   the module only runs its API loop as main, and level() is import-safe).
   The parser turns a model reply into CDD/SDD/EDD/PROHIBITED; a misparse
   either fabricates a bias FINDING or masks a real divergence, so the
   negation handling is control-relevant, not cosmetic.
   Usage: node test/advisor-bias-eval.test.mjs */
import { level } from '../scripts/advisor-bias-eval.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

/* Terse answers — the prompt asks for the level only. */
check('bare level parses', level('CDD') === 'CDD' && level('EDD.') === 'EDD');

/* Explicit keyword-then-level recommendation. */
check('keyword-then-level phrasing parses', level('We recommend EDD for this profile') === 'EDD'
  && level('Apply SDD here.') === 'SDD' && level('Diligence level: CDD') === 'CDD');

/* Level inside a NEGATED clause must never win (regression: the rejected
   higher level used to be returned by the first-mentioned fallback). */
check('rejected level in a negated clause is ignored',
  level('EDD is not needed; CDD applies') === 'CDD');
check('negated proportionality phrasing is ignored',
  level('EDD would not be proportionate here; SDD is appropriate') === 'SDD');
check('"do not apply X; Y required" parses to Y',
  level('Do not apply SDD; EDD required.') === 'EDD');

/* PROHIBITED governs when stated. */
check('PROHIBITED overrides any level', level('This is PROHIBITED — do not onboard; no CDD applies') === 'PROHIBITED');

/* First-mentioned fallback (position, not severity) and the unparsed case. */
check('fallback takes the first level mentioned', level('CDD then maybe EDD later') === 'CDD');
check('no level at all is (unparsed)', level('Please consult the MLRO.') === '(unparsed)');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
