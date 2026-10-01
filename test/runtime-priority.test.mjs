/* Synthetic, offline integration checks. No screening-provider traffic. */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
process.env.GDELT_MIN_INTERVAL_MS = '1';
process.env.GNEWS_MIN_INTERVAL_MS = '1';
process.env.BING_MIN_INTERVAL_MS = '1';
process.env.ADVERSE_RATE_LIMIT_BACKOFF_MS = '1000';
process.env.BING_NEWS = '1';
const am = await import('../scripts/adverse-media.mjs');
const pep = await import('../scripts/pep-worldwide.mjs');
let checks = 0;
const check = (message, value) => { assert.ok(value, message); checks++; console.log('ok - ' + message); };
const reply = (status, text) => ({ ok: status === 200, status,
  headers: { get: () => null }, text: async () => text });
const rss = '<rss><channel></channel></rss>';
const options = { locales: [am.LOCALES.find(l => l.id === 'en-US')], timeoutMs: 2000 };
const realFetch = globalThis.fetch;
try {
  am.resetAdverseMediaRateGates(); am.resetGdeltBreaker(); am.resetGnewsBreaker();
  const seen = new Set();
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async url => {
    const host = new URL(url).hostname; seen.add(host);
    return host === 'api.gdeltproject.org' ? blocked : reply(200, rss);
  };
  const pending = am.checkAdverseMedia('Synthetic Parallel Example', options);
  let independent;
  try {
    await new Promise(resolve => setTimeout(resolve, 30));
    independent = seen.has('news.google.com') && seen.has('www.bing.com');
  } finally { release(reply(200, '{"articles":[]}')); }
  const complete = await pending;
  check('Google and Bing start before a stalled GDELT request resolves', independent);
  check('all validated providers retain complete coverage', !complete.errored && !complete.partial && complete.backbones.gdelt);
  am.resetAdverseMediaRateGates(); am.resetGdeltBreaker(); am.resetGnewsBreaker();
  const starts = [];
  globalThis.fetch = async url => {
    const host = new URL(url).hostname;
    if (host === 'api.gdeltproject.org') { starts.push(Date.now()); return reply(429, 'Rate limited'); }
    return reply(200, rss);
  };
  const limited = await am.checkAdverseMedia('Synthetic Rate Limit One', options);
  check('HTTP 429 does not trigger a second shorter GDELT query', starts.length === 1);
  check('a provider refusal stays partial while independent validated coverage survives',
    limited.partial && !limited.errored && !limited.backbones.gdelt && limited.backbones.bing && limited.backbones.googleNewsEnUs);
  await am.checkAdverseMedia('Synthetic Rate Limit Two', options);
  check('429 without Retry-After postpones the shared provider queue',
    starts.length === 2 && starts[1] - starts[0] >= am.ADVERSE_RATE_LIMIT_BACKOFF_MS - 10);
} finally {
  globalThis.fetch = realFetch;
  am.resetAdverseMediaRateGates(); am.resetGdeltBreaker(); am.resetGnewsBreaker();
}
const stamp = new Date().toISOString();
const qids = ['Q1', 'Q2', 'Q3'];
const before = { name: 'Current One', aliases: [] };
const artifact = { harvested: stamp, expected: 3, count: 3, entries: [
  { qid: 'Q1', name: 'Published One', aliases: [] },
  { qid: 'Q2', name: ' Published Two ', aliases: [' Two ', null, 42] },
  { qid: 'Q3', name: ' ', aliases: [] },
] };
const names = new Map([['Q1', before]]);
check('same-harvest publication fills only usable missing names', pep.seedResumeNames(qids, names, artifact, stamp) === 1);
check('existing banked names are not overwritten', names.get('Q1') === before);
check('reused names and aliases are validated and trimmed', names.get('Q2').name === 'Published Two' && names.get('Q2').aliases.join(',') === 'Two');
check('an unnamed published entry remains pending', pep.pendingLabels(qids, names, { count: 1, index: 0 }).join(',') === 'Q3');
check('an old harvest cannot count as new label progress', pep.seedResumeNames(qids, new Map(), { ...artifact, harvested: '2020-01-01' }, stamp) === 0);
check('a different holder universe cannot seed progress', pep.seedResumeNames(qids, new Map(), { ...artifact, expected: 2 }, stamp) === 0);
check('inconsistent artifact counts are rejected', pep.seedResumeNames(qids, new Map(), { ...artifact, count: 2 }, stamp) === 0);
const foreign = { ...artifact, count: 1, entries: [{ qid: 'Q999', name: 'Other Person' }] };
check('persons outside the current holder universe cannot enter the name bank', pep.seedResumeNames(qids, new Map(), foreign, stamp) === 0);
const dir = mkdtempSync(join(tmpdir(), 'pep-priority-'));
try {
  const outfile = join(dir, 'pep.json');
  const cpfile = pep.checkpointPath(outfile);
  const positions = pep.PEP_ROOT_CLASSES.map((c, i) => ['Q' + (100 + i), { label: '', country: '', classKey: c.key }]);
  const rows = pep.PEP_ROOT_CLASSES.map((c, i) => ({ person: i ? 'Q1' : 'Q2', pos: 'Q' + (100 + i), classKey: c.key }));
  pep.writeCheckpoint(cpfile, { v: 1, phase: 'labels', sinceIso: stamp, harvestedAt: stamp, resumeCount: 0,
    positions, posByClass: pep.PEP_ROOT_CLASSES.map((c, i) => [c.key, ['Q' + (100 + i)]]),
    holderRows: rows, classHolders: Object.fromEntries(pep.PEP_ROOT_CLASSES.map(c => [c.key, 1])),
    classBatchFailed: {}, batchTotal: rows.length, batchFailed: 0,
    labelQids: ['Q1', 'Q2'], names: [], next: { labelIdx: 0 } });
  pep.writeJsonGz(outfile, { harvested: stamp, expected: 2, count: 1, partial: true,
    entries: [{ qid: 'Q1', name: 'Synthetic Published One', aliases: [] }] });
  const preload = join(dir, 'stub.mjs');
  writeFileSync(preload, "globalThis.fetch = async (url) => { const u = new URL(url); console.log('FETCH_IDS=' + u.searchParams.get('ids')); if (u.hostname !== 'www.wikidata.org' || u.searchParams.get('ids') !== 'Q2') throw new Error('Optional office work or already-published name fetched before unresolved person'); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ entities: {} }) }; };\n");
  const run = spawnSync(process.execPath,
    ['--import', pathToFileURL(preload).href, 'scripts/pep-worldwide.mjs', 'harvest', outfile],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 15000,
      env: { ...process.env, PEP_FLOOR: '1', PEP_SHARD_COUNT: '1', PEP_SHARD_INDEX: '0', PEP_TIME_BUDGET_MIN: '100', PEP_MAX_RESUMES: '12' } });
  assert.ifError(run.error);
  check('real CLI reaches missing persons before optional office enrichment', run.status === pep.RESUME_EXIT_CODE && run.stdout.includes('FETCH_IDS=Q2'));
  check('same-harvest names are reused by the real resume path', run.stdout.includes('reused 1 published names'));
  check('only the missing person is fetched, first normally then once through the targeted fallback',
    (run.stdout.match(/FETCH_IDS=Q2/g) || []).length === 2
    && !run.stdout.includes('FETCH_IDS=Q1'));
  const published = pep.readJsonMaybeGz(outfile);
  check('unresolved source records do not become a false complete artifact', published.partial && published.expected === 2 && published.count === 1);
  const saved = pep.readCheckpoint(cpfile);
  check('current person-name progress is preserved in the checkpoint', new Map(saved.names).get('Q1').name === 'Synthetic Published One');
  // Complete the same checkpoint. Office work must still run after names.
  writeFileSync(preload, 'globalThis.fetch = ' + (async function (url) {
    const u = new URL(url);
    if (u.hostname === 'www.wikidata.org') {
      const ids = u.searchParams.get('ids').split('|');
      console.log('LABEL_IDS=' + ids.join(','));
      return { ok: true, status: 200, headers: { get: () => null },
        json: async () => ({ entities: Object.fromEntries(ids.map(id =>
          [id, { id, labels: { en: { value: id === 'Q2' ? 'Synthetic Person Two' : 'Synthetic Office' } } }])) }) };
    }
    if (u.hostname === 'query.wikidata.org') return {
      ok: true, status: 200, headers: { get: () => null },
      json: async () => ({ results: { bindings: [] } }),
    };
    throw new Error('Unexpected network');
  }).toString() + ';');
  const done = spawnSync(process.execPath,
    ['--import', pathToFileURL(preload).href, 'scripts/pep-worldwide.mjs', 'harvest', outfile],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 15000,
      env: { ...process.env, PEP_FLOOR: '1', PEP_SHARD_COUNT: '1', PEP_SHARD_INDEX: '0', PEP_TIME_BUDGET_MIN: '100', PEP_MAX_RESUMES: '12' } });
  assert.ifError(done.error);
  if (done.status !== 0) console.error(done.stdout + done.stderr);
  check('completed person-name pass still runs optional office enrichment',
    done.status === 0 && done.stdout.includes('LABEL_IDS=Q100'));
  check('missing person is fetched before office labels on a successful resume',
    done.stdout.indexOf('LABEL_IDS=Q2') >= 0
    && done.stdout.indexOf('LABEL_IDS=Q2') < done.stdout.indexOf('LABEL_IDS=Q100'));
  const complete = pep.readJsonMaybeGz(outfile);
  check('office enrichment retains every newly completed person name',
    complete.count === 2 && !complete.partial
    && complete.entries.some(e => e.qid === 'Q2' && e.name === 'Synthetic Person Two'));
} finally { rmSync(dir, { recursive: true, force: true }); }
// Retry the real fetch boundary without network traffic or wall-clock sleeps.
{
  const original = globalThis.fetch;
  const delays = [];
  const wait = async ms => { delays.push(ms); };
  const success = { entities: { Q2: { id: 'Q2', labels: { en: { value: 'Synthetic Person' } } } } };
  const response = (body, retryAfter = null, status = 200) => ({
    ok: status === 200, status, headers: { get: () => retryAfter }, json: async () => body,
  });
  let requests = 0;
  try {
    globalThis.fetch = async () => { requests++; return requests === 1
      ? response({ error: { code: 'maxlag', lag: 9.8 } }, '9') : response(success); };
    const recovered = await pep.fetchJson('https://www.wikidata.org/w/api.php', { tries: 2, wait });
    check('HTTP 200 maxlag retries the same batch and returns recovered entities', requests === 2 && recovered === success);
    check('maxlag honors Retry-After and does not sleep after recovery', delays.length === 1 && delays[0] === 9000);
    requests = 0; delays.length = 0;
    globalThis.fetch = async () => { requests++; return response({ error: { code: 'maxlag' } }); };
    await assert.rejects(pep.fetchJson('https://www.wikidata.org/w/api.php', { tries: 3, wait }), /maxlag/);
    check('persistent maxlag terminates at the retry budget without a false empty batch', requests === 3);
    check('headerless maxlag backs off at least five seconds and has no final sleep', delays.join(',') === '5000,10000');
    requests = 0; delays.length = 0;
    globalThis.fetch = async () => { requests++; return requests === 1
      ? response({ errors: [{ code: 'ratelimited' }], entities: success.entities }, '7') : response(success); };
    const modern = await pep.fetchJson('https://www.wikidata.org/w/api.php', { tries: 2, wait });
    check('modern API errors are retried even when the payload also contains entities', requests === 2 && modern === success && delays[0] === 7000);
    requests = 0; delays.length = 0;
    globalThis.fetch = async () => { requests++; return response({ error: { code: 'badvalue' } }); };
    await assert.rejects(pep.fetchJson('https://www.wikidata.org/w/api.php', { tries: 1, wait }), /badvalue/);
    check('other API errors are never returned as successful data', requests === 1 && delays.length === 0);
    requests = 0; delays.length = 0;
    globalThis.fetch = async () => { requests++; return requests === 1
      ? response(null, '8', 429) : response(success); };
    const throttled = await pep.fetchJson('https://www.wikidata.org/w/api.php', { tries: 2, wait });
    check('HTTP throttling still recovers with bounded Retry-After', requests === 2 && throttled === success && delays[0] === 8000);
    requests = 0; delays.length = 0;
    globalThis.fetch = async () => { requests++; return response({ error: { code: 'maxlag' } }, '99999999'); };
    await assert.rejects(pep.fetchJson('https://www.wikidata.org/w/api.php', { tries: 2, wait }), /maxlag/);
    check('a hostile retry header cannot schedule an unbounded wait', delays.length === 1 && delays[0] === 900000);
  } finally { globalThis.fetch = original; }
}
// Exercise the exact publication loop in a disposable, offline Git index.
{
  const workflow = readFileSync(new URL('../.github/workflows/sanctions-screen.yml', import.meta.url), 'utf8');
  const persist = workflow.split('      - name: Persist screening + case state (screen-state branch)')[1]
    .split('      - name: Refresh runtime assurance watchdog')[0];
  check('unfinished screens cannot publish over existing runtime evidence',
    persist.includes("if: always() && steps.screen.outcome == 'success' && steps.screen.outputs.screen_error != 'true'"));
  check('a failed case-delivery step does not prevent preserving completed screening state',
    !persist.includes('steps.cases.outcome'));
  check('the state publisher cannot force-push over a concurrent update', !/git push\s+--force\b/.test(persist));
  const loop = persist.match(/            for f in "\$\{files\[@\]\}"; do\n[\s\S]*?            done/);
  check('the production file-publication loop is present', !!loop);
  const work = mkdtempSync(join(tmpdir(), 'screen-retain-'));
  const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, { cwd: work, encoding: 'utf8', timeout: 10000, ...options });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
  };
  try {
    run('git', ['init', '--quiet']);
    writeFileSync(join(work, 'report.json'), '{"operational":false,"generatedAt":"2026-09-29T11:21:16.658Z"}');
    writeFileSync(join(work, 'badge.svg'), '<svg>degraded</svg>');
    run('git', ['add', 'report.json', 'badge.svg']);
    const initial = run('git', ['write-tree']);
    const env = { ...process.env, GIT_INDEX_FILE: join(work, '.git', 'publication-index') };
    run('git', ['read-tree', initial], { env });
    rmSync(join(work, 'report.json')); rmSync(join(work, 'badge.svg'));
    run('bash', ['-e', '-c', 'files=(report.json badge.svg)\n' + loop[0]], { env });
    check('absent report and badge outputs preserve the complete prior tree',
      run('git', ['write-tree'], { env }) === initial);
    writeFileSync(join(work, 'report.json'), '{"operational":false,"generatedAt":"2026-09-29T13:30:00.000Z"}');
    run('bash', ['-e', '-c', 'files=(report.json badge.svg)\n' + loop[0]], { env });
    check('a replacement report does not erase an absent badge',
      run('git', ['show', ':badge.svg'], { env }) === '<svg>degraded</svg>');
    const replacement = JSON.parse(run('git', ['show', ':report.json'], { env }));
    check('new evidence replaces only its own output and keeps its actual verdict',
      replacement.generatedAt === '2026-09-29T13:30:00.000Z' && replacement.operational === false);
  } finally { rmSync(work, { recursive: true, force: true }); }
}
console.log('runtime-priority: ' + checks + ' checks passed');
