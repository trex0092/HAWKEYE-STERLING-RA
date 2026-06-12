/* Unit tests for the FATF watchdog's pure logic (no network).
   Usage: node test/watchdog.test.mjs */
import { readFileSync } from 'node:fs';
import { loadBaseline, extractCountries, splitFatfPage, diffLists, buildAlert, normalize } from '../scripts/fatf-watchdog.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

const baseline = loadBaseline(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
check('baseline loads all countries', baseline.length === 245);
check('baseline CFA flags are Iran, North Korea, Myanmar',
  baseline.filter(c => c.cfa).map(c => c.name).sort().join('|') === 'Islamic Republic of Iran|Myanmar|North Korea');

const fixture = `
<h2>High-Risk Jurisdictions subject to a Call for Action</h2>
<p>Democratic People's Republic of Korea (DPRK)</p><p>Iran</p><p>Myanmar</p>
<h2>Jurisdictions under Increased Monitoring</h2>
<ul><li>Algeria</li><li>Angola</li><li>Bulgaria</li><li>Monaco</li><li>Nigeria</li><li>South Africa</li><li>Côte d'Ivoire</li></ul>`;

const seg = splitFatfPage(fixture);
const black = extractCountries(seg.black, baseline);
const grey = extractCountries(seg.grey, baseline);
check('black list extracted via aliases', black.join('|') === 'Islamic Republic of Iran|Myanmar|North Korea');
check('grey list extracted incl. accented alias', grey.includes("Cote D'Ivoire") && grey.includes('Nigeria') && grey.length === 7);
check('heading order tolerated', (() => {
  const flipped = splitFatfPage(fixture.split('\n').reverse().join('\n'));
  return typeof flipped.black === 'string' && typeof flipped.grey === 'string';
})());

const diff = diffLists({ black: ['Islamic Republic of Iran', 'Myanmar', 'North Korea'], grey: ['Algeria', 'Monaco'] },
                       { black: ['Islamic Republic of Iran', 'North Korea'], grey: ['Algeria', 'Nigeria'] });
check('diff finds additions and removals both ways',
  diff.blackRemoved.join() === 'Myanmar' && diff.greyAdded.join() === 'Nigeria'
  && diff.greyRemoved.join() === 'Monaco' && diff.blackAdded.length === 0);

const notes = buildAlert(diff, baseline, ['RA-20260612-001 · FINE GOLD LLC · CDD 19 (Nigeria)'], '24/10/2026');
check('alert names additions with app score', notes.includes('FATF added Nigeria to the grey list (increased monitoring) on 24/10/2026')
  && notes.includes('scores it 3 (High)') && notes.includes('Risk Data panel'));
check('alert names removals both lists', notes.includes('FATF removed Myanmar from the BLACK list')
  && notes.includes('FATF removed Monaco from the grey list'));
check('alert lists affected assessments and re-assess instruction',
  notes.includes('FINE GOLD LLC') && notes.includes('Re-assess these entities'));
check('alert with no affected says none', buildAlert(diff, baseline, [], '24/10/2026').includes('none found'));
check('normalize strips accents and case', normalize('CÔTE  d’IvoirE'.replace('’', "'")) === "cote d'ivoire");

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
