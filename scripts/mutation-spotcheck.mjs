/* Dependency-free mutation spot-check for the regulated scoring golden set.
 *
 * Each mutant changes one material decision rule in app.js, then executes the
 * existing golden test in an isolated temporary tree. A mutant is "killed"
 * only when the golden test becomes non-zero. This is intentionally a small
 * report-only spot-check, not a replacement for a full mutation framework.
 *
 * Usage:
 *   node scripts/mutation-spotcheck.mjs [--json path]
 */
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// nosemgrep: hawkeye-no-child-process
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(ROOT, 'app.js'), 'utf8');
const temp = mkdtempSync(join(tmpdir(), 'hs-mutation-'));

function runWith(source) {
  const root = join(temp, 'case');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'test'), { recursive: true });
  writeFileSync(join(root, 'app.js'), source);
  cpSync(join(ROOT, 'index.html'), join(root, 'index.html'));
  cpSync(join(ROOT, 'test', 'scoring-golden.test.js'), join(root, 'test', 'scoring-golden.test.js'));
  return spawnSync(process.execPath, [join('test', 'scoring-golden.test.js')], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
}

const baseline = runWith(app);
if (baseline.status !== 0) {
  process.stderr.write(baseline.stdout || '');
  process.stderr.write(baseline.stderr || '');
  console.error('mutation-spotcheck: baseline golden test is not green; refusing to score mutants');
  rmSync(temp, { recursive: true, force: true });
  process.exit(2);
}

const mutants = [
  {
    id: 'band-cdd-upper-bound',
    from: "const numericBand = total<=19 ? 'CDD' : total<=22 ? 'SDD' : 'EDD';",
    to: "const numericBand = total<=18 ? 'CDD' : total<=22 ? 'SDD' : 'EDD';",
  },
  {
    id: 'band-sdd-upper-bound',
    from: "const numericBand = total<=19 ? 'CDD' : total<=22 ? 'SDD' : 'EDD';",
    to: "const numericBand = total<=19 ? 'CDD' : total<=23 ? 'SDD' : 'EDD';",
  },
  {
    id: 'disable-prohibited-floor',
    from: "if(q.prohibit && s.questions[q.id]==='Yes') escalations.push({level:'prohibit', reason:q.short});",
    to: "if(false && q.prohibit && s.questions[q.id]==='Yes') escalations.push({level:'prohibit', reason:q.short});",
  },
  {
    id: 'disable-edd-floor',
    from: "if(q.eddTrigger && s.questions[q.id]==='Yes') escalations.push({level:'edd', reason:q.short+' (FATF R.12)'});",
    to: "if(false && q.eddTrigger && s.questions[q.id]==='Yes') escalations.push({level:'edd', reason:q.short+' (FATF R.12)'});",
  },
  {
    id: 'reverse-analyst-override-ratchet',
    from: "RANK[ao.band] > RANK[engineOutcome]",
    to: "RANK[ao.band] < RANK[engineOutcome]",
  },
];

const results = [];
for (const m of mutants) {
  if (!app.includes(m.from)) {
    results.push({ id: m.id, killed: false, infrastructure_error: 'mutation target not found' });
    continue;
  }
  const mutated = app.replace(m.from, m.to);
  const r = runWith(mutated);
  results.push({ id: m.id, killed: r.status !== 0, exit_code: r.status });
}

rmSync(temp, { recursive: true, force: true });
const killed = results.filter(r => r.killed).length;
const rate = results.length ? Math.round((killed / results.length) * 1000) / 10 : 0;
const summary = {
  generated_at: new Date().toISOString(),
  suite: 'test/scoring-golden.test.js',
  mutants: results.length,
  killed,
  survived: results.length - killed,
  kill_rate_percent: rate,
  results,
};
console.log(JSON.stringify(summary, null, 2));

const i = process.argv.indexOf('--json');
if (i !== -1 && process.argv[i + 1]) writeFileSync(resolve(process.argv[i + 1]), JSON.stringify(summary, null, 2) + '\n');
process.exit(results.some(r => r.infrastructure_error) ? 2 : 0);
