/* Board-figure drift guard. Hand-maintained board figures drifted within a
   day (workflow count 45 to 46, doc count 84 to 87, egress split changed by
   one merge). data/board-figures.json is the canonical committed snapshot;
   this test recomputes every figure from the live repository and fails on any
   difference, which is exactly the check that would have caught the drift.
   Usage: node test/board-figures.test.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildFigures, countWorkflows, countDocs, countAutoDocs, egressSplit, FIGURES_FILE } from '../scripts/board-figures.mjs';
import { issuingCountry, screenedSources } from '../scripts/coverage-figures.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

console.log('\n— board-figure drift guard —\n');

// Counter sanity on the live repo.
check('counts workflows (> 20 expected in this estate)', countWorkflows() > 20);
check('counts docs recursively (> 50 expected)', countDocs() > 50);
check('auto docs are a strict subset of total docs', countAutoDocs() > 0 && countAutoDocs() < countDocs());
const eg = egressSplit();
check('egress split finds both postures', eg.block > 0 && eg.audit > 0);

// The drift guard proper: committed snapshot === live estate, field by field.
const committed = JSON.parse(readFileSync(join(ROOT, FIGURES_FILE), 'utf8'));
check('committed file documents itself and its definitions', !!committed._README && !!committed.definitions);
const live = buildFigures();
for (const [k, v] of Object.entries(live)) {
  check(`figure "${k}" matches the live estate (committed ${committed.figures && committed.figures[k]} vs live ${v})`,
    !!committed.figures && committed.figures[k] === v);
}
for (const k of Object.keys(committed.figures || {})) {
  check(`committed figure "${k}" is still a computed figure`, k in live);
}

/* Coverage figures (the README sanctions-jurisdictions badge). "jurisdiction:
   Global" in the source files is a list's REACH, not its issuer — counting only
   non-Global entries silently dropped Canada, France, Ukraine and the UK from
   the badge (36 shown vs 40 issuing countries screened). */
console.log('\n— coverage figures: sanctions issuing countries —\n');
check('a Global-reach national list counts its issuing country (Canada SEMA)',
  issuingCountry({ jurisdiction: 'Global', name: 'Canada — Consolidated Autonomous Sanctions (SEMA, XML)' }) === 'Canada');
check('US OFAC and the UK list map to their countries',
  issuingCountry({ jurisdiction: 'Global', name: 'US OFAC — SDN list (CSV)' }) === 'United States'
  && issuingCountry({ jurisdiction: 'Global', name: 'UK Sanctions List — FCDO/OFSI consolidated targets (CSV)' }) === 'United Kingdom');
check('UN, EU and development-bank lists are supranational, never a country',
  [['UN Security Council — Consolidated list (XML)', 'Global'], ['EU — Consolidated financial sanctions list (CSV)', 'Global'],
   ['ADB — Published Debarment & Suspension Register', 'Global (MDB)'],
   ['Inter-American Development Bank: Sanctioned Firms & Individuals', 'Global (Latin America/Caribbean-focused)']]
    .every(([name, jurisdiction]) => issuingCountry({ name, jurisdiction }) === null));
check('a national jurisdiction field is used as-is',
  issuingCountry({ jurisdiction: 'Brazil', name: 'Brazil — BCB Disqualified Persons' }) === 'Brazil');
{
  const live = new Set(screenedSources().map(issuingCountry).filter(Boolean));
  check('the live screened set counts Canada, France, Ukraine and the UK as issuers',
    ['Canada', 'France', 'Ukraine', 'United Kingdom', 'United States'].every(c => live.has(c)));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
