/* Recovery routing, not an operational attestation. Read immutable evidence;
 * retain the existing dispatcher, retry limits and independent assurance gate.
 * No provider queries, source edits, screening output writes or deployments.
 */
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const ACTIVE = new Set(['queued', 'in_progress', 'requested', 'waiting', 'pending']);
const EVENTS = new Set(['schedule', 'workflow_dispatch']);
const DAY = 86400000;
const HOUR = 3600000;
const PRODUCER = 'sanctions-screen.yml';
const RECEIPT = 'data/screening-assurance.json';
const time = r => Date.parse(r?.run_started_at || r?.created_at || '');
const midnight = ms => Math.floor(ms / DAY) * DAY;
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);

export function screeningDecision(runs, evidence, {
  nowMs = Date.now(), currentSha = '', branch = 'main', activeRuns = [],
} = {}) {
  if (!Array.isArray(runs) || !Array.isArray(activeRuns) || !Number.isFinite(nowMs) || !SHA.test(currentSha)) {
    return { action: 'unknown', reason: 'invalid screening recovery inputs' };
  }
  if ([...runs, ...activeRuns].some(r => !object(r) || typeof r.head_branch !== 'string' || typeof r.event !== 'string')) {
    return { action: 'unknown', reason: 'malformed screening history' };
  }
  const relevant = r => r.head_branch === branch && EVENTS.has(r.event);
  const scoped = runs.filter(relevant);
  const active = [...scoped, ...activeRuns.filter(relevant)].find(r => ACTIVE.has(r.status));
  if (active) return { action: 'wait', reason: 'a screening run is active; never cancel or duplicate it' };
  if (scoped.some(r => !Number.isSafeInteger(r.id) || r.id <= 0 || !Number.isFinite(time(r)) ||
      time(r) > nowMs + 300000 || r.status !== 'completed')) {
    return { action: 'unknown', reason: 'screening run history is unverified' };
  }
  if (!evidence || !['verified', 'degraded'].includes(evidence.state) || evidence.currentSha !== currentSha) {
    return { action: 'unknown', reason: 'pinned screening receipt or producer provenance is unverified' };
  }
  const unique = [...new Map(scoped.map(r => [r.id, r])).values()];
  const latest = unique.filter(r => r.status === 'completed' && r.conclusion !== 'skipped').sort((a, b) => time(b) - time(a))[0];
  if (latest?.conclusion === 'success' && time(latest) >= midnight(nowMs) &&
      latest.head_sha === currentSha && String(latest.id) === evidence.runId && evidence.state === 'verified') {
    return { action: 'healthy', reason: 'current-code producer and pinned receipt agree; independent assurance remains required' };
  }
  const attempts = unique.filter(r => time(r) >= midnight(nowMs));
  if (attempts.length >= 3) return { action: 'blocked', reason: 'screening retry limit of three attempts today reached; intervention required' };
  const last = [...unique].sort((a, b) => time(b) - time(a))[0];
  if (last && nowMs - time(last) < HOUR) return { action: 'cooldown', reason: 'last screening attempt was less than one hour ago' };
  return { action: 'dispatch', reason: 'current-code assured screening not evidenced; bounded producer recovery required' };
}

export function qualifyEvidence(receipt, producer, currentSha, {
  nowMs = Date.now(), checkStored, approvedSourcePopulationIssue,
} = {}) {
  const unknown = reason => ({ state: 'unknown', reason, currentSha });
  if (!SHA.test(currentSha) || !Number.isFinite(nowMs) || !object(receipt) || receipt.version !== 1 ||
      !object(receipt.run) || !SHA.test(receipt.run.commit || '') ||
      !/^[1-9][0-9]{0,15}$/.test(String(receipt.run.githubRunId || '')) ||
      typeof checkStored !== 'function' || typeof approvedSourcePopulationIssue !== 'function') {
    return unknown('receipt schema or verifier unavailable');
  }
  const generated = Date.parse(receipt.generatedAt || '');
  const runId = String(receipt.run.githubRunId);
  if (!Number.isFinite(generated) || generated > nowMs + 300000 ||
      !object(producer) || String(producer.id) !== runId || producer.head_branch !== 'main' ||
      producer.path !== '.github/workflows/' + PRODUCER || !EVENTS.has(producer.event) ||
      producer.head_sha !== receipt.run.commit || !Number.isFinite(time(producer))) {
    return unknown('receipt timestamp or producer identity mismatch');
  }
  const checked = checkStored(receipt, { nowMs, expectedCommit: currentSha });
  if (!object(checked) || typeof checked.ok !== 'boolean') return unknown('receipt verifier returned an invalid result');
  const populationIssue = approvedSourcePopulationIssue(
    receipt.domains?.sanctions?.evidence?.sourcePopulation, receipt.run.screenedSubjects);
  const am = receipt.domains?.adverseMedia?.evidence;
  const pep = receipt.domains?.pep?.evidence;
  const quality = receipt.sourceQuality?.evidence;
  const zeroes = [quality?.adverseMediaPartialSubjects, quality?.pepUnscreenableSourceRecords,
    quality?.adverseMediaBackboneFailures?.googleNews, quality?.adverseMediaBackboneFailures?.gdelt,
    quality?.adverseMediaBackboneFailures?.bing, am?.skippedSubjects, am?.partialSubjects,
    am?.backboneFailures?.googleNews, am?.backboneFailures?.gdelt, am?.backboneFailures?.bing];
  const backbones = Array.isArray(am?.globalBackbones) ? am.globalBackbones : [];
  const floors = quality?.sanctionsFloors;
  const completeSources = Array.isArray(floors) && floors.length > 0 && floors.every(f =>
    f?.primaryComplete === true && Number.isSafeInteger(f.minimum) && f.minimum > 0 &&
    Number.isSafeInteger(f.observed) && f.observed >= f.minimum) &&
    Array.isArray(quality?.fallbackSourcesUsed) && quality.fallbackSourcesUsed.length === 0 &&
    zeroes.every(n => n === 0) &&
    ['Google News RSS', 'GDELT global index', 'Bing News'].every(name => backbones.includes(name)) &&
    Array.isArray(pep?.sourceUnscreenable) && pep.sourceUnscreenable.length === 0 &&
    Array.isArray(receipt.sourceQuality?.reasons) && receipt.sourceQuality.reasons.length === 0;
  const verified = checked.ok && populationIssue === null && receipt.operational === true &&
    receipt.sourceQuality?.assured === true && completeSources &&
    am?.screenedSubjects === receipt.run.screenedSubjects &&
    producer.status === 'completed' && producer.conclusion === 'success' &&
    generated >= time(producer) && generated >= midnight(nowMs);
  return { state: verified ? 'verified' : 'degraded', currentSha, runId,
    generatedAt: receipt.generatedAt,
    reason: verified ? 'receipt and producer validated' : 'fresh current-code, population or source-quality evidence is incomplete' };
}

export function makeEvidenceReader({ repo, token, fetchImpl = fetch }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') || !token) {
    throw new Error('repository and GitHub token are required');
  }
  return async path => {
    if (!['/git/ref/heads/main', '/git/ref/heads/screen-state'].includes(path) &&
        !/^\/contents\/data\/screening-assurance\.json\?ref=[a-f0-9]{40}$/.test(path)) {
      throw new Error('refusing unapproved evidence endpoint');
    }
    const response = await fetchImpl('https://api.github.com/repos/' + repo + path, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!response.ok) throw new Error('GitHub evidence read failed with HTTP ' + response.status);
    let bytes = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 524288) throw new Error('GitHub evidence response exceeds byte limit');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  };
}

export async function readPinnedEvidence(read, api, currentSha, validators = {}) {
  const main = await read('/git/ref/heads/main');
  if (main?.object?.sha !== currentSha || !SHA.test(currentSha)) throw new Error('controller checkout is not current main');
  const state = await read('/git/ref/heads/screen-state');
  const stateSha = state?.object?.sha;
  if (!SHA.test(stateSha || '')) throw new Error('screen-state ref is unverified');
  const file = await read('/contents/' + RECEIPT + '?ref=' + stateSha);
  if (file?.path !== RECEIPT || file.encoding !== 'base64' || !SHA.test(file.sha || '') ||
      typeof file.content !== 'string' || file.content.length > 400000) throw new Error('receipt file metadata is invalid');
  const encoded = file.content.replace(/\s/g, '');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > 262144 || bytes.length !== file.size || bytes.toString('base64') !== encoded) {
    throw new Error('receipt encoding or size is invalid');
  }
  const receipt = JSON.parse(bytes.toString('utf8'));
  const id = String(receipt?.run?.githubRunId || '');
  if (!/^[1-9][0-9]{0,15}$/.test(id)) throw new Error('receipt producer ID is invalid');
  const { data: producer } = await api('/actions/runs/' + id);
  return { ...qualifyEvidence(receipt, producer, currentSha, validators), stateSha, blobSha: file.sha };
}

export function independentReady(runs, evidence, currentSha) {
  if (evidence?.state !== 'verified' || !Array.isArray(runs)) return false;
  const relevant = runs.filter(r => r?.head_branch === 'main' && EVENTS.has(r.event));
  if (relevant.some(r => ACTIVE.has(r.status) || !Number.isFinite(time(r)))) return false;
  const latest = [...relevant].sort((a, b) => time(b) - time(a))[0];
  return !!latest && latest.path === '.github/workflows/screening-assurance.yml' &&
    latest.head_sha === currentSha && latest.status === 'completed' && latest.conclusion === 'success' &&
    time(latest) >= Date.parse(evidence.generatedAt);
}

export async function main() {
  const { makeApi, readRuns, decide, HELPERS, activePrerequisite } = await import('./workflow-recovery.mjs');
  const { dispatchOnce } = await import('./github-workflow-dispatch-guard.mjs');
  const { CONTROLS } = await import('./freshness-check.mjs');
  const { checkStored, approvedSourcePopulationIssue } = await import('./screening-assurance.mjs');
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const currentSha = process.env.GITHUB_SHA || '';
  const api = makeApi({ repo, token });
  const read = makeEvidenceReader({ repo, token });
  const validators = { checkStored, approvedSourcePopulationIssue };
  let evidence;
  try { evidence = await readPinnedEvidence(read, api, currentSha, validators); }
  catch { evidence = { state: 'unknown', currentSha, reason: 'immutable evidence could not be verified' }; }
  const activeRuns = [];
  for (const status of ACTIVE) activeRuns.push(...await readRuns(api, '/actions/runs', { branch: 'main', status }));
  const controls = [...CONTROLS, ...HELPERS].filter((c, i, a) => a.findIndex(x => x.id === c.id) === i);
  const rows = [];
  let dispatched = false;
  for (const control of controls) {
    try {
      const path = '/actions/workflows/' + encodeURIComponent(control.id);
      const { data: workflow } = await api(path);
      if (workflow.state !== 'active') throw new Error('control is not active; no automatic enabling');
      const nowMs = Date.now();
      const created = '>=' + new Date(midnight(nowMs) - (control.maxAgeDays || 0) * DAY).toISOString();
      const runs = [];
      for (const event of [...EVENTS, ...(control.allowPush ? ['push'] : [])]) {
        runs.push(...await readRuns(api, path + '/runs', { branch: 'main', event, created }));
      }
      const controlActive = activeRuns.filter(r => r.path === '.github/workflows/' + control.id);
      let decision;
      if (control.id === 'site-currency.yml') {
        let assured = false;
        if (evidence.state === 'verified') {
          const assuranceRuns = await readRuns(api, '/actions/workflows/screening-assurance.yml/runs', {
            branch: 'main', created: '>=' + evidence.generatedAt,
          });
          assured = independentReady(assuranceRuns, evidence, currentSha);
        }
        if (!assured) decision = { action: 'blocked', reason: 'production parity deferred until independent screening recovery' };
      }
      if (!decision && activePrerequisite(control, activeRuns, { branch: 'main', currentSha })) {
        decision = { action: 'wait', reason: 'current-main deployment remains active; no premature production probe' };
      }
      if (!decision) decision = control.id === PRODUCER
        ? screeningDecision(runs, evidence, { nowMs, currentSha, activeRuns: controlActive })
        : decide(control, runs, { nowMs, branch: 'main', activeRuns: controlActive });
      if (decision.action === 'dispatch') {
        const mainRef = await read('/git/ref/heads/main');
        if (mainRef?.object?.sha !== currentSha) throw new Error('main moved; require a new controller invocation');
        if ([PRODUCER, 'site-currency.yml'].includes(control.id)) {
          const latestState = await read('/git/ref/heads/screen-state');
          if (latestState?.object?.sha !== evidence.stateSha) throw new Error('screening evidence changed; re-evaluation required');
        }
        const guarded = await dispatchOnce(api, path, { branch: 'main', nowMs: Date.now(), quietMs: HOUR });
        decision = { action: guarded.action, reason: decision.reason + '; ' + guarded.reason };
        if (guarded.action === 'dispatched') dispatched = true;
      }
      rows.push({ id: control.id, ...decision });
    } catch {
      rows.push({ id: control.id, action: 'unknown', reason: 'control history, evidence or dispatch is unverified; no blind retry' });
    }
  }
  if (evidence.state !== 'unknown' && !dispatched && !activeRuns.some(r => r.path === '.github/workflows/freshness-check.yml')) {
    const finalMain = await read('/git/ref/heads/main');
    if (finalMain?.object?.sha !== currentSha) throw new Error('main moved before freshness dispatch');
    rows.push({ id: 'freshness-check.yml', ...await dispatchOnce(api, '/actions/workflows/freshness-check.yml', {
      branch: 'main', nowMs: Date.now(), quietMs: 30 * 60000,
    }) });
  }
  const cell = value => String(value).replaceAll('|', '/').replace(/[\r\n]/g, ' ');
  const report = ['# Evidence-aware control recovery', '',
    'Recovery routing is not screening, AI, security or deployment assurance. A dispatch is not a pass.',
    'Pinned receipt: ' + (evidence.stateSha || 'unverified') + ' / blob ' + (evidence.blobSha || 'unverified'), '',
    '| Control | Recovery state | Evidence / action |', '| --- | --- | --- |',
    ...rows.map(r => `| ${cell(r.id)} | ${cell(r.action)} | ${cell(r.reason)} |`), ''].join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  if (evidence.state !== 'verified' || rows.some(r => ['unknown', 'blocked'].includes(r.action))) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Recovery failed; no operational pass is established.'); process.exitCode = 1; });
}
