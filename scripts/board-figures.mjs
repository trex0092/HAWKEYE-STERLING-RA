/* Board figures — generated from the repository, never hand-maintained.

   Board material (executive docs, the periodic report pack) quotes estate
   figures: how many assurance workflows exist, how many governance documents,
   how the runner egress posture splits between enforced block and observe-only
   audit. Hand-maintained copies of those numbers drifted within a day of a
   normal merge (workflow count 45 to 46, doc count 84 to 87, egress split
   changed by one hardening PR). This script computes the canonical figures
   from HEAD; data/board-figures.json is the committed snapshot and
   test/board-figures.test.mjs fails CI whenever the snapshot drifts from the
   live estate, so a quoted figure is always traceable to a commit.

   Usage:
     node scripts/board-figures.mjs           # print the computed figures
     node scripts/board-figures.mjs --write   # refresh data/board-figures.json
     node scripts/board-figures.mjs --check   # exit 1 if the committed file drifted */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

export const FIGURES_FILE = 'data/board-figures.json';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Count workflow definition files. */
export function countWorkflows(root = ROOT) {
  return readdirSync(join(root, '.github', 'workflows')).filter(f => /\.ya?ml$/.test(f)).length;
}

/* Count *.md files under docs/, recursively. */
export function countDocs(root = ROOT, rel = 'docs') {
  let n = 0;
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (e.isDirectory()) n += countDocs(root, join(rel, e.name));
    else if (e.name.endsWith('.md')) n++;
  }
  return n;
}

/* Count *.md files in the auto-generated research folder (excluded from the
   curated documentation figure). */
export function countAutoDocs(root = ROOT) {
  return readdirSync(join(root, 'docs', 'research', 'auto')).filter(f => f.endsWith('.md')).length;
}

/* Egress posture split: harden-runner steps declaring egress-policy block vs
   audit, summed across every workflow file (a workflow may run several jobs,
   each with its own harden-runner step, so this is a per-job figure). */
export function egressSplit(root = ROOT) {
  const dir = join(root, '.github', 'workflows');
  let block = 0, audit = 0;
  for (const f of readdirSync(dir).filter(x => /\.ya?ml$/.test(x))) {
    const body = readFileSync(join(dir, f), 'utf8');
    block += (body.match(/egress-policy:\s*block/g) || []).length;
    audit += (body.match(/egress-policy:\s*audit/g) || []).length;
  }
  return { block, audit };
}

export function buildFigures(root = ROOT) {
  const docsTotal = countDocs(root);
  const egress = egressSplit(root);
  return {
    workflows: countWorkflows(root),
    docsTotal,
    docsCurated: docsTotal - countAutoDocs(root),
    egressBlock: egress.block,
    egressAudit: egress.audit,
  };
}

export function buildFile(root = ROOT) {
  return {
    _README: 'Canonical board/report figures generated from the repository by scripts/board-figures.mjs. Never hand-edit: run `node scripts/board-figures.mjs --write` to refresh. test/board-figures.test.mjs fails CI whenever the committed figures drift from the live estate, so any figure quoted in board material traces to a commit instead of a hand count.',
    figures: buildFigures(root),
    definitions: {
      workflows: 'count of .github/workflows/*.yml|yaml files',
      docsTotal: 'count of *.md files under docs/ (recursive)',
      docsCurated: 'docsTotal excluding the auto-generated docs/research/auto/',
      egressBlock: 'harden-runner steps with egress-policy: block, summed across all workflows (per job)',
      egressAudit: 'harden-runner steps with egress-policy: audit, summed across all workflows (per job)',
    },
  };
}

function main() {
  const mode = process.argv[2] || '';
  const fresh = buildFile();
  if (mode === '--write') {
    writeFileSync(join(ROOT, FIGURES_FILE), JSON.stringify(fresh, null, 2) + '\n');
    console.log('wrote ' + FIGURES_FILE + ': ' + JSON.stringify(fresh.figures));
    return;
  }
  console.log(JSON.stringify(fresh.figures, null, 2));
  if (mode === '--check') {
    const committed = JSON.parse(readFileSync(join(ROOT, FIGURES_FILE), 'utf8'));
    const drift = JSON.stringify(committed.figures) !== JSON.stringify(fresh.figures);
    if (drift) {
      console.error('DRIFT: committed ' + JSON.stringify(committed.figures)
        + ' vs live ' + JSON.stringify(fresh.figures)
        + ' — run `node scripts/board-figures.mjs --write` and commit.');
      process.exitCode = 1;
    } else {
      console.log('board figures match the live estate.');
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
