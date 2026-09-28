/* Screening coverage figures — generated from the engine's own configuration,
   never hand-counted.

   The README coverage badges (adverse-media editions, countries and languages;
   sanctions lists and jurisdictions) read data/coverage-figures.json. The
   numbers come from the same structures the screen runs on:
     - scripts/adverse-media.mjs  LOCALES (Google News editions) and LANG_TERMS
       (the languages the risk-term scorer reads);
     - data/sanctions-sources.json + data/sanctions-extra.json, filtered by the
       exact rule sanctions-screen.mjs loadAllLists uses (enabled !== false, and
       for extra sources a url or file), minus alias-only sources (mergeInto),
       which fold into their primary list rather than screening as one.
   So a badge can only move when the screen's configuration moves, and
   `--check` (a CI drift step) fails whenever the committed file lags it.

   These are CONFIGURED coverage figures, not per-run results: a list that
   fails to load on a given run is reported by that run (degraded), not here.

   Usage:
     node scripts/coverage-figures.mjs           # print the computed figures
     node scripts/coverage-figures.mjs --write   # refresh data/coverage-figures.json
     node scripts/coverage-figures.mjs --check   # exit 1 if the committed file drifted */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { LOCALES, LANG_TERMS } from './adverse-media.mjs';

export const FIGURES_FILE = 'data/coverage-figures.json';
export const BADGE_FILES = {
  sanctions: 'data/badges/sanctions-worldwide.svg',
  adverseMedia: 'data/badges/adverse-media-worldwide.svg',
  pep: 'data/badges/pep-worldwide.svg',
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* The sources the screen actually loads, as sanctions-screen.mjs selects them. */
export function screenedSources(root = ROOT) {
  const read = (f) => (JSON.parse(readFileSync(join(root, f), 'utf8')).sources || []);
  const core = read('data/sanctions-sources.json').filter(s => s && s.enabled !== false);
  const extra = read('data/sanctions-extra.json').filter(s => s && s.enabled !== false && (s.url || s.file));
  return [...core, ...extra].filter(s => !s.mergeInto);
}

/* In the source files `jurisdiction: "Global"` describes a list's REACH (it
   targets worldwide), not its ISSUER: Canada's SEMA, France's DGT and the US
   OFAC lists are all marked Global. The issuing country is therefore read from
   the list name's prefix ("Canada — …") for those entries. Supranational and
   multilateral issuers are named here explicitly so they are never counted as
   a country; any other prefix on a Global entry is its issuing country. */
const ISSUER_ALIASES = { 'US OFAC': 'United States', 'UK Sanctions List': 'United Kingdom' };
const SUPRANATIONAL = new Set(['UN Security Council', 'EU', 'IDB', 'ADB', 'Inter-American Development Bank']);

export function issuingCountry(s) {
  const j = String(s.jurisdiction || '').trim();
  if (j && !/^global\b/i.test(j)) return j;
  const prefix = String(s.name || '').split(/ — |: /)[0].trim();
  if (!prefix || SUPRANATIONAL.has(prefix)) return null;
  return ISSUER_ALIASES[prefix] || prefix;
}

/* The 195-country register (data/sanctions-country-coverage.json): how many of
   the world's countries have had their national sanctions publication
   researched, whatever the outcome. */
export function countryRegister(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'data/sanctions-country-coverage.json'), 'utf8')).countries || [];
}

export function screeningCountryMatrix(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'data/screening-country-coverage.json'), 'utf8'));
}

export function buildFigures(root = ROOT) {
  const sources = screenedSources(root);
  const jurisdictions = new Set(sources.map(issuingCountry).filter(Boolean));
  const screening = screeningCountryMatrix(root);
  return {
    adverseMediaEditions: LOCALES.length,
    adverseMediaCountries: new Set(LOCALES.map(l => l.gl)).size,
    adverseMediaLanguages: Object.keys(LANG_TERMS).length,
    sanctionsLists: sources.length,
    sanctionsJurisdictions: jurisdictions.size,
    sanctionsCountriesResearched: countryRegister(root).filter(r => r.status !== 'not-researched').length,
    sanctionsCountriesCovered: countryRegister(root).filter(r => r.status === 'screened').length,
    adverseMediaCountriesCovered: screening.counts?.adverseMediaCovered || 0,
    pepCountriesCovered: screening.counts?.pepCovered || 0,
  };
}

function xmlEscape(s) {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function buildBadges(figures) {
  const badge = (label, value) => {
    const message = value + ' / 195';
    const color = value === 195 ? '#4c1' : '#e05d44';
    const labelWidth = Math.max(110, label.length * 7 + 18);
    const valueWidth = 72;
    const total = labelWidth + valueWidth;
    const lx = labelWidth / 2;
    const vx = labelWidth + valueWidth / 2;
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + total + '" height="20" role="img" aria-label="' + xmlEscape(label + ': ' + message) + '">',
      '<title>' + xmlEscape(label + ': ' + message) + '</title>',
      '<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>',
      '<clipPath id="r"><rect width="' + total + '" height="20" rx="3"/></clipPath>',
      '<g clip-path="url(#r)"><rect width="' + labelWidth + '" height="20" fill="#555"/><rect x="' + labelWidth + '" width="' + valueWidth + '" height="20" fill="' + color + '"/><rect width="' + total + '" height="20" fill="url(#s)"/></g>',
      '<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="' + lx + '" y="15" fill="#010101" fill-opacity=".3">' + xmlEscape(label) + '</text><text x="' + lx + '" y="14">' + xmlEscape(label) + '</text><text x="' + vx + '" y="15" fill="#010101" fill-opacity=".3">' + xmlEscape(message) + '</text><text x="' + vx + '" y="14">' + xmlEscape(message) + '</text></g>',
      '</svg>',
      ''
    ].join('');
  };
  return {
    sanctions: badge('sanctions worldwide coverage', figures.sanctionsCountriesCovered),
    adverseMedia: badge('adverse media worldwide coverage', figures.adverseMediaCountriesCovered),
    pep: badge('PEP worldwide coverage', figures.pepCountriesCovered),
  };
}

export function buildFile(root = ROOT) {
  return {
    _README: 'Configured screening coverage, generated by scripts/coverage-figures.mjs from the engine\'s own configuration. Never hand-edit: run `node scripts/coverage-figures.mjs --write` to refresh. CI fails when the committed figures drift from the configuration. These are configured figures; a source that fails on a given run is reported by that run as degraded.',
    figures: buildFigures(root),
    definitions: {
      adverseMediaEditions: 'Google News country/language editions in the adverse-media locale matrix (scripts/adverse-media.mjs LOCALES); the daily run sweeps a budgeted rotation of them plus GDELT and Bing News',
      adverseMediaCountries: 'distinct countries (gl) across those editions',
      adverseMediaLanguages: 'languages with native risk terms in the scorer (scripts/adverse-media.mjs LANG_TERMS)',
      sanctionsLists: 'enabled sources in data/sanctions-sources.json + data/sanctions-extra.json (extra: with url or file), excluding alias-only sources (mergeInto)',
      sanctionsCountriesResearched: 'of the 195 countries in data/sanctions-country-coverage.json, how many have a recorded research outcome (screened, pending, identified or assessed-not-loadable) rather than not-researched',
      sanctionsCountriesCovered: 'countries whose own national sanctions source is loaded by the screen today (status=screened in data/sanctions-country-coverage.json). Global UN/EU/US/UK backbones are separate baseline coverage and do not turn unresolved national-source gaps into covered countries',
      adverseMediaCountriesCovered: 'countries included in worldwide name-scoped adverse-media screening through GDELT and Bing News, with Google News editions adding regional depth',
      pepCountriesCovered: 'countries included in the worldwide PEP screening scope through the Wikidata public-office holder harvest; screening is not country-filtered',
      sanctionsJurisdictions: 'distinct issuing countries among those sources: the jurisdiction field, or for entries marked Global (a list\'s reach, not its issuer) the country named in the list title; UN, EU and development-bank lists are supranational and not counted',
    },
  };
}

function main() {
  const mode = process.argv[2] || '';
  const fresh = buildFile();
  if (mode === '--write') {
    writeFileSync(join(ROOT, FIGURES_FILE), JSON.stringify(fresh, null, 2) + '\n');
    const badges = buildBadges(fresh.figures);
    for (const [key, rel] of Object.entries(BADGE_FILES)) {
      writeFileSync(join(ROOT, rel), badges[key]);
    }
    console.log('wrote ' + FIGURES_FILE + ' + endpoint badges: ' + JSON.stringify(fresh.figures));
    return;
  }
  console.log(JSON.stringify(fresh.figures, null, 2));
  if (mode === '--check') {
    let committed = null;
    try { committed = JSON.parse(readFileSync(join(ROOT, FIGURES_FILE), 'utf8')); } catch { /* reported below */ }
    if (!committed || JSON.stringify(committed.figures) !== JSON.stringify(fresh.figures)) {
      console.error('DRIFT: committed ' + JSON.stringify(committed && committed.figures)
        + ' vs live ' + JSON.stringify(fresh.figures)
        + ' — run `node scripts/coverage-figures.mjs --write` and commit.');
      process.exitCode = 1;
    } else {
      console.log('coverage-figures: ' + FIGURES_FILE + ' is in sync.');
    }
    const badges = buildBadges(fresh.figures);
    for (const [key, rel] of Object.entries(BADGE_FILES)) {
      let committedBadge = null;
      try { committedBadge = readFileSync(join(ROOT, rel), 'utf8'); } catch { /* reported below */ }
      if (committedBadge !== badges[key]) {
        console.error('DRIFT: badge ' + rel + ' is stale — run `node scripts/coverage-figures.mjs --write` and commit.');
        process.exitCode = 1;
      } else {
        console.log('coverage-figures: ' + rel + ' is in sync.');
      }
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
