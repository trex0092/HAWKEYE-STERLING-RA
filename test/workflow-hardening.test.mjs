/* Workflow-hardening ratchet — the 2026-08-05 full-estate audit found every
   deviation documented in-file; this guard FREEZES that state so a future
   workflow (or edit) cannot regress it silently. Line-based checks (no YAML
   dep — zero-dependency doctrine) over every .github/workflows/*.yml:

     1. every `uses:` is pinned to a full 40-hex commit SHA
     2. `egress-policy: audit` requires a same-line justification comment or a
        "Stays audit" rationale in the file (the estate's own convention)
     3. every job carries `timeout-minutes`
     4. every job runs step-security/harden-runner — or appears in the
        DOCUMENTED_EXCEPTIONS table below with the in-file rationale
     5. a top-level `permissions:` block exists and `write-all` appears nowhere
     6. every actions/checkout sets `persist-credentials: false` — or the
        file::job is listed in DOCUMENTED_EXCEPTIONS

   Adding an exception here is a reviewed act: quote the workflow's own
   comment as the reason, the same way the screening benchmark allowlists a
   residual. An empty reason fails the guard.
   Usage: node test/workflow-hardening.test.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

/* file::job → reason (quoted from the workflow itself). Kept deliberately
   TINY: the estate's convention is to document exceptions in the workflow,
   and this table only mirrors ones the checks below cannot read in place. */
const DOCUMENTED_EXCEPTIONS = new Map([
]);

const dir = '.github/workflows';
const files = readdirSync(dir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml')).sort();
check('the estate is present (50+ workflows)', files.length >= 50);

const SHA_PIN = /@[0-9a-f]{40}(\s|#|$)/;

for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8');
  const lines = text.split('\n');

  /* 1. SHA pinning — every uses: line (comments stripped) */
  const unpinned = [];
  for (const raw of lines) {
    const line = raw.split('#')[0];
    const m = line.match(/^\s*(?:-\s+)?uses:\s*(\S+)/);
    if (m && !SHA_PIN.test(m[1] + ' ') && !m[1].startsWith('./')) unpinned.push(m[1]);
  }
  check(`${f}: every action is SHA-pinned`, unpinned.length === 0 || `unpinned: ${unpinned}` === '');

  /* 5. permissions posture */
  check(`${f}: top-level permissions block exists`, /^permissions:/m.test(text));
  check(`${f}: no write-all anywhere`, !/write-all/.test(text));

  /* Job blocks: keys at 2-space indent under jobs: */
  const jobsIdx = lines.findIndex(l => /^jobs:\s*$/.test(l));
  const jobs = [];
  if (jobsIdx >= 0) {
    for (let i = jobsIdx + 1; i < lines.length; i++) {
      const m = lines[i].match(/^  ([A-Za-z0-9_-]+):\s*(#.*)?$/);
      if (m) jobs.push({ name: m[1], start: i });
      else if (/^[A-Za-z]/.test(lines[i])) break;
    }
  }
  for (let j = 0; j < jobs.length; j++) {
    const body = lines.slice(jobs[j].start, j + 1 < jobs.length ? jobs[j + 1].start : lines.length).join('\n');
    const id = `${f}::${jobs[j].name}`;
    const exception = DOCUMENTED_EXCEPTIONS.get(id);

    /* 3. timeout on every job */
    check(`${id}: timeout-minutes set`, /timeout-minutes:/.test(body) || Boolean(exception));

    /* 4. harden-runner on every job */
    check(`${id}: harden-runner present`,
      /step-security\/harden-runner@/.test(body) || Boolean(exception));

    /* 6. checkout keeps credentials off disk */
    if (/uses:\s*actions\/checkout@/.test(body)) {
      check(`${id}: checkout persist-credentials: false`,
        /persist-credentials:\s*false/.test(body) || Boolean(exception));
    }
  }

  /* 2. egress audit demands a written rationale */
  for (let i = 0; i < lines.length; i++) {
    if (/egress-policy:\s*audit/.test(lines[i])) {
      const sameLine = /egress-policy:\s*audit\s*#\s*\S/.test(lines[i]);
      const staysAudit = /Stays audit/i.test(text);
      check(`${f}: 'egress-policy: audit' carries its rationale (line ${i + 1})`,
        sameLine || staysAudit);
    }
  }
}

/* The exceptions table itself must stay honest: no empty reasons. */
for (const [id, reason] of DOCUMENTED_EXCEPTIONS) {
  check(`exception ${id} carries a quoted reason`, typeof reason === 'string' && reason.trim().length > 10);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
