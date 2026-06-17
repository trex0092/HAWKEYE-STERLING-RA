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
    setAttribute(k,v){ this['_a_'+k] = String(v); },
    getAttribute(k){ const v = this['_a_'+k]; return v==null ? null : v; },
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
  setAnalystOverride, reassess, priorChanges, fmtDate, dmyToISO, dateFieldChanged,
  buildNarrative, insertNarrative, asanaPayload, sendToAsana, deliveredGid, rememberDelivered,
  scheduleRiskBackup,
  regAll, regUpsert, regDelete, regOpenEntry, regRender, regOpenIdx, regDeleteIdx,
  openRegister, closeRegister,
  storeFailedDelivery, clearFailedDelivery, getFailedPayload, paintRetryButton, retryAsanaDelivery,
  _deriveKey, encryptStr, decryptStr, sha256Hex, auditAppend, auditAll, auditVerify,
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

// 3. PROHIBITED rendering: pill, banner, chips, review
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
check('PEP review +3mo (EDD cadence, FG/KYC)', A.state.signoff.nextReview === '2026-09-11');

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
check('CDD review +12mo (FG/KYC)', A.state.signoff.nextReview === '2027-06-11');
A.onSign('nextReview','2026-12-31');
check('manual review kept', A.state.signoff.nextReview === '2026-12-31' && A.state.signoff.reviewManual === true);
check('hint offers "use suggested"', els.reviewHint._inner.includes('use suggested'));
A.useSuggestedReview();
check('back to suggested', A.state.signoff.nextReview === '2027-06-11' && A.state.signoff.reviewManual === false);

// 11. Persistence round-trip
reset();
A.state.entity.name = 'Fine Gold LLC';
A.state.entity.regno = 'REG-123';
A.state.meta.assessor = 'J. Smith';
A.state.signoff.completedBy = 'J. Smith';
A.recalc(); A.saveDraft();
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
check('print shows PROHIBITED - DO NOT ONBOARD', pr.includes('PROHIBITED - DO NOT ONBOARD'));
check('print prohibition box cites factor + instruction', pr.includes('Proliferation financing connections')
  && pr.includes('Freeze funds where held'));
check('print escapes HTML in name', pr.includes('&lt;img src=x onerror=alert(1)&gt; &amp; Co') && !pr.includes('<img src=x'));
check('print escapes notes + newlines', pr.includes('line1<br>line2 &lt;script&gt;'));
check('print shows score caption (0-30 display scale)', pr.includes('/ 30+'));
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
check('leap-day assessment → review 2029-02-28 (CDD +12mo)', A.state.signoff.nextReview === '2029-02-28');

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
check('gauge arc tracks score (19/30 of the 396-unit sweep)', els.gaugeArc.style.strokeDasharray === '250.8 600');
A.setToggle('criminal','Yes');                                 // 21
check('gauge arc updates on change', els.gaugeArc.style.strokeDasharray === '277.2 600');
reset();
A.toggleComplete();
check('complete toggle sets state + button', A.state.complete === true
  && txt(els.btnComplete) === '✓ Mark as Draft');
A.toggleComplete();
check('complete toggle back to draft', A.state.complete === false
  && txt(els.btnComplete) === '✓ Complete Assessment');
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
check('report flags risk-data overrides applied', pr.includes('Risk data overrides applied') && pr.includes('Test escalation'));
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
  && pr.includes('OpenSanctions · 12/06/2026 · Ref SCR-001'));
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
check('review cadence follows the overridden band (+3mo, EDD)', A.state.signoff.nextReview === '2026-09-11');
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

/* ── 21. Accessibility: toggle buttons expose pressed state ── */
reset();
check('aria-pressed reflects the AML answer (Yes default)',
  els.btn_aml_yes.getAttribute('aria-pressed') === 'true' && els.btn_aml_no.getAttribute('aria-pressed') === 'false');
A.setToggle('aml','No');
check('aria-pressed follows toggling', els.btn_aml_yes.getAttribute('aria-pressed') === 'false'
  && els.btn_aml_no.getAttribute('aria-pressed') === 'true');

/* ── 22. DD/MM/YYYY display with ISO state ── */
check('fmtDate renders dd/mm/yyyy', A.fmtDate('2026-06-12') === '12/06/2026' && A.fmtDate('') === '' && A.fmtDate('junk') === '');
check('dmyToISO parses and pads', A.dmyToISO('1/6/2026') === '2026-06-01' && A.dmyToISO('31/12/2026') === '2026-12-31');
check('dmyToISO rejects impossible dates', A.dmyToISO('31/02/2026') === '' && A.dmyToISO('12/13/2026') === ''
  && A.dmyToISO('2026-06-12') === '');
reset();
const dEl = {value:'1/6/2026'};
A.dateFieldChanged(dEl, v => A.onField('meta','date', v));
check('date field stores ISO and normalises display', A.state.meta.date === '2026-06-01' && dEl.value === '01/06/2026');
check('next-review input shows dd/mm/yyyy', /^\d{2}\/\d{2}\/\d{4}$/.test(els.nextReview.value));

/* ── 23. Narrative template (formal, plain, human voice, audit-ready) ── */
reset();
let nar = A.buildNarrative();
check('low narrative cites policies by full name', nar.includes('low risk band')
  && nar.includes("Company's Risk Assessment methodology") && nar.includes('Standard due diligence')
  && nar.includes('every twelve months') && nar.includes('Targeted Financial Sanctions')
  && nar.includes('Know Your Customer procedure'));
check('narrative contains no manual codes', nar.indexOf('FG/') === -1);
check('narrative uses placeholder when entity unnamed', nar.includes('[Entity Legal Name]'));
check('narrative contains no em-dash', nar.indexOf('—') === -1);
A.state.entity.name = 'Fine Gold LLC';
nar = A.buildNarrative();
check('narrative auto-fills entity, date, and score', nar.includes('We assessed Fine Gold LLC on ')
  && nar.includes('19 / 30+'));
A.setToggle('criminal','Yes');                                  // 21 → SDD
nar = A.buildNarrative();
check('medium narrative reads human with six-month cycle', nar.includes('medium risk band')
  && nar.includes('Simplified due diligence') && nar.includes('every six months')
  && nar.indexOf('—') === -1);
reset();
A.setToggle('pep','Yes');                                       // EDD floor
nar = A.buildNarrative();
check('high narrative covers EDD measures and three-month cycle', nar.includes('high risk band')
  && nar.includes('Enhanced due diligence') && nar.includes('every three months')
  && nar.includes('senior management approval') && nar.indexOf('—') === -1);
reset();
A.setToggle('sanctions_entity','Yes');
nar = A.buildNarrative();
check('prohibited narrative cites the law + FIU (no article number), freeze, no em-dash',
  nar.includes('The relationship is prohibited')
  && nar.includes('Federal Decree-Law No. (10) of 2025') && nar.includes('Financial Intelligence Unit')
  && nar.indexOf('Article 11') === -1 && nar.includes('Funds are frozen')
  && nar.indexOf('—') === -1);
reset();
A.insertNarrative();
check('insertNarrative fills the notes box', A.state.notes.includes('low risk band')
  && els.notesInput.value === A.state.notes);
A.buildPrintReport();
check('narrative prints in the report notes', els.printReport._inner.includes('low risk band')
  && els.printReport._inner.includes('Risk Assessment methodology'));

/* ── 24. Asana delivery payload + Netlify function ── */
reset();
A.state.entity.name = 'Fine Gold LLC';
A.recalc();
let ap = A.asanaPayload();
check('asana task name carries ref, entity, band, score',
  /^RA-\d{8}-\d{3} · Fine Gold LLC · CDD 19$/.test(ap.name));
check('asana notes fall back to the generated narrative', ap.notes.includes('low risk band')
  && ap.notes.includes('Ref: ' + A.state.meta.ref) && ap.notes.includes('Result: 19 / 30+ (CDD)'));
A.state.notes = 'Officer-written rationale.';
ap = A.asanaPayload();
check('asana notes prefer the officer narrative', ap.notes.startsWith('Officer-written rationale.')
  && ap.notes.includes('Next review:'));
check('asana shows unsigned sign-off as dashes', ap.notes.includes('Assessed by: -')
  && ap.notes.includes('Approved by (MLRO): -'));
A.state.signoff.completedBy = 'J. Smith'; A.state.signoff.completedTitle = 'Senior Compliance Analyst';
A.state.signoff.completedDate = '2026-06-12';
A.state.signoff.approvedBy = 'A. Jones'; A.state.signoff.approvedTitle = 'MLRO'; A.state.signoff.approvedDate = '2026-06-13';
ap = A.asanaPayload();
check('asana delivers manually-entered assessor and MLRO',
  ap.notes.includes('Assessed by: J. Smith (Senior Compliance Analyst), 12/06/2026')
  && ap.notes.includes('Approved by (MLRO): A. Jones (MLRO), 13/06/2026'));
check('asana due date mirrors the next-review date (risk level)', ap.due_on === A.state.signoff.nextReview
  && /^\d{4}-\d{2}-\d{2}$/.test(ap.due_on));
check('asana payload carries the risk band for sectioning', ap.band === 'CDD');
A.onSign('nextReview','2026-08-01');                      // manual entry (e.g. change in law)
check('manual review date drives the asana due date', A.asanaPayload().due_on === '2026-08-01');
A.setToggle('sanctions_entity','Yes');                    // prohibited → no review date
check('prohibited assessments carry no due date', A.asanaPayload().due_on === '');
check('prohibited payload band = PROHIBITED', A.asanaPayload().band === 'PROHIBITED');
A.setToggle('sanctions_entity','No');
check('payload carries no task gid before first delivery', A.asanaPayload().gid === '');
A.rememberDelivered(A.state.meta.ref, '4242');
check('delivered gid remembered per reference for update-not-duplicate',
  A.deliveredGid(A.state.meta.ref) === '4242' && A.deliveredGid('RA-OTHER') === ''
  && A.asanaPayload().gid === '4242');
check('toggleComplete is safe without fetch (sandbox/test)', (A.toggleComplete(), A.state.complete === true));
A.toggleComplete();

/* ── 25. Assessment register (the filing cabinet) ── */
localStorage.removeItem('hsra.register.v1');               // earlier sections filed entries; start clean
reset();
A.saveDraft();
check('register ignores unnamed assessments', Object.keys(A.regAll()).length === 0);
A.state.entity.name = 'Alpha Gold DMCC';
A.saveDraft();
const regRef1 = A.state.meta.ref;
let regItems = A.regAll();
check('named assessment files itself on save', Object.keys(regItems).length === 1
  && regItems[regRef1].summary.entity === 'Alpha Gold DMCC'
  && regItems[regRef1].summary.total === 19 && regItems[regRef1].summary.outcome === 'CDD'
  && regItems[regRef1].summary.complete === false
  && regItems[regRef1].state.entity.name === 'Alpha Gold DMCC');
A.state.complete = true;
A.saveDraft();
check('completion status reaches the register', A.regAll()[regRef1].summary.complete === true);
A.newAssessment();                                          // files Alpha, opens a fresh ref
check('reset keeps the filed assessment and issues a new ref',
  A.state.meta.ref !== regRef1 && A.regAll()[regRef1] != null && A.state.entity.name === '');
A.state.entity.name = 'Beta Jewellery LLC';
A.setToggle('pep','Yes');                                   // EDD floor for a distinct summary
A.saveDraft();
const regRef2 = A.state.meta.ref;
check('second entity files alongside the first', Object.keys(A.regAll()).length === 2
  && A.regAll()[regRef2].summary.outcome === 'EDD');
check('regOpenEntry restores a filed assessment', A.regOpenEntry(regRef1)
  && A.state.meta.ref === regRef1 && A.state.entity.name === 'Alpha Gold DMCC'
  && A.state.complete === true && A.computeAssessment().total === 19);
check('opening filed Beta first (auto-file on switch)', A.regAll()[regRef2].state.questions.pep === 'Yes');
A.regAll()[regRef1].state.entity.jurisdiction = 'Narnia';   // returned copy only — store is untouched
check('regAll returns copies, store stays clean', A.regAll()[regRef1].state.entity.jurisdiction === 'United Kingdom');
localStorage.setItem('hsra.register.v1',
  JSON.stringify({version:1, items:{'RA-X':{savedAt:'2026-01-01', summary:{entity:'Tampered'}, state:{questions:{}, entity:{jurisdiction:'Narnia', name:'Tampered'}}}}}));
check('tampered snapshot is sanitised through mergeState', A.regOpenEntry('RA-X')
  && A.state.entity.jurisdiction === 'United Kingdom' && A.state.entity.name === 'Tampered');
localStorage.setItem('hsra.register.v1', '{corrupt');
check('corrupt register degrades to empty, app survives', Object.keys(A.regAll()).length === 0);
localStorage.removeItem('hsra.register.v1');
reset();
A.state.entity.name = 'Gamma Metals FZE';
A.state.signoff.nextReview = '2020-01-01'; A.state.signoff.reviewManual = true;
A.saveDraft();
A.openRegister();
check('register panel opens and renders rows', els.regOverlay.classList.contains('open')
  && els.regRows._inner.includes('Gamma Metals FZE') && els.regRows._inner.includes('Open')
  && txt(els.regCountLbl) === '1 assessment filed');
check('overdue reviews are flagged', els.regRows._inner.includes('REVIEW OVERDUE — 01/01/2020'));
check('the open assessment is marked current', els.regRows._inner.includes('reg-cur'));
els.regSearch.value = 'zzz-no-match';
A.regRender();
check('filter hides non-matching rows', els.regRows._inner.includes('No matches'));
els.regSearch.value = '';
A.regRender();
A.regDeleteIdx(0);                                          // confirm is stubbed true
check('delete removes the filed copy', Object.keys(A.regAll()).length === 0
  && els.regRows._inner.includes('Nothing filed yet'));
check('deleting a missing ref is a clean no-op', A.regDelete('RA-NOPE') === false);
A.closeRegister();
check('register panel closes', !els.regOverlay.classList.contains('open'));

/* ── 26. Review fixes: ref rename, invalid date display ── */
localStorage.removeItem('hsra.register.v1');
reset();
A.state.entity.name = 'Rename Co';
A.saveDraft();
const renameFrom = A.state.meta.ref;
A.onField('meta','ref', renameFrom + 'B');                 // typing in the reference field
A.saveDraft();
check('renaming the reference moves its register entry (no duplicate)',
  A.regAll()[renameFrom] == null && A.regAll()[renameFrom + 'B'] != null
  && A.regAll()[renameFrom + 'B'].summary.entity === 'Rename Co');
const badDate = { value: '31/02/2026' };
let badGot = 'x';
A.dateFieldChanged(badDate, v => badGot = v);
check('invalid date clears both the field and the state', badDate.value === '' && badGot === '');
const goodDate = { value: '1/6/2026' };
A.dateFieldChanged(goodDate, v => {});
check('valid date still normalises in place', goodDate.value === '01/06/2026');
check('risk-backup scheduler is inert without fetch (test/file://)', (A.scheduleRiskBackup(), true));

(async () => {
  const fn = require('../netlify/functions/asana-task.js');
  let sent = null, calls = [];
  let sectionsOnServer = [{ gid: 's-low', name: 'LOW RISK (CDD)' }];
  let projectTasksOnServer = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (url.includes('/sections?')) return { ok: true, status: 200, json: async () => ({ data: sectionsOnServer }) };
    if (url.includes('/tasks?')) return { ok: true, status: 200, json: async () => ({ data: projectTasksOnServer }) };
    if (/\/projects\/[^/]+\/sections$/.test(url)) return { ok: true, status: 200, json: async () => ({ data: { gid: 's-new' } }) };
    if (url.includes('/addTask')) return { ok: true, status: 200, json: async () => ({ data: {} }) };
    if (opts && opts.method === 'PUT') return url.endsWith('/tasks/410')
      ? { ok: false, status: 404, json: async () => ({ errors: [{ message: 'Not Found' }] }) }
      : { ok: true, status: 200, json: async () => ({ data: { gid: url.split('/').pop(), permalink_url: 'https://app.asana.com/x/upd' } }) };
    sent = { url, opts };
    return { ok: true, status: 200, json: async () => ({ data: { gid: '42', permalink_url: 'https://app.asana.com/x/42' } }) };
  };
  process.env.ASANA_ACCESS_TOKEN = 'test-token';
  let r = await fn.handler({httpMethod:'POST', body:JSON.stringify({name:'RA X · Y · CDD 19', notes:'n', due_on:'2027-06-12'})});
  const body = JSON.parse(r.body), sentBody = JSON.parse(sent.opts.body);
  check('fn creates the asana task in RISK ASSESSMENTS', r.statusCode === 200 && body.ok === true
    && sent.url === 'https://app.asana.com/api/1.0/tasks'
    && sent.opts.headers.Authorization === 'Bearer test-token'
    && sentBody.data.projects[0] === '1215653768729951' && sentBody.data.name === 'RA X · Y · CDD 19');
  check('fn passes the due date through to asana', sentBody.data.due_on === '2027-06-12');
  await fn.handler({httpMethod:'POST', body:JSON.stringify({name:'x', due_on:'junk'})});
  check('fn drops malformed due dates', !('due_on' in JSON.parse(sent.opts.body).data));
  check('fn assigns the task so Asana sends due-date reminders', JSON.parse(sent.opts.body).data.assignee === 'me');
  calls = [];
  r = await fn.handler({httpMethod:'POST', body:JSON.stringify({name:'RA Z · Low Co · CDD 19', band:'CDD'})});
  check('fn files CDD tasks into the LOW RISK section', r.statusCode === 200
    && JSON.parse(r.body).section === 'LOW RISK (CDD)'
    && calls.some(c => c.url.includes('/sections?limit=100'))
    && calls.some(c => c.url.endsWith('/sections/s-low/addTask')));
  calls = [];
  r = await fn.handler({httpMethod:'POST', body:JSON.stringify({name:'RA W · High Co · EDD 24', band:'EDD'})});
  const mkSection = calls.find(c => /\/projects\/[^/]+\/sections$/.test(c.url));
  check('fn creates a missing band section on demand', mkSection
    && JSON.parse(mkSection.opts.body).data.name === 'HIGH RISK (EDD)'
    && calls.some(c => c.url.endsWith('/sections/s-new/addTask'))
    && JSON.parse(r.body).section === 'HIGH RISK (EDD)');
  calls = [];
  r = await fn.handler({httpMethod:'POST', body:JSON.stringify({name:'RA V · Junk Band Co', band:'NOT-A-BAND'})});
  check('fn ignores unknown bands (task still created, no section calls)', r.statusCode === 200
    && JSON.parse(r.body).section === null && !calls.some(c => c.url.includes('section')));
  calls = [];
  r = await fn.handler({httpMethod:'POST', body:JSON.stringify({name:'RA U2 · Co · SDD 21', band:'SDD', gid:'42'})});
  const put = calls.find(c => c.opts && c.opts.method === 'PUT');
  check('fn updates the existing task instead of duplicating', r.statusCode === 200
    && JSON.parse(r.body).updated === true && put && put.url.endsWith('/tasks/42')
    && !calls.some(c => c.opts.method === 'POST' && c.url.endsWith('/tasks')));
  check('fn re-files the updated task into its (new) band section',
    calls.some(c => /\/projects\/[^/]+\/sections$/.test(c.url))
    && calls.some(c => c.url.endsWith('/sections/s-new/addTask')));
  calls = [];
  r = await fn.handler({httpMethod:'POST', body:JSON.stringify({name:'RA U3 · Co · CDD 19', band:'CDD', gid:'410'})});
  check('fn falls back to create when the remembered task is gone', r.statusCode === 200
    && JSON.parse(r.body).updated !== true && JSON.parse(r.body).gid === '42'
    && calls.some(c => c.opts.method === 'POST' && c.url.endsWith('/tasks')));
  r = await fn.handler({httpMethod:'GET'});
  check('fn rejects non-POST', r.statusCode === 405);
  r = await fn.handler({httpMethod:'POST', body:'{}'});
  check('fn requires a task name', r.statusCode === 400);
  delete process.env.ASANA_ACCESS_TOKEN;
  r = await fn.handler({httpMethod:'POST', body:JSON.stringify({name:'x'})});
  check('fn fails clearly without token', r.statusCode === 500 && JSON.parse(r.body).error.includes('ASANA_ACCESS_TOKEN'));

  /* origin guard: cross-site browser origin is rejected; same-origin / header-less pass.
     Restore the token so a passing CORS check reaches the Asana path, not the 500 path. */
  process.env.ASANA_ACCESS_TOKEN = 'test-token';
  r = await fn.handler({httpMethod:'POST', headers:{origin:'https://evil.example', host:'hawkeye-sterling-ra.netlify.app'}, body:JSON.stringify({name:'x'})});
  check('fn rejects a foreign browser origin (403)', r.statusCode === 403);
  r = await fn.handler({httpMethod:'POST', headers:{origin:'https://hawkeye-sterling-ra.netlify.app', host:'hawkeye-sterling-ra.netlify.app'}, body:JSON.stringify({name:'x'})});
  check('fn allows the same-origin request past the guard', r.statusCode !== 403);
  r = await fn.handler({httpMethod:'POST', body:JSON.stringify({name:'x'})});
  check('fn allows header-less (server-to-server) requests past the guard', r.statusCode !== 403);

  /* risk-backup function: browser overrides → Asana mirror task */
  const rb = require('../netlify/functions/risk-backup.js');
  const sheet = {app:'x', version:'3.6.0', riskDataVersion:'2026-06', updatedAt:'2026-06-12',
    overrides:{countries:{Hungary:{score:3, reason:'FATF grey-listing', at:'2026-06-12'}}, activities:{}, recycled:{}, mined:{}}};
  process.env.ASANA_ACCESS_TOKEN = 'test-token';
  calls = []; projectTasksOnServer = [];
  r = await rb.handler({httpMethod:'POST', body:JSON.stringify({sheet})});
  const rbMade = calls.find(c => c.opts.method === 'POST' && c.url.endsWith('/tasks'));
  check('risk-backup creates the mirror task with the sheet between markers', r.statusCode === 200
    && JSON.parse(r.body).updated === false && rbMade
    && JSON.parse(rbMade.opts.body).data.name === 'RISK DATA SHEET (auto-backup)'
    && JSON.parse(rbMade.opts.body).data.notes.includes('===RISK DATA SHEET===')
    && JSON.parse(rbMade.opts.body).data.notes.includes('FATF grey-listing'));
  calls = []; projectTasksOnServer = [{gid:'rb1', name:'RISK DATA SHEET (auto-backup)'}];
  r = await rb.handler({httpMethod:'POST', body:JSON.stringify({sheet})});
  check('risk-backup updates the existing mirror task in place', r.statusCode === 200
    && JSON.parse(r.body).updated === true
    && calls.some(c => c.opts.method === 'PUT' && c.url.endsWith('/tasks/rb1')));
  r = await rb.handler({httpMethod:'POST', body:JSON.stringify({sheet:{nope:1}})});
  check('risk-backup rejects payloads without overrides', r.statusCode === 400);
  r = await rb.handler({httpMethod:'GET'});
  check('risk-backup rejects non-POST', r.statusCode === 405);
  delete process.env.ASANA_ACCESS_TOKEN;
  delete global.fetch;

  // ── Edge-case resilience tests ──

  // Corrupted localStorage recovery: loadRiskData must return a fresh empty sheet,
  // never throw, even when the stored value is not valid JSON.
  (function(){
    const savedM = Object.assign({}, global.localStorage._m);
    global.localStorage._m['hsra.riskdata.v1'] = '{corrupted:{{{not json';
    const rd = A.loadRiskData();
    check('loadRiskData recovers from corrupted localStorage', rd && typeof rd.overrides === 'object' && Object.keys(rd.overrides.countries).length === 0);
    global.localStorage._m = savedM;
  })();

  // Year field clamping: mergeState must clamp entityYears and relYears to 0–99.
  (function(){
    const s = A.mergeState({profile:{activity:'Non-Manufactured Precious Metal Trading', onboard:'No', entityYears:9999, relYears:-5}});
    check('mergeState clamps entityYears to 99', s.profile.entityYears === 99);
    check('mergeState clamps relYears to 0',     s.profile.relYears   === 0);
  })();

  // Very long string handling: mergeState must not crash and must preserve long strings as-is.
  (function(){
    const longName = 'A'.repeat(12000);
    const s = A.mergeState({entity:{name: longName, jurisdiction:'United Kingdom'}, profile:{}, questions:{}, signoff:{}});
    check('mergeState handles 12k-char entity name without throwing', typeof s.entity.name === 'string' && s.entity.name.length === 12000);
  })();

  // Asana retry: storeFailedDelivery / clearFailedDelivery round-trip.
  (function(){
    const ref = 'RA-TEST-999';
    const payload = {name: ref + ' · Test · CDD 19', band: 'CDD'};
    A.storeFailedDelivery(ref, payload);
    check('storeFailedDelivery persists payload',   JSON.stringify(A.getFailedPayload(ref)) === JSON.stringify(payload));
    A.clearFailedDelivery(ref);
    check('clearFailedDelivery removes payload',    A.getFailedPayload(ref) === null);
  })();

  // NARRATIVE_POLICIES: buildNarrative must still reference all policy long-form names.
  (function(){
    reset(); A.state.entity.name = 'Test Co'; A.state.entity.jurisdiction = 'United Kingdom'; A.recalc();
    const n = A.buildNarrative();
    check('narrative cites TFS policy by full name',  n.includes('Targeted Financial Sanctions procedure'));
    check('narrative cites KYC policy by full name',  n.includes('Know Your Customer procedure'));
    check('narrative cites RAS by full name',         n.includes('Risk Appetite Statement'));
  })();

  // UI entry-point regression: these functions are tested above; the buttons
  // ensure users can actually reach them without the browser console.
  // (Export/Import JSON are intentionally code-only — no UI button.)
  check('reassess button wired in HTML', html.includes('onclick="reassess()"'));
  check('retry Asana button wired in HTML', html.includes('onclick="retryAsanaDelivery()"'));
  check('print preflight wired in HTML', html.includes('onclick="printPreflight()"'));

  /* ── 27. Encryption-at-rest primitives (WebCrypto) ── */
  await (async function(){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await A._deriveKey('correct horse battery staple', salt, 1000);
    const plain = 'sensitive client data — Fine Gold LLC, REG-123';
    const blob = await A.encryptStr(key, plain);
    check('encryptStr produces tagged ciphertext, not plaintext',
      blob.startsWith('hsx1:') && !blob.includes('Fine Gold') && !blob.includes('REG-123'));
    check('decryptStr round-trips to the original plaintext', (await A.decryptStr(key, blob)) === plain);
    const wrong = await A._deriveKey('wrong passphrase', salt, 1000);
    let rejected = false; try{ await A.decryptStr(wrong, blob); }catch(e){ rejected = true; }
    check('wrong passphrase cannot decrypt (AES-GCM auth fails)', rejected);
    let plainRejected = false; try{ await A.decryptStr(key, 'just-some-plaintext'); }catch(e){ plainRejected = true; }
    check('decryptStr rejects non-encrypted input', plainRejected);
  })();

  /* ── 28. Tamper-evident activity log (hash chain) ── */
  await (async function(){
    global.localStorage.removeItem('hsra.audit.v1');
    await A.auditAppend('test.one', 'first');
    await A.auditAppend('test.two', 'second');
    const log = A.auditAll();
    check('audit log appends hash-chained entries',
      log.length === 2 && !!log[0].hash && !!log[1].hash && log[0].hash !== log[1].hash);
    check('audit chain verifies as intact', (await A.auditVerify()) === true);
    const sameHash = await A.sha256Hex('x'); const sameHash2 = await A.sha256Hex('x');
    check('sha256Hex is deterministic 64-hex', sameHash === sameHash2 && /^[0-9a-f]{64}$/.test(sameHash));
    log[0].detail = 'tampered'; global.localStorage.setItem('hsra.audit.v1', JSON.stringify(log));
    check('audit chain detects a tampered earlier entry', (await A.auditVerify()) === false);
    global.localStorage.removeItem('hsra.audit.v1');
  })();

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
