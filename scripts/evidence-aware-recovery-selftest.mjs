/* Offline synthetic regression cases ONLY. No screening or provider evidence. */
import assert from 'node:assert/strict';
import { screeningDecision, qualifyEvidence, independentReady,
  makeEvidenceReader, readPinnedEvidence, safeRecoverySummary } from './evidence-aware-recovery.mjs';

const sha = 'a'.repeat(40), oldSha = 'b'.repeat(40), stateSha = 'c'.repeat(40), blobSha = 'd'.repeat(40);
const nowMs = Date.parse('2026-10-22T16:00:00Z');
const baseRun = { id: 111, head_branch: 'main', event: 'workflow_dispatch',
  path: '.github/workflows/sanctions-screen.yml', head_sha: sha,
  status: 'completed', conclusion: 'success', created_at: '2026-10-22T12:00:00Z' };
const fixture = () => ({ version: 1, generatedAt: '2026-10-22T15:00:00Z', operational: true,
  run: { githubRunId: '111', commit: sha, screenedSubjects: 991 },
  sourceQuality: { assured: true, reasons: [], evidence: { adverseMediaPartialSubjects: 0,
    pepUnscreenableSourceRecords: 0, adverseMediaBackboneFailures: { googleNews: 0, gdelt: 0, bing: 0 },
    sanctionsFloors: [{ id: 'fixture-list', minimum: 100, observed: 101, primaryComplete: true }],
    fallbackSourcesUsed: [] } },
  domains: { sanctions: { operational: true, evidence: { sourcePopulation: {
    customer: { screenedSubjects: 971 }, employee: { screenedSubjects: 20 } } } },
  adverseMedia: { operational: true, evidence: { screenedSubjects: 991, skippedSubjects: 0,
    partialSubjects: 0, backboneFailures: { googleNews: 0, gdelt: 0, bing: 0 },
    globalBackbones: ['Google News RSS', 'GDELT global index', 'Bing News'] } },
  pep: { operational: true, evidence: { sourceUnscreenable: [] } } } });
// These collaborators are isolated in unit tests. Production imports the
// repository's real checkStored and approvedSourcePopulationIssue unchanged.
const validators = { nowMs,
  checkStored: (r, options) => ({ ok: options.expectedCommit === r.run.commit && !Object.hasOwn(options, 'maxAgeHours') &&
    r.sourceQuality.assured === true && Object.values(r.domains).every(x => x.operational === true) }),
  approvedSourcePopulationIssue: (p, n) => p?.customer?.screenedSubjects + p?.employee?.screenedSubjects === n ? null : 'mismatch',
};
const qualify = (r = fixture(), run = baseRun, options = {}) => qualifyEvidence(r, run, sha, { ...validators, ...options });
const good = qualify();
const plan = (runs = [baseRun], evidence = good, options = {}) => screeningDecision(runs, evidence, { nowMs, currentSha: sha, ...options });
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('ok ' + passed + ' - ' + name); }
await test('valid current-code receipt is eligible, not an independent pass', () => assert.equal(plan().action, 'healthy'));
await test('degraded quality routes to bounded recovery', () => {
  const r = fixture(); r.sourceQuality.assured = false;
  assert.equal(plan([baseRun], qualify(r)).action, 'dispatch');
});
await test('old successful producer cannot satisfy current main', () => {
  const r = fixture(); r.run.commit = oldSha;
  const run = { ...baseRun, head_sha: oldSha };
  assert.equal(plan([run], qualify(r, run)).action, 'dispatch');
});
await test('unknown evidence never launches a blind screen', () => assert.equal(plan([baseRun], { state: 'unknown', currentSha: sha }).action, 'unknown'));
await test('active producer is not cancelled or duplicated', () => assert.equal(plan([{ ...baseRun, status: 'in_progress', conclusion: null }]).action, 'wait'));
await test('active run discovered outside history also blocks duplication', () => assert.equal(plan([], good, { activeRuns: [{ ...baseRun, status: 'queued' }] }).action, 'wait'));
await test('one-hour cooldown is retained', () => assert.equal(plan([{ ...baseRun, conclusion: 'failure', created_at: '2026-10-22T15:30:00Z' }]).action, 'cooldown'));
await test('three-attempt limit retained even for unassured success', () => {
  const failed = { ...good, state: 'degraded' };
  assert.equal(plan([baseRun, { ...baseRun, id: 112 }, { ...baseRun, id: 113 }], failed).action, 'blocked');
});
await test('duplicate history rows do not inflate attempts', () => assert.equal(plan([baseRun, baseRun, baseRun], { ...good, state: 'degraded' }).action, 'dispatch'));
await test('skipped workflow is not success', () => assert.equal(plan([{ ...baseRun, conclusion: 'skipped' }]).action, 'dispatch'));
await test('unrelated branches cannot supply successful screening', () => assert.equal(plan([{ ...baseRun, head_branch: 'feature' }]).action, 'dispatch'));
await test('push-only checks cannot supply successful screening', () => assert.equal(plan([{ ...baseRun, event: 'push' }]).action, 'dispatch'));
await test('invalid history fails closed', () => assert.equal(plan([null]).action, 'unknown'));
await test('invalid run timestamp fails closed', () => assert.equal(plan([{ ...baseRun, created_at: 'invalid' }]).action, 'unknown'));
await test('future run timestamp fails closed', () => assert.equal(plan([{ ...baseRun, created_at: '2026-10-23T12:00:00Z' }]).action, 'unknown'));
await test('missing expected SHA fails closed', () => assert.equal(plan([baseRun], good, { currentSha: '' }).action, 'unknown'));
await test('different receipt run ID cannot certify latest success', () => assert.equal(plan([baseRun], { ...good, runId: '222' }).action, 'dispatch'));
await test('receipt from yesterday cannot satisfy today', () => {
  const r = fixture(); r.generatedAt = '2026-10-21T15:00:00Z';
  assert.equal(qualify(r).state, 'degraded');
});
await test('receipt from a previous attempt fails freshness', () => assert.equal(qualify(fixture(), { ...baseRun, run_started_at: '2026-10-22T15:30:00Z' }).state, 'degraded'));
await test('future receipt is unknown, never a pass', () => {
  const r = fixture(); r.generatedAt = '2026-10-23T15:00:00Z'; assert.equal(qualify(r).state, 'unknown');
});
await test('wrong producer workflow is rejected', () => assert.equal(qualify(fixture(), { ...baseRun, path: '.github/workflows/ci.yml' }).state, 'unknown'));
await test('producer and receipt SHA mismatch is rejected', () => assert.equal(qualify(fixture(), { ...baseRun, head_sha: oldSha }).state, 'unknown'));
await test('failed actual producer cannot be green', () => assert.equal(qualify(fixture(), { ...baseRun, conclusion: 'failure' }).state, 'degraded'));
await test('approved population mismatch is rejected', () => {
  const r = fixture(); r.run.screenedSubjects = 990; assert.equal(qualify(r).state, 'degraded');
});
await test('missing real validator fails closed', () => assert.equal(qualify(fixture(), baseRun, { checkStored: undefined }).state, 'unknown'));
await test('actual verifier rejection cannot be overridden', () => assert.equal(qualify(fixture(), baseRun, { checkStored: () => ({ ok: false }) }).state, 'degraded'));
await test('83 skipped enrichments cannot pass through an assured boolean', () => {
  const r = fixture(); r.domains.adverseMedia.evidence.skippedSubjects = 83; assert.equal(qualify(r).state, 'degraded');
});
await test('Google News failures cannot pass through an assured boolean', () => {
  const r = fixture(); r.sourceQuality.evidence.adverseMediaBackboneFailures.googleNews = 877; assert.equal(qualify(r).state, 'degraded');
});
await test('GDELT failures cannot pass through an assured boolean', () => {
  const r = fixture(); r.domains.adverseMedia.evidence.backboneFailures.gdelt = 908; assert.equal(qualify(r).state, 'degraded');
});
await test('missing provider cannot be silently substituted', () => {
  const r = fixture(); r.domains.adverseMedia.evidence.globalBackbones = ['Bing News']; assert.equal(qualify(r).state, 'degraded');
});
await test('PEP identity exceptions cannot be erased by a boolean', () => {
  const r = fixture(); r.domains.pep.evidence.sourceUnscreenable = ['fixture-item']; assert.equal(qualify(r).state, 'degraded');
});
await test('sanctions list below its floor cannot pass', () => {
  const r = fixture(); r.sourceQuality.evidence.sanctionsFloors[0].observed = 99; assert.equal(qualify(r).state, 'degraded');
});
await test('fallback provenance is not primary-source assurance', () => {
  const r = fixture(); r.sourceQuality.evidence.fallbackSourcesUsed = ['fixture-fallback']; assert.equal(qualify(r).state, 'degraded');
});
const independent = { ...baseRun, id: 444, path: '.github/workflows/screening-assurance.yml', created_at: '2026-10-22T15:10:00Z' };
await test('independent verification must postdate the pinned receipt', () => assert.equal(independentReady([{ ...independent, created_at: '2026-10-22T14:00:00Z' }], good, sha), false));
await test('independent current-code success is recognized', () => assert.equal(independentReady([independent], good, sha), true));
await test('newer independent failure overrides earlier success', () => assert.equal(independentReady([independent, { ...independent, id: 445, created_at: '2026-10-22T15:20:00Z', conclusion: 'failure' }], good, sha), false));
await test('active independent verification blocks production probes', () => assert.equal(independentReady([{ ...independent, status: 'in_progress' }], good, sha), false));
await test('degraded screening blocks production despite green independent history', () => assert.equal(independentReady([independent], { ...good, state: 'degraded' }, sha), false));
const bytes = Buffer.from(JSON.stringify(fixture()));
const file = { path: 'data/screening-assurance.json', encoding: 'base64', content: bytes.toString('base64'), size: bytes.length, sha: blobSha };
const reader = async path => {
  if (path === '/git/ref/heads/main') return { object: { sha } };
  if (path === '/git/ref/heads/screen-state') return { object: { sha: stateSha } };
  assert.equal(path, '/contents/data/screening-assurance.json?ref=' + stateSha); return file;
};
const actions = async path => { assert.equal(path, '/actions/runs/111'); return { data: baseRun }; };
await test('receipt is fetched at immutable state SHA and producer is read', async () => {
  const e = await readPinnedEvidence(reader, actions, sha, validators);
  assert.equal(e.state, 'verified'); assert.equal(e.stateSha, stateSha); assert.equal(e.blobSha, blobSha);
});
await test('stale controller cannot read against new main', async () => assert.rejects(readPinnedEvidence(reader, actions, oldSha, validators)));
await test('invalid encoded receipt is rejected', async () => assert.rejects(readPinnedEvidence(async path => path.startsWith('/contents/') ? { ...file, content: '!' } : reader(path), actions, sha, validators)));
await test('missing receipt does not fall back to main', async () => assert.rejects(readPinnedEvidence(async path => { if (path.startsWith('/contents/')) throw new Error('404'); return reader(path); }, actions, sha, validators)));
await test('read API cannot call secret or arbitrary paths', async () => {
  let calls = 0;
  const read = makeEvidenceReader({ repo: 'owner/repository', token: 'fixture', fetchImpl: async () => { calls++; } });
  await assert.rejects(read('/actions/secrets')); assert.equal(calls, 0);
});
await test('read API refuses redirects and masks response body', async () => {
  const read = makeEvidenceReader({ repo: 'owner/repository', token: 'fixture', fetchImpl: async (url, options) => {
    assert.equal(options.redirect, 'error'); assert.equal(options.method, 'GET');
    return { ok: false, status: 403 };
  } });
  await assert.rejects(read('/git/ref/heads/main'), /HTTP 403/);
});
await test('recovery summary never emits raw API reasoning or injected markdown', () => {
  const marker = 'UNTRUSTED_API_REASON_DO_NOT_WRITE';
  const s = safeRecoverySummary([
    { id: 'sanctions-screen.yml', action: 'blocked', reason: marker },
    { id: 'invalid|control\n' + marker, action: 'healthy\n' + marker, reason: marker },
  ], { state: 'degraded', stateSha: marker, blobSha: marker },
  ['sanctions-screen.yml']);
  assert.match(s, /sanctions-screen\.yml \| blocked \| Manual intervention required/);
  assert.match(s, /unrecognized-control \| unknown/);
  assert.match(s, /validation state: degraded/);
  assert.ok(!s.includes(marker) && !s.includes('invalid|control'));
});
await test('recovery report never promotes an unknown receipt to verified', () => {
  const s = safeRecoverySummary([{ id: 'freshness-check.yml', action: 'dispatched' }],
    { state: 'verified\nFALSE_PASS' }, ['freshness-check.yml']);
  assert.match(s, /validation state: unknown/);
  assert.match(s, /accepted dispatch; result unverified/);
  assert.ok(!s.includes('FALSE_PASS'));
});
console.log(`${passed} offline software checks passed. No live screening, provider, security-scan or deployment claim.`);
