/* Legal-citation guard: the FDL 10/2025 migration must stay complete.

   UAE Federal Decree-Law No. (20) of 2018 was repealed by FDL 10/2025, and
   Cabinet Decision No. (10) of 2019 (the old Implementing Regulation) was
   superseded by Cabinet Resolution No. (134) of 2025 (see
   docs/research/uae-aml-legal-framework.md). After the citation migration,
   three OPERATIVE references to the repealed instruments survived: the
   adverse-media report's regulatory-basis line (screen.py), the Advisor's
   cited-answer basis list (advisor.js), and the governance framework doc
   (docs/AI-GOVERNANCE.md). This guard keeps that from recurring: on the
   scanned surfaces a repealed instrument may appear ONLY on a line that marks
   it as repealed/superseded (historical context); citing it as an operative
   basis fails CI.

   assets/super-data.js (the Super Tools Q&A catalogue) is deliberately NOT
   scanned yet: it cites the old Implementing Regulation at article level in
   many answers, and mapping each article to Cabinet Resolution 134/2025 needs
   MLRO/counsel verification first. That content migration is tracked as its
   own register item; add the file to SCAN once migrated.
   Usage: node test/legal-citations.test.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

console.log('\n— legal-citation guard (repealed instruments never cited as operative) —\n');

/* Engine, Advisor and framework surfaces covered by the migration. */
const SCAN = [
  'screen.py', 'ai.py', 'kyc.py', 'monitoring.py', 'agents.py', 'txn_monitor.py',
  'advisor.js', 'console.js', 'app.js', 'i18n.js',
  'netlify/functions/brain-soul.js',
  'docs/AI-GOVERNANCE.md',
];

/* The repealed instruments. */
const REPEALED = /No\.?\s*\(?20\)?\s+of\s+2018|20\/2018|No\.?\s*\(?10\)?\s+of\s+2019|10\/2019/;
/* A line may reference them only in historical context. */
const HISTORICAL = /repeal|supersed|formerly|replac/i;

const violations = [];
for (const rel of SCAN) {
  const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (REPEALED.test(line) && !HISTORICAL.test(line)) {
      violations.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 120));
    }
  });
}
check('no operative reference to a repealed instrument on the scanned surfaces', violations.length === 0);
for (const v of violations) console.log('     VIOLATION  ' + v);

/* And the current instruments must actually be cited where the old ones were. */
check('screen.py cites Cabinet Resolution 134/2025 for ongoing monitoring',
  readFileSync(join(ROOT, 'screen.py'), 'utf8').includes('Cabinet Resolution 134/2025'));
check('advisor.js basis cites Cabinet Resolution No. (134) of 2025',
  readFileSync(join(ROOT, 'advisor.js'), 'utf8').includes('Cabinet Resolution No. (134) of 2025'));
const gov = readFileSync(join(ROOT, 'docs/AI-GOVERNANCE.md'), 'utf8');
check('AI-GOVERNANCE.md regulatory basis cites FDL 10/2025 and Cabinet Resolution 134/2025',
  gov.includes('Decree-Law No. 10 of 2025') && gov.includes('Cabinet Resolution 134/2025'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
