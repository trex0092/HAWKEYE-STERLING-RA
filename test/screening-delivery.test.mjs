/* Synthetic, offline integration tests. Never call Asana or live providers. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishDailyScreening, buildReports, splitEvidence, textSize, validateEvidence,
  PROJECT, DESTINATIONS, buildFindingsCsv, csvCell, findingsAttachmentName } from '../scripts/screening-delivery.mjs';

const NOW = Date.parse('2026-09-30T10:00:00Z');
function fixture() {
  // Synthetic but internally consistent evidence, so that failures prove the
  // mismatch under test rather than passing because the fixture lacks sources.
  const status = (operational, evidence) => ({ operational, reasons: [], warnings: [], evidence });
  return {
    runId: '100', nowMs: NOW,
    results: { date: '2026-09-30', screened: 2, alerts: [], lists: [{ id: 'synthetic', name: 'Synthetic Test List', count: 1, partial: false }],
      failures: [], enrichment: {}, cleared: [], degraded: false },

    assurance: { version: 1, generatedAt: new Date(NOW).toISOString(), operational: true,
      run: { githubRunId: '100', date: '2026-09-30', screenedSubjects: 2 },
      domains: {
        sanctions: status(true, {
          screenedSubjects: 2, requiredSourceIds: ['synthetic'],
          loadedSources: [{ id: 'synthetic', count: 1, partial: false }],
          sourceFloors: [{ id: 'synthetic', minNames: 1 }],
          servedByFallback: [],
        }),
        adverseMedia: status(true, {
          screenedSubjects: 2, errors: 0, skippedSubjects: 0,
          matrixTotal: 79, googleNewsLocalesPerSubject: 8,
          globalBackbones: ['Google News RSS', 'GDELT global index', 'Bing News'],
          backboneFailures: { googleNews: 0, gdelt: 0, bing: 0 },
        }),
        pep: status(true, {
          persons: 50000, floor: 30000, partial: false,
          dailyScreenActive: true, dailyScreenCount: 50000,
          harvestedAt: '2026-09-30T00:00:00.000Z',
          dailyScreenHarvestedAt: '2026-09-30T00:00:00.000Z',
        }),
      } },
    state: { updated: '2026-09-30', subjects: {} },
  };
}
function api() {
  const tasks = new Map();
  const calls = [];
  const attachments = new Map();   // gid -> { gid, name, parent, text }
  let hideUploads = false;
  let next = 1000;
  let intercept = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const add = (data, parent = null) => {
    const id = String(next++);
    tasks.set(id, { gid: id, ...data,
      ...(parent ? { parent: { gid: parent } } : {}),
      memberships: (data.memberships || []).map(m => ({ project: { gid: m.project }, section: { gid: m.section } })),
      permalink_url: 'https://app.asana.com/0/' + PROJECT + '/' + id,
    });
    return tasks.get(id);
  };
  const request = async (path, options = {}) => {
    const method = options.method || 'GET';
    const data = options.body ? JSON.parse(options.body).data : null;
    calls.push({ path, method, data, nonReplayable: options.noRetryOnUnknownOutcome === true });
    if (intercept) { const response = await intercept(path, method, data); if (response !== undefined) return response; }
    let match;
    if ((match = path.match(/^\/attachments\?parent=(\d+)/))) {
      return { data: [...attachments.values()].filter(a => a.parent === match[1] && !a.hidden)
        .map(a => ({ gid: a.gid, name: a.name })) };
    }
    if ((match = path.match(/^\/attachments\/(\d+)$/)) && method === 'DELETE') {
      attachments.delete(match[1]);
      return { data: {} };
    }
    if (path.startsWith('/projects/')) return { data: [...tasks.values()].filter(t => !t.parent).map(clone) };
    if ((match = path.match(/^\/sections\/(\d+)\?/))) return { data: { gid: match[1], project: { gid: PROJECT } } };
    if ((match = path.match(/^\/sections\/(\d+)\/addTask$/))) {
      const task = tasks.get(data.task);
      task.memberships = [{ project: { gid: PROJECT }, section: { gid: match[1] } }];
      return { data: {} };
    }
    if (path === '/tasks' && method === 'POST') return { data: clone(add(data)) };
    if ((match = path.match(/^\/tasks\/(\d+)\/subtasks/))) {
      if (method === 'POST') return { data: clone(add(data, match[1])) };
      return { data: [...tasks.values()].filter(t => t.parent?.gid === match[1]).map(clone) };
    }
    if ((match = path.match(/^\/tasks\/(\d+)(?:\?|$)/))) {
      const task = tasks.get(match[1]);
      assert.ok(task, 'task must exist');
      if (method === 'PUT') Object.assign(task, data);
      return { data: clone(task) };
    }
    throw new Error('Unexpected test request: ' + method + ' ' + path);
  };
  const upload = async (parent, name, text, type) => {
    const id = String(next++);
    attachments.set(id, { gid: id, name, parent, text, type, hidden: hideUploads });
    calls.push({ path: 'upload', method: 'POST', data: { parent, name } });
    return id;
  };
  return { request, upload, tasks, calls, add, attachments,
    hideUploads: v => { hideUploads = v; }, setIntercept: fn => { intercept = fn; } };
}
function verify(input) { return validateEvidence(input.results, input.assurance, input.state, input); }

test('fresh consistent evidence is accepted; no network is required for validation', () => {
  assert.equal(verify(fixture()), true);
});
for (const [name, change] of [
  ['missing results', x => { x.results = null; }],
  ['zero screened subjects', x => { x.results.screened = 0; }],
  ['invalid calendar date', x => { x.results.date = '2026-02-30'; }],
  ['non-numeric workflow run ID', x => { x.runId = 'malformed/run'; x.assurance.run.githubRunId = x.runId; }],
  ['a zero-source green report', x => { x.results.lists = []; }],
  ['a zero-entry source with green assurance', x => { x.results.lists[0].count = 0; }],
  ['partial designation source with green assurance', x => { x.results.lists[0].partial = true; }],
  ['unnamed source with green assurance', x => { x.results.lists[0].name = ''; }],
  ['missing alerts', x => { delete x.results.alerts; }],
  ['missing assurance', x => { x.assurance = null; }],
  ['stale assurance', x => { x.assurance.generatedAt = '2026-09-29T00:00:00Z'; }],
  ['future assurance', x => { x.assurance.generatedAt = '2026-10-01T00:00:00Z'; }],
  ['another workflow run', x => { x.assurance.run.githubRunId = '99'; }],
  ['missing current run identifier', x => { x.runId = ''; }],
  ['count mismatch', x => { x.assurance.run.screenedSubjects = 1; }],
  ['date mismatch', x => { x.assurance.run.date = '2026-09-29'; }],
  ['stale state', x => { x.state.updated = '2026-09-29'; }],
  ['malformed state', x => { x.state.subjects = []; }],
  ['missing PEP status', x => { delete x.assurance.domains.pep; }],
  ['green with reasons', x => { x.assurance.domains.pep.reasons.push('partial'); }],
  ['contradictory overall status', x => { x.assurance.operational = false; }],
  ['green flag despite uncovered adverse-media subjects', x => { x.assurance.domains.adverseMedia.evidence.errors = 18; }],
  ['green flag despite skipped adverse-media subjects', x => { x.assurance.domains.adverseMedia.evidence.skippedSubjects = 1; }],
  ['green flag despite missing global backbone evidence', x => { delete x.assurance.domains.adverseMedia.evidence.backboneFailures; }],
  ['green flag despite contradictory news provider counts', x => { x.assurance.domains.adverseMedia.evidence.backboneFailures.googleNews = 1; }],
  ['green flag despite truncated required sanctions source', x => { x.assurance.domains.sanctions.evidence.loadedSources[0].count = 0; }],
  ['green flag despite wrong sanctions source subject count', x => { x.assurance.domains.sanctions.evidence.screenedSubjects = 1; }],
  ['green flag despite partial worldwide PEP harvest', x => { x.assurance.domains.pep.evidence.partial = true; }],
  ['green flag despite unconsumed worldwide PEP harvest', x => { x.assurance.domains.pep.evidence.dailyScreenActive = false; }],
  ['green flag without detailed operational source evidence', x => { x.assurance.domains.adverseMedia.evidence = {}; }],
]) {
  test('rejects ' + name + ' before any write', async () => {
    const input = fixture(); change(input);
    const fake = api();
    await assert.rejects(publishDailyScreening({ ...input, request: fake.request, upload: fake.upload }));
    assert.equal(fake.calls.length, 0);
  });
}

test('supplementary sanctions-source outage delivers verified reports into the approved Asana project', async () => {
  const input = fixture();
  input.results.degraded = true; // real 14 Oct 2026 source limitation
  input.results.lists.push({
    id: 'supplemental', name: 'Synthetic supplementary national list', count: 7, partial: true
  });
  input.assurance.domains.sanctions.evidence.loadedSources.push({
    id: 'supplemental', count: 7, partial: true
  });
  input.assurance.domains.sanctions.warnings.push(
    'A supplementary national list was partial; all required lists are complete');
  const fake = api();
  const receipt = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.equal(receipt.projectGid, '1216203370612914');
  assert.equal(receipt.requiredDomainsOperational, true);
  assert.equal(receipt.operational, false, 'supplementary loss must not become an all-clear');
  assert.deepEqual(receipt.reports.map(r => r.sectionGid), [
    '1218451960830318', '1218979441933783'
  ]);
  for (const report of receipt.reports) {
    const card = fake.tasks.get(report.taskGid);
    assert.match(card.notes, /^DELIVERY VERIFIED:/);
    assert.match(card.notes, /Overall screening evidence: DEGRADED \/ PROVISIONAL/);
    assert.match(card.notes, /WARNING: One or more supplementary sanctions sources/);
    assert.equal(card.memberships[0].project.gid, '1216203370612914');
    assert.equal(card.memberships[0].section.gid, report.sectionGid);
  }
  assert.equal(fake.attachments.size, 2, 'both domains must receive real findings attachments');
});

test('source-failure flag alone must not prevent evidence delivery or imply all-clear', async () => {
  const input = fixture();
  input.results.degraded = true;
  input.results.failures = ['Synthetic optional national source temporarily unavailable'];
  input.assurance.domains.sanctions.warnings.push('Supplementary source failed');
  const fake = api();
  const receipt = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.equal(receipt.operational, false);
  assert.equal(receipt.reports.length, 2);
  assert.match(fake.tasks.get(receipt.reports[0].taskGid).notes, /DEGRADED \/ PROVISIONAL/);
});

test('source receipts cannot be altered independently of assurance, even with a partial source', async () => {
  const input = fixture();
  input.results.degraded = true;
  input.results.lists[0].partial = true;
  const fake = api();
  await assert.rejects(
    publishDailyScreening({ ...input, request: fake.request, upload: fake.upload }),
    /inventory contradicts/
  );
  assert.equal(fake.calls.length, 0);
});
test('a missing required source still fails closed rather than using a supplementary warning', async () => {
  const input = fixture();
  input.results.degraded = true;
  input.results.lists[0].partial = true;
  input.assurance.domains.sanctions.evidence.loadedSources[0].partial = true;
  const fake = api();
  await assert.rejects(
    publishDailyScreening({ ...input, request: fake.request, upload: fake.upload }),
    /contradicts the OPERATIONAL Asana delivery claim/
  );
  assert.equal(fake.calls.length, 0);
});

test('both sections receive read-back-verified daily reports, including a no-new-match day', async () => {
  const fake = api();
  const receipt = await publishDailyScreening({ ...fixture(), request: fake.request, upload: fake.upload });
  assert.equal(receipt.reports.length, 2);
  assert.equal(receipt.projectGid, PROJECT);
  assert.equal(receipt.operational, true);
  for (const item of receipt.reports) {
    assert.equal(item.sectionGid, DESTINATIONS[item.domain]);
    const task = fake.tasks.get(item.taskGid);
    assert.match(task.notes, /^DELIVERY VERIFIED:/);
    assert.match(task.notes, /New or changed findings in this report: 0/);
    assert.equal(task.memberships[0].project.gid, PROJECT);
    assert.ok(fake.calls.some(c => c.path.startsWith('/tasks/' + task.gid + '?')));
  }
});

test('degraded PEP/adverse media is delivered honestly, never converted to operational', async () => {
  const input = fixture();
  input.assurance.operational = false;
  input.assurance.domains.pep.operational = false;
  input.assurance.domains.pep.reasons = ['8 labels remain unresolved'];
  input.assurance.domains.adverseMedia.operational = false;
  input.assurance.domains.adverseMedia.reasons = ['5 subjects skipped enrichment'];
  const fake = api();
  const receipt = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.equal(receipt.operational, false);
  const media = fake.tasks.get(receipt.reports[1].taskGid);
  assert.match(media.notes, /PEP: DEGRADED/);
  assert.match(media.notes, /Adverse media: DEGRADED/);
  assert.match(media.notes, /8 labels remain unresolved/);
  assert.match(media.notes, /5 subjects skipped enrichment/);
});

test('an honestly degraded coverage report still reaches Asana with provisional findings', async () => {
  const input = fixture();
  input.assurance.domains.adverseMedia.operational = false;
  input.assurance.domains.adverseMedia.reasons = ['18 subjects had zero adverse-media backbone coverage'];
  input.assurance.domains.adverseMedia.evidence.errors = 18;
  input.assurance.operational = false;
  const fake = api();
  const receipt = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.equal(receipt.operational, false);
  const task = fake.tasks.get(receipt.reports.find(x => x.domain === 'media').taskGid);
  assert.match(task.notes, /Adverse media: DEGRADED/);
  assert.match(task.notes, /18 subjects had zero adverse-media backbone coverage/);
});

test('degraded screening can be delivered but never claims to clear prior findings', async () => {
  const input = fixture();
  input.assurance.operational = false;
  input.assurance.domains.sanctions.operational = false;
  input.assurance.domains.sanctions.reasons = ['Synthetic current source unavailable'];
  input.results.degraded = true;
  input.results.cleared = ['Former Synthetic Match'];
  const fake = api();
  const out = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.equal(out.operational, false);
  const sanctions = [...fake.attachments.values()].find(a => a.name.includes('-sanctions-')).text;
  assert.match(sanctions, /NOT MATCHED - DEGRADED COVERAGE - REVIEW REQUIRED,Former Synthetic Match/);
  assert.doesNotMatch(sanctions, /CLEARED THIS RUN/);
});

test('rerun refreshes the same cards and evidence rather than keeping stale results', async () => {
  const input = fixture(), fake = api();
  const before = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  input.results.alerts.push({ name: 'Synthetic Example', lists: ['PEP (Worldwide)'], hits: [{ list: 'PEP (Worldwide)', hitName: 'Synthetic Example' }] });
  const after = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.deepEqual(after.reports.map(r => r.taskGid), before.reports.map(r => r.taskGid));
  assert.equal(fake.tasks.size, 4);
  const media = fake.tasks.get(after.reports[1].taskGid);
  assert.match(media.notes, /New or changed findings in this report: 1/);
  const child = [...fake.tasks.values()].find(t => t.parent?.gid === media.gid);
  assert.match(child.notes, /Synthetic Example/);
});

test('lost acknowledgement after Asana daily report creation does not replay the write', async () => {
  const input = fixture(), fake = api();
  const title = buildReports(input.results, input.assurance, input.state, input)[0].title;
  let lost = false;
  fake.setIntercept((path, method, data) => {
    if (!lost && path === '/tasks' && method === 'POST' && data.name === title) {
      lost = true;
      fake.add(data);  // Remote create succeeded, only the acknowledgement was lost.
      throw new Error('synthetic lost Asana report creation acknowledgement');
    }
  });
  await assert.rejects(
    publishDailyScreening({ ...input, request: fake.request, upload: fake.upload }),
    /sanctions delivery failed/
  );
  assert.equal([...fake.tasks.values()].filter(x => x.name === title).length, 1);
  assert.ok(fake.calls.filter(x => x.path === '/tasks' && x.method === 'POST')
    .every(x => x.nonReplayable), 'report creation must opt out of ambiguous retry');
  fake.setIntercept(null);
  const recovered = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.equal(recovered.reports.length, 2);
  assert.equal([...fake.tasks.values()].filter(x => x.name === title).length, 1,
    'rerun must reuse the remote-created report, not create a duplicate');
});

test('lost acknowledgement after evidence page creation is reconciled by page marker', async () => {
  const input = fixture(), fake = api();
  let lost = false;
  fake.setIntercept((path, method, data) => {
    const parent = /^\/tasks\/(\d+)\/subtasks$/.exec(path);
    if (!lost && parent && method === 'POST' && data.name === '[screening-evidence] 0001') {
      lost = true;
      fake.add(data, parent[1]);  // Page exists on Asana, but the response is lost.
      throw new Error('synthetic lost Asana evidence-page acknowledgement');
    }
  });
  await assert.rejects(
    publishDailyScreening({ ...input, request: fake.request, upload: fake.upload }),
    /sanctions delivery failed/
  );
  assert.ok(fake.calls.filter(x => /\/tasks\/\d+\/subtasks$/.test(x.path) && x.method === 'POST')
    .every(x => x.nonReplayable), 'evidence page creation must opt out of ambiguous retry');
  fake.setIntercept(null);
  const recovered = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.equal(recovered.reports.length, 2);
  const taskId = recovered.reports.find(x => x.domain === 'sanctions').taskGid;
  const pages = [...fake.tasks.values()].filter(x =>
    x.parent?.gid === taskId && x.name === '[screening-evidence] 0001');
  assert.equal(pages.length, 1, 'lost acknowledgement must not create two evidence pages');
  assert.match(pages[0].notes, /^BEGIN SCREENING EVIDENCE/);
});

test('next date creates fresh daily reports rather than suppressing the day', async () => {
  const fake = api(), input = fixture();
  const first = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  input.results.date = input.state.updated = input.assurance.run.date = '2026-10-01';
  input.assurance.generatedAt = '2026-10-01T10:00:00Z'; input.nowMs += 86400000;
  const next = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.notEqual(first.reports[0].taskGid, next.reports[0].taskGid);
  assert.equal([...fake.tasks.values()].filter(t => !t.parent).length, 4);
});

test('mixed and unclassifiable findings remain visible, with carry-forward flags intact', () => {
  const input = fixture();
  input.state.subjects = {
    mixed: { name: 'Synthetic Mixed', hits: [{ list: 'UN' }, { list: 'PEP (Worldwide)' }], unverified: ['PEP (Worldwide)'], lastSeen: '2026-09-29' },
    unknown: { name: 'Synthetic Unknown', recommendation: 'review' },
  };
  for (const report of buildReports(input.results, input.assurance, input.state, input)) {
    const data = JSON.parse(report.pages.join(''));
    assert.equal(data.storedFindings.mixed.lastSeen, '2026-09-29');
    assert.deepEqual(data.storedFindings.mixed.unverified, ['PEP (Worldwide)']);
    assert.equal(data.storedFindings.unknown.name, 'Synthetic Unknown');
  }
});

test('large multilingual evidence is losslessly split under the rich-text budget', () => {
  const value = JSON.stringify({ text: '\u0645\ud83d\ude00<&"\n'.repeat(12000) });
  const pages = splitEvidence(value);
  assert.ok(pages.length > 1);
  assert.equal(pages.join(''), value);
  for (const page of pages) assert.ok(textSize(page) <= 45000);
  assert.deepEqual(JSON.parse(pages.join('')), JSON.parse(value));
  assert.throws(() => splitEvidence('x', 0));
});

test('shorter reruns supersede old machine pages without modifying analyst subtasks', async () => {
  const input = fixture(), fake = api();
  input.state.subjects.example = { name: 'Synthetic Example', lists: ['UN'], detail: 'x'.repeat(60000) };
  const first = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  const parent = first.reports[0].taskGid;
  fake.add({ name: 'Analyst notes', notes: 'Preserve my investigation' }, parent);
  delete input.state.subjects.example;
  await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  const children = [...fake.tasks.values()].filter(t => t.parent?.gid === parent);
  assert.match(children.find(t => t.name === '[screening-evidence] 0002').notes, /^SUPERSEDED/);
  assert.equal(children.find(t => t.name === 'Analyst notes').notes, 'Preserve my investigation');
});

test('API/read-back failure leaves a pending report, but still attempts the other domain', async () => {
  const fake = api();
  fake.setIntercept((path, method) => {
    if (method === 'POST' && path === '/tasks/1000/subtasks') throw new Error('simulated unavailable');
  });
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request, upload: fake.upload }), /sanctions delivery failed/);
  assert.match(fake.tasks.get('1000').notes, /^DELIVERY INCOMPLETE/);
  const media = [...fake.tasks.values()].find(t => t.name.startsWith('Daily Adverse'));
  assert.match(media.notes, /^DELIVERY VERIFIED/);
});

test('read-back content mismatch is not delivery success', async () => {
  const fake = api();
  fake.setIntercept((path, method) => {
    if (method === 'GET' && path.startsWith('/tasks/') && path.includes('?opt_fields=name,notes')) {
      return { data: { name: 'Stale title', notes: 'Stale body' } };
    }
  });
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request, upload: fake.upload }), /read-back/);
});

test('wrong section membership fails verification', async () => {
  const fake = api();
  fake.setIntercept((path, method, data) => {
    if (method === 'POST' && path.endsWith('/addTask')) {
      fake.tasks.get(data.task).memberships = [];
      return { data: {} };
    }
  });
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request, upload: fake.upload }), /wrong screening section/);
});

test('a destination from another project is rejected before creating tasks', async () => {
  const fake = api();
  fake.setIntercept(path => path.startsWith('/sections/') ? { data: { project: { gid: '1' } } } : undefined);
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request, upload: fake.upload }), /approved project/);
  assert.equal(fake.calls.filter(c => c.method === 'POST').length, 0);
});

test('duplicate parent cards fail loudly rather than updating an arbitrary card', async () => {
  const input = fixture(), fake = api();
  const title = buildReports(input.results, input.assurance, input.state, input)[0].title;
  fake.add({ name: title }); fake.add({ name: title });
  await assert.rejects(publishDailyScreening({ ...input, request: fake.request, upload: fake.upload }), /require reconciliation/);
});

test('paginated scans include later pages when finding the existing report', async () => {
  const input = fixture(), fake = api();
  const title = buildReports(input.results, input.assurance, input.state, input)[0].title;
  const old = fake.add({ name: title, notes: 'HAWKEYE-SCREENING-V1:sanctions:2026-09-30' });
  fake.setIntercept(path => {
    if (path.startsWith('/projects/') && !path.includes('&offset=')) return { data: [], next_page: { offset: 'page 2' } };
    if (path.startsWith('/projects/') && path.includes('&offset=page%202')) return { data: [{ gid: old.gid, name: title }] };
  });
  const receipt = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.equal(receipt.reports[0].taskGid, old.gid);
});

test('pagination loops or failures cannot fall through to duplicate creation', async () => {
  const fake = api();
  fake.setIntercept(() => ({ data: [], next_page: { offset: 'same' } }));
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request, upload: fake.upload }), /pagination/);
  assert.equal(fake.tasks.size, 0);
});

test('a successful-looking create without an identifier is rejected', async () => {
  const fake = api();
  fake.setIntercept((path, method) => path === '/tasks' && method === 'POST' ? { data: {} } : undefined);
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request, upload: fake.upload }), /identifier/);
});


test('same-named analyst cards are never overwritten', async () => {
  const input = fixture(), fake = api();
  const title = buildReports(input.results, input.assurance, input.state, input)[0].title;
  const existing = fake.add({ name: title, notes: 'Analyst-owned report' });
  await assert.rejects(publishDailyScreening({ ...input, request: fake.request, upload: fake.upload }), /ownership marker/);
  assert.equal(fake.tasks.get(existing.gid).notes, 'Analyst-owned report');
});

test('page framing preserves whitespace inside quoted JSON across Asana trimming', async () => {
  const input = fixture(), fake = api();
  const detail = ('word ' + 'م').repeat(12000);
  input.state.subjects.example = { name: 'Synthetic', lists: ['UN'], detail };
  const receipt = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  const parent = receipt.reports[0].taskGid;
  const pages = [...fake.tasks.values()].filter(t => t.parent?.gid === parent)
    .sort((a, b) => a.name.localeCompare(b.name));
  const reconstructed = pages.map(page => page.notes.trim()
    .replace(/^BEGIN SCREENING EVIDENCE\n/, '').replace(/\nEND SCREENING EVIDENCE$/, '')).join('');
  assert.equal(JSON.parse(reconstructed).storedFindings.example.detail, detail);
  for (const page of pages) assert.ok(textSize(page.notes) <= 45000);
});

test('each results card carries a read-back-verified findings table, one row per hit', async () => {
  const input = fixture();
  input.state.subjects = {
    'jane roe': { name: 'Jane Roe', entityType: 'individual', parent: 'Acme Gold', role: 'Shareholder',
      band: 'medium', topScore: 88, recommendation: 'review', firstSeen: '2026-09-29', lastSeen: '2026-09-30',
      lists: ['OFAC SDN', 'PEP (Worldwide — Wikidata)'],
      hits: [{ list: 'OFAC SDN', hitName: '=ROE, Jane', score: 88, mechanism: 'subset', confidence: 'WEAK',
               provenance: { sourceUrl: 'https://ofac.example/sdn.csv' } },
             { list: 'PEP (Worldwide — Wikidata)', hitName: 'Jane Roe', score: 90, confidence: 'MODERATE' }] },
  };
  input.results.alerts = [{ key: 'jane roe', lists: ['OFAC SDN'], hits: [{ list: 'OFAC SDN' }] }];
  input.results.cleared = ['Old Match'];
  const fake = api();
  const receipt = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  assert.equal(receipt.reports.length, 2);
  for (const report of receipt.reports) {
    const files = [...fake.attachments.values()].filter(a => a.parent === report.taskGid);
    assert.equal(files.length, 1, report.domain + ' card has exactly one findings table');
    assert.equal(files[0].name, findingsAttachmentName(report.domain, '2026-09-30', '100'));
    assert.ok(files[0].text.startsWith('\ufeffstatus,subject,'), 'BOM + header');
    assert.match(fake.tasks.get(report.taskGid).notes, /Readable findings table \(one row per hit\) is attached/);
  }
  const sanctions = [...fake.attachments.values()].find(a => a.name.includes('-sanctions-')).text;
  const media = [...fake.attachments.values()].find(a => a.name.includes('-media-')).text;
  assert.match(sanctions, /NEW\/CHANGED,Jane Roe,individual,Acme Gold,Shareholder/);
  assert.match(sanctions, /OFAC SDN,'=ROE\, Jane|OFAC SDN,"'=ROE, Jane"/, 'formula injection neutralised');
  assert.doesNotMatch(sanctions, /PEP \(Worldwide/, 'PEP hits belong to the media table');
  assert.match(sanctions, /NO MATCH ON THIS RUN - NOT MLRO CLEARANCE,Old Match/);
  assert.match(media, /PEP \(Worldwide — Wikidata\),Jane Roe,90/);
});

test('a card is never marked verified without its findings table', async () => {
  const fake = api();
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request }), /attachment uploader/);
  for (const task of fake.tasks.values()) assert.doesNotMatch(String(task.notes), /^DELIVERY VERIFIED/);
  const hidden = api();
  hidden.hideUploads(true);
  await assert.rejects(publishDailyScreening({ ...fixture(), request: hidden.request, upload: hidden.upload }),
    /did not confirm the findings attachment/);
  for (const task of hidden.tasks.values()) assert.doesNotMatch(String(task.notes), /^DELIVERY VERIFIED/);
});

test('a rerun replaces the superseded findings table and leaves analyst files alone', async () => {
  const input = fixture();
  const fake = api();
  const first = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  const card = first.reports[0].taskGid;
  await fake.upload(card, 'analyst-notes.csv', 'x', 'text/csv');
  input.runId = '101';
  input.assurance.run.githubRunId = '101';
  await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  const names = [...fake.attachments.values()].filter(a => a.parent === card).map(a => a.name).sort();
  assert.deepEqual(names, ['analyst-notes.csv', findingsAttachmentName('sanctions', '2026-09-30', '101')]);
});

test('csvCell quotes separators and neutralises formulas', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('  =HYPERLINK("https://example.invalid","run")'),
    '\'  =HYPERLINK("https://example.invalid","run")'.replaceAll('"', '""').replace(/^/, '"').concat('"'));
  assert.equal(csvCell('\t@SUM(1,2)'), '"\'\t@SUM(1,2)"');
  assert.equal(csvCell('\u200b=1+1'), "'\u200b=1+1");
  assert.equal(csvCell(['x', 'y']), 'x; y');
  assert.ok(buildFindingsCsv('sanctions', [], [], []).startsWith('\ufeffstatus,'));
});

test('a same-run re-attempt keeps a single findings table', async () => {
  const input = fixture();
  const fake = api();
  const first = await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  await publishDailyScreening({ ...input, request: fake.request, upload: fake.upload });
  for (const report of first.reports) {
    assert.equal([...fake.attachments.values()].filter(a => a.parent === report.taskGid).length, 1);
  }
});
