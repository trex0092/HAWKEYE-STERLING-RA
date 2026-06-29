/* Export-integrity + import round-trip tests.

   Verifies that an exported assessment carries a SHA-256 integrity envelope that
   an independent party can recompute, that tampering is detected, and that the
   import path round-trips the whitelisted record losslessly. See
   docs/governance/backup-recovery.md for the documented verify/restore procedure.

   Runs app.js against a minimal DOM stub — no dependencies.
   Usage: node test/export-integrity.test.js */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const appjs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

const els = {};
function makeEl() {
  const el = { style:{}, value:'', textContent:'', className:'', _inner:'',
    classList:{ _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} },
    appendChild(){}, addEventListener(){}, click(){}, setAttribute(){}, getAttribute(){ return null; } };
  Object.defineProperty(el,'innerHTML',{ get(){return this._inner;}, set(v){ this._inner=v; for(const m of String(v).matchAll(/id="([^"]+)"/g)) register(m[1]); } });
  return el;
}
function register(id){ if(!els[id]) els[id]=makeEl(); return els[id]; }
for(const m of html.matchAll(/id="([^"]+)"/g)) register(m[1]);

let lastExport = null;
global.document = { getElementById(id){ return els[id]||null; }, createElement(){ return makeEl(); }, addEventListener(){} };
global.window = { addEventListener(){} };
global.localStorage = { _m:{}, getItem(k){ return Object.prototype.hasOwnProperty.call(this._m,k)?this._m[k]:null; }, setItem(k,v){ this._m[k]=String(v); }, removeItem(k){ delete this._m[k]; } };
global.confirm = () => true;
global.alert = (m) => { throw new Error('alert: '+m); };
global.Blob = class { constructor(parts){ lastExport = String(parts[0]); } };
global.URL = { createObjectURL(){ return 'blob:test'; }, revokeObjectURL(){} };

(0, eval)(appjs + `
;globalThis.__app = {
  exportJSON, sha256Hex, mergeState, defaultState,
  get state(){ return state; }, set state(v){ state = v; }
};`);
const A = globalThis.__app;

let pass = 0, fail = 0;
const check = (n,c) => { if(c){ pass++; console.log('  ok  '+n); } else { fail++; console.log('FAIL  '+n); } };

(async () => {
  console.log('\n— Export integrity + round-trip —\n');

  // Build a representative assessment and export it.
  const s = A.defaultState();
  s.entity.name = 'Acme Trading FZE';
  s.entity.jurisdiction = 'Nigeria';
  s.profile.activity = 'Mining Company';
  s.questions.pep = 'Yes';
  s.override = { band: 'EDD', reason: 'MLRO judgement', at: '2026-01-01' };
  A.state = s;

  await A.exportJSON();
  check('export produced a payload', !!lastExport && lastExport.length > 100);

  const file = JSON.parse(lastExport);
  check('integrity envelope present (SHA-256)', file.integrity && file.integrity.algorithm === 'SHA-256');
  check('integrity value is a 64-char hex digest', /^[0-9a-f]{64}$/.test(file.integrity.value || ''));

  // Independent verification: recompute SHA-256 over JSON.stringify(export.state).
  const recomputed = await A.sha256Hex(JSON.stringify(file.state));
  check('digest verifies against exported state', recomputed === file.integrity.value);

  // Tamper detection: a single changed field breaks the digest.
  const tampered = JSON.parse(JSON.stringify(file.state));
  tampered.entity.jurisdiction = 'United Kingdom';
  const tamperedHash = await A.sha256Hex(JSON.stringify(tampered));
  check('tampering changes the digest (detected)', tamperedHash !== file.integrity.value);

  // Round-trip: re-importing the exported state preserves the whitelisted record.
  const back = A.mergeState(file.state);
  check('round-trip preserves entity name', back.entity.name === 'Acme Trading FZE');
  check('round-trip preserves jurisdiction', back.entity.jurisdiction === 'Nigeria');
  check('round-trip preserves activity', back.profile.activity === 'Mining Company');
  check('round-trip preserves a question answer', back.questions.pep === 'Yes');

  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
