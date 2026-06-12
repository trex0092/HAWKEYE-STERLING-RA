/* Functional tests for the Entity Risk Assessment app (index.html).
   Runs the app's full inline script against a minimal DOM stub — no dependencies.
   Usage: node test/app.test.js */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

/* ── DOM stub ── */
const els = {};
function makeEl() {
  const el = {
    style: {}, value: '', textContent: '', className: '', _inner: '',
    classList: {
      _s: new Set(),
      add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); },
      toggle(c){ this._s.has(c) ? this._s.delete(c) : this._s.add(c); },
      contains(c){ return this._s.has(c); }
    },
    appendChild(){}, addEventListener(){}, click(){},
  };
  Object.defineProperty(el, 'innerHTML', {
    get(){ return this._inner; },
    set(v){ this._inner = v; for(const m of String(v).matchAll(/id="([^"]+)"/g)) register(m[1]); }
  });
  return el;
}
function register(id){ if(!els[id]) els[id] = makeEl(); return els[id]; }
for(const m of html.matchAll(/id="([^"]+)"/g)) register(m[1]);

global.document = {
  getElementById(id){ return els[id] || null; },  // browser-accurate: null for unknown
  createElement(){ return makeEl(); }
};
global.window = { addEventListener(){} };
global.localStorage = {
  _m: {},
  getItem(k){ return Object.prototype.hasOwnProperty.call(this._m,k) ? this._m[k] : null; },
  setItem(k,v){ this._m[k] = String(v); },
  removeItem(k){ delete this._m[k]; }
};
global.confirm = () => true;
global.alert = (m) => { throw new Error('alert called: '+m); };
global.Blob = class { constructor(parts){ this.parts = parts; } };
global.URL = { createObjectURL(){ return 'blob:test'; }, revokeObjectURL(){} };

/* ── Load app script; let/const are eval-scoped, so export a bridge ── */
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
(0, eval)(script + `
;globalThis.__app = {
  get state(){ return state; }, set state(v){ state = v; },
  computeAssessment, setToggle, onYears, onJurisdiction, onActivity, onSupplier,
  onSign, onField, useSuggestedReview, recalc, syncUI, freshState, mergeState,
  saveDraft, loadDraft, exportJSON, buildPrintReport, newAssessment, MAX_SCORE,
  addMonths, exportFileName, toggleComplete,
  rdSetOverride, rdClearOverride, rdResetAll, rdCount, mergeRiskData,
  saveRiskData, loadRiskData, rdExportSheet, rdRender,
  setAnalystOverride, reassess, priorChanges,
  get riskData(){ return riskData; }
};`);
const A = globalThis.__app;
const txt = el => String(el.textContent);
const reset = () => { A.state = A.freshState(); A.syncUI(); };

/* ── Assertions ── */
let passed = 0, failed = 0;
function check(name, cond){
  if(cond){ passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

// 1. Defaults reproduce the original baseline: 19 / CDD
let a = A.computeAssessment();
check('default total = 19', a.total === 19);
check('default outcome = CDD', a.outcome === 'CDD' && a.numericBand === 'CDD');
check('default has no escalations', a.escalations.length === 0 && a.prohibited === false);
check('default parts count = 22', a.parts.length === 22);
check('totalScore rendered "19"', txt(els.totalScore) === '19');
check('verdict text CDD', txt(els.verdictText) === 'CDD — Customer Due Diligence');
check('boundary warning shown at 19', els.boundaryWarn.style.display === 'block');
check('banner hidden by default', els.critBanner.style.display === 'none');
check('ref generated RA-YYYYMMDD-001', /^RA-\d{8}-001$/.test(A.state.meta.ref));
check('MAX_SCORE = 66', A.MAX_SCORE === 66);

// 2. Every prohibitive question forces PROHIBITED
for(const q of ['sanctions_person','sanctions_entity','tf','pf']){
  reset();
  A.setToggle(q,'Yes');
  a = A.computeAssessment();
  check(q+' Yes → PROHIBITED (numeric stays '+a.numericBand+')',
    a.outcome === 'PROHIBITED' && a.prohibited === true && a.total === 21 && a.numericBand === 'SDD');
}

// 3. PROHIBITED rendering: pill, banner, chips, review, boundary
reset();
A.setToggle('sanctions_entity','Yes');
check('pill solid red PROHIBITED', els.verdictPill.className === 'verdict-pill vp-proh');
check('verdict text Do Not Onboard', txt(els.verdictText) === 'PROHIBITED — Do Not Onboard');
check('banner instructs freeze + report', txt(els.critBanner).includes('Do not onboard')
  && txt(els.critBanner).includes('Freeze funds') && txt(els.critBanner).includes('Sanctions — legal entity'));
check('chips track numeric band (SDD)', els['tc-med'].classList.contains('tc-active')
  && !els['tc-high'].classList.contains('tc-active'));
check('no review when prohibited', A.state.signoff.nextReview === ''
  && els.reviewHint._inner.includes('No review — relationship prohibited'));
check('boundary warning suppressed when escalated', els.boundaryWarn.style.display === 'none');

// 4. Non-trigger Yes lands in SDD with no escalation
reset();
A.setToggle('criminal','Yes');
a = A.computeAssessment();
check('criminal Yes → 21 SDD, no escalation', a.total === 21 && a.outcome === 'SDD' && a.escalations.length === 0);
check('banner hidden for plain SDD', els.critBanner.style.display === 'none');

// 5. PEP = mandatory EDD floor
reset();
A.setToggle('pep','Yes');
a = A.computeAssessment();
check('PEP Yes → outcome EDD over numeric SDD', a.outcome === 'EDD' && a.numericBand === 'SDD' && !a.prohibited);
check('PEP escalation reason cites FATF R.12', a.escalations.some(e=>e.level==='edd' && e.reason.includes('PEP') && e.reason.includes('FATF R.12')));
check('banner says EDD mandatory', txt(els.critBanner).includes('Enhanced Due Diligence mandatory'));
A.state.meta.date = '2026-06-11'; A.recalc();
check('PEP review +12mo (EDD cadence)', A.state.signoff.nextReview === '2027-06-11');

// 6. FATF call-for-action jurisdictions = mandatory EDD floor
for(const c of ['Islamic Republic of Iran','North Korea','Myanmar']){
  reset();
  els.jurisdictionSelect.value = c;
  A.onJurisdiction();
  a = A.computeAssessment();
  check(c+' → EDD floor (numeric '+a.numericBand+')',
    a.outcome === 'EDD' && a.numericBand === 'SDD'
    && a.escalations.some(e=>e.reason.includes('call-for-action')));
}

// 7. High-risk country alone is NOT a floor; ASM + high-risk country IS (OECD Annex II)
reset();
els.jurisdictionSelect.value = 'Nigeria'; A.onJurisdiction();           // score 3, not CFA
els.activitySelect.value = 'Regulated Financial Entities'; A.onActivity(); // -2 to keep numeric in SDD
a = A.computeAssessment();
check('Nigeria alone → no escalation (19 CDD)', a.total === 19 && a.outcome === 'CDD' && a.escalations.length === 0);
els.sel_mined_0.value = 'ASM — Artisanal Mining'; A.onSupplier('mined',0);
a = A.computeAssessment();
check('Nigeria + ASM → EDD floor at numeric SDD', a.total === 22 && a.numericBand === 'SDD' && a.outcome === 'EDD');
check('reason cites OECD Annex II', a.escalations.some(e=>e.reason.includes('OECD Annex II')));
reset();
els.sel_mined_0.value = 'ASM — Artisanal Mining'; A.onSupplier('mined',0);
a = A.computeAssessment();
check('ASM + low-risk UK → no floor (22 SDD)', a.total === 22 && a.outcome === 'SDD' && a.escalations.length === 0);

// 8. Priority: prohibition beats every floor
reset();
A.setToggle('sanctions_entity','Yes');
A.setToggle('pep','Yes');
els.jurisdictionSelect.value = 'Islamic Republic of Iran'; A.onJurisdiction();
a = A.computeAssessment();
check('prohibit + PEP + Iran → PROHIBITED', a.outcome === 'PROHIBITED');
check('all escalations recorded', a.escalations.filter(e=>e.level==='prohibit').length === 1
  && a.escalations.filter(e=>e.level==='edd').length === 2);

// 9. Years scoring
reset();
els.entityYearsInput.value = '0'; A.onYears('entity');
check('0 years → total 21', A.computeAssessment().total === 21);
els.entityYearsInput.value = '1'; A.onYears('entity');
check('1 year → total 20 (SDD)', A.computeAssessment().total === 20);
els.entityYearsInput.value = '2'; A.onYears('entity');
check('2 years → back to 19', A.computeAssessment().total === 19);

// 10. Review suggestion follows outcome; manual override respected
reset();
A.state.meta.date = '2026-06-11'; A.recalc();
check('CDD review +36mo', A.state.signoff.nextReview === '2029-06-11');
A.onSign('nextReview','2026-12-31');
check('manual review kept', A.state.signoff.nextReview === '2026-12-31' && A.state.signoff.reviewManual === true);
check('hint offers "use suggested"', els.reviewHint._inner.includes('use suggested'));
A.useSuggestedReview();
check('back to suggested', A.state.signoff.nextReview === '2029-06-11' && A.state.signoff.reviewManual === false);

// 11. Persistence round-trip
reset();
A.state.entity.name = 'Fine Gold LLC';
A.state.entity.regno = 'REG-123';
A.state.meta.assessor = 'J. Smith';
A.state.signoff.completedBy = 'J. Smith';
A.recalc(); A.saveDraft();
check('completeness all green', txt(els.completeness).includes('all 4 required fields'));
const restored = A.loadDraft();
check('draft restores entity name', restored && restored.state.entity.name === 'Fine Gold LLC');
check('mergeState round-trip stable', JSON.stringify(A.mergeState(JSON.parse(JSON.stringify(A.state)))) === JSON.stringify(A.state));
check('mergeState sanitises bad values',
  A.mergeState({questions:{tf:'MAYBE'}}).questions.tf === 'No'
  && A.mergeState({suppliers:{mined:['bogus']}}).suppliers.mined[0] === 'N/A'
  && A.mergeState({entity:{jurisdiction:'Narnia'}}).entity.jurisdiction === 'United Kingdom');

// 12. Export carries outcome + escalations; print report reflects PROHIBITED and escapes input
reset();
A.setToggle('pf','Yes');
A.exportJSON();
check('export did not throw', true);
A.state.entity.name = '<img src=x onerror=alert(1)> & Co';
A.state.notes = 'line1\nline2 <script>';
A.buildPrintReport();
let pr = els.printReport._inner;
check('print shows PROHIBITED — DO NOT ONBOARD', pr.includes('PROHIBITED — DO NOT ONBOARD'));
check('print prohibition box cites factor + instruction', pr.includes('Proliferation financing connections')
  && pr.includes('Freeze funds where held'));
check('print escapes HTML in name', pr.includes('&lt;img src=x onerror=alert(1)&gt; &amp; Co') && !pr.includes('<img src=x'));
check('print escapes notes + newlines', pr.includes('line1<br>line2 &lt;script&gt;'));
check('print shows score caption (0–30 display scale)', pr.includes('Risk score / 30+'));
reset();
A.setToggle('pep','Yes');
A.buildPrintReport();
pr = els.printReport._inner;
check('print shows EDD-mandatory box for floors', pr.includes('Enhanced Due Diligence mandatory') && !pr.includes('DO NOT ONBOARD'));

// 13. New assessment increments reference and resets
reset();
const prevRef = A.state.meta.ref;
A.newAssessment();
check('new ref differs and matches format', A.state.meta.ref !== prevRef && /^RA-\d{8}-\d{3}$/.test(A.state.meta.ref));
check('new assessment resets to 19/CDD', A.computeAssessment().total === 19 && A.computeAssessment().outcome === 'CDD');

/* ── 14. Principals are plain record data (print + import) ── */
reset();
A.state.entity.principals = 'John Smith, Jane Doe';
A.buildPrintReport();
check('print includes principals', els.printReport._inner.includes('John Smith, Jane Doe'));
check('mergeState keeps principals', A.mergeState({entity:{principals:'A, B'}}).entity.principals === 'A, B');
// `screening` is now the evidence-fields record; legacy live-screening exports
// ({at, subjects}) must still import cleanly with their junk keys dropped.
const oldScr = A.mergeState({screening:{at:'x', subjects:[]}, entity:{name:'Y'}});
check('legacy screening import sanitised to evidence fields',
  oldScr.screening.sanctions.system === '' && !('at' in oldScr.screening) && !('subjects' in oldScr.screening));

/* ── 15. Deep-review regressions ── */
// addMonths clamps day overflow instead of rolling into the next month
check('addMonths: 29 Feb + 12mo clamps to 28 Feb', A.addMonths('2028-02-29',12) === '2029-02-28');
check('addMonths: 31 Jan + 1mo clamps to 28 Feb', A.addMonths('2026-01-31',1) === '2026-02-28');
check('addMonths: plain dates unaffected', A.addMonths('2026-06-11',36) === '2029-06-11');
reset();
A.state.meta.date = '2028-02-29'; A.recalc();
check('leap-day assessment → review 2031-02-28 (CDD +36mo)', A.state.signoff.nextReview === '2031-02-28');

// boundary warning covers both band edges with the right text
reset();                                                       // 19 — CDD/SDD edge
check('boundary at 19 names CDD/SDD', els.boundaryWarn.style.display === 'block'
  && txt(els.boundaryWarn).includes('CDD/SDD'));
els.sel_mined_0.value = 'ASM — Artisanal Mining'; A.onSupplier('mined',0);  // 22 SDD, no escalation
check('boundary at 22 names SDD/EDD', els.boundaryWarn.style.display === 'block'
  && txt(els.boundaryWarn).includes('SDD/EDD') && txt(els.boundaryWarn).includes('Enhanced Due Diligence'));
reset();
A.setToggle('criminal','Yes');                                 // 21 — mid-band
check('boundary hidden mid-band', els.boundaryWarn.style.display === 'none');

// mergeState rejects objects, coerces scalars, drops unknown keys
const hard = A.mergeState({meta:{ref:{a:1}}, entity:{name:123, evil:'x'}, signoff:{reviewManual:'true'}});
check('import: object value rejected (no "[object Object]")', hard.meta.ref === '');
check('import: scalar coerced to string', hard.entity.name === '123');
check('import: unknown keys dropped', !('evil' in hard.entity));
check('import: reviewManual normalised to boolean', hard.signoff.reviewManual === true);

// export filename is sanitised
reset();
A.state.meta.ref = 'RA/2026:te*st?"x"<y>|z';
check('export filename sanitised', A.exportFileName() === 'RA-2026-te-st--x--y--z.json');
A.state.meta.ref = '  ';
check('blank ref falls back to default filename', A.exportFileName() === 'risk-assessment.json');

/* ── 16. Dark-redesign additions: gauge, complete toggle, signatory titles ── */
reset();
check('gauge arc tracks score (19/30 of the 339-unit sweep)', els.gaugeArc.style.strokeDasharray === '214.7 452');
A.setToggle('criminal','Yes');                                 // 21
check('gauge arc updates on change', els.gaugeArc.style.strokeDasharray === '237.3 452');
reset();
A.toggleComplete();
check('complete toggle sets state + badge + button', A.state.complete === true
  && els.statusBadge.className === 'status-badge s-complete'
  && txt(els.btnComplete) === '✓ Mark as Draft');
A.toggleComplete();
check('complete toggle back to draft', A.state.complete === false
  && els.statusBadge.className === 'status-badge s-draft');
check('mergeState keeps signatory titles', A.mergeState({signoff:{completedTitle:'Analyst', approvedTitle:'MLRO'}}).signoff.completedTitle === 'Analyst'
  && A.mergeState({signoff:{approvedTitle:'MLRO'}}).signoff.approvedTitle === 'MLRO');
check('mergeState normalises complete flag', A.mergeState({complete:'true'}).complete === true
  && A.mergeState({complete:{}}).complete === false && A.mergeState({}).complete === false);

/* ── 17. Risk Data overrides: mandatory reason, scoring, flags, persistence ── */
reset();
check('risk data starts at baseline', A.rdCount() === 0 && A.computeAssessment().total === 19);
check('override rejects empty reason', A.rdSetOverride('countries','United Kingdom',{score:3, reason:'  '}) === false && A.rdCount() === 0);
check('override rejects N/A and out-of-range scores',
  A.rdSetOverride('mined','N/A',{score:2, reason:'x'}) === false
  && A.rdSetOverride('countries','United Kingdom',{score:9, reason:'x'}) === false
  && A.rdSetOverride('countries','United Kingdom',{score:0, reason:'x'}) === false);
check('override applies: UK 1→3 lifts total to 21 SDD',
  A.rdSetOverride('countries','United Kingdom',{score:3, reason:'Test escalation'}) === true
  && A.computeAssessment().total === 21 && A.computeAssessment().outcome === 'SDD');
a = A.computeAssessment();
check('breakdown part carries override audit', !!a.parts[0].ov
  && a.parts[0].ov.baseScore === 1 && a.parts[0].ov.reason === 'Test escalation');
check('jurisdiction tag marks override', txt(els.jurisdictionScore).includes('✱'));
A.buildPrintReport();
pr = els.printReport._inner;
check('report flags the override with audit detail', pr.includes('United Kingdom: 1 → 3') && pr.includes('Test escalation'));
check('report carries risk-data version stamp', pr.includes('Risk data: baseline') && pr.includes('1 local override'));
check('cfa-only override is a stored delta', A.rdSetOverride('countries','United Kingdom',{score:1, cfa:true, reason:'CFA test'}) === true && A.rdCount() === 1);
a = A.computeAssessment();
check('CFA override triggers the EDD floor', a.outcome === 'EDD'
  && a.escalations.some(e=>e.reason.includes('call-for-action')));
check('setting baseline values clears the override',
  A.rdSetOverride('countries','United Kingdom',{score:1, cfa:false, reason:'back'}) === true && A.rdCount() === 0);
const rdHard = A.mergeRiskData({overrides:{
  countries:{ Narnia:{score:3, reason:'x'}, Hungary:{score:9, reason:'x'}, France:{score:3} },
  bogus:{ France:{score:3, reason:'x'} }
}});
check('mergeRiskData drops unknown names/kinds and bad scores',
  !rdHard.overrides.countries.Narnia && !rdHard.overrides.countries.Hungary && !rdHard.overrides.bogus);
check('mergeRiskData coerces missing reason', rdHard.overrides.countries.France
  && rdHard.overrides.countries.France.reason === '(no reason recorded)');
check('mergeRiskData drops non-delta entries',
  !A.mergeRiskData({overrides:{countries:{France:{score:1, reason:'same as baseline'}}}}).overrides.countries.France);
A.rdSetOverride('activities','Jewellery Trading',{score:2, reason:'Mitigated channel'});
const rdLoaded = A.loadRiskData();
check('risk data persists via localStorage', rdLoaded.overrides.activities['Jewellery Trading'].score === 2
  && rdLoaded.overrides.activities['Jewellery Trading'].reason === 'Mitigated channel');
check('export sheet did not throw', (A.rdExportSheet(), true));
check('panel render did not throw', (A.rdRender(), true));
A.rdResetAll();
check('reset restores baseline scoring', A.rdCount() === 0 && A.computeAssessment().total === 19);

/* ── 18. Screening evidence fields ── */
reset();
A.state.screening.sanctions = {system:'OpenSanctions', date:'2026-06-12', ref:'SCR-001'};
A.buildPrintReport();
pr = els.printReport._inner;
check('report shows screening evidence', pr.includes('Sanctions screening')
  && pr.includes('OpenSanctions · 12 Jun 2026 · Ref SCR-001'));
check('report dashes unscreened checks', pr.includes('PEP screening') && pr.includes('Adverse media screening'));
const scrMerged = A.mergeState({screening:{sanctions:{system:'DJ', date:'2026-01-01', ref:'R1', evil:'x'}, pep:'bogus'}});
check('mergeState sanitises screening fields', scrMerged.screening.sanctions.system === 'DJ'
  && !('evil' in scrMerged.screening.sanctions) && scrMerged.screening.pep.system === '');
check('screening survives draft round-trip', (A.saveDraft(), A.loadDraft().state.screening.sanctions.ref === 'SCR-001'));

/* ── 19. Analyst override (one-way ratchet) ── */
reset();
a = A.computeAssessment();
check('no override by default', a.analystOv === null && a.outcome === a.engineOutcome);
A.setAnalystOverride('EDD', '');
check('override without justification is inactive', A.computeAssessment().analystOv === null
  && A.computeAssessment().outcome === 'CDD');
A.setAnalystOverride('EDD', 'Complex layered ownership');
a = A.computeAssessment();
check('override raises CDD → EDD', a.outcome === 'EDD' && a.engineOutcome === 'CDD'
  && a.analystOv.reason === 'Complex layered ownership');
check('verdict pill reflects override with marker', els.verdictPill.className === 'verdict-pill vp-edd'
  && txt(els.verdictText).includes('✱'));
check('override banner shown with from→to', els.ovBanner.style.display === 'block'
  && txt(els.ovBanner).includes('CDD → EDD'));
A.state.meta.date = '2026-06-11'; A.recalc();
check('review cadence follows the overridden band (+12mo)', A.state.signoff.nextReview === '2027-06-11');
A.buildPrintReport();
pr = els.printReport._inner;
check('report shows analyst override box + computed outcome', pr.includes('Analyst override')
  && pr.includes('Complex layered ownership') && pr.includes('Computed outcome: CDD'));
reset();
A.setToggle('pep','Yes');                            // mandatory-EDD floor
A.setAnalystOverride('SDD', 'attempt to lower');
a = A.computeAssessment();
check('override cannot weaken the outcome', a.outcome === 'EDD' && a.analystOv === null);
reset();
A.setToggle('sanctions_entity','Yes');
A.setAnalystOverride('EDD', 'irrelevant');
a = A.computeAssessment();
check('override never applies when prohibited', a.outcome === 'PROHIBITED' && a.analystOv === null);
check('mergeState whitelists override band', A.mergeState({override:{band:'CDD', reason:'x'}}).override.band === ''
  && A.mergeState({override:{band:'EDD', reason:'why', at:'2026-06-12'}}).override.reason === 'why');

/* ── 20. Periodic re-assessment flow ── */
reset();
A.state.entity.name = 'Fine Gold LLC';
A.state.notes = 'old rationale';
A.state.signoff.completedBy = 'J. Smith';
A.state.complete = true;
const oldRef = A.state.meta.ref;
A.reassess();
check('re-assess issues a new ref and keeps the facts', A.state.meta.ref !== oldRef
  && A.state.entity.name === 'Fine Gold LLC' && A.state.prior && A.state.prior.ref === oldRef);
check('re-assess clears rationale, sign-off, status', A.state.notes === ''
  && A.state.signoff.completedBy === '' && A.state.complete === false);
check('prior snapshot records result + factors', A.state.prior.total === 19
  && A.state.prior.outcome === 'CDD' && A.state.prior.parts.length === 22);
check('no changes right after cloning', (A.priorChanges(A.computeAssessment()) || []).length === 0
  && txt(els.priorChangesLbl).includes('No changes'));
els.jurisdictionSelect.value = 'Nigeria'; A.onJurisdiction();
let ch = A.priorChanges(A.computeAssessment());
check('factor change is diffed against prior', ch.length === 2
  && ch[0].includes('United Kingdom (1) → Nigeria (3)') && ch[1].includes('Result: 19 · CDD → 21 · SDD'));
check('prior block painted', els.priorBlock.style.display === 'block'
  && txt(els.priorInfo).includes(oldRef) && txt(els.priorChangesLbl).includes('2 changes'));
A.buildPrintReport();
pr = els.printReport._inner;
check('report shows re-assessment box with changes', pr.includes('Periodic re-assessment')
  && pr.includes(oldRef) && pr.includes('United Kingdom (1) → Nigeria (3)'));
check('mergeState round-trips the prior snapshot',
  JSON.stringify(A.mergeState(JSON.parse(JSON.stringify(A.state))).prior) === JSON.stringify(A.state.prior));
check('mergeState rejects malformed priors', A.mergeState({prior:{total:'NaNish', outcome:'CDD'}}).prior === null
  && A.mergeState({prior:{total:19, outcome:'BOGUS'}}).prior === null);
A.newAssessment();
check('new assessment clears the prior', A.state.prior === null && els.priorBlock.style.display === 'none');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
