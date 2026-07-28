/* Prompt register test — change control over the instruction sets.

   data/ai-assets.json says WHICH LLM surfaces exist; data/prompt-assets.json
   says WHAT each one is told to do, and pins that text to a SHA-256. This suite
   is the enforcement half:

     1. schema — every row keeps an owner-visible purpose, guards, assurance,
        a version and an approval record;
     2. fingerprints — the recorded hash still matches the source region, so a
        prompt edit cannot reach production without re-approving the row;
     3. coverage — every model-API caller has at least one registered prompt
        (the anti-shadow-prompt control), in both directions against the asset
        register.

   Content assertions on the charter itself live in test/advisor-assurance.test.js;
   this suite governs change, not wording.

   Usage: node test/prompt-register.test.mjs */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { auditRegister, loadRegister } from '../scripts/prompt-register.mjs';
import { SCANNERS } from '../scripts/grc-metrics.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const abs = (rel) => join(ROOT, rel);

console.log('\n— Prompt register test —\n');

let reg;
try { reg = loadRegister(ROOT); }
catch (e) { console.log('FAIL  data/prompt-assets.json parses (' + e.message + ')'); process.exit(1); }

/* ── 1. Schema ──────────────────────────────────────────────────────────── */
check('register has a prompts array', Array.isArray(reg.prompts) && reg.prompts.length > 0);
check('register declares an owner role', !!reg.owner_role);
check('register declares a review cadence', !!reg.review_cadence);
check('register has a shadow-prompt note (the anti-shadow-prompt control)', !!reg.shadow_prompt_note);
check('register names a change-control document that exists',
  !!reg.change_control && existsSync(abs(reg.change_control)));
// Shape only — currency is a governance-report concern, never a time-bomb test.
check('register last_reviewed is a parseable date', Number.isFinite(Date.parse(reg.last_reviewed || '')));

const ROLES = ['system', 'system-fragment-set', 'user-template'];
const REQUIRED = ['id', 'name', 'serves_asset', 'role', 'surface_file', 'symbol', 'region',
  'purpose', 'risk_if_changed_unreviewed', 'guards', 'assurance', 'version', 'sha256',
  'approved_on', 'approved_by'];

const seen = new Set();
for (const [i, p] of reg.prompts.entries()) {
  const tag = p.id || ('#' + i);
  for (const f of REQUIRED) {
    check('prompt "' + tag + '" has "' + f + '"', p[f] !== undefined && p[f] !== null && String(p[f]).length > 0);
  }
  check('prompt "' + tag + '" id is unique', !seen.has(p.id));
  seen.add(p.id);
  check('prompt "' + tag + '" has a known role (' + p.role + ')', ROLES.includes(p.role));
  check('prompt "' + tag + '" surface_file exists (' + p.surface_file + ')', existsSync(abs(p.surface_file)));
  check('prompt "' + tag + '" version is a positive integer', Number.isInteger(p.version) && p.version >= 1);
  check('prompt "' + tag + '" sha256 is a 64-char hex digest', /^[0-9a-f]{64}$/.test(String(p.sha256)));
  check('prompt "' + tag + '" approved_on is a parseable date', Number.isFinite(Date.parse(p.approved_on || '')));
  check('prompt "' + tag + '" names at least one guard', Array.isArray(p.guards) && p.guards.length > 0);
  check('prompt "' + tag + '" names at least one assurance control', Array.isArray(p.assurance) && p.assurance.length > 0);
  /* An assurance entry that looks like a repo path must resolve — a row citing a
     test that no longer exists is worse than a row citing none. */
  for (const a of (p.assurance || []).filter((s) => s.includes('/'))) {
    check('prompt "' + tag + '" assurance path exists (' + a + ')', existsSync(abs(a)));
  }
}

/* ── 2. Fingerprints ────────────────────────────────────────────────────── */
const audit = auditRegister(ROOT);
check('audit returned a row per registered prompt', audit.length === reg.prompts.length);
for (const r of audit) {
  const how = r.status === 'missing'
    ? ' — ' + r.reason + ' (re-anchor the region in data/prompt-assets.json)'
    : ' — the prompt changed; review the edit, then: node scripts/prompt-register.mjs --update';
  check('prompt "' + r.id + '" matches its approved fingerprint' + (r.status === 'ok' ? '' : how),
    r.status === 'ok');
}

/* ── 3. Coverage, both directions ───────────────────────────────────────── */
const assets = JSON.parse(readFileSync(abs('data/ai-assets.json'), 'utf8'));
const assetIds = new Set(assets.assets.map((a) => a.id));
for (const p of reg.prompts) {
  check('prompt "' + p.id + '" serves a registered AI asset (' + p.serves_asset + ')', assetIds.has(p.serves_asset));
}
const served = new Set(reg.prompts.map((p) => p.serves_asset));
for (const a of assets.assets) {
  check('AI asset "' + a.id + '" has at least one registered prompt', served.has(a.id));
}

/* Anti-shadow-prompt scan, mirroring the shadow-AI scan in test/ai-assets.test.js:
   a file that calls the model API is telling the model something, so it must
   appear as the surface_file of a registered prompt — unless it is an
   allowlisted eval harness, whose adversarial inputs are assurance controls
   over the prompts above rather than governed prompts of their own. */
const EVAL_HARNESSES = new Set(['scripts/advisor-eval.mjs', 'scripts/advisor-bias-eval.mjs']);
const SCAN_DIRS = ['', 'scripts', 'netlify/functions'];
const callers = [];
for (const d of SCAN_DIRS) {
  for (const f of readdirSync(abs(d) || ROOT)) {
    if (!/\.(js|mjs|py)$/.test(f)) continue;
    const rel = d ? d + '/' + f : f;
    if (SCANNERS.has(rel)) continue;   // scans for the host string; never calls it
    if (!statSync(abs(rel)).isFile()) continue;
    if (readFileSync(abs(rel), 'utf8').includes('api.anthropic.com')) callers.push(rel);
  }
}
check('shadow-prompt scan found the known model-API callers', callers.length >= 3);
const surfaces = new Set(reg.prompts.map((p) => p.surface_file));
for (const f of callers) {
  check('model-API caller "' + f + '" has a registered prompt or is an allowlisted eval harness',
    surfaces.has(f) || EVAL_HARNESSES.has(f));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
