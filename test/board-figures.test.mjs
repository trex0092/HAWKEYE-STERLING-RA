/* Board-figure drift guard. Hand-maintained board figures drifted within a
   day (workflow count 45 to 46, doc count 84 to 87, egress split changed by
   one merge). data/board-figures.json is the canonical committed snapshot;
   this test recomputes every figure from the live repository and fails on any
   difference, which is exactly the check that would have caught the drift.
   Usage: node test/board-figures.test.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildFigures, countWorkflows, countDocs, countAutoDocs, egressSplit, FIGURES_FILE } from '../scripts/board-figures.mjs';
import { issuingCountry, screenedSources } from '../scripts/coverage-figures.mjs';
import { assessRuntime, checkStored } from '../scripts/screening-assurance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

console.log('\n— board-figure drift guard —\n');

// Counter sanity on the live repo.
check('counts workflows (> 20 expected in this estate)', countWorkflows() > 20);
check('counts docs recursively (> 50 expected)', countDocs() > 50);
check('auto docs are a strict subset of total docs', countAutoDocs() > 0 && countAutoDocs() < countDocs());
const eg = egressSplit();
check('egress split finds both postures', eg.block > 0 && eg.audit > 0);

// The drift guard proper: committed snapshot === live estate, field by field.
const committed = JSON.parse(readFileSync(join(ROOT, FIGURES_FILE), 'utf8'));
check('committed file documents itself and its definitions', !!committed._README && !!committed.definitions);
const live = buildFigures();
for (const [k, v] of Object.entries(live)) {
  check(`figure "${k}" matches the live estate (committed ${committed.figures && committed.figures[k]} vs live ${v})`,
    !!committed.figures && committed.figures[k] === v);
}
for (const k of Object.keys(committed.figures || {})) {
  check(`committed figure "${k}" is still a computed figure`, k in live);
}

/* Coverage figures (the README sanctions-jurisdictions badge). "jurisdiction:
   Global" in the source files is a list's REACH, not its issuer — counting only
   non-Global entries silently dropped Canada, France, Ukraine and the UK from
   the badge (36 shown vs 40 issuing countries screened). */
console.log('\n— coverage figures: sanctions issuing countries —\n');
check('a Global-reach national list counts its issuing country (Canada SEMA)',
  issuingCountry({ jurisdiction: 'Global', name: 'Canada — Consolidated Autonomous Sanctions (SEMA, XML)' }) === 'Canada');
check('US OFAC and the UK list map to their countries',
  issuingCountry({ jurisdiction: 'Global', name: 'US OFAC — SDN list (CSV)' }) === 'United States'
  && issuingCountry({ jurisdiction: 'Global', name: 'UK Sanctions List — FCDO/OFSI consolidated targets (CSV)' }) === 'United Kingdom');
check('UN, EU and development-bank lists are supranational, never a country',
  [['UN Security Council — Consolidated list (XML)', 'Global'], ['EU — Consolidated financial sanctions list (CSV)', 'Global'],
   ['ADB — Published Debarment & Suspension Register', 'Global (MDB)'],
   ['Inter-American Development Bank: Sanctioned Firms & Individuals', 'Global (Latin America/Caribbean-focused)']]
    .every(([name, jurisdiction]) => issuingCountry({ name, jurisdiction }) === null));
check('a national jurisdiction field is used as-is',
  issuingCountry({ jurisdiction: 'Brazil', name: 'Brazil — BCB Disqualified Persons' }) === 'Brazil');
{
  const live = new Set(screenedSources().map(issuingCountry).filter(Boolean));
  check('the live screened set counts Canada, France, Ukraine and the UK as issuers',
    ['Canada', 'France', 'Ukraine', 'United Kingdom', 'United States'].every(c => live.has(c)));
}

/* The 195-country sanctions coverage register. "screened" is the one status a
   file edit could overstate, so it is pinned to the live configuration in both
   directions: every country marked screened really issues a loaded list, and
   every issuing country of a loaded list is marked screened. */
console.log('\n— sanctions country coverage register (195) —\n');
{
  const reg = JSON.parse(readFileSync(join(ROOT, 'data/sanctions-country-coverage.json'), 'utf8')).countries;
  const names = reg.map(r => r.country);
  check('the register lists exactly 195 countries, each once', names.length === 195 && new Set(names).size === 195);
  const allowed = new Set(['screened', 'pending', 'identified', 'assessed-not-loadable', 'not-researched']);
  check('every row has a known status', reg.every(r => allowed.has(r.status)));
  const live = new Set(screenedSources().map(issuingCountry).filter(Boolean));
  const marked = new Set(reg.filter(r => r.status === 'screened').map(r => r.country));
  check('every country marked screened issues a list the screen loads',
    [...marked].every(c => live.has(c)));
  check('every issuing country of a loaded list is marked screened',
    [...live].every(c => marked.has(c)));
  /* baseline = the multilateral lists already screened daily for every row:
     UN for all 193 UN members (not the Holy See / Palestine), EU for the 27
     EU members — and both lists must really be enabled in the registry. */
  const core = JSON.parse(readFileSync(join(ROOT, 'data/sanctions-sources.json'), 'utf8')).sources || [];
  const on = id => core.some(s => s.id === id && s.enabled !== false);
  const unRows = reg.filter(r => (r.baseline || []).includes('UN'));
  check('baseline UN covers exactly the 193 UN members and the UN list is enabled',
    unRows.length === 193 && !unRows.some(r => r.country === 'Holy See' || r.country === 'Palestine') && on('un-consolidated'));
  check('baseline EU covers exactly the 27 EU members and the EU list is enabled',
    reg.filter(r => (r.baseline || []).includes('EU')).length === 27 && on('eu-fsf'));
  check('non-screened statuses other than not-researched carry a note',
    reg.filter(r => r.status !== 'screened' && r.status !== 'not-researched').every(r => r.note));
}

/* Runtime worldwide screening assurance: green means actual run evidence,
   not a static 195-country scope flag. */
console.log('\n— runtime worldwide screening assurance —\n');
{
  const contract = {
    countryUniverse: 195,
    domains: {
      sanctions: {
        sources: [
          { id: 'un-consolidated', required: true },
          { id: 'ofac-sdn', required: true },
          { id: 'ofac-consolidated', required: true },
          { id: 'uk-ofsi', required: true },
          { id: 'eu-fsf', required: true },
        ],
      },
    },
  };
  const results = {
    date: '2026-09-28',
    screened: 12,
    degraded: false,
    failures: [],
    lists: [
      { id: 'un-consolidated', count: 1000, partial: false },
      { id: 'ofac-sdn', count: 10000, partial: false },
      { id: 'ofac-consolidated', count: 500, partial: false },
      { id: 'uk-ofsi', count: 10000, partial: false },
      { id: 'eu-fsf', count: 25000, partial: false },
    ],
    enrichment: {
      amErrors: 0, amPartial: 0, pepErrors: 0, skipped: 0,
      amLocalesPerSubject: 8, amRotationCycleDays: 9, amMatrixTotal: 79,
      amBackboneFailures: { googleNews: 0, gdelt: 0, bing: 0 },
      amBackbones: ['Google News RSS', 'GDELT global index', 'Bing News'],
      pepLookupEnabled: true,
      pepWorldwide: {
        active: true,
        count: 50000,
        harvested: '2026-09-27T00:00:00.000Z',
        partial: false,
        expected: 50000,
      },
    },
  };
  const pep = {
    count: 50000, harvested: '2026-09-27T00:00:00.000Z', entries: [],
  };
  const nowMs = Date.parse('2026-09-28T00:00:00.000Z');
  const ok = assessRuntime({ results, pepDataset: pep, contract, nowMs, expectedAdverseMatrix: 79 });
  check('runtime assurance passes only when all three domains have complete current evidence',
    ok.operational && ok.domains.sanctions.operational && ok.domains.adverseMedia.operational && ok.domains.pep.operational);

  const noOfac = structuredClone(results);
  noOfac.lists = noOfac.lists.filter(x => x.id !== 'ofac-sdn');
  const miss = assessRuntime({ results: noOfac, pepDataset: pep, contract, nowMs, expectedAdverseMatrix: 79 });
  check('runtime assurance fails when a required sanctions backbone is missing',
    !miss.domains.sanctions.operational && miss.domains.sanctions.reasons.some(r => r.includes('ofac-sdn')));

  const supplementalDown = structuredClone(results);
  supplementalDown.degraded = true;
  supplementalDown.failures = ['Nigeria national supplement unavailable'];
  const supp = assessRuntime({ results: supplementalDown, pepDataset: pep, contract, nowMs, expectedAdverseMatrix: 79 });
  check('runtime assurance keeps sanctions operational when only supplementary sources are degraded',
    supp.domains.sanctions.operational
    && supp.domains.sanctions.warnings.some(r => r.includes('supplementary sanctions sources')));

  const amPartial = structuredClone(results);
  amPartial.enrichment.amPartial = 1;
  const am = assessRuntime({ results: amPartial, pepDataset: pep, contract, nowMs, expectedAdverseMatrix: 79 });
  check('runtime assurance stays operational when redundancy is reduced but no subject lost all adverse-media coverage',
    am.domains.adverseMedia.operational
    && am.domains.adverseMedia.warnings.some(r => r.includes('reduced adverse-media source redundancy')));

  const gdeltDown = structuredClone(results);
  gdeltDown.enrichment.amBackboneFailures.gdelt = 1;
  gdeltDown.enrichment.amBackbones = ['Google News RSS', 'Bing News'];
  const gd = assessRuntime({ results: gdeltDown, pepDataset: pep, contract, nowMs, expectedAdverseMatrix: 79 });
  check('runtime assurance warns, but does not fail, when one redundant adverse-media backbone is unavailable',
    gd.domains.adverseMedia.operational
    && gd.domains.adverseMedia.warnings.some(r => r.includes('GDELT')));

  const uncovered = structuredClone(results);
  uncovered.enrichment.amErrors = 1;
  uncovered.enrichment.amRetryAttempted = 1;
  uncovered.enrichment.amRetryRecovered = 0;
  const uc = assessRuntime({ results: uncovered, pepDataset: pep, contract, nowMs, expectedAdverseMatrix: 79 });
  check('runtime assurance fails when any subject has zero global adverse-media backbone coverage after retry',
    !uc.domains.adverseMedia.operational
    && uc.domains.adverseMedia.reasons.some(r => r.includes('zero adverse-media backbone coverage')));

  const pepNotConsumed = structuredClone(results);
  pepNotConsumed.enrichment.pepWorldwide.active = false;
  const pc = assessRuntime({ results: pepNotConsumed, pepDataset: pep, contract, nowMs, expectedAdverseMatrix: 79 });
  check('runtime assurance fails when the daily screen did not consume the worldwide PEP artifact',
    !pc.domains.pep.operational);

  const partialPep = { ...pep, partial: true, expected: 60000 };
  const pp = assessRuntime({ results, pepDataset: partialPep, contract, nowMs, expectedAdverseMatrix: 79 });
  check('runtime assurance fails when the worldwide PEP artifact is partial',
    !pp.domains.pep.operational);

  const stale = checkStored({ ...ok, generatedAt: '2026-09-20T00:00:00.000Z' },
    { nowMs, maxAgeHours: 36 });
  check('stored runtime assurance fails closed when evidence is stale', !stale.ok);
}

/* FATF black/grey lists: data/fatf-assessments.json (the assessment text),
   data/jurisdiction-risk.json (the scoring nudge) and the register's `fatf`
   field must name the same jurisdictions, so a plenary update to one without
   the others fails here instead of silently disagreeing. */
{
  const fa = JSON.parse(readFileSync(join(ROOT, 'data/fatf-assessments.json'), 'utf8'));
  const jr = JSON.parse(readFileSync(join(ROOT, 'data/jurisdiction-risk.json'), 'utf8'));
  const reg = JSON.parse(readFileSync(join(ROOT, 'data/sanctions-country-coverage.json'), 'utf8')).countries;
  const J = fa.jurisdictions || [];
  const same = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  const of = l => J.filter(j => j.list === l);
  check('FATF black list matches jurisdiction-risk high', same(of('black').map(j => j.riskName), jr.high || []));
  check('FATF grey list matches jurisdiction-risk grey', same(of('grey').map(j => j.riskName), jr.grey || []));
  check('register `fatf` field matches the assessments', same(
    reg.filter(r => r.fatf).map(r => r.country + ':' + r.fatf),
    J.filter(j => j.register).map(j => j.register + ':' + j.list)));
  check('every FATF assessment cites a fatf-gafi.org statement and has action-plan items',
    J.length > 0 && J.every(j => /^https:\/\/www\.fatf-gafi\.org\//.test(j.source) && Array.isArray(j.actionPlan) && j.actionPlan.length && j.status && j.statementDate));
  check('black-list entries state the FATF call (countermeasures or enhanced due diligence)',
    of('black').every(j => j.call === 'countermeasures' || j.call === 'enhanced due diligence'));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
