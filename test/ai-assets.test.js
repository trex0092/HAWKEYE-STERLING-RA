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

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
