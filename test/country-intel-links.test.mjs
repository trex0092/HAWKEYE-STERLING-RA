/* KnowYourCountry analyst-reference links — every app jurisdiction must map
   to a page KnowYourCountry actually lists, and the link must never carry
   their content or influence the score.

   KNOWN_SLUGS is the country list from the public index
   https://www.knowyourcountry.com/country-aml-intelligence/ (retrieved
   2026-10-02, 245 jurisdictions) — page addresses only, no report content.
   Their terms of use bar republishing country reports outside the reader's
   organisation, so this repository links and never copies.

   Usage: node test/country-intel-links.test.mjs */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
console.log('\n— country AML intelligence links —\n');

const KNOWN_SLUGS = new Set(`afghanistan aland-islands albania algeria american-samoa andorra angola anguilla antigua-and-barbuda argentina armenia aruba australia austria azerbaijan bahamas bahrain bangladesh barbados belarus belgium belize benin bermuda bhutan bolivia bonaire-sint-eustatius-and-saba bosnia-herzegovina botswana brazil british-indian-ocean-territory british-virgin-islands brunei-darussalam bulgaria burkina-faso burundi cambodia cameroon canada cape-verde cayman-islands central-african-rep chad chile china christmas-island cocos-keeling-islands colombia comoros congo-brazzaville cook-islands costa-rica cote-divoire croatia cuba curacao cyprus czech-republic congo-the-democratic-republic denmark djibouti dominica dominican-republic ecuador egypt el-salvador equatorial-guinea eritrea estonia eswatini ethiopia falkland-islands-malvinas faroe-islands fiji finland france french-guiana french-polynesia gabon gambia gaza-strip georgia germany ghana gibraltar greece greenland grenada guadeloupe guam guatemala guernsey guinea guinea-bissau guyana haiti honduras hong-kong hungary iceland india indonesia iran-islamic-republic-of iraq ireland isle-of-man israel italy jamaica japan jersey jordan kazakhstan kenya kiribati kosovo kuwait kyrgyzstan lao-peoples-democratic-republic latvia lebanon lesotho liberia libya liechtenstein lithuania luxembourg macau madagascar malawi malaysia maldives mali malta marshall-islands martinique mauritania mauritius mayotte mexico micronesia moldova monaco mongolia montenegro montserrat morocco mozambique myanmar namibia nauru nepal netherlands new-caledonia new-zealand nicaragua niger nigeria niue norfolk-island north-korea north-macedonia north-mariana-islands norway oman pakistan palau panama papua-new-guinea paraguay peru philippines pitcairn poland portugal puerto-rico qatar reunion romania russian-federation rwanda saint-barthelemy saint-helena-ascension-and-tristan saint-martin-french-part saint-pierre-and-miquelon samoa san-marino sao-tome-prin saudi-arabia senegal serbia seychelles sierra-leone singapore slovakia slovenia solomon-islands somalia south-africa south-korea south-sudan spain sri-lanka st-kitts-nevis st-lucia st-maarten st-vincent-gren sudan suriname svalbard-and-mayen sweden switzerland syria taiwan tajikistan tanzania thailand timor-leste togo tokelau tonga trinidad-tobago tunisia turkey turkmenistan turks-caicos tuvalu uganda ukraine united-arab-emirates united-kingdom united-states united-states-virgin-islands uruguay uzbekistan vanuatu vatican-city-state-holy-see venezuela vietnam wallis-and-futuna west-bank-palestinian-territory-occupied western-sahara yemen zambia zimbabwe`.split(/\s+/));
check('the reference list holds all 245 KnowYourCountry jurisdictions', KNOWN_SLUGS.size === 245);

const src = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const pick = (re, label) => { const m = src.match(re); if (!m) throw new Error('app.js: ' + label + ' not found'); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  pick(/const COUNTRIES = \[.*?\];/, 'COUNTRIES'),
  pick(/const KYC_INTEL_BASE = [^\n]+/, 'KYC_INTEL_BASE'),
  pick(/const KYC_SLUG_OVERRIDES = \{[\s\S]*?\n\};/, 'KYC_SLUG_OVERRIDES'),
  pick(/function kycSlug\(name\) \{[\s\S]*?\n\}/, 'kycSlug'),
  pick(/function countryIntelUrl\(name\) \{[\s\S]*?\n\}/, 'countryIntelUrl'),
  'globalThis.out = { COUNTRIES, countryIntelUrl, KYC_SLUG_OVERRIDES };',
].join('\n'), ctx);
const { COUNTRIES, countryIntelUrl, KYC_SLUG_OVERRIDES } = ctx.out;

const PREFIX = 'https://www.knowyourcountry.com/country-aml-intelligence/country/';
const unmatched = COUNTRIES.filter(c => {
  const u = countryIntelUrl(c.name);
  return !u.startsWith(PREFIX) || !KNOWN_SLUGS.has(u.slice(PREFIX.length).replace(/\/$/, ''));
}).map(c => c.name);
check('every app jurisdiction (' + COUNTRIES.length + ') links to a listed KnowYourCountry page'
  + (unmatched.length ? ' - unmatched: ' + unmatched.join(', ') : ''), unmatched.length === 0);
check('the links are one-to-one (no two jurisdictions share a page)',
  new Set(COUNTRIES.map(c => countryIntelUrl(c.name))).size === COUNTRIES.length);
check('every override targets a listed page', Object.values(KYC_SLUG_OVERRIDES).every(s => KNOWN_SLUGS.has(s)));
check('diacritics, ampersands and apostrophes fold to the site slug',
  countryIntelUrl('Åland Islands') === PREFIX + 'aland-islands/'
  && countryIntelUrl('St Kitts & Nevis') === PREFIX + 'st-kitts-nevis/'
  && countryIntelUrl("Cote D'Ivoire") === PREFIX + 'cote-divoire/'
  && countryIntelUrl('United Arab Emirates') === PREFIX + 'united-arab-emirates/');
check('an empty jurisdiction falls back to the index, never a broken page',
  countryIntelUrl('') === 'https://www.knowyourcountry.com/country-aml-intelligence/');

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const link = (html.match(/<a id="jurisdictionIntel"[^>]*>/) || [''])[0];
check('the link opens externally with noopener noreferrer (no opener or referrer leak)',
  /target="_blank"/.test(link) && /rel="noopener noreferrer"/.test(link));
check('the link is translated (data-i18n key present in both languages)',
  /data-i18n="fld\.countryIntel"/.test(link) && /'fld\.countryIntel': \{en:'[^']+', ar:'[^']+'\}/.test(src));
check('no KnowYourCountry content is stored in the data directory',
  !/knowyourcountry/i.test(readFileSync(new URL('../data/jurisdiction-risk.json', import.meta.url), 'utf8')));
check('the reference never feeds the score (paintJurisdiction only sets the href)',
  !/countryIntelUrl/.test(pick(/function recalc\(\)[\s\S]*?\n\}/, 'recalc')));

/* DRAFT suggested country score (scripts/country-score.mjs): displayed beside
   the current score, never applied. The Python engine suite re-derives every
   row of the generated file; here the generator's band edges and the app's
   display-only wiring are pinned. */
const cs = await import('../scripts/country-score.mjs');
check('suggested score: effectiveness points 0-1 = 3, 2-3 = 2, 4-6 = 1, 7+ = 0',
  [0, 1, 2, 3, 4, 6, 7, 11].map(cs.effectivenessPoints).join() === '3,3,2,2,1,1,0,0');
check('suggested score: bands 0-2 Low, 3-5 Medium, 6-8 High',
  [0, 2, 3, 5, 6, 8].map(cs.band).join() === '1,1,2,2,3,3');
const inp = { high: new Set(['X']), grey: new Set(['G']), eff: new Map([['X', { high_or_substantial: 9 }], ['G', { high_or_substantial: 9 }],
  ['A', { high_or_substantial: 1, report: 'MER', date: '2020-01', body: 'FATF' }]]), incsr: new Set(['A']), tip: new Map([['A', 'Tier 3']]), euTax: new Set(['A']) };
const rX = cs.scoreCountry({ name: 'X', score: 1 }, inp), rG = cs.scoreCountry({ name: 'G', score: 1 }, inp);
const rA = cs.scoreCountry({ name: 'A', score: 3 }, inp), rN = cs.scoreCountry({ name: 'N', score: 2 }, inp);
check('suggested score: FATF call for action and grey list override good ratings to 3',
  rX.suggested === 3 && rX.basis === 'fatf-call-for-action' && rG.suggested === 3 && rG.basis === 'fatf-grey-list');
check('suggested score: points add up across factors (3 + 2 + 2 + 1 = 8, High)',
  rA.points === 8 && rA.suggested === 3 && rA.compare === 'same' && rA.factors.length === 4);
check('suggested score: an unrated, unlisted jurisdiction gets no suggestion',
  rN.suggested === null && rN.compare === 'n/a');
check('suggested score: the app shows it under the jurisdiction',
  /<div id="jurisdictionSuggested"[^>]*>/.test(html) && /fetch\('data\/country-score-suggested\.json'/.test(src));
check('suggested score: the app labels it draft and pending MLRO approval, and says so when it cannot load',
  /draft, pending MLRO approval, not applied/.test(src) && /suggestion file could not be loaded/.test(src));
check('suggested score: it never feeds the assessment score (recalc does not read it)',
  !/suggestedScores|paintSuggestedScore/.test(pick(/function recalc\(\)[\s\S]*?\n\}/, 'recalc')));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
