/* Deliver the complete daily screening evidence, separately from case lifecycle.
 * This module does not decide matches, clear cases, or relax assurance gates.
 * Network dependencies are injected so the real publisher is testable offline.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PROJECT = '1216203370612914';
export const DESTINATIONS = Object.freeze({
  sanctions: '1218451960830318',
  media: '1218979441933783',
});
const DOMAINS = ['sanctions', 'adverseMedia', 'pep'];
const LABELS = { sanctions: 'Sanctions', adverseMedia: 'Adverse media', pep: 'PEP' };
const PAGE_BUDGET = 45000;
const MAX_PAGES = 500;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const normalize = value => String(value ?? '').replace(/\r\n?/g, '\n').trim();
const gid = value => {
  const text = String(value ?? '');
  if (!/^\d+$/.test(text)) throw new Error('Missing or invalid Asana task identifier');
  return text;
};

// Budget the converted rich text, not just UTF-8 bytes. No content is discarded.
export function textSize(value) {
  let size = 0;
  const special = { '&': 5, '<': 4, '>': 4, '"': 6, "'": 6 };
  for (const ch of String(value)) {
    const cp = ch.codePointAt(0);
    size += special[ch] ?? (cp < 128 ? 1 : String(cp).length + 3);
  }
  return size;
}

export function splitEvidence(text, budget = PAGE_BUDGET) {
  if (!Number.isInteger(budget) || budget < 16) throw new Error('Invalid evidence page budget');
  const pages = [];
  let page = '', size = 0;
  for (const ch of String(text)) {
    const cost = textSize(ch);
    if (size + cost > budget) { pages.push(page); page = ''; size = 0; }
    page += ch;
    size += cost;
  }
  if (page || !pages.length) pages.push(page);
  return pages;
}

export function validateEvidence(results, assurance, state, { runId, nowMs = Date.now() } = {}) {
  if (!record(results) || !/^\d{4}-\d{2}-\d{2}$/.test(results.date || '')
    || new Date(results.date + 'T00:00:00Z').toISOString().slice(0, 10) !== results.date
    || !Number.isInteger(results.screened) || results.screened <= 0
    || !Array.isArray(results.alerts) || !Array.isArray(results.lists)) {
    throw new Error('Missing or invalid screening results; refusing a false all-clear');
  }
  if (!record(state) || state.updated !== results.date || !record(state.subjects)) {
    throw new Error('Screening state is missing or belongs to a different screening date');
  }
  const generated = Date.parse(assurance?.generatedAt || '');
  if (!record(assurance) || assurance.version !== 1 || !runId
    || String(assurance.run?.githubRunId) !== String(runId)
    || assurance.run?.date !== results.date
    || assurance.run?.screenedSubjects !== results.screened
    || !Number.isFinite(generated) || generated > nowMs + 60000
    || nowMs - generated > 6 * 3600000) {
    throw new Error('Assurance is missing, stale, or belongs to another workflow run');
  }
  for (const domain of DOMAINS) {
    const item = assurance.domains?.[domain];
    if (!record(item) || typeof item.operational !== 'boolean'
      || !Array.isArray(item.reasons) || !Array.isArray(item.warnings)) {
      throw new Error('Assurance has no explicit status for ' + domain);
    }
    if (item.operational && item.reasons.length) throw new Error('Contradictory assurance for ' + domain);
  }
  const operational = DOMAINS.every(domain => assurance.domains[domain].operational);
  if (assurance.operational !== operational) throw new Error('Contradictory overall assurance status');
  return operational;
}

function isMedia(list) { return /^(?:adverse media|pep(?:\s|\()|interpol|fbi)/i.test(String(list)); }
function rowDomains(row) {
  const hits = Array.isArray(row?.hits) ? row.hits.filter(hit => hit?.list) : [];
  const lists = hits.length ? hits.map(hit => hit.list) : (Array.isArray(row?.lists) ? row.lists : []);
  // Unclassifiable findings are disclosed in both reports, never silently lost.
  return lists.length ? [...new Set(lists.map(list => isMedia(list) ? 'media' : 'sanctions'))]
    : ['sanctions', 'media'];
}

export function buildReports(results, assurance, state, context) {
  validateEvidence(results, assurance, state, context);
  return Object.entries(DESTINATIONS).map(([domain, section]) => {
    const domains = domain === 'sanctions' ? ['sanctions'] : ['adverseMedia', 'pep'];
    const title = 'Daily ' + (domain === 'sanctions' ? 'Sanctions' : 'Adverse Media and PEP')
      + ' Results | ' + results.date;
    const summary = [title, 'Screening date (UTC): ' + results.date,
      'Evidence generated: ' + assurance.generatedAt,
      'Workflow run: ' + assurance.run.githubRunId,
      'Subjects processed by the sanctions engine: ' + results.screened,
      'Processing count is not proof of complete adverse-media or PEP coverage.'];
    for (const key of domains) {
      const item = assurance.domains[key];
      summary.push('\n' + LABELS[key] + ': ' + (item.operational ? 'OPERATIONAL' : 'DEGRADED'));
      for (const reason of item.reasons) summary.push('Failure: ' + reason);
      for (const warning of item.warnings) summary.push('Warning: ' + warning);
    }
    summary.push('\nNo new match is not an all-clear. Review source failures, incomplete coverage and retained findings.',
      'Matches require analyst identity verification. This delivery does not clear or disposition any case.');
    const standing = Object.entries(state.subjects).filter(([, row]) => rowDomains(row).includes(domain));
    const alerts = results.alerts.filter(row => rowDomains(row).includes(domain));
    summary.push('New or changed findings in this report: ' + alerts.length,
      'Stored finding records in this report (including retained/unverified records): ' + standing.length,
      'Complete evidence is in the numbered subtasks. Join the text between BEGIN/END SCREENING EVIDENCE markers in page order to reconstruct the JSON.');
    // Preserve original records and timestamps, including unverified/carry-forward
    // flags. A mixed-domain record appears in both reports with its full evidence.
    const evidence = JSON.stringify({
      screeningDate: results.date, generatedAt: assurance.generatedAt,
      run: assurance.run, domain, screened: results.screened,
      assurance: Object.fromEntries(domains.map(key => [key, assurance.domains[key]])),
      lists: results.lists, failures: results.failures || [],
      enrichment: results.enrichment || {}, newOrChangedFindings: alerts,
      storedFindings: Object.fromEntries(standing),
      clearedThisRun: results.cleared || [],
    }, null, 2);
    if (textSize(summary.join('\n')) > PAGE_BUDGET) throw new Error('Oversized screening summary');
    const pages = splitEvidence(evidence, PAGE_BUDGET - 128);
    if (pages.length > MAX_PAGES) throw new Error('Evidence exceeds the bounded delivery page count; nothing was truncated');
    return { domain, section, title, marker: 'HAWKEYE-SCREENING-V1:' + domain + ':' + results.date,
      summary: summary.join('\n'), pages };
  });
}

async function collection(request, base) {
  const rows = [];
  const offsets = new Set();
  let path = base;
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await request(path);
    if (!Array.isArray(response?.data)) throw new Error('Malformed Asana collection');
    rows.push(...response.data);
    if (!response.next_page) return rows;
    const offset = response.next_page.offset;
    if (typeof offset !== 'string' || !offset || offsets.has(offset)) throw new Error('Invalid Asana pagination');
    offsets.add(offset);
    path = base + '&offset=' + encodeURIComponent(offset);
  }
  throw new Error('Incomplete Asana collection; refusing an unsafe duplicate decision');
}

const body = data => JSON.stringify({ data });
async function verifyTask(request, task, expected, section = null, parent = null) {
  const value = (await request('/tasks/' + gid(task)
    + '?opt_fields=name,notes,parent.gid,memberships.project.gid,memberships.section.gid,permalink_url'))?.data;
  if (!value || value.name !== expected.name || normalize(value.notes) !== normalize(expected.notes)) {
    throw new Error('Asana read-back did not confirm current content for task ' + task);
  }
  if (section && !(value.memberships || []).some(m => String(m.project?.gid) === PROJECT
    && String(m.section?.gid) === section)) throw new Error('Asana task is in the wrong screening section');
  if (parent && String(value.parent?.gid) !== String(parent)) throw new Error('Evidence subtask has the wrong parent');
  return value;
}

async function deliverReport(request, report, projectTasks, assignee) {
  const duplicates = projectTasks.filter(task => task.name === report.title);
  if (duplicates.length > 1) throw new Error('Multiple daily result cards require reconciliation: ' + report.title);
  const pending = { name: report.title, notes: 'DELIVERY INCOMPLETE. Do not treat this card as a complete report.\n' + report.marker + '\n\n' + report.summary };
  let taskId;
  if (duplicates.length) {
    taskId = gid(duplicates[0].gid);
    const existing = (await request('/tasks/' + taskId + '?opt_fields=notes'))?.data;
    if (!String(existing?.notes || '').split(/\r?\n/).includes(report.marker)) {
      throw new Error('Refusing to overwrite a daily card without its publisher ownership marker');
    }
    await request('/tasks/' + taskId, { method: 'PUT', body: body(pending) });
  } else {
    const created = await request('/tasks', { method: 'POST', body: body({ ...pending,
      projects: [PROJECT], assignee,
      memberships: [{ project: PROJECT, section: report.section }],
    }) });
    taskId = gid(created?.data?.gid);
    projectTasks.push({ gid: taskId, name: report.title });
  }
  await request('/sections/' + report.section + '/addTask', { method: 'POST', body: body({ task: taskId }) });
  await verifyTask(request, taskId, pending, report.section);
  const children = await collection(request, '/tasks/' + taskId + '/subtasks?limit=100&opt_fields=name');
  const prefix = '[screening-evidence] ';
  const used = new Set();
  for (let i = 0; i < report.pages.length; i++) {
    const name = prefix + String(i + 1).padStart(4, '0');
    const matches = children.filter(child => child.name === name);
    if (matches.length > 1) throw new Error('Duplicate screening evidence page ' + name);
    const content = { name, notes: 'BEGIN SCREENING EVIDENCE\n' + report.pages[i] + '\nEND SCREENING EVIDENCE' };
    let childId;
    if (matches.length) {
      childId = gid(matches[0].gid);
      await request('/tasks/' + childId, { method: 'PUT', body: body(content) });
    } else {
      childId = gid((await request('/tasks/' + taskId + '/subtasks', { method: 'POST', body: body(content) }))?.data?.gid);
    }
    await verifyTask(request, childId, content, null, taskId);
    used.add(childId);
  }
  // A shorter rerun must not leave old findings masquerading as current pages.
  // Only exact machine-owned names are touched; analyst subtasks are untouched.
  for (const child of children) {
    if (!/^\[screening-evidence\] \d{4}$/.test(child.name || '') || used.has(gid(child.gid))) continue;
    const content = { name: child.name, notes: 'SUPERSEDED by the latest run. This page is not current screening evidence.' };
    await request('/tasks/' + gid(child.gid), { method: 'PUT', body: body(content) });
    await verifyTask(request, child.gid, content, null, taskId);
  }
  const final = { name: report.title, notes: 'DELIVERY VERIFIED: ' + report.pages.length
    + ' current evidence page(s). Delivery status is separate from screening coverage.\n' + report.marker + '\n\n' + report.summary };
  await request('/tasks/' + taskId, { method: 'PUT', body: body(final) });
  const verified = await verifyTask(request, taskId, final, report.section);
  return { domain: report.domain, taskGid: taskId, sectionGid: report.section,
    pages: report.pages.length, url: verified.permalink_url || null };
}

export async function publishDailyScreening({ results, assurance, state, request, runId,
  nowMs = Date.now(), assignee = '1213645083721304' }) {
  if (typeof request !== 'function') throw new Error('Asana client is required');
  const reports = buildReports(results, assurance, state, { runId, nowMs });
  const tasks = await collection(request, '/projects/' + PROJECT + '/tasks?limit=100&opt_fields=name');
  const delivered = [], errors = [];
  for (const report of reports) {
    try {
      const section = (await request('/sections/' + report.section + '?opt_fields=project.gid'))?.data;
      if (String(section?.project?.gid) !== PROJECT) throw new Error('Screening section is not in the approved project');
      delivered.push(await deliverReport(request, report, tasks, assignee));
    } catch (error) {
      errors.push(new Error(report.domain + ' delivery failed: ' + error.message));
    }
  }
  if (errors.length) throw new AggregateError(errors, errors.map(error => error.message).join('; '));
  return { version: 1, runId: String(runId), screeningDate: results.date, projectGid: PROJECT,
    verifiedAt: new Date(nowMs).toISOString(), operational: assurance.operational, reports: delivered };
}

async function main() {
  if (!process.env.ASANA_ACCESS_TOKEN) throw new Error('ASANA_ACCESS_TOKEN is required for daily results delivery');
  const read = file => JSON.parse(readFileSync(file, 'utf8'));
  const { asana } = await import('./asana-notify.mjs');
  const receipt = await publishDailyScreening({
    results: read('sanctions-screen-results.json'),
    assurance: read('data/screening-assurance.json'),
    state: read('data/sanctions-screen-state.json'),
    runId: process.env.GITHUB_RUN_ID,
    assignee: process.env.ASANA_CASE_ASSIGNEE_GID || '1213645083721304',
    request: (path, options = {}) => asana(path, { ...options, signal: AbortSignal.timeout(30000) }),
  });
  writeFileSync('screening-delivery-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  for (const report of receipt.reports) console.log('screening-delivery: verified ' + report.domain + ' task ' + report.taskGid);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error('screening-delivery: ' + error.message); process.exitCode = 1; });
}
