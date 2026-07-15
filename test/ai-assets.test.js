/* AI asset register schema test — Layer 1 (AI Discovery & Inventory).
   Fails CI if data/ai-assets.json drifts out of shape, so the register cannot
   silently rot: every inventoried AI surface must keep an owner, a valid risk
   tier, an EU AI Act class, named controls, and a status.

   Usage: node test/ai-assets.test.js */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— AI asset register schema test —\n');

const file = path.join(__dirname, '..', 'data', 'ai-assets.json');
let reg;
try { reg = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.log('FAIL  data/ai-assets.json parses (' + e.message + ')'); console.log('\n0 passed, 1 failed\n'); process.exit(1); }

check('register parses and has an assets array', Array.isArray(reg.assets) && reg.assets.length > 0);
check('register declares an owner role', !!reg.owner_role);
check('register has a shadow-AI note (the anti-shadow-AI control)', !!reg.shadow_ai_note);

const TIERS = ['LOW', 'MEDIUM', 'HIGH'];
const REQUIRED = ['id', 'name', 'classification', 'surface_file', 'provider',
  'risk_tier', 'risk_tier_rationale', 'eu_ai_act_class', 'human_oversight', 'controls', 'status'];

const seen = new Set();
reg.assets.forEach((a, i) => {
  const tag = a.id || ('#' + i);
  REQUIRED.forEach(f => check('asset "' + tag + '" has "' + f + '"',
    a[f] !== undefined && a[f] !== null && String(a[f]).length > 0));
  check('asset "' + tag + '" has a valid risk_tier', TIERS.includes(a.risk_tier));
  check('asset "' + tag + '" lists at least one control', Array.isArray(a.controls) && a.controls.length > 0);
  check('asset "' + tag + '" id is unique', !seen.has(a.id));
  seen.add(a.id);
});

/* ── Register ⇄ code cross-checks ─────────────────────────────────────────
   These are the drift guards that were missing when the register said
   "personas": 14 while brain-soul.js defined 16, and while ai.py (the LLM
   adverse-media triage surface) was not registered at all. */

// Every registered surface file must exist on disk.
reg.assets.forEach(a => {
  check('asset "' + a.id + '" surface_file exists on disk (' + a.surface_file + ')',
    fs.existsSync(path.join(__dirname, '..', a.surface_file)));
});

// The advisor's persona count must equal the persona definitions in code:
// brain-soul.js PERSONA_SUFFIX (server) and advisor.js PERSONAS (UI) — the
// two lists the code itself says must stay aligned.
const advisor = reg.assets.find(a => a.id === 'advisor');
check('register contains the advisor asset', !!advisor);
if (advisor) {
  const soul = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'brain-soul.js'), 'utf8');
  const suffixBlock = (soul.match(/const PERSONA_SUFFIX = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const suffixCount = (suffixBlock.match(/^  [a-z_]+:/gm) || []).length;
  check('brain-soul.js PERSONA_SUFFIX parsed (found ' + suffixCount + ' personas)', suffixCount > 0);
  check('register persona count matches brain-soul.js PERSONA_SUFFIX (' + advisor.personas + ' vs ' + suffixCount + ')',
    advisor.personas === suffixCount);

  const advisorSrc = fs.readFileSync(path.join(__dirname, '..', 'advisor.js'), 'utf8');
  const personasBlock = (advisorSrc.match(/const PERSONAS = \[([\s\S]*?)\n\];/) || [])[1] || '';
  const uiCount = (personasBlock.match(/\{id:'/g) || []).length;
  check('advisor.js PERSONAS parsed (found ' + uiCount + ' personas)', uiCount > 0);
  check('register persona count matches advisor.js PERSONAS (' + advisor.personas + ' vs ' + uiCount + ')',
    advisor.personas === uiCount);
}

// Shadow-AI scan: every file that calls the model API endpoint must be a
// registered surface, or an allowlisted eval harness (an assurance control
// over a registered surface, documented in the advisor asset's controls).
const EVAL_HARNESSES = new Set(['scripts/advisor-eval.mjs', 'scripts/advisor-bias-eval.mjs']);
const SCAN_DIRS = ['', 'scripts', 'netlify/functions'];
const apiCallers = [];
for (const d of SCAN_DIRS) {
  const abs = path.join(__dirname, '..', d);
  for (const f of fs.readdirSync(abs)) {
    if (!/\.(js|mjs|py)$/.test(f)) continue;
    const rel = d ? d + '/' + f : f;
    const full = path.join(abs, f);
    if (!fs.statSync(full).isFile()) continue;
    if (fs.readFileSync(full, 'utf8').includes('api.anthropic.com')) apiCallers.push(rel);
  }
}
check('shadow-AI scan found the known model-API callers', apiCallers.length >= 3);
const surfaces = new Set(reg.assets.map(a => a.surface_file));
for (const f of apiCallers) {
  check('model-API caller "' + f + '" is a registered surface or an allowlisted eval harness',
    surfaces.has(f) || EVAL_HARNESSES.has(f));
}
check('the LLM triage surface (ai.py) is registered', surfaces.has('ai.py'));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
