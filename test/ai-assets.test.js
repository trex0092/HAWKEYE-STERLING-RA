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
check('register declares a review cadence', !!reg.review_cadence);
// Shape only — currency (quarterly, 100-day window) is enforced daily by the
// governance report's register-review row, never by CI (no time-bomb tests).
check('register last_reviewed is a parseable date',
  Number.isFinite(Date.parse(reg.last_reviewed || '')));

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
/* Files whose job is to SCAN for model-API callers necessarily contain the host
   string they look for, and call nothing. Kept in step with the exported
   SCANNERS set in scripts/grc-metrics.mjs — this suite is CommonJS and cannot
   import that ESM module synchronously, so test/grc-metrics.test.mjs asserts
   the two lists are identical. */
const SCANNERS = new Set(['scripts/grc-metrics.mjs']);
const SCAN_DIRS = ['', 'scripts', 'netlify/functions'];
const apiCallers = [];
for (const d of SCAN_DIRS) {
  const abs = path.join(__dirname, '..', d);
  for (const f of fs.readdirSync(abs)) {
    if (!/\.(js|mjs|py)$/.test(f)) continue;
    const rel = d ? d + '/' + f : f;
    if (SCANNERS.has(rel)) continue;
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

/* ── 12-framework adoption and threat-model evidence selection ──────────
   A comparison infographic is NOT an instruction to install nine new runtime
   frameworks. Keep the explicit decisions, real code/test references and open
   operational gaps in CI so the owner can review adoption intentionally. */
let selection;
try {
  selection = JSON.parse(fs.readFileSync(path.join(__dirname, '..',
    'data', 'ai-framework-selection.json'), 'utf8'));
} catch (err) {
  check('AI framework decision register parses', false);
}
if (selection) {
  check('AI framework selection has a versioned schema and human control owner',
    selection.schema === 'hawkeye.ai-framework-selection/v1' &&
    /MLRO/.test(selection.owner || '') &&
    Number.isFinite(Date.parse(selection.as_of || '')));
  const expected = new Set([
    'langgraph', 'crewai', 'microsoft-agent-framework', 'haystack',
    'faiss', 'vllm', 'ollama', 'chroma', 'pinecone-qdrant-weaviate',
    'mitre-atlas', 'owasp-llm-top10', 'mitre-attack'
  ]);
  const frameworks = selection.frameworks || [];
  const found = new Set(frameworks.map(x => x.id));
  check('all twelve items assessed with no duplicates, none silently omitted',
    frameworks.length === 12 && found.size === 12 &&
    [...expected].every(id => found.has(id)));
  const docs = fs.readFileSync(path.join(__dirname, '..', 'docs',
    'governance', 'ai-stack-selection-2026.md'), 'utf8');
  const checkPath = (value) => typeof value === 'string' &&
    value.length > 0 && !path.isAbsolute(value) &&
    !value.split('/').includes('..') &&
    !/^netlify\b/i.test(value) &&
    fs.existsSync(path.join(__dirname, '..', value));
  for (const [i, f] of frameworks.entries()) {
    check('framework ' + f.id + ' has a justified decision and future adoption gate',
      typeof f.rationale === 'string' && f.rationale.length >= 65 &&
      typeof f.adoption_gate === 'string' && f.adoption_gate.length >= 35 &&
      ['deferred', 'reference-control'].includes(f.decision));
    check('framework ' + f.id + ' references actual safe repository evidence',
      Array.isArray(f.evidence) && f.evidence.length > 0 &&
      f.evidence.every(checkPath));
    check('framework ' + f.id + ' has a matching numbered decision in the companion document',
      docs.includes('| ' + (i + 1) + ' | ' + f.name + ' |'));
  }
  check('non-security frameworks are deferred pending owner approval, no shadow AI deployment',
    frameworks.filter(x => x.decision === 'deferred').length === 9);
  check('only OWASP LLM, MITRE ATLAS and MITRE ATT&CK are adopted as security references',
    frameworks.filter(x => x.decision === 'reference-control')
      .map(x => x.id).sort().join(',') ===
      ['mitre-atlas', 'mitre-attack', 'owasp-llm-top10'].sort().join(','));
  const scenarios = selection.threat_scenarios || [];
  const unique = new Set(scenarios.map(x => x.id));
  check('AI threat model has unique, actionable security and runtime failure scenarios',
    scenarios.length >= 7 && unique.size === scenarios.length);
  for (const x of scenarios) {
    check('scenario ' + x.id + ' has mapped controls and real regression tests',
      found.has(x.framework) && checkPath(x.control) &&
      Array.isArray(x.tests) && x.tests.length > 0 &&
      x.tests.every(checkPath) &&
      ['repo-regression', 'open-operational-evidence'].includes(x.status) &&
      typeof x.remaining === 'string' && x.remaining.length >= 50);
  }
  check('source-outage failure remains explicitly OPEN instead of mislabeled healthy',
    scenarios.some(x => x.id === 'screening-operational-source-blackout' &&
      x.status === 'open-operational-evidence') &&
    /NOT_CERTIFIED/.test(selection.operational_status || '') &&
    /one subject had no verifiable adverse-media source response/.test(docs));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
