/* Unit tests for PEP screening pure logic (no network).
   Usage: node test/pep-check.test.mjs */
import { pepSearchUrl, scorePep, PEP_KEYWORDS } from '../scripts/pep-check.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

check('pepSearchUrl hits the Wikidata entity-search API with the name',
  pepSearchUrl('Vladimir Putin').startsWith('https://www.wikidata.org/w/api.php?action=wbsearchentities') &&
  decodeURIComponent(pepSearchUrl('Vladimir Putin')).includes('search=Vladimir Putin'));

const pol = scorePep('Vladimir Putin', { search: [
  { id: 'Q7747', label: 'Vladimir Putin', description: 'President of Russia (born 1952)' }
] });
check('scorePep flags a matching political description', pol.hit === true && pol.band === 'medium' && pol.match.id === 'Q7747');

const namesake = scorePep('Vladimir Putin', { search: [
  { id: 'Q1', label: 'Vladimir Putin', description: 'Russian table tennis player' }
] });
check('scorePep ignores a non-political namesake', namesake.hit === false);

const wrongName = scorePep('John Smith', { search: [
  { id: 'Q2', label: 'Jane Doe', description: 'Senator and politician' }
] });
check('scorePep requires the subject name in the result label', wrongName.hit === false);

check('scorePep tolerates an empty response', scorePep('Acme Co', {}).hit === false);
check('PEP_KEYWORDS includes core political roles', PEP_KEYWORDS.includes('president') && PEP_KEYWORDS.includes('minister'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
