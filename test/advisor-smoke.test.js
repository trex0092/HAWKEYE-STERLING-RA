/* Advisor full-surface smoke test — exercises EVERY subject in the Advisor
   (advisor.html) against a minimal DOM stub, with no dependencies:
     • Regulatory Q&A: every group renders, every question renders a cited answer.
     • Super Tools: every tool runs and renders a deterministic, cited result;
       the Escalation engine is checked across PROHIBITED / EDD / CDD scenarios.
     • Ask: every hero phase (idle / reasoning / answer / live / error) renders.
   Proves the boot path and every interaction run without throwing and produce
   non-empty, citation-backed output.

   Usage: node test/advisor-smoke.test.js */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function check(name, cond){
  if(cond){ passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}
const countOcc = (hay, needle) => hay.split(needle).length - 1;

/* ── Minimal DOM stub (same technique as screens.test.js) ── */
function makeEl(){
  const el = {
    _inner:'', textContent:'', value:'', style:{}, _attrs:{}, _fec:null,
    addEventListener(){}, appendChild(){}, click(){}, focus(){},
    setAttribute(k,v){ this._attrs[k] = String(v); },
    getAttribute(k){ return k in this._attrs ? this._attrs[k] : null; },
    classList:{ _s:new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); },
      toggle(c,f){ if(f===undefined){ this._s.has(c)?this._s.delete(c):this._s.add(c);} else { f?this._s.add(c):this._s.delete(c);} return this._s.has(c); },
      contains(c){ return this._s.has(c); } }
  };
  Object.defineProperty(el,'innerHTML',{ get(){ return this._inner; }, set(v){ this._inner = String(v); } });
  Object.defineProperty(el,'firstElementChild',{ get(){ if(!this._fec) this._fec = makeEl(); return this._fec; } });
  return el;
}
function runScreen(file, bridge){
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const lower = html.toLowerCase();
  const dataSrcs = [];
  for(let si = lower.indexOf('<script'); si !== -1; si = lower.indexOf('<script', si + 7)){
    const tagEnd = html.indexOf('>', si); if(tagEnd === -1) break;
    const seg = html.slice(si, tagEnd), k = seg.indexOf('src="');
    if(k !== -1){ const v = seg.slice(k + 5, seg.indexOf('"', k + 5)); if(/\.js$/i.test(v)) dataSrcs.push(v.replace(/^\//, '')); }
  }
  /* Boot logic now lives in an external same-origin file (advisor.js) so the
     CSP can drop 'unsafe-inline'; load it directly, with an inline-block fallback. */
  const boot = file.replace(/\.html$/, '.js');
  const dataOnly = dataSrcs.filter(p => p.split('/').pop() !== boot);
  const open = lower.indexOf('<script>');
  const start = open === -1 ? -1 : open + '<script>'.length;
  const end = start > 0 ? lower.indexOf('</script', start) : -1;
  const script = (open !== -1 && start > 0 && end !== -1)
    ? html.slice(start, end)
    : fs.readFileSync(path.join(__dirname, '..', boot), 'utf8');
  const els = {};
  global.document = {
    getElementById(id){ return els[id] || (els[id] = makeEl()); },
    createElement(){ return makeEl(); }, querySelectorAll(){ return []; },
    addEventListener(){},                            /* delegation layer registers here */
    documentElement: { style: { _p:{}, setProperty(k,v){ this._p[k]=v; }, getPropertyValue(k){ return this._p[k]||''; } } }
  };
  global.window = { matchMedia(){ return { matches:true }; }, addEventListener(){} };
  const _store = {};
  global.localStorage = { getItem(k){ return Object.prototype.hasOwnProperty.call(_store,k)?_store[k]:null; }, setItem(k,v){ _store[k]=String(v); }, removeItem(k){ delete _store[k]; } };
  global.requestAnimationFrame = () => 0; global.cancelAnimationFrame = () => {};
  global.performance = { now: () => Date.now() };
  global.setInterval = () => 0; global.clearInterval = () => {};
  global.setTimeout = () => 0; global.clearTimeout = () => {};
  global.fetch = () => new Promise(() => {});
  for(const p of dataOnly){ try{ (0, eval)(fs.readFileSync(path.join(__dirname, '..', p), 'utf8')); }catch(e){} }
  (0, eval)(script + '\n;globalThis.__screenAPI = (' + bridge + ');');
  return { els, api: globalThis.__screenAPI };
}

const BRIDGE = '{ get state(){return state;}, render, renderTabs, renderQa, renderRegGroups, regGroups,'
  + ' regAnswerHtml, qText, qAnswer, genericRun, escalationRun, toolsList, currentTool, renderTools,'
  + ' renderToolResult, heroHtml, aupAck, aupAcked, piiScan, get ANSWER(){return ANSWER;} }';

console.log('\n— Advisor full-surface smoke test —\n');
const { els, api } = runScreen('advisor.html', BRIDGE);

/* ── Boot ── */
let bootOk = true; try { api.render(); } catch(e){ bootOk = false; console.log('   boot threw: '+e.message); }
check('boot: advisor renders without throwing', bootOk && els.main.innerHTML.length > 0);

/* ── 1. Regulatory Q&A: every subject ── */
const groups = api.regGroups();
let qTotal = 0, qBad = 0, grpThrew = 0;
const qFails = [];
groups.forEach((g, gi) => {
  api.state.regOpen = gi; api.state.qOpen = null;
  try { api.renderRegGroups(); } catch(e){ grpThrew++; qFails.push([g.label, 'group render threw: '+e.message]); }
  (g.questions || []).forEach(q => {
    qTotal++;
    const ans = api.qAnswer(q);
    if(!ans){ qBad++; qFails.push([api.qText(q), 'no answer object']); return; }
    let h; try { h = api.regAnswerHtml(ans); } catch(e){ qBad++; qFails.push([api.qText(q), 'answer render threw: '+e.message]); return; }
    if(!h.includes('qa-summary') || !h.includes('qa-basis') || !(ans.a && ans.a.length > 20)){
      qBad++; qFails.push([api.qText(q), 'missing substantive summary or cited basis']);
    }
  });
});
check('Q&A: all 59 groups render without throwing', grpThrew === 0 && groups.length === 59);
check('Q&A: every one of '+qTotal+' subjects renders a substantive cited answer', qBad === 0 && qTotal === 336);

/* ── 2. Super Tools: every subject ── */
const tools = api.toolsList();
let tBad = 0; const tFails = [];
tools.forEach(t => {
  api.state.toolId = t.id; api.state.toolResult = null;
  try { api.renderTools(); } catch(e){ tBad++; tFails.push([t.id, 'form render threw: '+e.message]); return; }
  let res;
  try {
    res = (t.id === 'escalation')
      ? api.escalationRun({ subject:'Acme Trading FZE', risk:'85', sanctions:'', pep:'ministerial', typologies:'tbml', jurisdictions:'AE' })
      : api.genericRun(t, 'A tier-1 PEP from a high-risk jurisdiction wires USD 500,000 to a free-zone shell company.');
  } catch(e){ tBad++; tFails.push([t.id, 'run threw: '+e.message]); return; }
  api.state.toolResult = res;
  let html; try { html = api.renderToolResult(); } catch(e){ tBad++; tFails.push([t.id, 'result render threw: '+e.message]); return; }
  if(html.includes('tool-err')) { tBad++; tFails.push([t.id, 'rendered an error']); return; }
  if(!html.includes('step-row') || !html.includes('qa-basis')) { tBad++; tFails.push([t.id, 'missing steps or cited basis']); }
});
check('Super Tools: all 186 subjects run + render a cited result', tBad === 0 && tools.length === 186);

/* Escalation rule engine — decision correctness across scenarios */
const esc = (v) => api.escalationRun(v);
check('Escalation: sanctions hit → PROHIBITED',
  esc({subject:'X', sanctions:'OFAC', risk:'10'}).verdict.startsWith('PROHIBITED'));
check('Escalation: PEP over low score → EDD',
  esc({subject:'X', pep:'ministerial', risk:'10'}).verdict.startsWith('EDD'));
check('Escalation: clean low-risk → CDD',
  esc({subject:'X', risk:'10'}).verdict.startsWith('CDD'));

/* ── 2b. EU AI Act transparency notice renders on the Ask tab ── */
api.state.tab = 'ask';
api.render();
check('Ask tab shows the AI transparency notice', els.main.innerHTML.includes('You are interacting with an AI system'));

/* ── 2c. AUP gate shows until acknowledged, then disappears ── */
check('Ask tab shows the AUP acknowledgment gate before ack', els.main.innerHTML.includes('AI Acceptable-Use Policy'));
api.aupAck();
api.render();
check('AUP gate disappears after acknowledgment', !els.main.innerHTML.includes('I acknowledge'));

/* ── 3. Ask: every hero phase ── */
function hero(phase, mut){ api.state.phase = phase; if(mut) mut(); try { return api.heroHtml(); } catch(e){ return 'THREW:'+e.message; } }
check('Ask: idle hero renders', /hero-title/.test(hero('idle', () => { api.state.liveAnswer = null; })));
check('Ask: reasoning hero renders', /hero-reason/.test(hero('reasoning')));
check('Ask: default ANSWER renders', (() => { const h = hero('answer', () => { api.state.liveAnswer = null; api.state.askedQuestion = 'Q?'; }); return h.includes('Advisor response') && h.includes('Cited legal basis'); })());
check('Ask: live brain answer renders', (() => { const h = hero('answer', () => { api.state.liveAnswer = {ok:true, text:'A cited live answer body.', model:'claude'}; }); return h.includes('A cited live answer body.'); })());
check('Ask: brain-unavailable error renders', (() => { const h = hero('answer', () => { api.state.liveAnswer = {ok:false, text:'The brain is unavailable.'}; }); return h.includes('The brain is unavailable.'); })());

/* ── Report ── */
if(qFails.length){ console.log('\nQ&A failures:'); qFails.slice(0,20).forEach(f=>console.log('  -', f[0], '=>', f[1])); }
if(tFails.length){ console.log('\nSuper Tools failures:'); tFails.slice(0,20).forEach(f=>console.log('  -', f[0], '=>', f[1])); }
console.log('\n'+passed+' passed, '+failed+' failed  ('+qTotal+' Q&A subjects, '+tools.length+' tools smoke-tested)\n');
if(failed) process.exitCode = 1;
