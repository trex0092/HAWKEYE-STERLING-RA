/* Structured identity corroboration tests. */
import {
  normId, normDate, corroborateIdentity, corroborateArticleIdentity, identityLabel
} from '../scripts/entity-resolution.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

check('identifier normalization strips punctuation/case',
  normId('A-123 45') === 'A12345');
check('DOB normalization accepts ISO and DMY',
  normDate('1980-04-09') === '1980-04-09' && normDate('09/04/1980') === '1980-04-09');
check('DOB normalization rejects impossible calendar dates and embedded years',
  normDate('1900-02-29') === '' && normDate('1980-02-30') === ''
  && normDate('1980-13-01') === '' && normDate('born around 1980') === ''
  && normDate('2000-02-29') === '2000-02-29');
check('a year-only DOB remains a year, not an exact date', normDate('1980') === '1980');

const strong = corroborateIdentity(
  { name: 'John Smith', entityType: 'individual', nationality: 'United Arab Emirates', dob: '1980-04-09', passport: 'A12345' },
  { entityType: 'individual', country: 'United Arab Emirates', dob: '09/04/1980', passport: 'A-12345' },
  { nameScore: 96 }
);
check('multi-attribute match reaches strong corroboration',
  strong.level === 'strong' && strong.points >= 65
  && strong.evidence.includes('identifier exact')
  && strong.evidence.includes('date of birth exact'));

const fullDateConflict = corroborateIdentity({ dob: '1980-04-09' }, { dob: '1980-09-04' });
check('two different full DOBs in the same year are conflicts, not corroboration',
  fullDateConflict.points === 0 && fullDateConflict.conflicts.includes('date of birth mismatch'));
const yearOnly = corroborateIdentity({ dob: '1980' }, { dob: '09/04/1980' });
check('partial birth year scores at most 10 points, never exact DOB',
  yearOnly.points === 10 && yearOnly.evidence.includes('birth year corroborated'));
const invalidDates = corroborateIdentity({ dob: '1980-02-30' }, { dob: '1980-02-30' });
check('two identically invalid dates do not corroborate',
  invalidDates.points === 0 && !invalidDates.evidence.includes('date of birth exact'));

const diffCountries = corroborateIdentity({ nationality: 'United States' }, { country: 'United Arab Emirates' });
check('shared generic country words never corroborate different jurisdictions',
  diffCountries.points === 0 && diffCountries.conflicts.includes('country/nationality differs'));

const conflict = corroborateIdentity(
  { entityType: 'individual', nationality: 'UAE', dob: '1980-04-09', passport: 'A12345' },
  { entityType: 'individual', country: 'Canada', dob: '1975-01-01', passport: 'Z99999' },
  { nameScore: 92 }
);
check('identity conflicts are retained rather than suppressing a name hit',
  conflict.conflicts.length >= 2 && conflict.points > 0);

const article = corroborateArticleIdentity(
  { jurisdiction: 'Jordan' },
  { title: 'Jordanian authorities investigate Acme director for bribery', snippet: 'Case in Jordan' }
);
check('article identity corroboration recognizes CDD country evidence',
  article.level === 'corroborated');
check('article corroboration rejects another country sharing a common word',
  corroborateArticleIdentity({ country: 'United Arab Emirates' },
    { title: 'United States authorities announce new rule' }).level === 'name-only');
check('article corroboration does not mistake ordinary pronouns for US country code',
  corroborateArticleIdentity({ country: 'US' },
    { title: 'Tell us about the new rules' }).level === 'name-only');
check('article corroboration accepts an explicitly uppercase US country code',
  corroborateArticleIdentity({ country: 'US' },
    { title: 'US authorities announce new rules' }).level === 'corroborated');

check('identity label is examiner-readable',
  /strong/.test(identityLabel(strong)) && /identifier exact/.test(identityLabel(strong)));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
