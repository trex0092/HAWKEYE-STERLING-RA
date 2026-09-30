import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
const source = readFileSync(new URL('./data-schema.test.js', import.meta.url), 'utf8');
const row = { name: 'Synthetic', band: 'medium', topScore: 85, lists: ['Synthetic'],
  firstSeen: '2026-09-30', lastSeen: '2026-09-30' };
function run(state) {
  const data = {
    'sanctions-screen-state.json': state,
    'sanctions-state.json': { updated: '2026-09-30', sources: { synthetic: { hash: 'a'.repeat(64), bytes: 10, checkedAt: '2026-09-30' } } },
    'sanctions-sources.json': { sources: ['ofac-sdn', 'un-consolidated', 'uk-ofsi', 'eu-fsf'].map(id => ({ id, name: id, url: 'https://example.invalid', parser: 'csv', type: 'csv' })) },
    'eocn-local-terrorist-list.json': { lastReviewed: '2026-09-30', populated: true, entries: ['Synthetic'], count: 1 },
    'internal-watchlist.json': { lastReviewed: '2026-09-30', populated: false, entries: [], count: 0 },
    'sanctions-extra.json': { sources: [{ id: 'internal-watchlist', enabled: true, file: 'data/internal-watchlist.json', parser: 'curated', optional: true }] },
  };
  const process = { exitCode: 0 }, lines = [];
  const fs = { existsSync: () => true, readFileSync: path => {
    const name = basename(path);
    if (name.endsWith('.md')) return 'Update triggers Update procedure Full reconciliation procedure Evidence log eocn-local-terrorist-list.json internal-watchlist.json';
    if (!(name in data)) throw new Error('Unexpected fixture ' + name);
    return JSON.stringify(data[name]);
  } };
  runInNewContext(source, { __dirname: '/fixture/test', process,
    console: { log: text => lines.push(text) },
    require: name => { if (name === 'fs') return fs; if (name === 'path') return { join }; throw new Error(name); },
  });
  return { code: process.exitCode, lines };
}
test('actual schema accepts the null-date empty bootstrap without inventing runtime evidence', () => {
  assert.equal(run({ updated: null, subjects: {} }).code, 0);
});
test('actual schema still requires dates on populated state', () => {
  assert.equal(run({ updated: null, subjects: { synthetic: row } }).code, 1);
  assert.equal(run({ updated: '2026-09-30', subjects: { synthetic: row } }).code, 0);
});
for (const subjects of [null, [], 'invalid']) {
  test('actual schema rejects a malformed bootstrap ' + JSON.stringify(subjects), () => {
    assert.equal(run({ updated: null, subjects }).code, 1);
  });
}
test('actual schema does not allow a missing updated field to masquerade as bootstrap', () => {
  assert.equal(run({ subjects: {} }).code, 1);
});
