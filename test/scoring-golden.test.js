/* Golden / regression tests for the Entity Risk Assessment scoring model
   (the regulated decision surface). Each case freezes a representative entity's
   inputs and the EXACT engine output — numeric total, numeric band, hard-outcome
   escalations and the one-way analyst-override ratchet. These values are the
   documented reference set in docs/governance/model-validation-2026.md; any
   change here is a change to firm-approved methodology and must carry MLRO
   sign-off (see that document).

   Runs app.js against a minimal DOM stub — no dependencies.
   Usage: node test/scoring-golden.test.js */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const appjs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

/* ── DOM stub (same technique as app.test.js) ── */
const els = {};
function makeEl() {
  const el = {
    style: {}, value: '', textContent: '', className: '', _inner: '',
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); },
      toggle(c){ this._s.has(c) ? this._s.delete(c) : this._s.add(c); }, contains(c){ return this._s.has(c); } },
    appendChild(){}, addEventListener(){}, click(){},
    setAttribute(k,v){ this['_a_'+k] = String(v); }, getAttribute(k){ const v = this['_a_'+k]; return v==null ? null : v; },
  };
  Object.defineProperty(el, 'innerHTML', { get(){ return this._inner; },
    set(v){ this._inner = v; for(const m of String(v).matchAll(/id="([^"]+)"/g)) register(m[1]); } });
  return el;
}
function register(id){ if(!els[id]) els[id] = makeEl(); return els[id]; }
for(const m of html.matchAll(/id="([^"]+)"/g)) register(m[1]);

global.document = { getElementById(id){ return els[id] || null; }, createElement(){ return makeEl(); }, addEventListener(){} };
global.window = { addEventListener(){} };
global.localStorage = { _m:{}, getItem(k){ return Object.prototype.hasOwnProperty.call(this._m,k)?this._m[k]:null; }, setItem(k,v){ this._m[k]=String(v); }, removeItem(k){ delete this._m[k]; } };
global.confirm = () => true;
global.alert = (m) => { throw new Error('alert called: '+m); };
global.Blob = class { constructor(parts){ this.parts = parts; } };
global.URL = { createObjectURL(){ return 'blob:test'; }, revokeObjectURL(){} };

(0, eval)(appjs + `
;globalThis.__app = {
  computeAssessment, defaultState,
  get state(){ return state; }, set state(v){ state = v; }
};`);
const A = globalThis.__app;

/* ── Tiny assert harness ── */
let pass = 0, fail = 0;
function check(name, cond){ if(cond){ pass++; console.log('  ok  '+name); } else { fail++; console.log('FAIL  '+name); } }
function eq(name, got, want){ check(name + ' = ' + JSON.stringify(want), got === want); }

/* Build a clean state, apply a per-case mutation, and compute. */
function run(mutate){
  const s = A.defaultState();
  if(mutate) mutate(s);
  A.state = s;
  return A.computeAssessment();
}
const hasLevel = (a, lvl) => a.escalations.some(e => e.level === lvl);

console.log('\n— Risk-scoring golden / regression set —\n');

/* G1 — Baseline: UK precious-metal trader, all defaults. The reference anchor. */
(() => {
  const a = run();
  eq('G1 baseline total', a.total, 19);
  eq('G1 baseline numeric band', a.numericBand, 'CDD');
  eq('G1 baseline outcome', a.outcome, 'CDD');
  check('G1 baseline has no escalations', a.escalations.length === 0 && a.prohibited === false);
})();

/* G2 — Numeric band boundaries (CDD 0–19 / SDD 20–22 / EDD 23+). */
(() => {
  const sdd = run(s => { s.profile.entityYears = 1; });          // 19 - 1 + 2 = 20
  eq('G2 one year operating → total', sdd.total, 20);
  eq('G2 → SDD band', sdd.numericBand, 'SDD');
  eq('G2 → SDD outcome (no hard outcome)', sdd.outcome, 'SDD');

  const edd = run(s => { s.profile.entityYears = 0; s.profile.relYears = 0; }); // 19 +2 +2 = 23
  eq('G2 new + greenfield → total', edd.total, 23);
  eq('G2 → EDD band by score alone', edd.numericBand, 'EDD');
  check('G2 EDD-by-score carries no hard-outcome escalation', edd.escalations.length === 0);
})();

/* G3 — PROHIBITED hard outcomes override the numeric score (do not onboard). */
(() => {
  for(const q of ['sanctions_person','sanctions_entity','tf','pf']){
    const a = run(s => { s.questions[q] = 'Yes'; });
    check('G3 '+q+' Yes → PROHIBITED', a.prohibited === true && a.engineOutcome === 'PROHIBITED' && a.outcome === 'PROHIBITED');
    check('G3 '+q+' raises a prohibit escalation', hasLevel(a, 'prohibit'));
  }
})();

/* G4 — Mandatory-EDD floor: PEP exposure escalates regardless of score. */
(() => {
  const a = run(s => { s.questions.pep = 'Yes'; });             // +2 → 21 (numeric SDD)
  eq('G4 PEP total', a.total, 21);
  eq('G4 PEP numeric band is SDD', a.numericBand, 'SDD');
  eq('G4 PEP floored to EDD', a.engineOutcome, 'EDD');
  check('G4 PEP raises an edd escalation', hasLevel(a, 'edd'));
})();

/* G5 — Mandatory-EDD floor: FATF call-for-action jurisdiction (Iran). */
(() => {
  const a = run(s => { s.entity.jurisdiction = 'Islamic Republic of Iran'; }); // score 3, cfa
  eq('G5 Iran total', a.total, 21);
  eq('G5 Iran numeric band is SDD', a.numericBand, 'SDD');
  eq('G5 Iran floored to EDD', a.engineOutcome, 'EDD');
  check('G5 Iran escalation cites call-for-action', a.escalations.some(e => /call-for-action/i.test(e.reason)));
})();

/* G6 — OECD Annex II red flag: artisanal (ASM) gold from a high-risk jurisdiction. */
(() => {
  const a = run(s => { s.entity.jurisdiction = 'Nigeria'; s.suppliers.mined[0] = 'ASM — Artisanal Mining'; });
  eq('G6 Nigeria + ASM total', a.total, 24);
  eq('G6 → EDD outcome', a.engineOutcome, 'EDD');
  check('G6 escalation cites ASM / artisanal', a.escalations.some(e => /ASM|artisanal/i.test(e.reason)));
})();

/* G7 — Analyst override is a one-way ratchet (may only raise diligence). */
(() => {
  const up = run(s => { s.override = { band: 'EDD', reason: 'MLRO judgement: opaque ownership', at: '2026-01-01' }; });
  eq('G7 override engine outcome stays CDD', up.engineOutcome, 'CDD');
  eq('G7 override raises operative outcome to EDD', up.outcome, 'EDD');
  check('G7 override marks the result as forced', up.forced === true && !!up.analystOv);

  const down = run(s => { s.questions.pep = 'Yes'; s.override = { band: 'SDD', reason: 'attempt to weaken', at: '2026-01-01' }; });
  eq('G7 override cannot weaken EDD → SDD (ignored)', down.outcome, 'EDD');

  const onProh = run(s => { s.questions.tf = 'Yes'; s.override = { band: 'EDD', reason: 'irrelevant', at: '2026-01-01' }; });
  eq('G7 override has no effect on PROHIBITED', onProh.outcome, 'PROHIBITED');

  const noReason = run(s => { s.override = { band: 'EDD', reason: '   ', at: '2026-01-01' }; });
  eq('G7 override without justification is ignored', noReason.outcome, 'CDD');
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
if(fail) process.exit(1);
