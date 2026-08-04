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
function runScreen(file, bridge, seed){
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  /* Extract the inline boot <script> (no attributes) by plain string search — our
     fixtures have a single lowercase <script> block. Same-origin data scripts
     (<script src="…js">) are collected here and eval'd below so their globals
     (window.SUPER_TOOLS / REG_GROUPS) exist before the boot runs. Tag scanning is
     done with indexOf, not a tag-matching regex (avoids CodeQL js/bad-tag-filter). */
  const lower = html.toLowerCase();
  const dataSrcs = [];
  for(let si = lower.indexOf('<script'); si !== -1; si = lower.indexOf('<script', si + 7)){
    const tagEnd = html.indexOf('>', si); if(tagEnd === -1) break;
    const seg = html.slice(si, tagEnd), k = seg.indexOf('src="');
    if(k !== -1){ const v = seg.slice(k + 5, seg.indexOf('"', k + 5)); if(/\.js$/i.test(v)) dataSrcs.push(v.replace(/^\//, '')); }
  }
  /* Page logic now lives in an external same-origin file (console.js / advisor.js)
     so the CSP can drop 'unsafe-inline'; load that boot file directly. Older
     fixtures with an inline <script> block still work via the fallback below. */
  const boot = file.replace(/\.html$/, '.js');
  const dataOnly = dataSrcs.filter(p => p.split('/').pop() !== boot);
  const open = lower.indexOf('<script>');
  const start = open === -1 ? -1 : open + '<script>'.length;
  const end = start > 0 ? lower.indexOf('</script', start) : -1;
  const script = (open !== -1 && start > 0 && end !== -1)
    ? html.slice(start, end)
    : fs.readFileSync(path.join(__dirname, '..', boot), 'utf8');

  const els = {};
  const timers = [];
  global.document = {
    getElementById(id){ return els[id] || (els[id] = makeEl()); },
    createElement(){ return makeEl(); },
    querySelectorAll(){ return []; },               /* event binding becomes a no-op */
    addEventListener(){},                            /* delegation layer registers here */
    documentElement: { style: { _p:{}, setProperty(k,v){ this._p[k] = v; }, getPropertyValue(k){ return this._p[k] || ''; } } }
  };
  global.window = { matchMedia(){ return { matches:true }; }, addEventListener(){} };  /* reduced motion → deterministic */
  const _store = Object.assign({}, seed || {});                                        /* seedable localStorage */
  global.localStorage = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(_store,k) ? _store[k] : null; },
    setItem(k,v){ _store[k]=String(v); }, removeItem(k){ delete _store[k]; }
  };
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};
  global.performance = { now: () => Date.now() };
  global.setInterval = () => 0;  global.clearInterval = () => {};
  global.setTimeout = (cb) => { timers.push(cb); return timers.length; };  global.clearTimeout = () => {};
  const fetches = [];
  global.fetch = (url, opts) => { fetches.push({ url: String(url), opts }); return new Promise(() => {}); };

  let api = {};
  for(const p of dataOnly){ try{ (0, eval)(fs.readFileSync(path.join(__dirname, '..', p), 'utf8')); }catch(e){} }
  (0, eval)(script + '\n;globalThis.__screenAPI = (' + bridge + ');');
  api = globalThis.__screenAPI;
  return { els, timers, fetches, api, docStyle: global.document.documentElement.style };
}

/* ── 1a. AI Operations Console — NEW APP (empty register → zeros, no mock data) ── */
(function(){
  const { els, api, docStyle } = runScreen('console.html',
    '{ get state(){return state;}, op, renderOperator, OPERATORS }');   /* no seed → empty register */

  check('console(new): boots with Cypher on duty', els.operatorName.textContent === 'Cypher'
    && /Transaction Monitoring/.test(els.operatorRole.textContent));
  check('console(new): four stat tiles all read zero', countOcc(els.statTiles.innerHTML, 'class="tile"') === 4
    && countOcc(els.statTiles.innerHTML, '>0<') === 4);
  check('console(new): NO fabricated demo numbers (9,471 / 1,284 / 37)', !els.statTiles.innerHTML.includes('9,471')
    && !els.statTiles.innerHTML.includes('1,284') && !els.statTiles.innerHTML.includes('>37<'));
  check('console(new): tile titles coloured green / amber / red / blue',
    els.statTiles.innerHTML.includes('color:#4FD6A0">Entities Monitored')
    && els.statTiles.innerHTML.includes('color:#FFAE57">Open Alerts')
    && els.statTiles.innerHTML.includes('color:#FF6B6B">Sanctions Hits')
    && els.statTiles.innerHTML.includes('color:#7FB3E8">Cases Cleared'));
  check('console(new): alert stream shows guidance, no fake entities', els.alertStream.innerHTML.includes('No assessments filed yet')
    && !els.alertStream.innerHTML.includes('Meridian'));
  check('console(new): diligence mix + jurisdictions show empty states',
    els.riskBars.innerHTML.includes('No assessments yet') && els.jurWatch.innerHTML.includes('No jurisdictions yet'));
  check('console(new): threat level NOMINAL when nothing is filed', els.threatLevel.textContent === 'NOMINAL');
  check('console(new): operator strip offers all seventeen robots', countOcc(els.operatorStrip.innerHTML, 'class="op-btn"') === 17);
  check('console(new): default accent is Cypher pink', docStyle.getPropertyValue('--ac') === '255,92,168');

  api.state.operatorId = 'ember'; api.renderOperator();
  check('console(new): reassigning to Ember swaps the robot image', els.operatorName.textContent === 'Ember'
    && els.robotImg.style.backgroundImage.includes('persona-ember'));
})();

/* ── 1b. AI Operations Console — WITH DATA (derived from the register) ── */
(function(){
  const reg = JSON.stringify({version:1, items:{
    'RA-1':{savedAt:'2026-06-15T10:00:00Z', summary:{entity:'Alpha Gold DMCC', total:19, outcome:'CDD', prohibited:false, complete:true,  date:'2026-06-15', nextReview:'2027-06-15'}, state:{entity:{name:'Alpha Gold DMCC', jurisdiction:'United Arab Emirates'}, signoff:{}}},
    'RA-2':{savedAt:'2026-06-16T11:00:00Z', summary:{entity:'Beta Refining',   total:24, outcome:'EDD', prohibited:false, complete:false, date:'2026-06-16', nextReview:'2020-01-01'}, state:{entity:{name:'Beta Refining', jurisdiction:'Russian Federation'}, signoff:{}}},
    'RA-3':{savedAt:'2026-06-14T09:00:00Z', summary:{entity:'Gamma Metals',    total:21, outcome:'PROHIBITED', prohibited:true, complete:true, date:'2026-06-14', nextReview:''}, state:{entity:{name:'Gamma Metals', jurisdiction:'Islamic Republic of Iran'}, signoff:{}}}
  }});
  const { els } = runScreen('console.html', '{}', {'hsra.register.v1': reg});

  check('console(data): entities monitored = 3 from the register', els.statTiles.innerHTML.includes('>3<'));
  check('console(data): a prohibited entity surfaces as a sanctions hit', els.statTiles.innerHTML.includes('do not onboard'));
  check('console(data): completed assessments counted as cases cleared', els.statTiles.innerHTML.includes('marked complete'));
  check('console(data): real entities populate the alert stream', els.alertStream.innerHTML.includes('Alpha Gold DMCC')
    && els.alertStream.innerHTML.includes('Beta Refining') && !els.alertStream.innerHTML.includes('Meridian'));
  check('console(data): jurisdiction watch reflects the register', els.jurWatch.innerHTML.includes('Islamic Republic of Iran')
    && els.jurWatch.innerHTML.includes('United Arab Emirates'));
  check('console(data): threat CRITICAL when a prohibited entity exists', els.threatLevel.textContent === 'CRITICAL');
  check('console(data): diligence mix renders percentages', /\d+%/.test(els.riskBars.innerHTML));
})();

/* ── 1c. AI Operations Console — ENCRYPTED register (must NOT read as all-clear) ── */
(function(){
  const { els } = runScreen('console.html', '{}', {'hsra.register.v1': 'hsx1:AAAA:BBBB'});
  check('console(encrypted): alert stream says the register is encrypted, not "nothing filed"',
    els.alertStream.innerHTML.includes('encrypted') && !els.alertStream.innerHTML.includes('No assessments filed yet'));
  check('console(encrypted): entities tile sub flags the encrypted register',
    els.statTiles.innerHTML.includes('register encrypted'));
})();

/* ── 2. Hawkeye Sterling Advisor ── */
(function(){
  const { els, fetches, api } = runScreen('advisor.html',
    '{ get state(){return state;}, render, renderAsk, renderQa, renderRegGroups, regGroups, askQuestion, renderTools, currentTool, renderResultOnly, escalationRun, genericRun, toolsList, ask, reset, persona, heroHtml, aupAck, answerFromResponse, heroAnswerHtml, PERSONAS }');

  check('advisor: boots on the Ask tab with all three tabs', els.tabs.innerHTML.includes('Ask the advisor')
    && els.tabs.innerHTML.includes('Regulatory Q&amp;A') && els.tabs.innerHTML.includes('Super Tools'));
  check('advisor: composer + idle hero render', els.main.innerHTML.includes('Your question')
    && els.main.innerHTML.includes('Ask me anything about AML compliance.'));
  check('advisor: persona picker offers sixteen advisors, Sterling default', countOcc(els.main.innerHTML, 'class="p-btn"') === 16
    && els.main.innerHTML.includes('<b>Sterling</b>'));
  check('advisor: mode toggle offers the three backend reasoning depths, no fake "directives" claim',
    els.main.innerHTML.includes('data-mode="Speed"') && els.main.innerHTML.includes('data-mode="Balanced"')
    && els.main.innerHTML.includes('data-mode="Deep"') && !els.main.innerHTML.includes('data-mode="Quick"')
    && !els.main.innerHTML.includes('directives'));

  /* Switch persona → header avatar + picker update */
  api.state.personaId = 'ember'; api.renderAsk();
  check('advisor: selecting Ember updates the persona caption', els.main.innerHTML.includes('<b>Ember</b>'));
  api.state.personaId = 'sterling'; api.renderAsk();

  /* Ask flow: idle → reasoning → (timer) → answer.
     Acknowledge the AUP gate first (required before any send). */
  api.aupAck();
  api.state.question = 'What CDD is required for a UAE gold trader?';
  api.ask();
  check('advisor: Ask enters the reasoning phase', api.state.phase === 'reasoning'
    && els.hero.innerHTML.includes('Reviewing the cited legal sources'));
  check('advisor: brain fetch was dispatched on ask', fetches.length >= 1 && fetches[0].url.includes('brain-soul'));
  /* Simulate the static fallback answer path (liveAnswer null → renders ANSWER object) */
  /* A null live answer must NEVER render a substitute verdict: the canned
     "Enhanced Due Diligence · High confidence" card this test used to pin was
     removed 2026-08-04 as an integrity hazard — the idle hero renders instead. */
  api.state.phase = 'answer'; api.state.liveAnswer = null;
  document.getElementById('hero').innerHTML = api.heroHtml();
  check('advisor: a null live answer renders the idle hero, never a canned verdict',
    !els.hero.innerHTML.includes('Enhanced Due Diligence')
    && !els.hero.innerHTML.includes('High confidence')
    && els.hero.innerHTML.includes('Ask me anything'));
  const live = {ok:true, text:'Live cited answer body.', model:'claude'};
  api.state.liveAnswer = live;
  document.getElementById('hero').innerHTML = api.heroHtml();
  check('advisor: the live answer renders with the audit surface', els.hero.innerHTML.includes('Live cited answer body.')
    && els.hero.innerHTML.includes('Advisor response'));
  api.state.liveAnswer = null;
  api.reset();
  check('advisor: Ask another returns to the idle hero', api.state.phase === 'idle'
    && els.hero.innerHTML.includes('Ask me anything'));

  /* Asking with an empty composer prompts, rather than substituting a canned
     question and dispatching a (billed) backend call. */
  api.aupAck();
  const fetchesBefore = fetches.length;
  api.state.question = '   ';
  api.ask();
  check('advisor: an empty question prompts instead of substituting + sending',
    api.state.phase === 'answer' && /enter a question/i.test(api.state.liveAnswer.text) && fetches.length === fetchesBefore);
  api.reset();

  /* Server-error responses ({ok:false, error} with no `text`) must surface the
     message, not render a blank answer body. */
  check('advisor: a backend error body is mapped to a visible message',
    api.answerFromResponse({ok:false, error:'ANTHROPIC_API_KEY not configured'}).text === 'ANTHROPIC_API_KEY not configured');
  check('advisor: an empty/garbled error body still yields a non-blank message',
    (api.answerFromResponse({ok:false}).text || '').length > 0 && (api.answerFromResponse(null).text || '').length > 0);
  check('advisor: a successful body passes through unchanged',
    api.answerFromResponse({text:'ok', verdict:'CDD'}).verdict === 'CDD');

  /* Regulatory Q&A — full 60-group catalogue from window.REG_GROUPS */
  api.state.tab = 'qa'; api.render();
  check('advisor: Q&A renders all 60 regulatory groups', els.main.innerHTML.includes('Regulatory Q&amp;A')
    && api.regGroups().length === 60 && countOcc(els.regGroups.innerHTML, '<div class="reg-cat') === 60
    && els.regGroups.innerHTML.includes('UAE FDL &amp; Cabinet Resolution'));
  api.state.regOpen = 0; api.renderRegGroups();
  check('advisor: opening a group reveals its cited questions', countOcc(els.regGroups.innerHTML, 'class="reg-q"') >= 1);
  api.state.qaQuery = 'beneficial owner'; api.renderRegGroups();
  check('advisor: filtering narrows to matching questions across groups',
    countOcc(els.regGroups.innerHTML, 'class="reg-q"') >= 1 && /beneficial owner/i.test(els.regGroups.innerHTML));
  api.state.qaQuery = ''; api.state.regOpen = 0; api.renderRegGroups();
  api.askQuestion('What records must I keep, and for how long?');
  check('advisor: picking a question pre-fills the Ask composer', api.state.tab === 'ask'
    && api.state.question === 'What records must I keep, and for how long?');

  /* Super Tools tab — full 187-tool grouped picker + deterministic engines */
  api.state.tab = 'tools'; api.render();
  check('advisor: Super Tools renders the grouped picker + Escalation form',
    els.main.innerHTML.includes('Super Tools') && els.main.innerHTML.includes('Escalation Decision Engine')
    && els.main.innerHTML.includes('id="tf_subject"') && els.main.innerHTML.includes('Get Escalation Decision')
    && els.main.innerHTML.includes('<optgroup'));
  check('advisor: tool form fields are programmatically labelled (a11y)',
    els.main.innerHTML.includes('<label class="tf-label" for="tf_subject">'));
  check('advisor: the picker carries the full 187-tool catalogue across 7 groups',
    api.toolsList().length === 187 && countOcc(els.main.innerHTML, '<optgroup') === 7
    && els.main.innerHTML.includes('Sanctions Nexus') && els.main.innerHTML.includes('STR Drafter'));
  /* sanctions hit → PROHIBITED escalation */
  api.state.toolInputs = {subject:'Aurum Refining Ltd', sanctions:'OFAC, EU'};
  api.state.toolResult = api.escalationRun(api.state.toolInputs); api.renderResultOnly();
  check('advisor: a sanctions hit drives a PROHIBITED escalation decision',
    api.state.toolResult.verdict.indexOf('PROHIBITED') === 0 && els.toolResult.innerHTML.includes('FATF Rec. 6'));
  /* PEP forces the EDD floor even over a low risk score */
  api.state.toolInputs = {subject:'Northwind Jewellers', pep:'national', risk:'30'};
  api.state.toolResult = api.escalationRun(api.state.toolInputs); api.renderResultOnly();
  check('advisor: a PEP forces a mandatory EDD escalation over a low score',
    api.state.toolResult.verdict.indexOf('EDD') === 0 && els.toolResult.innerHTML.includes('FATF Rec. 12'));
  /* clean signals → CDD */
  api.state.toolInputs = {subject:'Crown Coin Exchange', risk:'20'};
  api.state.toolResult = api.escalationRun(api.state.toolInputs); api.renderResultOnly();
  check('advisor: clean low-risk signals resolve to CDD', api.state.toolResult.verdict.indexOf('CDD') === 0);
  /* a free-text PEP tier of "none" must NOT force EDD */
  api.state.toolInputs = {subject:'Crown Coin Exchange', pep:'none', risk:'20'};
  api.state.toolResult = api.escalationRun(api.state.toolInputs);
  check('advisor: PEP tier "none" does not force a mandatory-EDD escalation',
    api.state.toolResult.verdict.indexOf('CDD') === 0);
  /* a non-escalation tool returns deterministic, cited guidance (no faked AI) */
  const genTool = api.toolsList().find(t => t.id !== 'escalation');
  api.state.toolResult = api.genericRun(genTool, 'a DPMS dealer taking structured cash deposits');
  api.renderResultOnly();
  check('advisor: a generic tool returns deterministic, cited guidance',
    api.state.toolResult.kind === 'generic' && els.toolResult.innerHTML.includes('Deterministic guidance')
    && els.toolResult.innerHTML.includes('Federal Decree-Law No. 10 of 2025'));
})();

/* ── 3. Regulatory Q&A inline answers + per-tool Super Tools playbooks ── */
(function(){
  const { els, api } = runScreen('advisor.html',
    '{ get state(){return state;}, render, renderRegGroups, regGroups, genericRun, toolsList }');

  /* Every catalogue question now carries its own cited answer */
  const groups = api.regGroups();
  let totalQ = 0, withAnswer = 0, withRefs = 0;
  groups.forEach(g => (g.questions||[]).forEach(q => {
    totalQ++;
    if(q && typeof q==='object' && q.a && q.a.length > 20) withAnswer++;
    if(q && Array.isArray(q.refs) && q.refs.length) withRefs++;
  }));
  check('qa-data: 350 questions each carry a substantive cited answer',
    totalQ === 350 && withAnswer === 350 && withRefs === 350);

  /* Opening a question renders its answer + cited basis inline (not the canned reply) */
  api.state.tab = 'qa'; api.render();
  api.state.regOpen = 0;
  const firstQ = groups[0].questions[0];
  api.state.qOpen = '0␟' + firstQ.q; api.renderRegGroups();   // qOpen is keyed by groupIndex␟question
  check('qa: opening a question shows its own answer inline',
    els.regGroups.innerHTML.includes('class="qa-summary"')
    && els.regGroups.innerHTML.includes(esc_(firstQ.a).slice(0, 24))
    && els.regGroups.innerHTML.includes('Cited basis'));

  /* Different questions yield different answers (no single canned reply) */
  const q2 = groups[1].questions[0];
  api.state.regOpen = 1; api.state.qOpen = '1␟' + q2.q; api.renderRegGroups();
  check('qa: a second question yields a different cited answer',
    els.regGroups.innerHTML.includes(esc_(q2.a).slice(0, 24)) && q2.a !== firstQ.a);

  /* Super Tools: each tool carries its own bespoke playbook, not a shared template */
  const tools = api.toolsList();
  const withPlay = tools.filter(t => t.play && t.play.intro && Array.isArray(t.play.steps) && t.play.steps.length >= 3
    && Array.isArray(t.play.refs) && t.play.refs.some(r => r.ref === 'UAE Federal Decree-Law No. 10 of 2025'));
  check('tools-data: all 187 tools carry a cited deterministic playbook', tools.length === 187 && withPlay.length === 187);

  const a = api.genericRun(tools.find(t=>t.id==='flags'), 'cash-intensive dealer');
  const b = api.genericRun(tools.find(t=>t.id==='str-drafter') || tools.find(t=>t.id!=='flags'&&t.id!=='escalation'), 'cash-intensive dealer');
  check('tools: two different tools return distinct, tool-specific guidance',
    a.summary !== b.summary && JSON.stringify(a.actions) !== JSON.stringify(b.actions)
    && a.triggers.some(r=>r.ref==='UAE Federal Decree-Law No. 10 of 2025'));
})();

function esc_(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── a11y: skip links (WCAG 2.4.1) on console + advisor ──
   pa11y cannot flag a missing skip link, so its presence is pinned here the
   same way test/app.test.js pins index.html's. */
(function(){
  for(const page of ['console.html', 'advisor.html']){
    const raw = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    check(page + ': skip link is the first element in <body>',
      /<body>\s*(\n\s*)*<a class="skip-link" href="#main">/.test(raw));
    check(page + ': skip link targets a focusable #main', /id="main" tabindex="-1"/.test(raw));
  }
  for(const sheet of ['console.css', 'advisor.css']){
    const css = fs.readFileSync(path.join(__dirname, '..', sheet), 'utf8');
    check(sheet + ': skip link parked off-canvas until focus (never display:none)',
      css.includes('.skip-link{ position:absolute; left:-9999px;')
      && css.includes('.skip-link:focus{ left:0; }')
      && !/\.skip-link\{[^}]*display:none/.test(css));
  }
})();

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
