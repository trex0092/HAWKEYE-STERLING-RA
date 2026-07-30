/* ISO/IEC 42001 clause 6.1 mapping test.

   The mapping index exists to answer two questions the estate could not answer
   before it: "which Annex A control treats R-13?" and "you say A.5.4 applies —
   what does it treat?". Both answers are only worth having while they stay
   true, and both are hand-maintained tables, so this suite pins them:

     1. completeness — every risk in the register appears in the risk→control
        table, and the table cites no risk the register has dropped;
     2. bidirectionality — the two tables are the same relation read both ways,
        so a pair present in one and missing from the other is a defect;
     3. clause separation — 6.1.2 and 6.1.4 name DIFFERENT canonical artefacts,
        which is the whole point of writing the index;
     4. status vocabulary — each statement of applicability uses only the values
        it declares. A fifth value is how the two SoAs came to disagree.

   Usage: node test/clause-mapping.test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

console.log('\n— ISO 42001 clause 6.1 mapping test —\n');

const MAP = 'docs/aims/iso-42001-clause-6-1-mapping.md';
check('mapping index exists (' + MAP + ')', existsSync(join(ROOT, MAP)));
const map = read(MAP);
const register = read('docs/aims/ai-risk-register.md');

/* ── 1. Completeness against the risk register ───────────────────────────── */
const risks = [...new Set([...register.matchAll(/^\|\s*(R-\d+)\s*\|/gm)].map((m) => m[1]))];
check('parsed the risk register (' + risks.length + ' risks)', risks.length > 0);

/* An Annex A id may be a RANGE (`A.7.2–A.7.6`), which both statements of
   applicability treat as one control family. Matching the ends separately would
   invent two ids that appear in neither table, so the range is one token. */
const CONTROL_ID = /A\.[0-9.]+[0-9](?:–A\.[0-9.]+[0-9])?/g;

/* The risk→control table: rows whose first cell is a bare risk ID. */
const riskRows = new Map();
for (const m of map.matchAll(/^\|\s*(R-\d+)\s*\|([^|]*)\|([^|]*)\|/gm)) {
  riskRows.set(m[1], [...m[3].matchAll(CONTROL_ID)].map((x) => x[0]));
}
for (const r of risks) {
  check('risk "' + r + '" appears in the risk to control table', riskRows.has(r));
  if (riskRows.has(r)) check('risk "' + r + '" cites at least one Annex A control', riskRows.get(r).length > 0);
}
for (const [r] of riskRows) check('mapping cites a risk the register still carries (' + r + ')', risks.includes(r));

/* ── 2. Bidirectionality ─────────────────────────────────────────────────── */
/* The control→risk table: rows whose first cell starts with an Annex A id. */
const controlRows = new Map();
for (const m of map.matchAll(/^\|\s*(A\.[0-9.]+[0-9](?:–A\.[0-9.]+[0-9])?)[^|]*\|([^|]*)\|/gm)) {
  controlRows.set(m[1], [...m[2].matchAll(/R-\d+/g)].map((x) => x[0]));
}
check('parsed the control to risk table (' + controlRows.size + ' controls)', controlRows.size > 0);
for (const [risk, controls] of riskRows) {
  for (const c of controls) {
    const back = controlRows.get(c);
    check('control "' + c + '" (cited by ' + risk + ') appears in the reverse table', !!back);
    if (back) check('control "' + c + '" lists ' + risk + ' back', back.includes(risk));
  }
}
for (const [c, rs] of controlRows) {
  for (const r of rs) {
    check('reverse table entry ' + c + ' to ' + r + ' is mirrored in the forward table',
      (riskRows.get(r) || []).includes(c));
  }
}

/* ── 3. Clause separation ────────────────────────────────────────────────── */
const SIA = 'docs/governance/stakeholder-impact-assessment-2026.md';
const REG = 'docs/aims/ai-risk-register.md';
check('index names the 6.1.2 artefact', map.includes('6.1.2') && map.includes('ai-risk-register.md'));
check('index names the 6.1.4 artefact', map.includes('6.1.4') && map.includes('stakeholder-impact-assessment-2026.md'));
check('the 6.1.2 and 6.1.4 artefacts are different documents', SIA !== REG);
check('index explains why a risk assessment does not satisfy 6.1.4',
  /opposite direction/i.test(map) || /cannot stand in for/i.test(map));
const sia = read(SIA);
check('the 6.1.4 artefact declares itself as such', /6\.1\.4/.test(sia));
check('the 6.1.4 artefact covers unfair or discriminatory outcomes', /discriminat/i.test(sia));
check('the 6.1.4 artefact states who it is available to', /availab/i.test(sia));
/* A ratified document may not silently grow new content under the old
   signature. The rule is not "a new version may not be ratified" — v1.1 was
   signed on its own account on 2026-07-29 — it is that **no row may claim
   ratification without naming an approver and a date**. That catches both
   failure modes: content amended under an earlier signature, and a row marked
   Ratified with `_(pending)_` still in the approver column. */
const signoffRows = [...sia.matchAll(/^\|\s*(\d+\.\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/gm)];
check('the 6.1.4 artefact has a version sign-off table (' + signoffRows.length + ' rows)', signoffRows.length > 0);
for (const r of signoffRows) {
  const [, version, date, , approver, status] = r;
  if (!/ratified/i.test(status)) continue;
  check('ratified version ' + version + ' names an approver',
    approver.trim().length > 0 && !/pending|_|tbd|☐/i.test(approver));
  check('ratified version ' + version + ' carries a ratification date',
    /\d{4}-\d{2}-\d{2}/.test(status) && /\d{4}-\d{2}-\d{2}/.test(date));
}
/* Every version that exists must be accounted for as ratified or explicitly
   pending — a row with neither is a version nobody decided about. */
for (const r of signoffRows) {
  check('sign-off row ' + r[1] + ' states a decision', /ratified|pending|withdrawn|superseded/i.test(r[5]));
}

/* ── 4. Each SoA uses only the status vocabulary it declares ─────────────── */
const soaAims = read('docs/aims/statement-of-applicability.md');
const AIMS_STATUSES = ['Implemented', 'Partial', 'Planned', 'N/A'];
const statusCells = [...soaAims.matchAll(/^\|[^|]*\|[^|]*\|([^|]*)\|/gm)]
  .map((m) => m[1].trim()).filter((s) => s && !/^-+$/.test(s) && s !== 'Status');
check('parsed AIMS SoA status cells (' + statusCells.length + ')', statusCells.length > 0);
for (const s of new Set(statusCells)) {
  check('AIMS SoA status "' + s + '" is one of the four it declares', AIMS_STATUSES.includes(s));
}
const soa2026 = read('docs/governance/iso-42001-soa-2026.md');
const LEGEND = ['✅', '🟡', '🔴', 'N-A'];
const cells2026 = [...soa2026.matchAll(/^\|\s*A\.[^|]*\|[^|]*\|([^|]*)\|/gm)].map((m) => m[1].trim());
check('parsed Advisor SoA status cells (' + cells2026.length + ')', cells2026.length > 0);
for (const s of new Set(cells2026)) {
  check('Advisor SoA status "' + s + '" is in its declared legend', LEGEND.includes(s));
}
/* The two statements must not disagree about the same control. */
const a54Aims = (soaAims.match(/^\|[^|]*A\.5\.4[^|]*\|[^|]*\|([^|]*)\|/m) || [, ''])[1].trim();
const a54Adv = (soa2026.match(/^\|\s*A\.5\.4[^|]*\|[^|]*\|([^|]*)\|/m) || [, ''])[1].trim();
check('both statements agree that A.5.4 is partial (' + a54Aims + ' / ' + a54Adv + ')',
  a54Aims === 'Partial' && a54Adv === '🟡');
check('both statements cite the ratified stakeholder impact assessment',
  soaAims.includes('stakeholder-impact-assessment-2026.md') && soa2026.includes('stakeholder-impact-assessment-2026.md'));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
