/* Unit tests for lei-check pure logic (offline; no network).
   Usage: node test/lei-check.test.mjs */
import { leiSearchUrl, leiLookupUrl, isValidLei, scoreLei, LEI_ENDPOINT } from '../scripts/lei-check.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— lei-check unit tests —\n');

/* ── URLs ── */
const url = leiSearchUrl('Apple Inc.');
check('search url targets the GLEIF lei-records endpoint', url.startsWith(LEI_ENDPOINT));
check('search url filters on entity.legalName, URL-encoded', url.includes('filter[entity.legalName]=Apple%20Inc.'));
check('search url carries a page size cap', /page\[size\]=\d+/.test(url));
check('lookup url appends the upper-cased LEI', leiLookupUrl('hwupkr0mpou8fgxbt394') === LEI_ENDPOINT + '/HWUPKR0MPOU8FGXBT394');

/* ── ISO 17442 / 7064 MOD 97-10 checksum ── */
check('accepts a real, valid LEI (Apple)', isValidLei('HWUPKR0MPOU8FGXBT394') === true);
check('accepts a real, valid LEI (GLEIF itself)', isValidLei('5493001KJTIIGC8Y1R12') === true);
check('rejects a wrong check digit', isValidLei('HWUPKR0MPOU8FGXBT399') === false);
check('rejects wrong length', isValidLei('HWUPKR0MPOU8FGXBT39') === false);
check('rejects non-alphanumeric / lowercase noise', isValidLei('hwupkr0mpou8fgxbt394!') === false);

/* ── scoring over a JSON:API search response ── */
const gleif = {
  data: [
    { type: 'lei-records', id: 'HWUPKR0MPOU8FGXBT394',
      attributes: { lei: 'HWUPKR0MPOU8FGXBT394',
        entity: { legalName: { name: 'APPLE INC.' }, jurisdiction: 'US-CA', status: 'ACTIVE' },
        registration: { status: 'ISSUED' } } },
    { type: 'lei-records', id: '5493001KJTIIGC8Y1R12',
      attributes: { lei: '5493001KJTIIGC8Y1R12',
        entity: { legalName: { name: 'SOME OTHER ENTITY LLC' }, jurisdiction: 'GB', status: 'ACTIVE' },
        registration: { status: 'LAPSED' } } },
  ],
};

let r = scoreLei('Apple Inc.', gleif);
check('exact legal-name match is a hit', r.hit === true && r.count === 1);
check('exact match scores 95 / high band', r.score === 95 && r.band === 'high');
check('hit carries the verified LEI + jurisdiction + statuses',
  r.match.lei === 'HWUPKR0MPOU8FGXBT394' && r.match.jurisdiction === 'US-CA' &&
  r.match.entityStatus === 'ACTIVE' && r.match.registrationStatus === 'ISSUED');

/* token-subset (not exact) match scores lower */
r = scoreLei('Apple', gleif);
check('partial (token-subset) match scores 80 / medium band', r.hit === true && r.score === 80 && r.band === 'medium');

/* corp-suffix noise must not manufacture a match */
r = scoreLei('Unrelated Holdings LLC', gleif);
check('no hit when only corp-suffix words overlap', r.hit === false && r.count === 0);

/* a record with an invalid LEI is ignored even on a name match */
const badLei = { data: [{ id: 'NOTALEI', attributes: { lei: 'NOTALEI', entity: { legalName: { name: 'GHOST CORP' } } } }] };
check('ignores records whose LEI fails the checksum', scoreLei('Ghost Corp', badLei).hit === false);

/* shape tolerance: single-object lookup response + empty/odd payloads */
const lookup = { data: { id: 'HWUPKR0MPOU8FGXBT394',
  attributes: { lei: 'HWUPKR0MPOU8FGXBT394', entity: { legalName: { name: 'APPLE INC.' } } } } };
check('tolerates a single-object lookup response', scoreLei('Apple Inc.', lookup).hit === true);
check('tolerates an empty/odd response', scoreLei('x', {}).hit === false && scoreLei('x', null).hit === false);
check('tolerates a null/garbage element in data[]', scoreLei('Ghost', { data: [null, 'nope', { id: 'X' }] }).hit === false);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
