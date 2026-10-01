/* Offline regressions for runtime recovery. All subjects and API responses
   below are synthetic; this suite does not query screening providers. */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Keep the real dispatch gates in the integration tests, at a test-only pace.
process.env.GDELT_MIN_INTERVAL_MS = '1';
process.env.GNEWS_MIN_INTERVAL_MS = '1';
process.env.BING_MIN_INTERVAL_MS = '1';
process.env.GNEWS_BREAKER_AFTER = '25';
process.env.ADVERSE_BACKBONE_RETRY_MS = '1';
process.env.BING_NEWS = '0';
const am = await import('../scripts/adverse-media.mjs');
const pep = await import('../scripts/pep-worldwide.mjs');
let assertions = 0;
function check(message, predicate) {
  assert.ok(predicate, message);
  assertions++;
  console.log('ok - ' + message);
}
const openGdelt = () => {
  am.resetGdeltBreaker();
  for (let i = 0; i < am.GDELT_BREAKER_AFTER; i++) am.gdeltBreakerRecordFailure();
};
const openGoogle = () => {
  am.resetGnewsBreaker();
  for (let i = 0; i < 25; i++) am.noteGnewsResult(false, 429);
};
const reply = (status, body, retryAfter = null) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: key => key === 'retry-after' ? retryAfter : null },
  text: async () => body,
});

try {
  openGdelt();
  check('GDELT stays closed to new requests during cooldown', am.gdeltBreakerPermit() === null);
  am.gdeltBreakerRecordSuccess();
  check('a late success cannot re-close an open GDELT circuit', am.gdeltBreakerState.open);
  const tickets = Array.from({ length: 12 }, () => am.gdeltBreakerPermit(am.gdeltBreakerState.retryAt));
  check('only one concurrent GDELT recovery probe is admitted', tickets.filter(Boolean).length === 1);
  am.gdeltBreakerRecordFailure(tickets.find(Boolean));
  check('a failed probe re-arms cooldown without reporting recovery',
    am.gdeltBreakerState.open && !am.gdeltBreakerState.probing && am.gdeltBreakerPermit() === null);
  const ticket = am.gdeltBreakerPermit(am.gdeltBreakerState.retryAt);
  am.gdeltBreakerRecordSuccess(ticket);
  check('an admitted successful probe closes GDELT and resets failures',
    !am.gdeltBreakerState.open && am.gdeltBreakerState.consecutiveFailures === 0);

  openGoogle();
  check('Google remains unavailable during cooldown', !am.gnewsCanRequest('en-US'));
  const future = Date.now() + am.ADVERSE_RECOVERY_COOLDOWN_MS + 1;
  check('a regional edition cannot consume the global recovery probe',
    am.gnewsBreakerPermit('ar-AE', future) === null);
  const googleTicket = am.gnewsBreakerPermit('en-US', future);
  check('only one Google en-US recovery probe is admitted',
    googleTicket?.probe && am.gnewsBreakerPermit('en-US', future) === null);
  am.noteGnewsResult(true, 200);
  check('late pre-outage Google success is ignored', am.gnewsBreakerOpen());
  am.noteGnewsResult(false, 200, googleTicket);
  check('an HTTP-200 error body does not close Google or strand its probe',
    am.gnewsBreakerOpen() && !am.gnewsCanRequest('en-US'));
  const nextGoogle = am.gnewsBreakerPermit('en-US',
    Date.now() + am.ADVERSE_RECOVERY_COOLDOWN_MS + 1);
  am.noteGnewsResult(true, 200, nextGoogle);
  check('only validated Google probe coverage closes the circuit', !am.gnewsBreakerOpen());

  const now = Date.parse('2026-01-01T00:00:00Z');
  check('Retry-After seconds become a shared dispatch delay', am.retryAfterDelayMs('60', now) === 60000);
  check('Retry-After HTTP-date is supported',
    am.retryAfterDelayMs('Thu, 01 Jan 2026 00:01:00 GMT', now) === 60000);
  check('invalid, negative and past Retry-After values cannot suspend screening',
    ['', 'bad', '-1', 'Wed, 31 Dec 2025 23:59:00 GMT'].every(x => am.retryAfterDelayMs(x, now) === 0));
  check('an excessive provider delay is bounded', am.retryAfterDelayMs('999999', now) === 900000);

  const gate = new am.RequestStartGate(0);
  gate.deferFor(10);
  const start = Date.now();
  const waiting = gate.wait();
  globalThis.queueMicrotask(() => gate.deferFor(30));
  await waiting;
  check('a queued request re-checks a Retry-After deadline extended while asleep', Date.now() - start >= 25);

  const realFetch = globalThis.fetch;
  try {
    let calls = 0;
    openGdelt();
    am.resetAdverseMediaRateGates();
    globalThis.fetch = async () => { calls++; return reply(200, '{"articles":[]}'); };
    const unavailable = await am.checkAdverseMedia('Example Recovery LLC', { locales: [], timeoutMs: 100 });
    check('a skipped backbone is not counted as a successful empty search', unavailable.errored && calls === 0);
    am.gdeltBreakerState.retryAt = Date.now() - 1;
    const recovered = await am.checkAdverseMedia('Example Recovery LLC', { locales: [], timeoutMs: 100 });
    check('the live GDELT call path recovers only after a valid probe',
      !recovered.errored && recovered.backbones.gdelt && calls === 1 && !am.gdeltBreakerState.open);

    openGdelt();
    am.gdeltBreakerState.retryAt = Date.now() - 1;
    am.resetAdverseMediaRateGates();
    globalThis.fetch = async () => reply(503, 'temporarily unavailable');
    const failed = await am.checkAdverseMedia('Example Uncovered LLC', { locales: [], timeoutMs: 100 });
    check('failed wide and base recovery queries leave the subject errored',
      failed.errored && am.gdeltBreakerState.open && !am.gdeltBreakerState.probing);

    // Advance only the admission clock; reset gates so no real multi-minute wait occurs.
    const realNow = Date.now;
    openGoogle();
    openGdelt();
    const later = realNow() + am.ADVERSE_RECOVERY_COOLDOWN_MS + 10;
    try {
      Date.now = () => later;
      am.gdeltBreakerState.retryAt = later + am.ADVERSE_RECOVERY_COOLDOWN_MS;
      am.resetAdverseMediaRateGates();
      globalThis.fetch = async () => reply(200, '<html>Consent required</html>');
      const result = await am.checkAdverseMedia('Example Consent LLC', {
        locales: [am.LOCALES.find(x => x.id === 'en-US')], timeoutMs: 100,
      });
      check('the actual Google fetch/parser path rejects HTTP-200 consent pages',
        result.errored && am.gnewsBreakerOpen());
    } finally {
      Date.now = realNow;
      am.resetAdverseMediaRateGates();
    }
  } finally { globalThis.fetch = realFetch; }

  const qids = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
  const names = new Map([
    ['Q1', { name: 'Example Person One', aliases: [] }],
    ['Q2', { name: '', aliases: [] }],
    ['Q3', { name: '   ', aliases: [] }],
    ['Q4', null],
  ]);
  check('blank, whitespace, null and absent checkpoint names stay pending',
    JSON.stringify(pep.pendingLabels(qids, names, { count: 1, index: 0 }))
      === JSON.stringify(['Q2', 'Q3', 'Q4', 'Q5']));
  check('retry filtering does not change shard ownership',
    JSON.stringify(pep.pendingLabels(qids, names, { count: 2, index: 0 }))
      === JSON.stringify(['Q3', 'Q5']));
  check('missing and invalid API entities never become screenable names',
    !pep.hasScreenableName(pep.namesFromEntity({ missing: '', labels: { en: { value: 'Invalid' } } }))
    && !pep.hasScreenableName(pep.namesFromEntity({ invalid: '', labels: {} })));
  const multilingual = pep.namesFromEntity({
    labels: { en: { value: ' ' }, mul: { value: ' Example Person Two ' }, fr: { value: 'Personne Exemple' } },
    aliases: { en: [{ value: 'E. Person Two' }, { value: 42 }, null] },
  });
  check('a blank preferred label falls back to a valid label, with all usable aliases',
    multilingual.name === 'Example Person Two'
    && multilingual.aliases.includes('Personne Exemple') && multilingual.aliases.includes('E. Person Two'));
  const before = names.get('Q1');
  const banked = pep.bankLabelNames(names, { entities: {
    Q1: { missing: '' }, Q2: { labels: { en: { value: 'Example Person Two' } } },
    Q3: { labels: { en: { value: ' ' } } }, '-1': { labels: { en: { value: 'Not an entity' } } },
  } });
  check('only usable QID-labelled entries are banked, without erasing a prior name',
    banked === 1 && names.get('Q1') === before && names.get('Q2').name === 'Example Person Two');
  check('HTTP-200 API error envelopes cannot bank names',
    pep.bankLabelNames(names, { error: { code: 'maxlag' }, entities: { Q5: { labels: { en: { value: 'Wrong' } } } } }) === 0
    && !names.has('Q5'));
  const holders = [
    { person: 'Q1', pos: 'Q10', classKey: 'minister' },
    { person: 'Q2', pos: 'Q10', classKey: 'minister' },
  ];
  const incomplete = pep.buildPepDataset({
    harvestedAt: new Date().toISOString(), holderRows: holders,
    positions: new Map(), names: new Map([['Q1', before], ['Q2', { name: ' ', aliases: [] }]]),
  });
  check('omitting expected cannot mark an incomplete dataset complete',
    incomplete.partial === true && incomplete.count === 1 && incomplete.expected === 2);
  const understated = pep.buildPepDataset({
    harvestedAt: new Date().toISOString(), holderRows: holders, positions: new Map(),
    names: new Map([['Q1', before]]), expected: 1,
  });
  check('an understated expected count cannot conceal an unlabelled holder',
    understated.partial === true && understated.expected === 2);
  check('an empty earlier shard entry cannot block a later usable name',
    pep.mergeShardNames([[['Q9', { name: ' ', aliases: [] }]], [['Q9', { name: 'Example Nine', aliases: [] }]]])
      .get('Q9').name === 'Example Nine');

  // Exercise the real non-sharded CLI end-of-pass path with a persisted old
  // checkpoint and a deterministic EXISTING-BUT-NAMELESS entity response. A
  // positive missing/invalid marker is now a source tombstone, but an existing
  // item with no usable identity must still request a resume and stay partial.
  const dir = mkdtempSync(join(tmpdir(), 'pep-runtime-recovery-'));
  try {
    const outfile = join(dir, 'pep.json');
    const cpfile = pep.checkpointPath(outfile);
    const stamp = new Date().toISOString();
    const positions = pep.PEP_ROOT_CLASSES.map((c, i) => [
      'Q' + (100 + i), { label: 'Example Office', country: 'Example Country', classKey: c.key },
    ]);
    const rows = pep.PEP_ROOT_CLASSES.map((c, i) => ({
      person: i ? 'Q1' : 'Q2', pos: 'Q' + (100 + i), classKey: c.key,
    }));
    pep.writeCheckpoint(cpfile, {
      v: 1, phase: 'labels', sinceIso: stamp, harvestedAt: stamp, resumeCount: 0,
      positions, posByClass: pep.PEP_ROOT_CLASSES.map((c, i) => [c.key, ['Q' + (100 + i)]]),
      holderRows: rows, classHolders: Object.fromEntries(pep.PEP_ROOT_CLASSES.map(c => [c.key, 1])),
      classBatchFailed: {}, batchTotal: rows.length, batchFailed: 0,
      labelQids: ['Q1', 'Q2'], names: [['Q1', before], ['Q2', { name: '', aliases: [] }]],
      next: { labelIdx: 2 },
    });
    const preload = join(dir, 'stub.mjs');
    writeFileSync(preload, `globalThis.fetch = async (url) => {
      if (!String(url).startsWith('https://www.wikidata.org/w/api.php?')) throw new Error('Unexpected network');
      return { ok: true, status: 200, headers: { get: () => null },
        json: async () => ({ entities: { Q2: {
          id: 'Q2', labels: {}, aliases: {}, sitelinks: {}, claims: {}
        } } }) };
    };`);
    const run = spawnSync(process.execPath,
      ['--import', pathToFileURL(preload).href, 'scripts/pep-worldwide.mjs', 'harvest', outfile],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 15000,
        env: { ...process.env, PEP_FLOOR: '1', PEP_SHARD_COUNT: '1', PEP_SHARD_INDEX: '0',
          PEP_TIME_BUDGET_MIN: '100', PEP_MAX_RESUMES: '12' } });
    assert.ifError(run.error);
    check('the real non-sharded CLI requests a resume rather than declaring missing labels complete',
      run.status === pep.RESUME_EXIT_CODE);
    check('the incomplete CLI harvest keeps its checkpoint and unresolved QID',
      pep.pendingLabels(['Q1', 'Q2'], new Map(pep.readCheckpoint(cpfile).names),
        { count: 1, index: 0 }).includes('Q2'));
    const artifact = pep.readJsonMaybeGz(outfile);
    check('the published CLI artifact remains explicitly partial',
      artifact.partial === true && artifact.count === 1 && artifact.expected === 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
} finally {
  am.resetGdeltBreaker();
  am.resetGnewsBreaker();
  am.resetAdverseMediaRateGates();
}
console.log(`runtime-recovery: ${assertions} checks passed`);
