#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  fetchAsanaSubjects,
  screenLocally,
  resolveThreshold,
  SANCTIONS_SOURCES_FILE,
  CUSTOMER_PROJECT_GID,
  EMPLOYEE_PROJECT_GID,
} from './sanctions-screen.mjs';
import { assessRuntime, badgeSvg, BADGE_FILES } from './screening-assurance.mjs';

export const OUT_FILE = 'data/sanctions-runtime-assurance.json';

async function main() {
  const token = process.env.ASANA_ACCESS_TOKEN || '';
  if (!token) throw new Error('ASANA_ACCESS_TOKEN is required');

  const contract = JSON.parse(readFileSync('data/worldwide-screening-sources.json', 'utf8'));
  const required = (contract?.domains?.sanctions?.sources || [])
    .filter(s => s && s.required !== false)
    .map(s => String(s.id || '')).filter(Boolean);
  if (!required.length) throw new Error('no required sanctions sources are defined');

  const customers = await fetchAsanaSubjects(
    process.env.ASANA_CUSTOMER_PROJECT_GID || CUSTOMER_PROJECT_GID,
    token
  );
  if (!customers.length) throw new Error('Customer Database returned 0 screening subjects');

  let subjects = customers;
  const employeeProject = process.env.ASANA_EMPLOYEE_PROJECT_GID !== undefined
    ? process.env.ASANA_EMPLOYEE_PROJECT_GID
    : EMPLOYEE_PROJECT_GID;
  if (employeeProject) {
    const employees = await fetchAsanaSubjects(employeeProject, token);
    if (!employees.length) throw new Error('HR Employees project returned 0 screening subjects');
    subjects = subjects.concat(employees);
  }

  const probe = await screenLocally(subjects, {
    sourcesFile: SANCTIONS_SOURCES_FILE,
    extraFile: 'data/sanctions-extra.json',
    sourceIds: required,
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
  if (!probe.anyOk || probe.results.length !== subjects.length) {
    throw new Error('sanctions probe did not screen the complete subject population');
  }

  const results = {
    date: new Date().toISOString().slice(0, 10),
    screened: probe.results.length,
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
  const assessed = assessRuntime({ results, pepDataset: null, contract });
  const domain = assessed.domains.sanctions;
  const artifact = {
    version: 1,
    generatedAt: new Date().toISOString(),
    githubRunId: process.env.GITHUB_RUN_ID || '',
    commit: process.env.GITHUB_SHA || '',
    screenedSubjects: results.screened,
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
