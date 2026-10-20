#!/usr/bin/env node
// Source quality is independent of operational continuity. Offline, synthetic
// fixtures deliberately include a truncated core source and lost redundancy.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessRuntime, checkStored } from '../scripts/screening-assurance.mjs';
import { LOCALES } from '../scripts/adverse-media.mjs';
import { PEP_FLOOR } from '../scripts/pep-worldwide.mjs';

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
console.log('PASS: screening-source quality, floors, fallback, redundancy, PEP and provenance');
