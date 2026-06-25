/* Unit tests for interpol-check pure logic (offline; no network).
   Usage: node test/interpol-check.test.mjs */
import { interpolSearchUrl, scoreInterpol, INTERPOL_ENDPOINT } from '../scripts/interpol-check.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— interpol-check unit tests —\n');

// URL
const url = interpolSearchUrl('Ramzan Kadyrov');
check('url targets the public Red Notices endpoint', url.startsWith(INTERPOL_ENDPOINT));
check('url encodes the subject name', url.includes('name=Ramzan%20Kadyrov'));
check('url carries a resultPerPage cap', /resultPerPage=\d+/.test(url));

const halJson = {
  total: 2,
  _embedded: { notices: [
    { forename: 'RAMZAN', name: 'KADYROV', nationalities: ['RU'], entity_id: '2024/1', date_of_birth: '1976' },
    { forename: 'JOHN', name: 'SMITH', nationalities: ['US'], entity_id: 'x' },
  ] },
};

// match
let r = scoreInterpol('Ramzan Kadyrov', halJson);
check('hit when all subject tokens appear in a notice', r.hit === true);
check('hit is a high-band, score 85 verify signal', r.band === 'high' && r.score === 85);
check('hit returns the matched notice id + name', r.match.id === '2024/1' && r.match.name === 'RAMZAN KADYROV');
check('hit carries nationalities', Array.isArray(r.match.nationalities) && r.match.nationalities[0] === 'RU');

// namesake guard: a partial token must not match
r = scoreInterpol('Ramzan Akhmadov', halJson);
check('no hit when not all subject tokens match (namesake guard)', r.hit === false);

// unrelated subject
r = scoreInterpol('Jane Doe', halJson);
check('no hit for an unrelated subject', r.hit === false && r.count === 0);

// shape tolerance
check('tolerates an empty/odd response', scoreInterpol('x', {}).hit === false);
check('tolerates a plain-array response', scoreInterpol('John Smith', [{ forename: 'JOHN', name: 'SMITH', entity_id: 'a' }]).hit === true);
check('tolerates a {notices:[...]} response', scoreInterpol('John Smith', { notices: [{ forename: 'JOHN', name: 'SMITH', entity_id: 'b' }] }).hit === true);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
