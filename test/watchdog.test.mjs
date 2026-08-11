/* Unit tests for the FATF watchdog's pure logic (no network).
   Usage: node test/watchdog.test.mjs */
import { readFileSync } from 'node:fs';
import { loadBaseline, extractCountries, classifyCountries, diffLists, buildAlert, normalize, collectReviewsDue, extractSheet, snapshotAgeDays, SNAPSHOT_STALE_DAYS, assertPlausible, parseCdxTimestamps, listsIdentical } from '../scripts/fatf-watchdog.mjs';

function throws(fn) { try { fn(); return false; } catch { return true; } }

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

const baseline = loadBaseline(readFileSync(new URL('../app.js', import.meta.url), 'utf8'));
check('baseline loads all countries', baseline.length === 245);
check('baseline CFA flags are Iran, North Korea, Myanmar',
  baseline.filter(c => c.cfa).map(c => c.name).sort().join('|') === 'Islamic Republic of Iran|Myanmar|North Korea');

const fixture = `
<h2>High-Risk Jurisdictions subject to a Call for Action</h2>
<p>Democratic People's Republic of Korea (DPRK)</p><p>Iran</p><p>Myanmar</p>
<h2>Jurisdictions under Increased Monitoring</h2>
<ul><li>Algeria</li><li>Angola</li><li>Bulgaria</li><li>Monaco</li><li>Nigeria</li><li>South Africa</li><li>Côte d'Ivoire</li><li>Democratic Republic of Congo</li><li>Virgin Islands (UK)</li><li>Guinea-Bissau</li><li>Papua
New Guinea</li></ul>
<p>Find out more about the FATF's global network</p><p>Sudan hosts a MENAFATF workshop</p>
<h3>Jurisdictions No Longer Subject to Increased Monitoring</h3>
<p>Guinea</p>
<div>${'pad '.repeat(6000)}</div><p>Eritrea</p>`;

const noisy = '<nav>  black and grey lists   call for action  ·  increased monitoring </nav>\n' + fixture.replace('<p>Iran</p>', '<p>     Iran   </p>');
const lists = classifyCountries(noisy, baseline);
check('black list classified via aliases despite nav noise and whitespace',
  lists.black.join('|') === 'Islamic Republic of Iran|Myanmar|North Korea');
check('grey list classified incl. accented alias, Niger not false-matched',
  lists.grey.includes("Cote D'Ivoire") && lists.grey.includes('Nigeria')
  && !lists.grey.includes('Niger') && lists.grey.length === 11);
check('FATF spelling variants map to baseline names (DRC, Virgin Islands (UK))',
  lists.grey.includes('The Democratic Republic Of Congo') && lists.grey.includes('British Virgin Islands'));
check('hyphens fold: Guinea-Bissau matches Guinea Bissau, multiword spans newline',
  lists.grey.includes('Guinea Bissau') && lists.grey.includes('Papua New Guinea'));
check('post-list and delisted content is not current (Guinea, Sudan excluded)',
  !lists.grey.includes('Guinea') && !lists.grey.includes('Sudan')
  && !lists.black.includes('Guinea') && !lists.black.includes('Sudan'));
check('far-below-heading mentions are ignored (distance cap)', !lists.grey.includes('Eritrea'));
check('classification requires both headings', (() => {
  try { classifyCountries('<p>Iran</p>', baseline); return false; } catch (e) { return true; }
})());

const diff = diffLists({ black: ['Islamic Republic of Iran', 'Myanmar', 'North Korea'], grey: ['Algeria', 'Monaco'] },
                       { black: ['Islamic Republic of Iran', 'North Korea'], grey: ['Algeria', 'Nigeria'] });
check('diff finds additions and removals both ways',
  diff.blackRemoved.join() === 'Myanmar' && diff.greyAdded.join() === 'Nigeria'
  && diff.greyRemoved.join() === 'Monaco' && diff.blackAdded.length === 0);

const notes = buildAlert(diff, baseline, ['RA-20260612-001 · GOLDEN FALCON TRADING LLC · CDD 19 (Nigeria)'], '24/10/2026');
check('alert names additions with app score', notes.includes('FATF added Nigeria to the grey list (increased monitoring) on 24/10/2026')
  && notes.includes('scores it 3 (High)') && notes.includes('Risk Data panel'));
check('alert names removals both lists', notes.includes('FATF removed Myanmar from the BLACK list')
  && notes.includes('FATF removed Monaco from the grey list'));
check('alert lists affected assessments and re-assess instruction',
  notes.includes('GOLDEN FALCON TRADING LLC') && notes.includes('Re-assess these entities'));
check('alert with no affected says none', buildAlert(diff, baseline, [], '24/10/2026').includes('none found'));
check('normalize strips accents and case', normalize('CÔTE  d’IvoirE'.replace('’', "'")) === "cote d'ivoire");

const seg = '<h2>Increased Monitoring</h2><ul><li>Angola</li><li>Bulgaria</li><li>Nigeria</li></ul>';
check('extractCountries pulls known names from a text segment',
  extractCountries(seg, baseline).join('|') === 'Angola|Bulgaria|Nigeria');

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

/* Source freshness: a stale Wayback snapshot must read as older than the
   threshold (so the watchdog prefers Wikipedia), a same-day one as fresh, and
   an unparseable timestamp as infinitely stale (never masks a change). */
const now = Date.UTC(2026, 5, 20, 5, 0, 0); // 2026-06-20
check('stale snapshot (10 Jun) exceeds the staleness threshold',
  snapshotAgeDays('20260610220941', now) > SNAPSHOT_STALE_DAYS);
check('fresh snapshot (same day) is within the threshold',
  snapshotAgeDays('20260620010000', now) <= SNAPSHOT_STALE_DAYS);
check('unparseable snapshot timestamp is treated as infinitely stale',
  snapshotAgeDays('', now) === Infinity && snapshotAgeDays('not-a-date', now) === Infinity);

/* Sanity guard: a real list passes; a broken parse (oversized black, black/grey
   overlap, or empty grey) must stop loudly rather than alert/persist. */
check('plausible lists pass the sanity guard',
  !throws(() => assertPlausible({ black: ['Islamic Republic of Iran', 'Myanmar', 'North Korea'],
    grey: ['Angola', 'Bolivia', 'Bulgaria', 'Monaco', 'Nepal', 'Yemen'] })));
check('oversized black list is rejected (broken-source garbage)',
  throws(() => assertPlausible({ black: Array.from({ length: 54 }, (_, i) => 'C' + i),
    grey: Array.from({ length: 54 }, (_, i) => 'C' + i) })));
check('black/grey overlap is rejected',
  throws(() => assertPlausible({ black: ['Myanmar'], grey: ['Myanmar', 'Angola', 'Bolivia', 'Monaco', 'Nepal'] })));
check('empty/tiny grey list is rejected',
  throws(() => assertPlausible({ black: ['Myanmar'], grey: ['Angola'] })));

/* CDX index — the second opinion on archive.org. The availability API is
   cache-backed and was observed lagging the crawl by 10+ days (run 31369056569),
   which alone blinded the watchdog; CDX reads the crawl. Its response is a
   header row plus [timestamp, statuscode] rows, oldest first. */
const cdx = [['timestamp', 'statuscode'], ['20260731091550', '200'], ['20260806120000', '200'], ['20260808000000', '404']];
check('CDX timestamps come back newest-first, 200s only, header row dropped',
  parseCdxTimestamps(cdx).join(',') === '20260806120000,20260731091550');
check('a captured non-200 is not treated as the page',
  !parseCdxTimestamps([['20260808000000', '503']]).length);
check('a garbled CDX response yields no candidates, never a false hit',
  !parseCdxTimestamps(null).length && !parseCdxTimestamps({ error: 'x' }).length
  && !parseCdxTimestamps([['not-a-timestamp', '200'], 'junk', 42]).length);

/* Stale-capture corroboration. A capture past the freshness bar may not be
   DIFFED as current — it could pre-date a plenary and report a real move in
   reverse — but comparing it for EQUALITY is safe in the only direction that
   matters: it can confirm the stored lists are unchanged, and can never
   manufacture a change. Ordering is not part of a designation. */
const held = { black: ['Islamic Republic of Iran', 'Myanmar', 'North Korea'],
  grey: ['Angola', 'Bolivia', 'Bulgaria', 'Monaco', 'Nepal', 'Yemen'], updated: '2026-06-20' };
check('a stale capture naming the same lists corroborates coverage',
  listsIdentical(held, { black: ['Myanmar', 'North Korea', 'Islamic Republic of Iran'],
    grey: ['Yemen', 'Monaco', 'Angola', 'Nepal', 'Bulgaria', 'Bolivia'] }));
check('a stale capture missing a grey jurisdiction does NOT corroborate',
  !listsIdentical(held, { black: held.black, grey: held.grey.slice(1) }));
check('a stale capture with an extra black jurisdiction does NOT corroborate',
  !listsIdentical(held, { black: [...held.black, 'Angola'], grey: held.grey }));
check('a missing or list-less state never counts as identical',
  !listsIdentical(null, held) && !listsIdentical(held, null)
  && !listsIdentical({ skipStreak: 3 }, held));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
