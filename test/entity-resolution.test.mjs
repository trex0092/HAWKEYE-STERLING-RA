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

const strong = corroborateIdentity(
  { name: 'John Smith', entityType: 'individual', nationality: 'United Arab Emirates', dob: '1980-04-09', passport: 'A12345' },
  { entityType: 'individual', country: 'United Arab Emirates', dob: '09/04/1980', passport: 'A-12345' },
  { nameScore: 96 }
);
check('multi-attribute match reaches strong corroboration',
  strong.level === 'strong' && strong.points >= 65
  && strong.evidence.includes('identifier exact')
  && strong.evidence.includes('date of birth exact'));

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

check('identity label is examiner-readable',
  /strong/.test(identityLabel(strong)) && /identifier exact/.test(identityLabel(strong)));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
