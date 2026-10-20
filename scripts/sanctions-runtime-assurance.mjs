#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  fetchAsanaSubjects,
  fetchAsanaEmployeeSubjects,
  requireDistinctSourceKeys,
  requireApprovedScreeningRoute,
  screenLocally,
  resolveThreshold,
  SANCTIONS_SOURCES_FILE,
  CUSTOMER_PROJECT_GID,
  EMPLOYEE_PROJECT_GID,
} from './sanctions-screen.mjs';
import { assessRuntime, approvedSourcePopulationIssue, badgeSvg, BADGE_FILES } from './screening-assurance.mjs';

export const OUT_FILE = 'data/sanctions-runtime-assurance.json';
/* The auxiliary sanctions-only proof must use exactly the same authoritative
   Asana customer and completed-employee populations as the daily full screen.
   Generic fetchAsanaSubjects() classifies top-level tasks as organisations:
   it must NOT be used on employees, who require individual/PEP identity data.
   Dependencies are injectable for credential-free regression tests. */
export async function loadApprovedRuntimePopulation(token, {
  customerProject = process.env.ASANA_CUSTOMER_PROJECT_GID || CUSTOMER_PROJECT_GID,
  employeeProject = process.env.ASANA_EMPLOYEE_PROJECT_GID !== undefined
    ? process.env.ASANA_EMPLOYEE_PROJECT_GID : EMPLOYEE_PROJECT_GID,
  fetchCustomers = fetchAsanaSubjects,
  fetchEmployees = fetchAsanaEmployeeSubjects,
} = {}) {
  // A blank/redirected HR source may NOT turn a 2-project screen into a
  // seemingly successful customer-only probe. Validate BEFORE any network.
  requireApprovedScreeningRoute(customerProject, employeeProject);
  if (!token) throw new Error('ASANA_ACCESS_TOKEN is required');
  const customers = await fetchCustomers(customerProject, token);
  if (!Array.isArray(customers) || !customers.length) {
    throw new Error('Customer Database returned 0 verified screening subjects');
  }
  const employees = await fetchEmployees(employeeProject, token);
  if (!Array.isArray(employees) || !employees.length) {
    throw new Error('HR Employees project returned 0 verified screening subjects');
  }
  // Verify that both distinct project populations remain separately keyed;
  // a namesake across HR and the Customer Database cannot share AML state.
  requireDistinctSourceKeys(customers, employees);
  // Aggregates contain NO task names, dates of birth or national ID fields.
  const sources = {
    customer: { projectGid: customerProject, screenedSubjects: customers.length },
    employee: { projectGid: employeeProject, screenedSubjects: employees.length },
  };
  return { subjects: customers.concat(employees), sources };
}


/* Both approved Asana projects have ALREADY been read and independently
   counted. The auxiliary sanctions-only runner must pass their source receipt
   to assessRuntime exactly as the full-screening runner does, otherwise a
   valid 991-subject read fails the shared fail-closed population proof.
   Only project GIDs and aggregate counts survive into the artifact. */
export function buildSanctionsRuntimeResults(probe, sources,
  date = new Date().toISOString().slice(0, 10)) {
  const rows = probe?.results;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('sanctions runtime has no verified subject screening rows');
  }
  const sourcePopulation = {
    customer: {
      projectGid: sources?.customer?.projectGid,
      screenedSubjects: sources?.customer?.screenedSubjects,
    },
    employee: {
      projectGid: sources?.employee?.projectGid,
      screenedSubjects: sources?.employee?.screenedSubjects,
    },
  };
  const issue = approvedSourcePopulationIssue(sourcePopulation, rows.length);
  if (issue) throw new Error(issue);
  return {
    date,
    screened: rows.length,
    sourcePopulation,
    degraded: probe.degraded,
    failures: probe.notes || [],
    lists: (probe.coverage?.lists || []).map(x => ({
      id: x.id || '',
      name: x.name || '',
      count: Array.isArray(x.names) ? x.names.length : 0,
      partial: !!x.partial,
    })),
    enrichment: {},
  };
}

async function main() {
  const token = process.env.ASANA_ACCESS_TOKEN || '';
  if (!token) throw new Error('ASANA_ACCESS_TOKEN is required');

  const contract = JSON.parse(readFileSync('data/worldwide-screening-sources.json', 'utf8'));
  const required = (contract?.domains?.sanctions?.sources || [])
    .filter(s => s && s.required !== false)
    .map(s => String(s.id || '')).filter(Boolean);
  if (!required.length) throw new Error('no required sanctions sources are defined');
  /* A required source's declared fallback is loaded alongside it, so an
     outage of the primary (eu-fsf behind EU Login) is judged on whether the
     fallback actually covered it, not reported as a bare gap. */
  const fallbacks = (contract?.domains?.sanctions?.sources || [])
    .filter(s => s && s.required !== false && s.fallbackSourceId)
    .map(s => String(s.fallbackSourceId));
  const loadIds = [...new Set(required.concat(fallbacks))];

  const { subjects, sources } = await loadApprovedRuntimePopulation(token);

  const probe = await screenLocally(subjects, {
    sourcesFile: SANCTIONS_SOURCES_FILE,
    extraFile: 'data/sanctions-extra.json',
    sourceIds: loadIds,
    threshold: resolveThreshold(process.env.SCREEN_MATCH_THRESHOLD),
    adverseMedia: false,
    pep: false,
    interpol: false,
    fbi: false,
    listTimeoutMs: Number(process.env.SCREEN_LIST_TIMEOUT_MS) || 60000,
    checkTimeoutMs: 1000,
    concurrency: 32,
    enrichBudgetMs: 0,
    whitelist: false,
    secondOpinion: false,
  });
  if (!probe.anyOk || probe.results.length !== subjects.length ||
      sources.customer.screenedSubjects + sources.employee.screenedSubjects !== subjects.length) {
    throw new Error('sanctions probe did not screen the complete subject population');
  }

  const results = buildSanctionsRuntimeResults(probe, sources);
  const assessed = assessRuntime({ results, pepDataset: null, contract });
  const domain = assessed.domains.sanctions;
  const artifact = {
    version: 1,
    generatedAt: new Date().toISOString(),
    githubRunId: process.env.GITHUB_RUN_ID || '',
    commit: process.env.GITHUB_SHA || '',
    screenedSubjects: results.screened,
    sourceProjects: sources,
    requiredSourceIds: required,
    operational: domain.operational,
    reasons: domain.reasons,
    warnings: domain.warnings,
    evidence: domain.evidence,
  };

  mkdirSync('data/badges', { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(artifact, null, 2) + '\n');
  writeFileSync(BADGE_FILES.sanctions, badgeSvg('sanctions runtime', domain));

  console.log('sanctions runtime: ' + (domain.operational ? 'OPERATIONAL' : 'DEGRADED'));
  for (const r of domain.reasons) console.error('- ' + r);
  for (const w of domain.warnings) console.warn('- ' + w);
  if (!domain.operational) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('sanctions-runtime-assurance: ' + (err && err.message || err));
    process.exitCode = 1;
  });
}
