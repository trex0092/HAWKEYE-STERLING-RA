/* Synthetic, offline integration tests. Never call Asana or live providers. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishDailyScreening, buildReports, splitEvidence, textSize, validateEvidence,
  PROJECT, DESTINATIONS } from '../scripts/screening-delivery.mjs';

const NOW = Date.parse('2026-09-30T10:00:00Z');
function fixture() {
  const status = operational => ({ operational, reasons: [], warnings: [], evidence: {} });
  return {
    runId: '100', nowMs: NOW,
    results: { date: '2026-09-30', screened: 2, alerts: [], lists: [{ id: 'synthetic', count: 1 }],
      failures: [], enrichment: {}, cleared: [] },
    assurance: { version: 1, generatedAt: new Date(NOW).toISOString(), operational: true,
      run: { githubRunId: '100', date: '2026-09-30', screenedSubjects: 2 },
      domains: { sanctions: status(true), adverseMedia: status(true), pep: status(true) } },
    state: { updated: '2026-09-30', subjects: {} },
  };
}
function api() {
  const tasks = new Map();
  const calls = [];
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
    calls.push({ path, method, data });
    if (intercept) { const response = await intercept(path, method, data); if (response !== undefined) return response; }
    let match;
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
  return { request, tasks, calls, add, setIntercept: fn => { intercept = fn; } };
}
function verify(input) { return validateEvidence(input.results, input.assurance, input.state, input); }

test('fresh consistent evidence is accepted; no network is required for validation', () => {
  assert.equal(verify(fixture()), true);
});
for (const [name, change] of [
  ['missing results', x => { x.results = null; }],
  ['zero screened subjects', x => { x.results.screened = 0; }],
  ['invalid calendar date', x => { x.results.date = '2026-02-30'; }],
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
]) {
  test('rejects ' + name + ' before any write', async () => {
    const input = fixture(); change(input);
    const fake = api();
    await assert.rejects(publishDailyScreening({ ...input, request: fake.request }));
    assert.equal(fake.calls.length, 0);
  });
}

test('both sections receive read-back-verified daily reports, including a no-new-match day', async () => {
  const fake = api();
  const receipt = await publishDailyScreening({ ...fixture(), request: fake.request });
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
  const receipt = await publishDailyScreening({ ...input, request: fake.request });
  assert.equal(receipt.operational, false);
  const media = fake.tasks.get(receipt.reports[1].taskGid);
  assert.match(media.notes, /PEP: DEGRADED/);
  assert.match(media.notes, /Adverse media: DEGRADED/);
  assert.match(media.notes, /8 labels remain unresolved/);
  assert.match(media.notes, /5 subjects skipped enrichment/);
});

test('rerun refreshes the same cards and evidence rather than keeping stale results', async () => {
  const input = fixture(), fake = api();
  const before = await publishDailyScreening({ ...input, request: fake.request });
  input.results.alerts.push({ name: 'Synthetic Example', lists: ['PEP (Worldwide)'], hits: [{ list: 'PEP (Worldwide)', hitName: 'Synthetic Example' }] });
  const after = await publishDailyScreening({ ...input, request: fake.request });
  assert.deepEqual(after.reports.map(r => r.taskGid), before.reports.map(r => r.taskGid));
  assert.equal(fake.tasks.size, 4);
  const media = fake.tasks.get(after.reports[1].taskGid);
  assert.match(media.notes, /New or changed findings in this report: 1/);
  const child = [...fake.tasks.values()].find(t => t.parent?.gid === media.gid);
  assert.match(child.notes, /Synthetic Example/);
});

test('next date creates fresh daily reports rather than suppressing the day', async () => {
  const fake = api(), input = fixture();
  const first = await publishDailyScreening({ ...input, request: fake.request });
  input.results.date = input.state.updated = input.assurance.run.date = '2026-10-01';
  input.assurance.generatedAt = '2026-10-01T10:00:00Z'; input.nowMs += 86400000;
  const next = await publishDailyScreening({ ...input, request: fake.request });
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
  const first = await publishDailyScreening({ ...input, request: fake.request });
  const parent = first.reports[0].taskGid;
  fake.add({ name: 'Analyst notes', notes: 'Preserve my investigation' }, parent);
  delete input.state.subjects.example;
  await publishDailyScreening({ ...input, request: fake.request });
  const children = [...fake.tasks.values()].filter(t => t.parent?.gid === parent);
  assert.match(children.find(t => t.name === '[screening-evidence] 0002').notes, /^SUPERSEDED/);
  assert.equal(children.find(t => t.name === 'Analyst notes').notes, 'Preserve my investigation');
});

test('API/read-back failure leaves a pending report, but still attempts the other domain', async () => {
  const fake = api();
  fake.setIntercept((path, method) => {
    if (method === 'POST' && path === '/tasks/1000/subtasks') throw new Error('simulated unavailable');
  });
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request }), /sanctions delivery failed/);
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
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request }), /read-back/);
});

test('wrong section membership fails verification', async () => {
  const fake = api();
  fake.setIntercept((path, method, data) => {
    if (method === 'POST' && path.endsWith('/addTask')) {
      fake.tasks.get(data.task).memberships = [];
      return { data: {} };
    }
  });
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request }), /wrong screening section/);
});

test('a destination from another project is rejected before creating tasks', async () => {
  const fake = api();
  fake.setIntercept(path => path.startsWith('/sections/') ? { data: { project: { gid: '1' } } } : undefined);
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request }), /approved project/);
  assert.equal(fake.calls.filter(c => c.method === 'POST').length, 0);
});

test('duplicate parent cards fail loudly rather than updating an arbitrary card', async () => {
  const input = fixture(), fake = api();
  const title = buildReports(input.results, input.assurance, input.state, input)[0].title;
  fake.add({ name: title }); fake.add({ name: title });
  await assert.rejects(publishDailyScreening({ ...input, request: fake.request }), /require reconciliation/);
});

test('paginated scans include later pages when finding the existing report', async () => {
  const input = fixture(), fake = api();
  const title = buildReports(input.results, input.assurance, input.state, input)[0].title;
  const old = fake.add({ name: title, notes: 'HAWKEYE-SCREENING-V1:sanctions:2026-09-30' });
  fake.setIntercept(path => {
    if (path.startsWith('/projects/') && !path.includes('&offset=')) return { data: [], next_page: { offset: 'page 2' } };
    if (path.startsWith('/projects/') && path.includes('&offset=page%202')) return { data: [{ gid: old.gid, name: title }] };
  });
  const receipt = await publishDailyScreening({ ...input, request: fake.request });
  assert.equal(receipt.reports[0].taskGid, old.gid);
});

test('pagination loops or failures cannot fall through to duplicate creation', async () => {
  const fake = api();
  fake.setIntercept(() => ({ data: [], next_page: { offset: 'same' } }));
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request }), /pagination/);
  assert.equal(fake.tasks.size, 0);
});

test('a successful-looking create without an identifier is rejected', async () => {
  const fake = api();
  fake.setIntercept((path, method) => path === '/tasks' && method === 'POST' ? { data: {} } : undefined);
  await assert.rejects(publishDailyScreening({ ...fixture(), request: fake.request }), /identifier/);
});


test('same-named analyst cards are never overwritten', async () => {
  const input = fixture(), fake = api();
  const title = buildReports(input.results, input.assurance, input.state, input)[0].title;
  const existing = fake.add({ name: title, notes: 'Analyst-owned report' });
  await assert.rejects(publishDailyScreening({ ...input, request: fake.request }), /ownership marker/);
  assert.equal(fake.tasks.get(existing.gid).notes, 'Analyst-owned report');
});

test('page framing preserves whitespace inside quoted JSON across Asana trimming', async () => {
  const input = fixture(), fake = api();
  const detail = ('word ' + 'م').repeat(12000);
  input.state.subjects.example = { name: 'Synthetic', lists: ['UN'], detail };
  const receipt = await publishDailyScreening({ ...input, request: fake.request });
  const parent = receipt.reports[0].taskGid;
  const pages = [...fake.tasks.values()].filter(t => t.parent?.gid === parent)
    .sort((a, b) => a.name.localeCompare(b.name));
  const reconstructed = pages.map(page => page.notes.trim()
    .replace(/^BEGIN SCREENING EVIDENCE\n/, '').replace(/\nEND SCREENING EVIDENCE$/, '')).join('');
  assert.equal(JSON.parse(reconstructed).storedFindings.example.detail, detail);
  for (const page of pages) assert.ok(textSize(page.notes) <= 45000);
});
