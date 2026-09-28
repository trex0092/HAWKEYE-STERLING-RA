/* Runtime screening assurance.
 *
 * This file turns the ACTUAL daily screening result into a fail-loud assurance
 * record. It does not infer coverage from configuration alone.
 *
 * Inputs:
 *   sanctions-screen-results.json  written by scripts/sanctions-screen.mjs
 *   data/pep-worldwide.json         overlaid from pep-worldwide-state
 *   data/worldwide-screening-sources.json
 *
 * Outputs:
 *   data/screening-assurance.json
 *   data/badges/*-operational.svg
 *
 * --write  writes the evidence and exits 1 when any required domain is not
 *          operational.
 * --check  validates an existing evidence file and its freshness.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readJsonMaybeGz, PEP_FLOOR } from './pep-worldwide.mjs';
import { LOCALES } from './adverse-media.mjs';

export const ASSURANCE_FILE = 'data/screening-assurance.json';
export const RESULTS_FILE = 'sanctions-screen-results.json';
export const PEP_FILE = process.env.PEP_WORLDWIDE_FILE || 'data/pep-worldwide.json';
export const DEFAULT_PEP_MAX_AGE_HOURS = Number(process.env.PEP_ASSURANCE_MAX_AGE_HOURS) || 240;
export const DEFAULT_ASSURANCE_MAX_AGE_HOURS = Number(process.env.SCREENING_ASSURANCE_MAX_AGE_HOURS) || 36;

export const BADGE_FILES = {
  sanctions: 'data/badges/sanctions-operational.svg',
  adverseMedia: 'data/badges/adverse-media-operational.svg',
  pep: 'data/badges/pep-operational.svg',
};

const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const arr = v => Array.isArray(v) ? v : [];

function ageHours(iso, nowMs) {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? Math.max(0, (nowMs - t) / 3600000) : Infinity;
}

function domain(ok, reasons, evidence) {
  return { operational: !!ok, reasons: reasons.filter(Boolean), evidence };
}

export function assessRuntime({
  results,
  pepDataset,
  contract,
  nowMs = Date.now(),
  pepMaxAgeHours = DEFAULT_PEP_MAX_AGE_HOURS,
  expectedAdverseMatrix = LOCALES.length,
} = {}) {
  const requiredSanctions = arr(contract?.domains?.sanctions?.sources)
    .filter(s => s && s.required !== false)
    .map(s => String(s.id || '')).filter(Boolean);
  const loaded = arr(results?.lists);
  const loadedById = new Map(loaded.map(x => [String(x?.id || ''), x]));
  const missingRequired = requiredSanctions.filter(id => !loadedById.has(id));
  const partialRequired = requiredSanctions.filter(id => loadedById.get(id)?.partial === true);
  const emptyRequired = requiredSanctions.filter(id => num(loadedById.get(id)?.count) <= 0);
  const sanctionsReasons = [];
  if (num(results?.screened) <= 0) sanctionsReasons.push('no subjects were screened');
  if (results?.degraded === true) sanctionsReasons.push('sanctions loader reported degraded coverage');
  if (missingRequired.length) sanctionsReasons.push('required sanctions sources missing: ' + missingRequired.join(', '));
  if (partialRequired.length) sanctionsReasons.push('required sanctions sources partial: ' + partialRequired.join(', '));
  if (emptyRequired.length) sanctionsReasons.push('required sanctions sources empty: ' + emptyRequired.join(', '));
  const sanctions = domain(sanctionsReasons.length === 0, sanctionsReasons, {
    screenedSubjects: num(results?.screened),
    loadedSources: loaded.map(x => ({ id: x?.id || '', name: x?.name || '', count: num(x?.count), partial: !!x?.partial })),
    requiredSourceIds: requiredSanctions,
    notes: arr(results?.failures),
  });

  const e = results?.enrichment || {};
  const backbones = new Set(arr(e.amBackbones).map(String));
  const backboneFailures = e.amBackboneFailures || {};
  const adverseReasons = [];
  if (num(results?.screened) <= 0) adverseReasons.push('no subjects were screened');
  if (num(e.skipped) > 0) adverseReasons.push(num(e.skipped) + ' subjects skipped enrichment');
  if (num(e.amErrors) > 0) adverseReasons.push(num(e.amErrors) + ' subjects had adverse-media errors');
  if (num(e.amPartial) > 0) adverseReasons.push(num(e.amPartial) + ' subjects had partial adverse-media coverage');
  if (num(e.amLocalesPerSubject) <= 0) adverseReasons.push('Google News locale sweep did not run');
  if (!backbones.has('Google News RSS') || num(backboneFailures.googleNews) > 0) {
    adverseReasons.push('Google News failed for ' + num(backboneFailures.googleNews) + ' subject(s)');
  }
  if (!backbones.has('GDELT global index') || num(backboneFailures.gdelt) > 0) {
    adverseReasons.push('GDELT failed for ' + num(backboneFailures.gdelt) + ' subject(s)');
  }
  if (!backbones.has('Bing News') || num(backboneFailures.bing) > 0) {
    adverseReasons.push('Bing News failed for ' + num(backboneFailures.bing) + ' subject(s)');
  }
  if (num(e.amMatrixTotal) !== num(expectedAdverseMatrix)) {
    adverseReasons.push('adverse-media matrix mismatch: run ' + num(e.amMatrixTotal) + ', configured ' + num(expectedAdverseMatrix));
  }
  const adverseMedia = domain(adverseReasons.length === 0, adverseReasons, {
    screenedSubjects: num(results?.screened),
    googleNewsLocalesPerSubject: num(e.amLocalesPerSubject),
    matrixTotal: num(e.amMatrixTotal),
    rotationCycleDays: num(e.amRotationCycleDays),
    globalBackbones: [...backbones],
    backboneFailures: {
      googleNews: num(backboneFailures.googleNews),
      gdelt: num(backboneFailures.gdelt),
      bing: num(backboneFailures.bing),
    },
    errors: num(e.amErrors),
    partialSubjects: num(e.amPartial),
    skippedSubjects: num(e.skipped),
  });

  const pepReasons = [];
  const pepRun = e.pepWorldwide || {};
  const pepCount = num(pepDataset?.count);
  const pepExpected = num(pepDataset?.expected);
  const pepAge = ageHours(pepDataset?.harvested, nowMs);
  if (!pepDataset || typeof pepDataset !== 'object') pepReasons.push('worldwide PEP artifact is missing');
  if (pepRun.active !== true) pepReasons.push('daily screen did not load the worldwide PEP artifact');
  if (num(pepRun.count) !== pepCount) pepReasons.push('daily screen PEP count does not match the harvested artifact');
  if (pepRun.harvested && pepDataset?.harvested && pepRun.harvested !== pepDataset.harvested) {
    pepReasons.push('daily screen consumed a different PEP harvest than the assurance artifact');
  }
  if (pepRun.partial === true) pepReasons.push('daily screen reports the worldwide PEP layer as partial');
  if (e.pepLookupEnabled !== true) pepReasons.push('live per-name PEP lookup is disabled');
  if (pepCount < PEP_FLOOR) pepReasons.push('worldwide PEP artifact below floor: ' + pepCount + ' < ' + PEP_FLOOR);
  if (pepDataset?.partial === true) pepReasons.push('worldwide PEP artifact is partial' + (pepExpected ? ': ' + pepCount + '/' + pepExpected : ''));
  if (!Number.isFinite(pepAge)) pepReasons.push('worldwide PEP artifact has no valid harvest timestamp');
  else if (pepAge > pepMaxAgeHours) pepReasons.push('worldwide PEP artifact is stale: ' + Math.round(pepAge) + 'h > ' + pepMaxAgeHours + 'h');
  if (num(e.pepErrors) > 0) pepReasons.push(num(e.pepErrors) + ' subjects had live PEP lookup errors');
  if (num(e.skipped) > 0) pepReasons.push(num(e.skipped) + ' subjects skipped PEP enrichment');
  const pep = domain(pepReasons.length === 0, pepReasons, {
    persons: pepCount,
    expected: pepExpected || pepCount,
    partial: !!pepDataset?.partial,
    harvestedAt: pepDataset?.harvested || '',
    ageHours: Number.isFinite(pepAge) ? Math.round(pepAge * 10) / 10 : null,
    floor: PEP_FLOOR,
    dailyScreenActive: pepRun.active === true,
    dailyScreenCount: num(pepRun.count),
    dailyScreenHarvestedAt: pepRun.harvested || '',
    liveLookupEnabled: e.pepLookupEnabled === true,
    liveLookupErrors: num(e.pepErrors),
    skippedSubjects: num(e.skipped),
  });

  return {
    version: 1,
    generatedAt: new Date(nowMs).toISOString(),
    run: {
      date: results?.date || '',
      githubRunId: process.env.GITHUB_RUN_ID || '',
      commit: process.env.GITHUB_SHA || '',
      screenedSubjects: num(results?.screened),
    },
    countryUniverse: Number(contract?.countryUniverse) || 195,
    operational: sanctions.operational && adverseMedia.operational && pep.operational,
    domains: { sanctions, adverseMedia, pep },
  };
}

function esc(s) {
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

export function badgeSvg(label, d) {
  const ok = !!d?.operational;
  const message = ok ? 'operational' : 'degraded';
  const color = ok ? '#4c1' : '#e05d44';
  const lw = Math.max(110, label.length * 7 + 18), vw = 78, total = lw + vw;
  const title = label + ': ' + message + (ok ? '' : ' — ' + arr(d?.reasons).join('; '));
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + total + '" height="20" role="img" aria-label="' + esc(title) + '">'
    + '<title>' + esc(title) + '</title>'
    + '<clipPath id="r"><rect width="' + total + '" height="20" rx="3"/></clipPath>'
    + '<g clip-path="url(#r)"><rect width="' + lw + '" height="20" fill="#555"/><rect x="' + lw + '" width="' + vw + '" height="20" fill="' + color + '"/></g>'
    + '<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">'
    + '<text x="' + (lw/2) + '" y="14">' + esc(label) + '</text><text x="' + (lw+vw/2) + '" y="14">' + message + '</text></g></svg>\n';
}

export function writeAssurance(assurance) {
  mkdirSync('data/badges', { recursive: true });
  writeFileSync(ASSURANCE_FILE, JSON.stringify(assurance, null, 2) + '\n');
  writeFileSync(BADGE_FILES.sanctions, badgeSvg('sanctions runtime', assurance.domains.sanctions));
  writeFileSync(BADGE_FILES.adverseMedia, badgeSvg('adverse media runtime', assurance.domains.adverseMedia));
  writeFileSync(BADGE_FILES.pep, badgeSvg('PEP runtime', assurance.domains.pep));
}

export function checkStored(assurance, { nowMs = Date.now(), maxAgeHours = DEFAULT_ASSURANCE_MAX_AGE_HOURS } = {}) {
  const reasons = [];
  if (!assurance || assurance.version !== 1) reasons.push('assurance artifact missing or invalid');
  const age = ageHours(assurance?.generatedAt, nowMs);
  if (!Number.isFinite(age)) reasons.push('assurance timestamp missing or invalid');
  else if (age > maxAgeHours) reasons.push('assurance evidence is stale: ' + Math.round(age) + 'h > ' + maxAgeHours + 'h');
  for (const key of ['sanctions','adverseMedia','pep']) {
    if (assurance?.domains?.[key]?.operational !== true) reasons.push(key + ' is not operational');
  }
  return { ok: reasons.length === 0, reasons, ageHours: Number.isFinite(age) ? age : null };
}

function loadJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function main() {
  const mode = process.argv[2] || '--write';
  if (mode === '--check') {
    let stored = null;
    try { stored = loadJson(ASSURANCE_FILE); } catch {}
    const checked = checkStored(stored);
    if (!checked.ok) {
      console.error('screening-assurance: FAILED');
      for (const r of checked.reasons) console.error('- ' + r);
      process.exit(1);
    }
    console.log('screening-assurance: PASSED — runtime evidence is fresh and all three domains are operational');
    return;
  }

  const results = loadJson(RESULTS_FILE);
  const contract = loadJson('data/worldwide-screening-sources.json');
  let pepDataset = null;
  try { pepDataset = readJsonMaybeGz(PEP_FILE); } catch {}
  const assurance = assessRuntime({ results, pepDataset, contract });
  writeAssurance(assurance);

  console.log('WORLDWIDE SCREENING RUNTIME ASSURANCE');
  console.log('------------------------------------');
  for (const [key, d] of Object.entries(assurance.domains)) {
    console.log(key + ': ' + (d.operational ? 'OPERATIONAL' : 'DEGRADED'));
    for (const reason of d.reasons) console.log('  - ' + reason);
  }
  if (!assurance.operational) {
    console.error('screening-assurance: FAIL — at least one required worldwide screening domain is not operational');
    process.exit(1);
  }
  console.log('screening-assurance: PASS — sanctions, adverse media and PEP are operational on current run evidence');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
