/* Unit tests for the FATF watchdog's pure logic (no network).
   Usage: node test/watchdog.test.mjs */
import { readFileSync } from 'node:fs';
import { loadBaseline, extractCountries, classifyCountries, diffLists, buildAlert, normalize, sliceCurrentSection, collectReviewsDue, extractSheet } from '../scripts/fatf-watchdog.mjs';

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
<ul><li>Algeria</li><li>Angola</li><li>Bulgaria</li><li>Monaco</li><li>Nigeria</li><li>South Africa</li><li>Côte d'Ivoire</li><li>Democratic Republic of Congo</li><li>Virgin Islands (UK)</li></ul>
<h3>Jurisdictions No Longer Subject to Increased Monitoring</h3>
<p>Guinea</p><p>Sudan</p>`;

const noisy = '<nav>  black and grey lists   call for action  ·  increased monitoring </nav>\n' + fixture.replace('<p>Iran</p>', '<p>     Iran   </p>');
const lists = classifyCountries(noisy, baseline);
check('black list classified via aliases despite nav noise and whitespace',
  lists.black.join('|') === 'Islamic Republic of Iran|Myanmar|North Korea');
check('grey list classified incl. accented alias, Niger not false-matched',
  lists.grey.includes("Cote D'Ivoire") && lists.grey.includes('Nigeria')
  && !lists.grey.includes('Niger') && lists.grey.length === 9);
check('FATF spelling variants map to baseline names (DRC, Virgin Islands (UK))',
  lists.grey.includes('The Democratic Republic Of Congo') && lists.grey.includes('British Virgin Islands'));
check('delisted table is not classified as current (Guinea, Sudan excluded)',
  !lists.grey.includes('Guinea') && !lists.grey.includes('Sudan')
  && !lists.black.includes('Guinea') && !lists.black.includes('Sudan'));
check('classification requires both headings', (() => {
  try { classifyCountries('<p>Iran</p>', baseline); return false; } catch (e) { return true; }
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

const wiki = '<h2 id="Current_FATF_blacklist">Current</h2><ul><li>Iran</li><li>North Korea</li><li>Myanmar</li></ul><h2 id="Former">Former</h2><ul><li>Panama</li><li>Nigeria</li></ul>';
const wikiSlice = sliceCurrentSection(wiki, 'call for action');
const wikiBlack = extractCountries(wikiSlice, baseline);
check('wikipedia slice keeps only the current section',
  wikiBlack.join('|') === 'Islamic Republic of Iran|Myanmar|North Korea' && !wikiSlice.includes('Panama'));

const digestTasks = [
  { name: 'RA-1 · Alpha Gold DMCC · CDD 19', due_on: '2026-06-15', completed: false },
  { name: 'RA-2 · Beta Jewellery LLC · EDD 24', due_on: '2026-06-01', completed: false },
  { name: 'RA-3 · Gamma Metals FZE · SDD 21', due_on: '2026-07-02', completed: false },   // next month
  { name: 'RA-4 · Done Co · CDD 19', due_on: '2026-06-20', completed: true },              // completed
  { name: 'Print check — iPhone Safari only (Edge already verified)', due_on: '2026-06-19', completed: false }, // not a client
  { name: 'RA-6 · Prohibited Co · PROHIBITED 21', due_on: '2026-06-18', completed: false }, // prohibited: no reviews
  { name: 'RA-5 · Old Overdue LLC · CDD 19', due_on: '2026-05-30', completed: false },     // overdue from May
];
const digest = collectReviewsDue(digestTasks, '2026-06-10', '2026-06-30');
check('digest picks due + overdue clients only, oldest first', digest.length === 3
  && digest[0].includes('Old Overdue LLC') && digest[0].includes('30/05/2026') && digest[0].includes('(OVERDUE)')
  && digest[1].includes('Beta Jewellery LLC') && digest[1].includes('(OVERDUE)')
  && digest[2].includes('Alpha Gold DMCC') && digest[2].includes('review due 15/06/2026') && !digest[2].includes('OVERDUE'));
check('digest is silent when nothing is due', collectReviewsDue(digestTasks, '2026-01-01', '2026-01-31').length === 0);

const goodNotes = 'header text\n===RISK DATA SHEET===\n{"updatedAt":"2026-06-12","overrides":{"countries":{"Hungary":{"score":3}}}}\n===END===';
const sheetParsed = extractSheet(goodNotes);
check('backup sheet extracted from mirror-task notes', !!sheetParsed
  && sheetParsed.updatedAt === '2026-06-12' && sheetParsed.overrides.countries.Hungary.score === 3);
check('backup extraction rejects garbage and missing markers',
  extractSheet('no markers {"overrides":{}}') === null
  && extractSheet('===RISK DATA SHEET===\n{broken\n===END===') === null
  && extractSheet('===RISK DATA SHEET===\n{"noOverrides":1}\n===END===') === null);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
