/* Runtime smoke tests for the two added presentation screens:
   console.html (AI Operations Console) and advisor.html (Hawkeye Sterling
   Advisor). Each screen's inline script is executed against a minimal DOM
   stub — no dependencies — to prove the boot path runs without throwing and
   renders the expected content, and that the core interactions (operator
   switch, ask flow, tab switch, Q&A expand) behave.

   The compliance logic lives in index.html (covered by app.test.js); these
   screens are presentation-only, so the assertions focus on render output.

   Usage: node test/screens.test.js */
const fs = require('fs');
const path = require('path');

/* ── Assertions ── */
let passed = 0, failed = 0;
function check(name, cond){
  if(cond){ passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}
const countOcc = (hay, needle) => hay.split(needle).length - 1;

/* ── Minimal DOM stub ── */
function makeEl(){
  const el = {
    _inner:'', textContent:'', value:'', style:{}, _attrs:{}, _fec:null,
    addEventListener(){}, appendChild(){}, click(){},
    setAttribute(k,v){ this._attrs[k] = String(v); },
    getAttribute(k){ return k in this._attrs ? this._attrs[k] : null; },
    classList:{ _s:new Set(),
      add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); },
      toggle(c,f){ if(f===undefined){ this._s.has(c)?this._s.delete(c):this._s.add(c); } else { f?this._s.add(c):this._s.delete(c); } return this._s.has(c); },
      contains(c){ return this._s.has(c); } }
  };
  Object.defineProperty(el,'innerHTML',{ get(){ return this._inner; }, set(v){ this._inner = String(v); } });
  Object.defineProperty(el,'firstElementChild',{ get(){ if(!this._fec) this._fec = makeEl(); return this._fec; } });
  return el;
}

/* Run a screen's inline <script> under the stub, with an appended bridge that
   exposes its internals (same technique app.test.js uses for index.html). */
function runScreen(file, bridge){
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if(!m) throw new Error('no inline script in ' + file);

  const els = {};
  const timers = [];
  global.document = {
    getElementById(id){ return els[id] || (els[id] = makeEl()); },
    createElement(){ return makeEl(); },
    querySelectorAll(){ return []; },               /* event binding becomes a no-op */
    documentElement: { style: { _p:{}, setProperty(k,v){ this._p[k] = v; }, getPropertyValue(k){ return this._p[k] || ''; } } }
  };
  global.window = { matchMedia(){ return { matches:true }; }, addEventListener(){} };  /* reduced motion → deterministic */
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};
  global.performance = { now: () => Date.now() };
  global.setInterval = () => 0;  global.clearInterval = () => {};
  global.setTimeout = (cb) => { timers.push(cb); return timers.length; };  global.clearTimeout = () => {};

  let api = {};
  (0, eval)(m[1] + '\n;globalThis.__screenAPI = (' + bridge + ');');
  api = globalThis.__screenAPI;
  return { els, timers, api, docStyle: global.document.documentElement.style };
}

/* ── 1. AI Operations Console ── */
(function(){
  const { els, api, docStyle } = runScreen('console.html',
    '{ get state(){return state;}, op, renderOperator, OPERATORS }');

  check('console: boots with Cypher on duty', els.operatorName.textContent === 'Cypher'
    && /Transaction Monitoring/.test(els.operatorRole.textContent));
  check('console: default accent is Cypher pink', docStyle.getPropertyValue('--ac') === '255,92,168');
  check('console: stat tiles count up to full targets', countOcc(els.statTiles.innerHTML, 'class="tile"') === 4
    && els.statTiles.innerHTML.includes('9,471') && els.statTiles.innerHTML.includes('1,284'));
  check('console: six live alerts render with entities', countOcc(els.alertStream.innerHTML, 'class="alert-row"') === 6
    && els.alertStream.innerHTML.includes('Meridian Bullion DMCC') && els.alertStream.innerHTML.includes('Aurum Refining Ltd'));
  check('console: diligence mix shows three bands at 68/22/10', countOcc(els.riskBars.innerHTML, 'class="bar-row"') === 3
    && els.riskBars.innerHTML.includes('68%') && els.riskBars.innerHTML.includes('10%'));
  check('console: jurisdiction watch lists five jurisdictions', countOcc(els.jurWatch.innerHTML, 'class="jur-row"') === 5
    && els.jurWatch.innerHTML.includes('Iran') && els.jurWatch.innerHTML.includes('United Arab Emirates'));
  check('console: operator strip offers all six robots', countOcc(els.operatorStrip.innerHTML, 'class="op-btn"') === 6);
  check('console: uptime renders as HH:MM:SS', /\d{2}:\d{2}:\d{2}/.test(els.uptime.textContent));

  /* Reassign operator → HUD + accent recolour */
  api.state.operatorId = 'ember'; api.renderOperator();
  check('console: reassigning to Ember swaps the robot image', els.operatorName.textContent === 'Ember'
    && els.robotImg.style.backgroundImage.includes('persona-ember'));
})();

/* ── 2. Hawkeye Sterling Advisor ── */
(function(){
  const { els, timers, api } = runScreen('advisor.html',
    '{ get state(){return state;}, render, renderAsk, renderQa, renderQaList, ask, reset, persona, PERSONAS, QA_DATA }');

  check('advisor: boots on the Ask tab', els.tabs.innerHTML.includes('Ask the advisor')
    && els.tabs.innerHTML.includes('Regulatory Q&amp;A'));
  check('advisor: composer + idle hero render', els.main.innerHTML.includes('Your question')
    && els.main.innerHTML.includes('Ask me anything about AML compliance.'));
  check('advisor: persona picker offers five advisors, Sterling default', countOcc(els.main.innerHTML, 'class="p-btn"') === 5
    && els.main.innerHTML.includes('<b>Sterling</b>'));
  check('advisor: Quick mode hint reasons over 24 directives', els.main.innerHTML.includes('Reasoning over 24 directives'));

  /* Switch persona → header avatar + picker update */
  api.state.personaId = 'ember'; api.renderAsk();
  check('advisor: selecting Ember updates the persona caption', els.main.innerHTML.includes('<b>Ember</b>'));
  api.state.personaId = 'sterling'; api.renderAsk();

  /* Ask flow: idle → reasoning → (timer) → answer */
  api.state.question = 'What CDD is required for a UAE gold trader?';
  api.ask();
  check('advisor: Ask enters the reasoning phase', api.state.phase === 'reasoning'
    && els.hero.innerHTML.includes('Reasoning over 24 directives'));
  check('advisor: reasoning timer was scheduled', timers.length >= 1);
  timers[timers.length - 1]();   /* flush the 1.5s reasoning timer */
  check('advisor: answer renders verdict, citation and steps', api.state.phase === 'answer'
    && els.hero.innerHTML.includes('Enhanced Due Diligence')
    && els.hero.innerHTML.includes('FATF Rec. 22 &amp; 23')
    && els.hero.innerHTML.includes('Decision guide'));
  api.reset();
  check('advisor: Ask another returns to the idle hero', api.state.phase === 'idle'
    && els.hero.innerHTML.includes('Ask me anything'));

  /* Regulatory Q&A tab */
  api.state.tab = 'qa'; api.render();
  check('advisor: Q&A tab lists all five curated questions', els.main.innerHTML.includes('Regulatory Q&amp;A')
    && countOcc(els.qaList.innerHTML, 'class="qa-item"') === 5
    && els.qaList.innerHTML.includes('When must a DPMS file a cash transaction report?'));
  api.state.expandedQa = 'q1'; api.renderQaList();
  check('advisor: expanding a question reveals its verdict + cited basis',
    els.qaList.innerHTML.includes('DPMSR required') && els.qaList.innerHTML.includes('Art. 16'));

  /* Filter narrows the list */
  api.state.qaQuery = 'suspicious'; api.renderQaList();
  check('advisor: filter narrows the Q&A list', countOcc(els.qaList.innerHTML, 'class="qa-item"') === 1
    && els.qaList.innerHTML.includes('Suspicious Activity Report'));
})();

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
