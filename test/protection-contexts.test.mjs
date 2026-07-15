/* Branch-protection drift guard — the two deadlock classes that once made every
   PR unmergeable can never silently return:

   1. NAME MISMATCH — every required status context in .github/settings.yml must
      equal the check name some workflow job actually reports (the job's `name:`
      display name, or its job id when unnamed). A context matching no check sits
      at "Expected — waiting for status to be reported" forever.
   2. PATH-GATED REQUIRED CHECK — every workflow that carries a required job must
      trigger on pull_request WITHOUT a paths/paths-ignore filter. A required
      check that only runs for some file paths deadlocks every PR that doesn't
      touch them.

   Pure Node built-ins (no YAML dep — the parsing is structural line-scanning
   over the repo's own conventional layout; if that layout changes, fix the
   parser here rather than weakening the assertions).
   Usage: node test/protection-contexts.test.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const stripComment = (s) => s.replace(/\s+#.*$/, '');

/* 1. Required contexts from settings.yml (lines under `contexts:` at its
   indentation, until a shallower/equal-indent non-list line). */
const settings = readFileSync(join(ROOT, '.github/settings.yml'), 'utf8').split('\n');
const contexts = [];
{
  let inBlock = false, listIndent = -1;
  for (const raw of settings) {
    const line = stripComment(raw);
    if (!inBlock) {
      if (/^\s*contexts:\s*$/.test(line)) inBlock = true;
      continue;
    }
    const m = line.match(/^(\s*)- (.+)$/);
    if (m) {
      if (listIndent === -1) listIndent = m[1].length;
      if (m[1].length === listIndent) { contexts.push(m[2].trim()); continue; }
    }
    if (line.trim() === '') continue;
    break; // first non-list, non-blank line ends the contexts block
  }
}
check(`settings.yml declares required status contexts (found ${contexts.length}, expect >= 5)`, contexts.length >= 5);

/* 2. Effective check names from every workflow: job display name or job id. */
const wfDir = join(ROOT, '.github/workflows');
const workflows = readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f));
const checkNames = new Map(); // check name -> workflow file
const wfRequiredJobs = new Map(); // workflow file -> [required check names]
for (const wf of workflows) {
  const lines = readFileSync(join(wfDir, wf), 'utf8').split('\n');
  let inJobs = false, currentJob = null, jobNamed = false;
  const names = [];
  for (const raw of lines) {
    const line = stripComment(raw);
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
    if (!inJobs) continue;
    if (/^[A-Za-z_#]/.test(line)) break; // left the jobs: block
    const job = line.match(/^  ([A-Za-z_][\w-]*):\s*$/);
    if (job) {
      if (currentJob && !jobNamed) names.push(currentJob);
      currentJob = job[1]; jobNamed = false; continue;
    }
    const nm = line.match(/^    name:\s*(.+)$/);
    if (nm && currentJob && !jobNamed) {
      const val = nm[1].trim().replace(/^["']|["']$/g, '');
      if (!val.includes('${{')) { names.push(val); jobNamed = true; }
    }
  }
  if (currentJob && !jobNamed) names.push(currentJob);
  for (const n of names) if (!checkNames.has(n)) checkNames.set(n, wf);
  const req = names.filter((n) => contexts.includes(n));
  if (req.length) wfRequiredJobs.set(wf, req);
}

/* 3. Every required context resolves to a real check name. */
for (const ctx of contexts) {
  check(`required context "${ctx}" matches a workflow job's check name`, checkNames.has(ctx));
}

/* 4. Every workflow carrying a required job: pull_request trigger present and
   NOT path-filtered. Only the pull_request sub-block is inspected — push may
   keep its paths filter (nothing gates on push). */
for (const [wf, req] of wfRequiredJobs) {
  const lines = readFileSync(join(wfDir, wf), 'utf8').split('\n');
  // slice the top-level `on:` block
  const onStart = lines.findIndex((l) => /^(on|"on"|'on'):\s*$/.test(stripComment(l)));
  check(`${wf} (required: ${req.join(', ')}) has an on: block`, onStart !== -1);
  if (onStart === -1) continue;
  let onEnd = lines.length;
  for (let i = onStart + 1; i < lines.length; i++) {
    if (/^[A-Za-z_'"]/.test(stripComment(lines[i]))) { onEnd = i; break; }
  }
  const onBlock = lines.slice(onStart + 1, onEnd).map(stripComment);
  const prIdx = onBlock.findIndex((l) => /^  pull_request:\s*$/.test(l));
  check(`${wf} triggers on pull_request`, prIdx !== -1);
  if (prIdx === -1) continue;
  // pull_request sub-block: lines indented deeper than 2 spaces until next 2-space key
  const sub = [];
  for (let i = prIdx + 1; i < onBlock.length; i++) {
    if (/^  \S/.test(onBlock[i])) break;
    sub.push(onBlock[i]);
  }
  const pathFiltered = sub.some((l) => /^\s+(paths|paths-ignore):/.test(l));
  check(`${wf} pull_request trigger is NOT path-filtered (required checks must report on every PR)`, !pathFiltered);
}

/* 5. RELEASE GATING — every workflow that creates a GitHub release must run
   inside the protected `release` environment, so the required-reviewer gate
   (configured in Settings → Environments, hardening runbook §4) binds every
   release path. auto-release.yml declared it; release.yml did not, leaving a
   dispatch path that could mint a tag + release + provenance with no
   environment gate at all. */
for (const wf of workflows) {
  const body = readFileSync(join(wfDir, wf), 'utf8');
  if (body.includes('gh release create')) {
    check(`${wf} creates releases inside the protected release environment`,
      /^\s{4}environment:\s*release\s*$/m.test(body.split('\n').map(stripComment).join('\n')));
  }
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
