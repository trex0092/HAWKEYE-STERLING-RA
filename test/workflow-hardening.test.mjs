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

/* ── 7. A core designation list may never be blocked by our own egress policy ──
   Australia DFAT and Switzerland SECO were added as CORE-FLOORED lists on
   2026-07-29; daily-sanctions-screen.yml's allowed-endpoints was not extended,
   so harden-runner blocked their host on every run. Both lists loaded 0 names,
   sat below their 500 floors, and the coverage-floor gate turned the job red
   after delivering a DEGRADED screen — daily, for weeks. The screen was honest
   about it (that part worked); nothing connected "this list has a floor" to
   "this runner is allowed to reach it".

   So derive it rather than list it: read the floored list names from the
   screening runner, read the engine's own download(URL, "Label") calls to learn
   each one's host, and require every workflow that ENFORCES those floors (it
   sets FLOOR_GATE) to allow those hosts. A new core list with a new host is
   covered the day it is added, without anyone remembering this rule. */
{
  const runner = readFileSync('scripts/daily-screen-run.py', 'utf8');
  const engine = readFileSync('screen.py', 'utf8');

  const floorBlock = /_floors\s*=\s*\{([\s\S]*?)\}/.exec(runner);
  check('core-list floors are readable from the screening runner', Boolean(floorBlock));
  const floored = new Set([...(floorBlock ? floorBlock[1] : '').matchAll(/"([^"]+)"\s*:/g)].map(m => m[1]));
  check(`parsed the core-floored list names (${floored.size})`, floored.size >= 5);

  /* download("https://host/path", "List Name") — the second argument is the
     same label the floor table keys on. A list with no download call is a
     locally maintained file (UAE EOCN) and needs no egress. */
  const hostFor = new Map();
  for (const m of engine.matchAll(/download\(\s*"https:\/\/([^/"]+)[^"]*"\s*,\s*"([^"]+)"/g)) {
    if (floored.has(m[2])) hostFor.set(m[2], m[1]);
  }
  check(`resolved a source host for the floored lists that fetch one (${hostFor.size})`, hostFor.size >= 2);

  /* The folded block runs from the `allowed-endpoints: >` line until the first
     line indented no deeper than the key itself. Matching on a blank line
     instead would swallow the steps that follow. */
  const endpointBlock = (text) => {
    const ls = text.split('\n');
    const i = ls.findIndex(l => /^\s*allowed-endpoints:\s*>/.test(l));
    if (i < 0) return null;
    const indent = ls[i].match(/^\s*/)[0].length;
    const out = [];
    for (let j = i + 1; j < ls.length; j++) {
      if (ls[j].trim() === '') break;
      if (ls[j].match(/^\s*/)[0].length <= indent) break;
      out.push(ls[j]);
    }
    return out.join('\n');
  };

  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    if (!text.includes('FLOOR_GATE')) continue;          // does not enforce core floors
    const allowed = endpointBlock(text);
    if (allowed === null) continue;                       // audit mode — nothing to block
    for (const [list, host] of hostFor) {
      check(`${f}: enforces the ${list} floor, so its host ${host} must be reachable`,
        allowed.includes(host + ':443'));
    }
  }

  /* A floored list with no loader is a permanent red run AND a permanent gap.
     Australia DFAT and Switzerland SECO were added to _floors on 2026-07-29
     and nothing in this pipeline ever fetched or parsed them: the floor
     demanded 500 names, the loader could only ever supply 0, so every run
     reported an outage and screened without two lists that carry freeze
     duties. The gate was honest; nothing checked that the thing it gated on
     could exist. Every floored list must name a source file, and every source
     file under /tmp must be written by the workflow that enforces the floor. */
  const srcBlock = /_srcfile\s*=\s*\{([\s\S]*?)\}/.exec(runner);
  check('the source-file map is readable from the screening runner', Boolean(srcBlock));
  const srcFor = new Map(
    [...(srcBlock ? srcBlock[1] : '').matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map(m => [m[1], m[2]]));
  for (const list of floored) {
    check(`floored list "${list}" names a source file (a floor with no loader is a permanent outage)`,
      srcFor.has(list));
  }
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    if (!text.includes('FLOOR_GATE')) continue;
    for (const list of floored) {
      const path = srcFor.get(list);
      if (!path || !path.startsWith('/tmp/')) continue;   // in-repo file, nothing to download
      check(`${f}: enforces the ${list} floor, so it must produce ${path}`, text.includes(path));
    }
  }

  /* An allowed-endpoints block is a YAML FOLDED scalar: every line is joined
     into one whitespace-separated string and harden-runner reads each WORD as a
     domain. A `#` comment inside it is not a comment — the action registers
     every word of the prose as an endpoint, fails to resolve them, and REVERTS
     its own enforcement, silently turning the egress block off. Observed live
     on run 31364821216, where "Australia." and "SECO." appear in the parsed
     endpoint map and the agent logs "Reverted changes". Comments go ABOVE the
     key. Every entry must look like host:port and nothing else. */
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    const allowed = endpointBlock(text);
    if (allowed === null) continue;
    const bad = allowed.split(/\s+/).filter(Boolean)
      .filter(tok => !/^(\*\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}:\d{2,5}$/i.test(tok));
    check(`${f}: every allowed-endpoints entry is a bare host:port — a comment in a folded block disables the egress guard${bad.length ? ' (offending: ' + bad.slice(0, 4).join(' ') + ')' : ''}`,
      bad.length === 0);
  }
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
