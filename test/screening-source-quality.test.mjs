#!/usr/bin/env node
// Source quality is independent of operational continuity. Offline, synthetic
// fixtures deliberately include a truncated core source and lost redundancy.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessRuntime, checkStored } from '../scripts/screening-assurance.mjs';
import { LOCALES } from '../scripts/adverse-media.mjs';
import { PEP_FLOOR } from '../scripts/pep-worldwide.mjs';
import * as pep from '../scripts/pep-worldwide.mjs';

const contract = JSON.parse(readFileSync('data/worldwide-screening-sources.json', 'utf8'));
const nowMs = Date.parse('2026-10-20T12:00:00Z');
const harvested = new Date(nowMs - 3600000).toISOString();
const pepCount = PEP_FLOOR + 1000;
const makeResults = () => ({
  screened: 359,
  sourcePopulation: {
    customer: { projectGid: '1214107620220121', screenedSubjects: 339 },
    employee: { projectGid: '1216239131596624', screenedSubjects: 20 },
  },
  degraded: false,
  lists: contract.domains.sanctions.sources.map(source => ({
    id: source.id, name: source.name, count: source.minNames + 500, partial: false,
  })),
  enrichment: {
    skipped: 0, amErrors: 0, amPartial: 0,
    amLocalesPerSubject: 8, amMatrixTotal: LOCALES.length,
    amBackbones: ['Google News RSS', 'GDELT global index', 'Bing News'],
    amBackboneFailures: { googleNews: 0, gdelt: 0, bing: 0 },
    pepWorldwide: { active: true, count: pepCount, harvested, partial: false },
    pepLookupEnabled: true, pepErrors: 0,
  },
});
const makePep = () => ({
  count: pepCount, expected: pepCount, sourceExpected: pepCount,
  harvested, partial: false, sourceUnscreenable: [],
});
const assess = (results = makeResults(), pepDataset = makePep()) =>
  assessRuntime({ results, pepDataset, contract, nowMs });
let checked = assess();
assert.equal(checked.operational, true, 'baseline must be operational');
assert.equal(checked.sourceQuality.assured, true, 'all sources at floor and all backbones healthy');
assert.equal(checkStored(checked, { nowMs }).ok, true, 'fresh, complete quality can pass');

// The source receipt must identify BOTH approved Asana populations.
const missingPopulation = makeResults();
delete missingPopulation.sourcePopulation;
checked = assess(missingPopulation);
assert.equal(checked.operational, false);
assert.equal(checked.sourceQuality.assured, false);
assert(checked.domains.sanctions.reasons.some(x => x.includes('approved screening population')));

const truncatedPopulation = makeResults();
truncatedPopulation.sourcePopulation.employee.screenedSubjects = 19;
checked = assess(truncatedPopulation);
assert.equal(checked.operational, false, 'an omitted employee blocks assurance');

const redirectedPopulation = makeResults();
redirectedPopulation.sourcePopulation.employee.projectGid = 'wrong-project';
checked = assess(redirectedPopulation);
assert.equal(checked.operational, false, 'unapproved HR source blocks assurance');

const truncated = makeResults();
truncated.lists.find(x => x.id === 'ofac-sdn').count = 1;
checked = assess(truncated);
assert.equal(checked.operational, false, 'single-name OFAC SDN must never pass');
assert.equal(checked.sourceQuality.assured, false);
assert(checked.domains.sanctions.reasons.some(x => x.includes('ofac-sdn') && x.includes('/9000')));

const fallback = makeResults();
fallback.lists.find(x => x.id === 'eu-fsf').count = 1;
fallback.lists.push({ id: 'fr-dgt', count: 9800, partial: false });
checked = assess(fallback);
assert.equal(checked.operational, true, 'contracted French fallback preserves continuity');
assert.equal(checked.sourceQuality.assured, false, 'fallback is not complete primary-source assurance');
assert(checked.sourceQuality.reasons.some(x => x.includes('eu-fsf')));
assert.equal(checkStored(checked, { nowMs }).ok, false, 'quality warning must not appear fully assured');

fallback.lists.find(x => x.id === 'fr-dgt').count = 2;
checked = assess(fallback);
assert.equal(checked.operational, false, 'an under-floor fallback must be rejected');

const partialNews = makeResults();
partialNews.enrichment.amPartial = 1;
partialNews.enrichment.amBackboneFailures.gdelt = 1;
checked = assess(partialNews);
assert.equal(checked.operational, true, 'fallback news backbone can keep basic screening operational');
assert.equal(checked.sourceQuality.assured, false, 'lost redundancy is not 100% news-source quality');

const incompletePep = makePep();
incompletePep.sourceUnscreenable = ['synthetic-unlabelled-QID'];
checked = assess(makeResults(), incompletePep);
assert.equal(checked.operational, true, 'PEP identity exception is tracked separately');
assert.equal(checked.sourceQuality.assured, false, 'unscreenable public-office records block full assurance');
assert(checked.sourceQuality.reasons.some(x => x.includes('PEP source records')));

const oldEvidence = assess();
delete oldEvidence.sourceQuality;
assert.equal(checkStored(oldEvidence, { nowMs }).ok, false,
  'prior-schema artifacts cannot silently claim the new quality assurance');
assert.equal(checkStored(assess(), { nowMs, expectedCommit: 'different-commit' }).ok, false,
  'a different screening commit remains a hard provenance error');

// Alias-only PEP recovery: retain source identities, never waive exceptions.
{
  let aliasChecks = 0;
  const check = (message, value) => { assert.ok(value, message); aliasChecks++; };
  const aliasOnly = { id: 'Q1', labels: {}, aliases: {
    ar: [{ value: ' \u0646\u0627\u062f\u0631 \u0645\u062b\u0627\u0644 ' }],
    en: [{ value: 'Synthetic Alias Person' }, { value: 'Synthetic Alias Person' }],
  } };
  const named = pep.namesFromEntity(aliasOnly);
  check('alias-only record gets a source-provided primary name', pep.hasScreenableName(named));
  check('all multilingual alias forms survive without duplication',
    new Set([named.name, ...named.aliases]).size === 2 && named.aliases.length === 1);
  check('name is trimmed and is one of the actual source aliases',
    ['\u0646\u0627\u062f\u0631 \u0645\u062b\u0627\u0644', 'Synthetic Alias Person'].includes(named.name));
  const data = { entities: { Q1: aliasOnly } };
  check('valid aliases are not source-quality exceptions', pep.confirmedUnscreenableQids(data, ['Q1']).length === 0);
  const bank = new Map();
  pep.bankLabelNames(bank, data, ['Q1']);
  check('alias-only holder is banked', pep.hasScreenableName(bank.get('Q1')));
  check('alias-only holder leaves the missing-name queue', pep.pendingLabels(['Q1'], bank, { count: 1, index: 0 }).length === 0);
  const set = pep.buildPepDataset({ harvestedAt: '2026-10-21T00:00:00Z',
    holderRows: [{ person: 'Q1', pos: 'Q100', classKey: 'minister' }],
    positions: new Map([['Q100', { label: 'Synthetic Office', country: 'Synthetic Country' }]]), names: bank, expected: 1 });
  check('alias-only holder reaches the screening dataset', set.count === 1 && !set.partial);
  check('screening list retains both scripts', pep.pepListFromDataset(set).list.names.length === 2);
  const redirects = { redirects: [{ from: 'Q2', to: 'Q1' }], entities: data.entities };
  const redirected = new Map();
  pep.bankLabelNames(redirected, redirects, ['Q2']);
  check('redirected alias-only holder preserves original identity key', pep.hasScreenableName(redirected.get('Q2')));
  check('redirected alias-only holder is not an unscreenable exception', pep.confirmedUnscreenableQids(redirects, ['Q2']).length === 0);
  const label = pep.namesFromEntity({ ...aliasOnly, labels: { en: { value: 'Synthetic Primary' } } });
  check('existing label priority is unchanged', label.name === 'Synthetic Primary' && label.aliases.length === 2);
  const claimed = pep.namesFromEntity({ ...aliasOnly, claims: { P1559: [{ mainsnak: { datavalue: { value: { text: 'Synthetic Native Name' } } } }] } });
  check('existing literal-claim priority is unchanged', claimed.name === 'Synthetic Native Name');
  const linked = pep.namesFromEntity({ ...aliasOnly, sitelinks: { enwiki: { title: 'Synthetic Officeholder (politician)' } } });
  check('existing sitelink priority is unchanged', linked.name === 'Synthetic Officeholder');
  for (const marker of ['missing', 'invalid']) {
    check(marker + ' record cannot recover through aliases', !pep.hasScreenableName(pep.namesFromEntity({ ...aliasOnly, [marker]: '' })));
  }
  const blank = { labels: {}, aliases: { en: [{ value: ' ' }, { value: 7 }, null], fr: { value: 'not an alias array' } }, descriptions: { en: { value: 'Unrelated narrative must not supply a name' } } };
  check('blank and malformed aliases do not invent identity', !pep.hasScreenableName(pep.namesFromEntity(blank)));
  check('a genuinely unnamed live source remains an explicit exception', pep.confirmedUnscreenableQids({ entities: { Q3: blank } }, ['Q3']).join() === 'Q3');
  check('provider API error cannot become a recovered record', pep.bankLabelNames(new Map(), { ...data, error: { code: 'maxlag' } }, ['Q1']) === 0);
  check('API error cannot certify an unscreenable exception', pep.confirmedUnscreenableQids({ ...data, error: { code: 'maxlag' } }, ['Q1']).length === 0);
  console.log('PASS: ' + aliasChecks + ' PEP alias recovery checks');
}
// Historical label recovery is QID-specific and requires an item-bound source
// reference, not a matching office, location, gender, or old revision alone.
{
  const refs = pep.CORROBORATED_PEP_HISTORICAL_NAMES;
  let checks = 0;
  const ok = (description, expr) => { assert.ok(expr, description); checks++; };
  const supported = Object.keys(refs);
  ok('exactly three reviewed exceptions, never an entire class', supported.length === 3);
  const person = qid => ({ id: qid, labels: {}, aliases: {},
    claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
      P39: [{ mainsnak: { datavalue: { value: { id: 'Q83307' } } },
        references: [{ snaks: { P854: [{ datavalue: { value: refs[qid].itemReferenceUrl } }] } }] }] } });
  for (const qid of supported) {
    const d = { entities: { [qid]: person(qid) } };
    const names = new Map();
    ok(qid + ' accepts supported item-specific source evidence',
      pep.bankCorroboratedPepNames(names, d, [qid]) === 1);
    ok(qid + ' preserves the exact source name and Wikidata revision',
      names.get(qid)?.name === refs[qid].name
      && names.get(qid)?.identityEvidence?.wikidataRevision === refs[qid].historicalRevision);
    ok(qid + ' supplies a screenable identity, never a synthetic office name',
      pep.hasScreenableName(names.get(qid)));
    ok(qid + ' loses recovery on an unrelated citation',
      pep.bankCorroboratedPepNames(new Map(), { entities: { [qid]: { ...person(qid),
        claims: { ...person(qid).claims, P39: [{ ...person(qid).claims.P39[0],
          references: [{ snaks: { P854: [{ datavalue: { value: 'https://example.org/unrelated' } }] } }] }] } } } }, [qid]) === 0);
    ok(qid + ' loses recovery on a mismatched entity ID',
      pep.bankCorroboratedPepNames(new Map(), { entities: { [qid]: { ...person(qid), id: 'Q123' } } }, [qid]) === 0);
    ok(qid + ' does not replace a fresh label',
      pep.bankCorroboratedPepNames(new Map([[qid, { name: 'Fresh Name' }]]), d, [qid]) === 0);
    const bank = new Map();
    pep.bankCorroboratedPepNames(bank, d, [qid]);
    const dataset = pep.buildPepDataset({ harvestedAt: '2026-10-21T00:00:00Z',
      holderRows: [{ person: qid, pos: 'Q83307', classKey: 'minister' }],
      positions: new Map([['Q83307', { label: 'Minister' }]]), names: bank, expected: 1 });
    ok(qid + ' keeps evidence in the final dataset', dataset.count === 1
      && dataset.entries[0].identityEvidence?.itemReferenceUrl === refs[qid].itemReferenceUrl);
  }
  const noRef = person(supported[0]);
  delete noRef.claims.P39[0].references;
  ok('missing statement provenance fails closed', pep.bankCorroboratedPepNames(new Map(),
    { entities: { [supported[0]]: noRef } }, [supported[0]]) === 0);
  const withoutClass = person(supported[0]);
  withoutClass.claims.P31 = [];
  ok('missing human class fails closed', pep.bankCorroboratedPepNames(new Map(),
    { entities: { [supported[0]]: withoutClass } }, [supported[0]]) === 0);
  const invalid = { entities: { [supported[0]]: { ...person(supported[0]), missing: '' } } };
  ok('deleted source entity fails closed', pep.bankCorroboratedPepNames(new Map(), invalid, [supported[0]]) === 0);
  ok('API error fails closed', pep.bankCorroboratedPepNames(new Map(),
    { entities: { [supported[0]]: person(supported[0]) }, error: { code: 'maxlag' } }, [supported[0]]) === 0);
  ok('unreviewed five exceptions are still unscreenable',
    ['Q138161351', 'Q58316593', 'Q58316598', 'Q58316599', 'Q58334883'].every(qid =>
      pep.bankCorroboratedPepNames(new Map(), { entities: { [qid]: person(supported[0]) } }, [qid]) === 0));
  console.log('PASS: ' + checks + ' corroborated historical PEP identity checks');
}
console.log('PASS: screening-source quality, floors, fallback, redundancy, PEP and provenance');
