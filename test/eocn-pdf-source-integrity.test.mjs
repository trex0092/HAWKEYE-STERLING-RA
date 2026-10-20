#!/usr/bin/env node
/* Guard the supplied UAE EOCN PDF's active-versus-delisted boundaries.
 * The PDF is NOT proof of freshness: official-source verification and MLRO
 * sign-off are separate controls before lastReviewed may be advanced.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('data/eocn-user-pdf-source-evidence.json', 'utf8'));
const list = JSON.parse(readFileSync('data/eocn-local-terrorist-list.json', 'utf8'));
const fold = value => String(value || '').normalize('NFKD').toLocaleUpperCase('en')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const names = new Set(list.entries.flatMap(entry => typeof entry === 'string'
  ? [entry] : [entry.name, ...(entry.aliases || [])]).map(fold));

assert.equal(manifest.fileSha256, '83d46617a1f9cc8045fbec031a98aac568f5fd7e6f8d9670a5b53606dd87f858');
assert.equal(manifest.pages, 12);
assert.deepEqual(manifest.listed,
  { individuals: 171, organizations: 75, entities: 65, totalDesignations: 311 });
assert.deepEqual(manifest.removed, { individuals: 19, entities: 8 });
assert.equal(manifest.status, 'PENDING_OFFICIAL_EOCN_AND_MLRO_CONFIRMATION');
assert.equal(manifest.confirmedOfficialPublicationDate, null);
assert.equal(manifest.mlroSignedOffAt, null);
assert.ok(Array.isArray(list.entries) && list.entries.length >= 311,
  'fewer screening entries than the 311 active designations in the supplied PDF');

// The two rows with multiple Latin spellings (#108 and #121) were omitted from
// the flat string array: they MUST remain covered through structured aliases.
for (const name of [
  'HAZEM MOHSEN FARHAN',
  'HAZEM MOHSEN AL FARHAN',
  'Alaa khanfurah',
  'Alaa abdulrazzaq ali khanfurah',
  'Alaa Alkhanfurah',
  'Nima Ahmad Jamil',
  'Ali Mohammed Karneeb',
  'RAFALLAH AL-SAHATI BRIGADE',
  'AL-KARAMA ORGANISATION',
  'AL-Khobara For Accounting, Auditing, and studies',
]) {
  assert.ok(names.has(fold(name)), 'missing active EOCN spelling: ' + name);
}

// Pages 11-12 explicitly describe removals, not fresh listings.
// A future valid re-listing requires revisiting this dated evidence guard.
for (const name of [
  'CANVAS : CENTER FOR APPLIED NONVIOLENT ACTION AND STRATEGIES',
  'QATAR VOLUNTEER CENTER',
  'DOHA APPLE',
  'QATAR CHARITY',
  'EID CHARITY',
  'AL-IHSAN CHARITABLE SOCIETY',
]) {
  assert.ok(!names.has(fold(name)), 'delisted record incorrectly active: ' + name);
}

// Every numbered Latin-script designation from pages 1-10 must remain
// screenable; every numbered removed record on pages 11-12 must stay absent.
// This is a dated supplied-PDF fixture, not an official freshness assertion.
const fixture = JSON.parse(readFileSync('test/fixtures/eocn-supplied-pdf-baseline.json', 'utf8'));
assert.equal(fixture.fileSha256, manifest.fileSha256);
const activeSections = { individuals: 171, organizations: 75, entities: 65 };
for (const [type, count] of Object.entries(activeSections)) {
  const rows = fixture.active[type];
  assert.equal(rows.length, count, type + ' active count');
  assert.deepEqual(rows.map(row => row.row), Array.from({ length: count }, (_, i) => i + 1),
    type + ' row numbers are complete');
  for (const row of rows) {
    assert.ok(row.name && names.has(fold(row.name)),
      'missing listed ' + type + ' # ' + row.row + ' (page ' + row.page + '): ' + row.name);
  }
}
for (const [type, count] of Object.entries({ individuals: 19, entities: 8 })) {
  const rows = fixture.removed[type];
  assert.equal(rows.length, count, type + ' removed count');
  assert.deepEqual(rows.map(row => row.row), Array.from({ length: count }, (_, i) => i + 1),
    type + ' removed row numbers are complete');
  for (const row of rows) {
    assert.ok(row.name && !names.has(fold(row.name)),
      'delisted ' + type + ' # ' + row.row + ' erroneously reactivated: ' + row.name);
  }
}

console.log('PASS: supplied EOCN PDF baseline checked (311 active designations; 27 removed rows; MLRO review pending)');
