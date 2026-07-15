/* Hawkeye Sterling - /home/user/HAWKEYE-STERLING-RA/advisor.html page logic.
   Extracted from /home/user/HAWKEYE-STERLING-RA/advisor.html so the Content-Security-Policy can drop
   'unsafe-inline' from script-src. Loaded from the same origin. */
/* ══════════════════════════════════════════
   Hawkeye Sterling Advisor — cited AML Q&A
   Vanilla port of the design component.
══════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
/* Strict-mode shared token (netlify/functions/_auth.js): sends the deploy-time
   <meta name="hsra-app-token"> value as X-App-Token when present. */
function fnHeaders(){
  const h = {'Content-Type':'application/json'};
  try{
    const m = document.querySelector('meta[name="hsra-app-token"]');
    const t = ((m && m.getAttribute('content')) || '').trim();
    if(t) h['X-App-Token'] = t;
  }catch(e){}
  return h;
}

const MODES = ['Quick','Speed','Balanced','Deep'];

const ANSWER = {
  verdict:'Enhanced Due Diligence', tone:'high', confidence:'High confidence',
  summary:'A UAE-licensed dealer in precious metals and stones (DPMS) is a DNFBP under the federal AML framework. Where the trader handles gold at or above the AED 55,000 cash threshold, or shows higher-risk indicators such as cross-border sourcing or PEP involvement, enhanced due diligence is required before the relationship proceeds.',
  basis:[
    {ref:'FATF Rec. 22 & 23', note:'Extends CDD, record-keeping and reporting duties to dealers in precious metals and stones.'},
    {ref:'FATF Rec. 10', note:'Standard customer due diligence and verification of beneficial ownership.'},
    {ref:'UAE Cabinet Resolution No. (134) of 2025', note:'Executive Regulations of FDL 10/2025: identification, verification and ongoing monitoring obligations (supersedes Cabinet Decision No. (10) of 2019).'},
    {ref:'MoE DPMS Guidance', note:'Cash-transaction reporting (DPMSR) at or above AED 55,000, single or linked.'}
  ],
  guide:[
    {n:'01', text:'Confirm the entity is a licensed DPMS and identify the trading activity — mined, recycled, or both.'},
    {n:'02', text:'Screen the customer and all beneficial owners against sanctions, PEP and adverse-media lists.'},
    {n:'03', text:'Assess geographic exposure: UAE-domestic versus cross-border sourcing from higher-risk jurisdictions.'},
    {n:'04', text:'Apply the cash test — single or linked transactions at or above AED 55,000 trigger a DPMSR filing.'}
  ],
  steps:[
    'Collect trade licence, beneficial-ownership declaration and source-of-funds evidence.',
    'Establish the expected transaction profile and set an ongoing-monitoring cadence.',
    'File a DPMSR for any qualifying cash transaction within the statutory window.',
    'Record the EDD rationale and obtain senior-management onboarding approval.'
  ]
};

/* Regulatory Q&A renders window.REG_GROUPS — 56 topic groups / 311 cited
   questions in assets/super-data.js. Each question is {q, a, refs:[{ref,note}]}
   and expands to its own cited answer inline (see renderRegGroups below). */

const PERSONAS = [
  {id:'sterling', name:'Sterling', role:'Lead AML advisor',       img:'assets/persona-sterling.webp', accent:'59,229,208',  pos:'36% 24%'},
  {id:'vale',     name:'Vale',     role:'KYC & onboarding',        img:'assets/persona-vale.webp',     accent:'91,155,216',  pos:'50% 22%'},
  {id:'ember',    name:'Ember',    role:'PEP & adverse media',     img:'assets/persona-ember.webp',    accent:'255,107,80',  pos:'50% 26%'},
  {id:'brass',    name:'Brass',    role:'Records & audit',         img:'assets/persona-brass.webp',    accent:'210,166,72',  pos:'46% 28%'},
  {id:'iris',     name:'Iris',     role:'Typologies & training',   img:'assets/persona-iris.webp',     accent:'180,92,255',  pos:'40% 24%'},
  {id:'bullion',  name:'Bullion',  role:'Precious Metals & Stones (DPMS)',     img:'assets/persona-bullion.webp',  accent:'255,90,200',  pos:'50% 20%'},
  {id:'cinder',   name:'Cinder',   role:'Terrorism & Proliferation Financing', img:'assets/persona-cinder.webp',   accent:'70,150,255',  pos:'40% 30%'},
  {id:'verde',    name:'Verde',    role:'ESG & Human Rights',                  img:'assets/persona-verde.webp',    accent:'60,200,130',  pos:'46% 26%'},
  {id:'haven',    name:'Haven',    role:'Artificial Intelligence',             img:'assets/persona-haven.webp',    accent:'230,180,70',  pos:'42% 26%'},
  {id:'cobalt',   name:'Cobalt',   role:'Trade-Based ML & Trade Finance',      img:'assets/persona-cobalt.webp',   accent:'235,190,90',  pos:'55% 22%'},
  {id:'sentinel', name:'Sentinel', role:'Sanctions Evasion & Watchlists',      img:'assets/persona-sentinel.webp', accent:'255,70,90',   pos:'55% 20%'},
  {id:'lattice',  name:'Lattice',  role:'Beneficial Ownership & UBO',          img:'assets/persona-lattice.webp',  accent:'90,160,255',  pos:'55% 18%'},
  {id:'talon',    name:'Talon',    role:'Trade Sanctions & Export Controls',    img:'assets/persona-talon.webp',    accent:'170,90,255',  pos:'55% 20%'},
  {id:'quartz',   name:'Quartz',   role:'Source of Wealth / Source of Funds',   img:'assets/persona-quartz.webp',   accent:'60,210,120',  pos:'55% 20%'},
  {id:'beacon',   name:'Beacon',   role:'Whistleblowing & Internal Investigations', img:'assets/persona-beacon.webp', accent:'255,150,40',  pos:'55% 20%'},
  {id:'warden',   name:'Warden',   role:'Board & MLRO Governance',              img:'assets/persona-warden.webp',   accent:'210,80,200',  pos:'52% 18%'}
];

let state = {tab:'ask', mode:'Quick', question:'', askedQuestion:'', phase:'idle', liveAnswer:null, regOpen:null, qOpen:null, qaQuery:'', personaId:'sterling', toolId:'escalation', toolInputs:{}, toolResult:null, piiConfirmed:false};
let reasoningTimer = null;
/* Monotonic ask sequence — a response only renders if it belongs to the most
   recent ask() (or nothing was reset in between). Without it, a slow Deep-mode
   response can land after a newer question (or after "Ask another") and
   overwrite the UI with a mismatched question/answer pair. */
let askSeq = 0;

/* AI Acceptable-Use Policy gate — the Advisor is blocked until the operator
   acknowledges the policy once on this device (recorded locally). */
const AUP_KEY = 'hsra.aup.ack.v1';
function aupAcked(){ try{ return !!localStorage.getItem(AUP_KEY); }catch(e){ return false; } }
function aupAck(){ try{ localStorage.setItem(AUP_KEY, JSON.stringify({at:new Date().toISOString(), version:1})); }catch(e){} }

/* Client PII guard — warns before identifiers leave the device (DPIA risk #1). */
const PII_RES = [/\b784-?\d{4}-?\d{7}-?\d\b/, /\b[A-Z]{1,2}\d{6,9}\b/, /\b\d{12,}\b/];
function piiScan(t){ const s = String(t||''); return PII_RES.some(re=>re.test(s)); }

/* ── AI governance telemetry (on-device, privacy-preserving) ──────────────────
   LAT (latency), USAGE (call analytics) and MON (health) for the Advisor. All
   data stays in this browser's localStorage — nothing is sent anywhere, in
   keeping with the suite's no-telemetry-by-design posture. */
const GOV_KEY = 'hsra.advisor.telemetry.v1';
/* Shape-validate, not just parse-validate: a stored value that is valid JSON
   but not the expected object (e.g. `{"calls":3}` or `[]`) would make
   govStats() throw inside renderAsk()'s innerHTML expression and leave the
   Ask tab blank and listener-less until localStorage is cleared by hand. */
function govDefault(){ return {lat:[], usage:{}, flags:{}, lastOk:null, lastErr:null, calls:0}; }
function govLoad(){
  try{
    const g = JSON.parse(localStorage.getItem(GOV_KEY) || 'null');
    if(!g || typeof g !== 'object' || Array.isArray(g)
       || !Array.isArray(g.lat)
       || !g.usage || typeof g.usage !== 'object' || Array.isArray(g.usage)
       || !g.flags || typeof g.flags !== 'object' || Array.isArray(g.flags)) return govDefault();
    return g;
  }catch(e){ return govDefault(); }
}
function govSave(g){ try{ localStorage.setItem(GOV_KEY, JSON.stringify(g)); }catch(e){} }
function govRecord(data){
  const g = govLoad();
  const ok = data && data.ok !== false;
  g.calls = (g.calls||0) + 1;
  if(typeof data.elapsedMs === 'number'){ g.lat.push(data.elapsedMs); if(g.lat.length > 200) g.lat = g.lat.slice(-200); }
  const day = new Date().toISOString().slice(0,10);
  g.usage[day] = g.usage[day] || {n:0, modes:{}, personas:{}};
  g.usage[day].n++;
  g.usage[day].modes[state.mode] = (g.usage[day].modes[state.mode]||0) + 1;
  g.usage[day].personas[state.personaId] = (g.usage[day].personas[state.personaId]||0) + 1;
  // prune usage to the last 30 days
  const keep = Object.keys(g.usage).sort().slice(-30);
  g.usage = keep.reduce((o,k)=>{ o[k]=g.usage[k]; return o; }, {});
  ['hallFlagged','injectionFlagged','anomFlagged','structureFlagged','latencyFlagged','tippingOffFlagged'].forEach(f=>{ if(data[f]) g.flags[f] = (g.flags[f]||0) + 1; });
  if(Array.isArray(data.piiFlagged) && data.piiFlagged.length) g.flags.piiFlagged = (g.flags.piiFlagged||0) + 1;
  if(ok) g.lastOk = new Date().toISOString(); else g.lastErr = new Date().toISOString();
  govSave(g);
}
function pct(arr, p){ if(!arr.length) return null; const s = arr.slice().sort((a,b)=>a-b); return s[Math.min(s.length-1, Math.floor((p/100)*s.length))]; }
function govStats(){
  const g = govLoad();
  const today = new Date().toISOString().slice(0,10);
  return { calls:g.calls||0, today:(g.usage[today]&&g.usage[today].n)||0,
    p50:pct(g.lat,50), p95:pct(g.lat,95), lastOk:g.lastOk, lastErr:g.lastErr, flags:g.flags||{} };
}
/* Governance chips rendered beside the Advisor response (HALL/THREAT/ANOM/PERF/LAT). */
function govFlagsHtml(la){
  if(!la || la.ok === false) return '';
  const chips = [];
  const mk = (txt, tn) => '<span class="pill" data-csstext="'+pillStyle(tn)+';font-size:9px;padding:3px 8px">'+esc(txt)+'</span>';
  if(typeof la.quality === 'number') chips.push(mk('quality '+la.quality+'/100', la.quality>=70?'low':la.quality>=40?'med':'high'));
  if(la.hallFlagged)      chips.push(mk('⚠ HALL — unsourced assertion', 'high'));
  if(la.injectionFlagged) chips.push(mk('⚠ THREAT — injection in input', 'high'));
  if(la.anomFlagged)      chips.push(mk('⚠ ANOM — output anomaly', 'med'));
  if(la.structureFlagged) chips.push(mk('⚠ scope/gaps missing', 'med'));
  if(la.latencyFlagged)   chips.push(mk('⚠ LAT — slow', 'med'));
  if(Array.isArray(la.piiFlagged) && la.piiFlagged.length) chips.push(mk('PII: '+la.piiFlagged.join('+'), 'med'));
  if(!chips.length) return '';
  return '<div data-csstext="display:flex;gap:6px;flex-wrap:wrap;margin-top:14px">'+chips.join('')+'</div>';
}
/* On-device USAGE/LAT/MON strip for the Ask view. */
function govStatsHtml(){
  const s = govStats();
  if(!s.calls) return '';
  const item = (lbl,val)=>'<span data-csstext="display:inline-flex;flex-direction:column;line-height:1.3"><b data-csstext="color:#9FB0C8;font-size:12px">'+esc(val)+'</b><span data-csstext="font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:#8A94A8">'+esc(lbl)+'</span></span>';
  const health = s.lastErr && (!s.lastOk || s.lastErr > s.lastOk) ? '⚠ last call failed' : (s.lastOk ? 'healthy' : '—');
  return '<div class="sec-lbl" data-csstext="margin:18px 0 9px"><span>Advisor telemetry (on-device)</span><i></i></div>'
    + '<div data-csstext="display:flex;gap:18px;flex-wrap:wrap;padding:10px 13px;border-radius:8px;background:#0B101A;border:1px solid rgba(255,255,255,0.06)">'
    +   item('calls', s.calls) + item('today', s.today)
    +   item('latency p50', s.p50!=null ? Math.round(s.p50)+'ms' : '—')
    +   item('latency p95', s.p95!=null ? Math.round(s.p95)+'ms' : '—')
    +   item('health', health)
    + '</div>';
}

function persona(){ return PERSONAS.find(p=>p.id===state.personaId) || PERSONAS[0]; }
function tone(t){
  if(t==='high') return {c:'#FF6B6B', bg:'rgba(255,87,87,0.10)',  bd:'rgba(255,87,87,0.45)'};
  if(t==='med')  return {c:'#FFAE57', bg:'rgba(255,148,52,0.10)', bd:'rgba(255,148,52,0.42)'};
  return            {c:'#4FD6A0', bg:'rgba(59,196,143,0.10)', bd:'rgba(59,196,143,0.36)'};
}
function pillStyle(t){ const x=tone(t); return 'color:'+x.c+';background:'+x.bg+';border-color:'+x.bd+';box-shadow:0 0 14px '+x.bg; }

/* ── Renderers ── */
function renderAvatar(){
  const p = persona();
  $('advAvatar').firstElementChild.style.backgroundImage = "url('"+p.img+"')";
  $('advAvatar').firstElementChild.style.backgroundPosition = p.pos;
}
function applyCssText(root){
  if(!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-csstext]').forEach(function(e){ e.style.cssText = e.getAttribute('data-csstext'); e.removeAttribute('data-csstext'); });
}
function renderTabs(){
  $('tabs').innerHTML =
    '<button class="tab'+(state.tab==='ask'?' active':'')+'" data-tab="ask">Ask the advisor</button>'+
    '<button class="tab'+(state.tab==='qa'?' active':'')+'" data-tab="qa">Regulatory Q&amp;A</button>'+
    '<button class="tab'+(state.tab==='tools'?' active':'')+'" data-tab="tools">Super Tools</button>';
  Array.from(document.querySelectorAll('.tab')).forEach(b=>b.addEventListener('click',()=>{ state.tab=b.getAttribute('data-tab'); render(); }));
}

function personaPickerHtml(){
  const cur = persona();
  const btns = PERSONAS.map(p=>{
    const on = p.id===cur.id;
    const ring = 'border:2px solid rgba('+p.accent+','+(on?'0.95':'0.26')+');'
      + 'box-shadow:'+(on?'0 0 16px rgba('+p.accent+',0.6)':'none')+';'
      + 'transform:'+(on?'scale(1.08)':'scale(1)')+';opacity:'+(on?'1':'0.5')+';filter:'+(on?'none':'grayscale(0.45)')+';';
    const img = "background-image:url('"+p.img+"');";
    return '<button class="p-btn" title="'+esc(p.name)+'" data-pid="'+p.id+'" data-csstext="'+ring+'"><div data-csstext="'+img+'"></div></button>';
  }).join('');
  return '<div class="persona-pick">'+btns+'</div>'
    + '<div class="persona-name"><b>'+esc(cur.name)+'</b> · '+esc(cur.role)+'</div>';
}

function heroIdleHtml(){
  const p = persona();
  return '<div class="hero">'
    + '<div class="hero-img" data-csstext="background-image:url(\''+p.img+'\');background-position:'+p.pos+'"></div>'
    + '<div class="hero-shade1"></div><div class="hero-shade2"></div>'
    + '<div class="hero-chip"><span class="chip" data-csstext="background:rgba('+p.accent+',0.16);border:1px solid rgba('+p.accent+',0.55);box-shadow:0 0 14px rgba('+p.accent+',0.3)"><i data-csstext="background:rgb('+p.accent+');box-shadow:0 0 8px rgb('+p.accent+')"></i>'+esc(p.name)+'</span></div>'
    + '<div class="hero-copy">'
    +   '<div class="hero-eyebrow">Ready when you are</div>'
    +   '<div class="hero-title">Ask me anything about AML compliance.</div>'
    +   '<div class="hero-lede">Every answer comes with a cited legal basis, a clear decision guide, and the recommended next steps.</div>'
    + '</div></div>';
}
function heroReasoningHtml(){
  const p = persona();
  return '<div class="hero-reason">'
    + '<div class="scan"></div>'
    + '<div class="reason-av"><div data-csstext="background-image:url(\''+p.img+'\');background-position:'+p.pos+'"></div></div>'
    + '<div class="reason-txt">Reviewing the cited legal sources…</div>'
    + '<div class="dots">'
    +   '<span data-csstext="background:var(--ac1);box-shadow:0 0 8px var(--ac1)"></span>'
    +   '<span data-csstext="background:var(--ac2);box-shadow:0 0 8px var(--ac2);animation-delay:.18s"></span>'
    +   '<span data-csstext="background:var(--ac2);box-shadow:0 0 8px var(--ac2);animation-delay:.36s"></span>'
    + '</div></div>';
}
function heroAnswerHtml(){
  const la = state.liveAnswer;
  if(la){
    const p = persona();
    const ok = la.ok !== false;
    const modelChip = la.model ? ' · '+la.model : '';
    return '<div class="card ans"><div class="card-pad">'
      + '<div class="sec-lbl"><span>Advisor response</span><i></i></div>'
      + '<div class="eyebrow">You asked</div>'
      + '<div class="asked">'+esc(state.askedQuestion)+'</div>'
      + '<div data-csstext="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">'
      +   '<span class="pill" data-csstext="'+pillStyle(ok?'low':'high')+'">'+esc(p.role)+'</span>'
      +   '<span class="conf"'+(ok?'':' data-csstext="color:#FF8A8A"')+'>'+(ok?'<i></i>':'&#9888; ')+esc(state.mode+' mode'+modelChip)+'</span>'
      + '</div>'
      + '<div class="summary" data-csstext="white-space:pre-line">'+esc(la.text)+'</div>'
      + govFlagsHtml(la)
      + (la.auditLine ? '<div data-csstext="margin-top:20px;padding:10px 13px;border-radius:8px;background:#0B101A;border:1px solid rgba(255,255,255,0.06)"><div class="eyebrow" data-csstext="font-size:9.5px;word-break:break-all;color:#8A94A8">'+esc(la.auditLine)+'</div></div>' : '')
      + '<button class="again" id="askAgain" data-csstext="margin-top:18px"><span>&#8634;</span> Ask another</button>'
      + '</div></div>';
  }
  const a = ANSWER;
  const basis = a.basis.map(b=>'<div class="basis"><div class="ref">'+esc(b.ref)+'</div><div class="note">'+esc(b.note)+'</div></div>').join('');
  const guide = a.guide.map(g=>'<div class="guide-row"><span class="n">'+esc(g.n)+'</span><span class="tx">'+esc(g.text)+'</span></div>').join('');
  const steps = a.steps.map(s=>'<div class="step-row"><span class="ck">&#10003;</span><span class="tx">'+esc(s)+'</span></div>').join('');
  return '<div class="card ans"><div class="card-pad">'
    + '<div class="sec-lbl"><span>Advisor response</span><i></i></div>'
    + '<div class="eyebrow">You asked</div>'
    + '<div class="asked">'+esc(state.askedQuestion)+'</div>'
    + '<div data-csstext="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">'
    +   '<span class="pill" data-csstext="'+pillStyle(a.tone)+'">'+esc(a.verdict)+'</span>'
    +   '<span class="conf"><i></i>'+esc(a.confidence)+'</span>'
    + '</div>'
    + '<div class="summary">'+esc(a.summary)+'</div>'
    + '<div class="block-h">Cited legal basis<i></i></div>'
    + '<div data-csstext="display:flex;flex-direction:column;gap:8px;margin-bottom:22px">'+basis+'</div>'
    + '<div class="block-h">Decision guide<i></i></div>'
    + '<div data-csstext="display:flex;flex-direction:column;gap:11px;margin-bottom:22px">'+guide+'</div>'
    + '<div class="block-h">Recommended steps<i></i></div>'
    + '<div data-csstext="display:flex;flex-direction:column;gap:9px;margin-bottom:24px">'+steps+'</div>'
    + '<button class="again" id="askAgain"><span>&#8634;</span> Ask another</button>'
    + '</div></div>';
}
function heroHtml(){
  if(state.phase==='reasoning') return heroReasoningHtml();
  if(state.phase==='answer') return heroAnswerHtml();
  return heroIdleHtml();
}

function renderAsk(){
  const modes = MODES.map(m=>
    '<button class="mode-btn'+(state.mode===m?' active':'')+'" data-mode="'+m+'">'+m+'</button>').join('');
  $('main').innerHTML =
    '<div class="ask-grid">'
    + '<div class="card"><div class="card-pad">'
    +   '<div class="sec-lbl"><span>Your question</span><i></i></div>'
    +   '<textarea class="q" id="qInput" aria-label="Compliance question" placeholder="Ask a compliance question, e.g. what CDD applies to a cross-border gold shipment?"></textarea>'
    +   '<p class="ai-transparency" role="note" data-csstext="margin:12px 0 0;font-size:11px;line-height:1.5;color:#8590A6">&#9888; You are interacting with an AI system (Anthropic Claude). Output is decision-support only — it is not a compliance decision. MLRO review required.</p>'
    +   (aupAcked() ? '' : '<div id="aupGate" role="note" data-csstext="margin-top:12px;padding:11px 13px;border-radius:8px;background:#1A1206;border:1px solid rgba(255,180,80,0.4);font-size:11.5px;line-height:1.55;color:#E8C28A">By using the Advisor you accept the <strong>AI Acceptable-Use Policy</strong>: decision-support only · MLRO review required · no tipping-off · do not paste data that must not leave the device. <button id="aupAckBtn" type="button" data-csstext="margin-left:6px;padding:5px 11px;border-radius:6px;border:1px solid rgba(255,180,80,0.6);background:rgba(255,180,80,0.14);color:#FFD9A0;cursor:pointer;font:inherit;font-size:11px">I acknowledge</button></div>')
    +   '<div data-csstext="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:18px">'
    +     '<button class="ask-btn" id="askBtn">Ask the advisor <span data-csstext="font-size:11px">&#9658;</span></button>'
    +   '</div>'
    +   '<div class="mode-strip"><span class="ml">Mode</span><div class="mode-group">'+modes+'</div></div>'
    + '</div></div>'
    + '<div>'
    +   '<div data-csstext="margin-bottom:16px"><div class="sec-lbl" data-csstext="margin-bottom:11px"><span>Advisor persona</span><i></i></div>'+personaPickerHtml()+'</div>'
    +   '<div id="hero" role="status" aria-live="polite">'+heroHtml()+'</div>'
    +   govStatsHtml()
    + '</div>'
    + '</div>';
  applyCssText($('main'));

  const qi = $('qInput'); if(qi){ qi.value = state.question; qi.addEventListener('input', e=>{ state.question = e.target.value; state.piiConfirmed = false; }); }
  const ab = $('askBtn'); if(ab) ab.addEventListener('click', ask);
  const ak = $('aupAckBtn'); if(ak) ak.addEventListener('click', ()=>{ aupAck(); renderAsk(); });
  Array.from(document.querySelectorAll('.mode-btn')).forEach(b=>b.addEventListener('click',()=>{ state.mode=b.getAttribute('data-mode'); renderAsk(); }));
  bindPersona();
  bindHero();
}
function bindPersona(){
  Array.from(document.querySelectorAll('.p-btn')).forEach(b=>b.addEventListener('click',()=>{
    state.personaId = b.getAttribute('data-pid'); renderAvatar(); renderAsk();
  }));
}
function bindHero(){ const aa=$('askAgain'); if(aa) aa.addEventListener('click', reset); }

const MODE_TO_REASONING = {Quick:'speed', Speed:'speed', Balanced:'balanced', Deep:'deep'};

function ask(){
  // AUP gate: must acknowledge the Acceptable-Use Policy before any send.
  if(!aupAcked()){ renderAsk(); return; }
  const q = (state.question||'').trim();
  // Don't substitute a canned question for an empty composer (that sends a
  // question the user never asked, plus a billed call + telemetry). Prompt instead.
  if(!q){
    state.askedQuestion = ''; state.phase = 'answer';
    state.liveAnswer = {ok:false, text:'Please enter a question for the advisor.'};
    $('hero').innerHTML = heroHtml(); applyCssText($('hero')); bindHero(); return;
  }
  // PII guard: warn (once) before identifiers leave the device.
  if(piiScan(q) && !state.piiConfirmed){
    state.piiConfirmed = true;
    state.askedQuestion = q; state.phase = 'answer';
    state.liveAnswer = {ok:false, text:'⚠ Possible personal identifiers detected in your question (e.g. Emirates ID, passport, or a long account/IBAN number). Sending will transfer them off-device to Anthropic for processing. Click "Ask the advisor" again to confirm, or edit your question to remove them.'};
    $('hero').innerHTML = heroHtml(); applyCssText($('hero')); bindHero(); return;
  }
  clearTimeout(reasoningTimer);
  const myAsk = ++askSeq;
  state.askedQuestion = q; state.phase = 'reasoning'; state.liveAnswer = null;
  $('hero').innerHTML = heroHtml(); applyCssText($('hero'));

  const minDelay = new Promise(r => { reasoningTimer = setTimeout(r, 1000); });
  /* fetch() does not reject on HTTP 4xx/5xx, and the backend returns
     {ok:false, error:'…'} for those (503 no API key, 403 origin, 429 rate-limit).
     Map any body lacking `text` to a visible error instead of a blank answer. */
  const brainFetch = fetch('/.netlify/functions/brain-soul', {
    method: 'POST',
    headers: fnHeaders(),
    body: JSON.stringify({
      question: q,
      mode: MODE_TO_REASONING[state.mode] || 'balanced',
      persona: state.personaId,
    }),
  }).then(r => r.json().catch(() => {
    /* A non-JSON body means the platform killed the function (Netlify's
       synchronous-function execution limit — most likely a long Deep-mode
       call), not a missing API key. Say so instead of misdirecting ops. */
    return {ok:false, error: r.status >= 500
      ? 'The advisor timed out at the platform level (HTTP ' + r.status + '). Deep mode can exceed the function execution limit — try Balanced or Speed, or raise the Netlify function timeout.'
      : 'The advisor returned an unreadable response (HTTP ' + r.status + ') — please try again.'};
  }));

  Promise.all([brainFetch, minDelay])
  .then(([data]) => {
    if(myAsk !== askSeq) return; // superseded by a newer ask() or reset()
    state.liveAnswer = answerFromResponse(data);
    try{ govRecord(data); }catch(e){}
    state.phase = 'answer';
    $('hero').innerHTML = heroHtml(); applyCssText($('hero'));
    bindHero();
  })
  .catch(() => {
    if(myAsk !== askSeq) return;
    state.liveAnswer = {ok: false, text: 'The brain is unavailable — ensure ANTHROPIC_API_KEY is set in Netlify environment variables and redeploy.'};
    try{ govRecord({ok:false}); }catch(e){}
    state.phase = 'answer';
    $('hero').innerHTML = heroHtml(); applyCssText($('hero'));
    bindHero();
  });
}
/* Normalise a brain-soul response into a renderable answer. A successful reply
   carries `text`; an error reply carries `{ok:false, error}` and no text — surface
   that error rather than rendering an empty hero. */
function answerFromResponse(data){
  if(data && data.text) return data;
  return {ok:false, text:(data && data.error) ? String(data.error) : 'The advisor is unavailable — please try again.'};
}
function reset(){ clearTimeout(reasoningTimer); askSeq++; state.phase='idle'; state.liveAnswer=null; $('hero').innerHTML = heroHtml(); applyCssText($('hero')); }

function regGroups(){ return (typeof window!=='undefined' && Array.isArray(window.REG_GROUPS)) ? window.REG_GROUPS : []; }
function askQuestion(q){ state.tab='ask'; state.question=q; render(); }
function renderQa(){
  $('main').innerHTML =
    '<div class="qa-wrap">'
    + '<div class="sec-lbl"><span>Regulatory Q&amp;A</span><i></i></div>'
    + '<div class="qa-desc">Source-cited regulatory questions, grouped by topic and grounded in UAE Federal Decree-Law No. 10 of 2025, Cabinet Decision 134/2025 and FATF. Pick a question to read its cited answer.</div>'
    + '<input class="qa-filter" id="qaFilter" aria-label="Filter questions" placeholder="Filter questions…">'
    + '<div class="reg-groups" id="regGroups"></div>'
    + '</div>';
  const f = $('qaFilter');
  f.value = state.qaQuery;
  f.addEventListener('input', e=>{ state.qaQuery = e.target.value; renderRegGroups(); });
  renderRegGroups();
}
/* A question may be a plain string (legacy) or {q, a, refs:[{ref,note}]}. */
function qText(q){ return typeof q==='string' ? q : (q && q.q) || ''; }
function qAnswer(q){ return (q && typeof q==='object') ? q : null; }
function regAnswerHtml(ans){
  const refs = Array.isArray(ans.refs) ? ans.refs : [];
  const basis = refs.map(r=>'<div class="qa-basis"><div class="ref">'+esc(r.ref)+'</div><div class="note">'+esc(r.note)+'</div></div>').join('');
  return '<div class="qa-body">'
    + (ans.a ? '<div class="qa-summary">'+esc(ans.a)+'</div>' : '')
    + (basis ? '<div class="block-h">Cited basis<i></i></div><div data-csstext="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">'+basis+'</div>' : '')
    + '<button class="again" data-ask="'+esc(qText(ans))+'"><span>&#8634;</span> Take to the advisor</button>'
    + '</div>';
}
function renderRegGroups(){
  const groups = regGroups(), fil = (state.qaQuery||'').trim().toLowerCase();
  let html = '';
  groups.forEach((g,gi)=>{
    const matches = fil ? (g.questions||[]).filter(q=>qText(q).toLowerCase().includes(fil)) : (g.questions||[]);
    if(fil && !matches.length) return;
    const open = fil ? true : state.regOpen===gi;
    html += '<div class="reg-cat'+(open?' open':'')+'">'
      + '<button class="reg-cat-head" data-gi="'+gi+'"><span class="reg-cat-name">'+esc(g.label)+'</span>'
      +   '<span class="reg-cat-meta"><span class="reg-cat-count">'+matches.length+'</span><span class="reg-cat-sign">'+(open?'−':'+')+'</span></span></button>';
    if(open) html += '<div class="reg-qs">'+matches.map(q=>{
      const t = qText(q), ans = qAnswer(q), key = gi+'␟'+t, isOpen = state.qOpen===key;
      return '<button class="reg-q" data-gi="'+gi+'" data-q="'+esc(t)+'" aria-expanded="'+(isOpen?'true':'false')+'"><span class="reg-q-arrow">'+(isOpen?'⌄':'›')+'</span>'+esc(t)+'</button>'
        + (isOpen && ans ? regAnswerHtml(ans) : '');
    }).join('')+'</div>';
    html += '</div>';
  });
  $('regGroups').innerHTML = html || '<p class="empty">No questions match “'+esc(fil)+'”.</p>';
  applyCssText($('regGroups'));
  Array.from(document.querySelectorAll('.reg-cat-head')).forEach(b=>b.addEventListener('click',()=>{ const gi=+b.getAttribute('data-gi'); state.regOpen = state.regOpen===gi?null:gi; state.qOpen=null; renderRegGroups(); }));
  Array.from(document.querySelectorAll('.reg-q')).forEach(b=>b.addEventListener('click',()=>{ const key=b.getAttribute('data-gi')+'␟'+b.getAttribute('data-q'); state.qOpen = state.qOpen===key?null:key; renderRegGroups(); }));
  Array.from(document.querySelectorAll('[data-ask]')).forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); askQuestion(b.getAttribute('data-ask')); }));
}

/* ── Super Tools — the advisor's specialist MLRO toolset (window.SUPER_TOOLS:
   186 tools across 7 groups, grouped in the picker). The Escalation Decision
   Engine runs on a deterministic, citation-backed rule engine; every other tool
   carries its own tool-specific playbook (play.intro / play.steps / play.refs in
   assets/super-data.js) and returns a deterministic, cited result keyed to that
   tool — not a shared group template. Where a tool has no bespoke playbook the
   engine falls back to the group-level guidance below. */
function splitList(s){ return String(s||'').split(',').map(x=>x.trim()).filter(Boolean); }
function stripEmoji(s){ return String(s||'').replace(/^[^\p{L}\p{N}]+/u,'').trim(); }
const TOOL_BAND = {CDD:'Customer Due Diligence', SDD:'Simplified Due Diligence', EDD:'Enhanced Due Diligence', PROHIBITED:'Prohibited — do not onboard'};
const TOOL_CFA = {IR:'Iran', KP:'North Korea', MM:'Myanmar', IRAN:'Iran', 'NORTH KOREA':'North Korea', MYANMAR:'Myanmar'};
const CITED_FRAMEWORK = [
  {ref:'UAE Federal Decree-Law No. 10 of 2025', note:'AML/CFT framework — CDD, record-keeping, STR and targeted financial sanctions.'},
  {ref:'Cabinet Decision No. 134 of 2025', note:'Implementing regulation — risk-based procedures and reporting obligations.'},
  {ref:'FATF Recommendations', note:'International AML/CFT standards (Recs 1, 6, 10, 12, 19, 20, 22-25).'}
];
const GROUP_PLAY = {
  'Core Tools': {intro:'Apply the firm’s risk-based AML/CFT controls to the scenario.', steps:['Identify and verify the subject and its beneficial owners (KYC/CDD).','Screen against sanctions, PEP and adverse-media lists.','Risk-rate the relationship and set the diligence level (CDD / SDD / EDD).','Document the rationale and set the ongoing-monitoring cadence.']},
  'Financial Crime Investigation': {intro:'Investigate the suspected predicate offence and its proceeds.', steps:['Establish the predicate offence and the financial footprint.','Trace the flow of funds and identify enablers and networks.','Preserve evidence and maintain the audit trail.','Escalate to the MLRO and file an STR if suspicion is established.']},
  'Regulatory & Compliance': {intro:'Map the obligation to the applicable regime and close any gaps.', steps:['Identify the controlling regulation and supervisory expectation.','Assess the current programme against the requirement.','Remediate gaps with named owners and deadlines.','Evidence compliance ahead of examination.']},
  'Advanced KYC/CDD': {intro:'Strengthen identification, verification and ownership transparency.', steps:['Verify identity with reliable, independent sources (including eKYC).','Establish the beneficial-ownership and control structure.','Substantiate source of wealth and source of funds.','Set perpetual-KYC triggers for ongoing review.']},
  'Transaction Monitoring': {intro:'Detect anomalous activity against the expected customer profile.', steps:['Baseline the expected transaction profile.','Test behaviour against typology and peer-group rules.','Investigate alerts and document each disposition.','Tune thresholds and escalate true positives to the MLRO.']},
  'Sector-Specific': {intro:'Apply the sector’s red flags and DNFBP obligations.', steps:['Identify the sector-specific ML/TF risks and red flags.','Apply the sector CDD and reporting obligations.','Calibrate monitoring to the sector typologies.','Document the sector risk assessment.']},
  'Advanced Analytics & Investigation': {intro:'Build the evidential picture and the recovery strategy.', steps:['Map the network and its central nodes.','Follow the money and build the causal chain.','Assess evidence strength and the legal options.','Coordinate with the FIU / law enforcement as appropriate.']}
};
function toolsList(){ return (typeof window!=='undefined' && Array.isArray(window.SUPER_TOOLS) && window.SUPER_TOOLS.length) ? window.SUPER_TOOLS : [{id:'escalation', label:'⚡ Escalation Decision Engine', group:'Core Tools'}]; }
function currentTool(){ const L=toolsList(); return L.find(t=>t.id===state.toolId) || L[0]; }
const ESC_FIELDS = [
  {key:'subject', label:'Subject name', req:true, ph:'Full subject name'},
  {key:'risk', label:'Risk score (0-100)', ph:'e.g. 87', num:true},
  {key:'sanctions', label:'Sanctions hits (comma-separated)', ph:'OFAC, UN, EU'},
  {key:'pep', label:'PEP tier', ph:'national, ministerial, local…'},
  {key:'typologies', label:'Typologies (comma-separated)', ph:'structuring, layering, tbml'},
  {key:'jurisdictions', label:'Jurisdictions (comma-separated)', ph:'RU, IR, AE'},
  {key:'notes', label:'Additional notes', ph:'Any additional context…', area:true}
];
function escalationRun(v){
  const subject = (v.subject||'').trim() || 'the subject';
  const sanctions = splitList(v.sanctions), typ = splitList(v.typologies);
  // A free-text "PEP tier" of none/no/n/a/nil means NOT a PEP — don't force EDD on it.
  const pepRaw = (v.pep||'').trim();
  const pep = /^(no|none|n\/?a|nil|n|false|-)$/i.test(pepRaw) ? '' : pepRaw;
  const jur = splitList(v.jurisdictions).map(s=>s.toUpperCase());
  const score = parseInt(v.risk,10), cfa = jur.filter(j=>TOOL_CFA[j]);
  const triggers = [], rank = {CDD:0, SDD:1, EDD:2};
  let prohibited = false, floor = 'CDD';
  if(sanctions.length){ prohibited = true; triggers.push({label:'Designated-party / sanctions exposure: '+sanctions.join(', '), ref:'FATF Rec. 6 · UAE Cabinet Decision 74/2020 (TFS)'}); }
  if(pep){ floor = 'EDD'; triggers.push({label:'PEP exposure — '+pep, ref:'FATF Rec. 12'}); }
  if(cfa.length){ floor = 'EDD'; triggers.push({label:'FATF call-for-action jurisdiction: '+cfa.map(c=>TOOL_CFA[c]).join(', '), ref:'FATF Rec. 19'}); }
  const band = isNaN(score) ? null : score>=70 ? 'EDD' : score>=40 ? 'SDD' : 'CDD';
  if(band) triggers.push({label:'Risk score '+score+'/100 → '+band+' band', ref:'Firm risk-scoring methodology'});
  if(typ.length) triggers.push({label:'Typologies present: '+typ.join(', ')+' — assess for suspicion', ref:'FATF typologies · STR consideration (FATF Rec. 20)'});
  let computed = band || 'CDD';
  if(rank[floor] > rank[computed]) computed = floor;
  const outcome = prohibited ? 'PROHIBITED' : computed;
  const tone = (outcome==='PROHIBITED'||outcome==='EDD') ? 'high' : outcome==='SDD' ? 'med' : 'low';
  const summary = outcome==='PROHIBITED'
    ? 'Designated-party exposure makes the relationship prohibited. Do not onboard '+subject+'; freeze any funds held and report to the FIU.'
    : outcome==='EDD' ? 'Enhanced due diligence is mandatory for '+subject+' before the relationship proceeds, driven by the triggers below.'
    : outcome==='SDD' ? 'Standard-plus (simplified) due diligence with enhanced monitoring is indicated for '+subject+'.'
    : 'Standard customer due diligence is sufficient for '+subject+' on the signals provided.';
  const actions = outcome==='PROHIBITED'
    ? ['Do not onboard or continue the relationship.','Freeze funds where held; do not tip off.','File a suspicious-transaction report with the UAE FIU via goAML.','Record the prohibition decision and notify the MLRO.']
    : outcome==='EDD' ? ['Obtain senior-management / MLRO approval before onboarding.','Establish source of wealth and source of funds.','Apply enhanced ongoing monitoring; set a 3-month review.', typ.length?'Assess the flagged typologies and file an STR if suspicion is established.':'Document the EDD rationale on file.']
    : outcome==='SDD' ? ['Complete standard CDD with enhanced transaction monitoring.','Set a 6-month review cadence.','Re-rate on any material change in the signals.']
    : ['Complete standard CDD and verify beneficial ownership.','Set a periodic (12-month) review.','Re-assess on any new sanctions, PEP or adverse-media signal.'];
  return { kind:'escalation', verdict: outcome+' — '+TOOL_BAND[outcome], tone, summary, triggers, actions };
}
function genericRun(tool, ctx){
  const bespoke = tool && tool.play && Array.isArray(tool.play.steps) && tool.play.steps.length ? tool.play : null;
  const play = bespoke || GROUP_PLAY[tool.group] || GROUP_PLAY['Core Tools'];
  const refs = (bespoke && Array.isArray(bespoke.refs) && bespoke.refs.length) ? bespoke.refs : CITED_FRAMEWORK;
  const title = stripEmoji(tool.label);
  const scenario = String(ctx||'').trim();
  const tail = scenario
    ? ' Applied to the scenario you described, the deterministic steps and cited basis below set out what an MLRO should do.'
    : ' The deterministic steps and cited basis below set out what an MLRO should do.';
  return { kind:'generic', title, summary: title + ' — ' + play.intro + tail,
    triggers: refs, actions: play.steps };
}
function renderField(f){
  const lab='<label class="tf-label" for="tf_'+f.key+'">'+esc(f.label)+(f.req?' <span data-csstext="color:var(--ac2)">*</span>':'')+'</label>';
  const inp = f.area
    ? '<textarea class="tf-input" id="tf_'+f.key+'" rows="4" placeholder="'+esc(f.ph)+'"></textarea>'
    : '<input class="tf-input" id="tf_'+f.key+'"'+(f.num?' inputmode="numeric"':'')+' placeholder="'+esc(f.ph)+'">';
  return '<div class="tf-row'+(f.area?' tf-area':'')+'">'+lab+inp+'</div>';
}
function renderToolResult(){
  const r = state.toolResult;
  if(!r) return '';
  if(r.error) return '<div class="tool-err">&#9888; '+esc(r.error)+'</div>';
  if(r.kind==='loading'){
    return '<div class="tool-result" data-csstext="display:flex;flex-direction:column;align-items:center;gap:14px;padding:28px 0">'
      + '<div class="dots">'
      +   '<span data-csstext="background:var(--ac1);box-shadow:0 0 8px var(--ac1)"></span>'
      +   '<span data-csstext="background:var(--ac2);box-shadow:0 0 8px var(--ac2);animation-delay:.18s"></span>'
      +   '<span data-csstext="background:var(--ac2);box-shadow:0 0 8px var(--ac2);animation-delay:.36s"></span>'
      + '</div>'
      + '<div data-csstext="font-family:var(--mono);font-size:12px;color:#828DA4">Compiling cited guidance…</div>'
      + '</div>';
  }
  if(r.kind==='brain'){
    return '<div class="tool-result">'
      + '<div data-csstext="margin:20px 0 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      +   '<span class="pill" data-csstext="'+pillStyle(r.ok!==false?'low':'high')+'">Brain-powered analysis</span>'
      +   (r.model ? '<span class="conf"><i></i>'+esc(r.model)+'</span>' : '')
      + '</div>'
      + '<div class="summary" data-csstext="white-space:pre-line">'+esc(r.text)+'</div>'
      + (r.auditLine ? '<div data-csstext="margin-top:18px;padding:10px 13px;border-radius:8px;background:#0B101A;border:1px solid rgba(255,255,255,0.06)"><div class="eyebrow" data-csstext="font-size:9.5px;word-break:break-all;color:#8A94A8">'+esc(r.auditLine)+'</div></div>' : '')
      + '</div>';
  }
  const head = r.kind==='generic'
    ? '<div data-csstext="margin:20px 0 14px"><span class="pill" data-csstext="'+pillStyle('low')+'">Deterministic guidance</span></div>'
    : '<div data-csstext="margin:20px 0 14px"><span class="pill" data-csstext="'+pillStyle(r.tone)+'">'+esc(r.verdict)+'</span></div>';
  const trig = r.triggers.map(t=>{
    const cite = esc(t.ref||t.label||''), note = esc(t.note||(t.ref?t.label:'')||'');
    return '<div class="qa-basis"><div class="ref">'+cite+'</div>'+(note&&note!==cite?'<div class="note">'+note+'</div>':'')+'</div>';
  }).join('');
  const acts = r.actions.map(a=>'<div class="step-row"><span class="ck">&#10003;</span><span class="tx">'+esc(a)+'</span></div>').join('');
  return '<div class="tool-result">'
    + head
    + '<div class="summary">'+esc(r.summary)+'</div>'
    + '<div class="block-h">'+(r.kind==='generic'?'Cited basis':'Triggers &amp; cited basis')+'<i></i></div>'
    + '<div data-csstext="display:flex;flex-direction:column;gap:8px;margin-bottom:22px">'+trig+'</div>'
    + '<div class="block-h">'+(r.kind==='generic'?'Recommended steps':'Required actions')+'<i></i></div>'
    + '<div data-csstext="display:flex;flex-direction:column;gap:9px">'+acts+'</div>'
    + '</div>';
}
function renderResultOnly(){ const el=$('toolResult'); if(el){ el.innerHTML = renderToolResult(); applyCssText(el); } }
function renderTools(){
  const tool = currentTool(), isEsc = tool.id==='escalation';
  let opts='', curG=null;
  toolsList().forEach(t=>{
    if(t.group!==curG){ if(curG!==null) opts+='</optgroup>'; opts+='<optgroup label="'+esc(t.group)+'">'; curG=t.group; }
    opts+='<option value="'+esc(t.id)+'"'+(t.id===tool.id?' selected':'')+'>'+esc(t.label)+'</option>';
  });
  if(curG!==null) opts+='</optgroup>';
  const title = stripEmoji(tool.label);
  const form = isEsc ? ESC_FIELDS.map(renderField).join('')
    : renderField({key:'context', label:'Case context / details', req:true, area:true,
        ph:'Describe the scenario, transactions or behaviour. Use roles / categories (e.g. “a tier-1 PEP”, “a DPMS dealer”), not named parties.'});
  const cta = isEsc ? 'Get Escalation Decision' : 'Run '+title;
  $('main').innerHTML =
    '<div class="qa-wrap">'
    + '<div class="sec-lbl"><span>Super Tools</span><i></i></div>'
    + '<div class="qa-desc">Specialist MLRO tools — every tool returns an instant, deterministic, citation-backed result keyed to the scenario. Pick a tool, fill the inputs, and run.</div>'
    + '<select class="tool-select" id="toolSelect" aria-label="Select tool">'+opts+'</select>'
    + '<div class="card" data-csstext="margin-top:14px"><div class="card-pad">'
    +   '<div class="tool-title">'+esc(tool.label)+'</div>'
    +   '<div class="tool-form">'+form+'</div>'
    +   '<button class="ask-btn" id="toolRun" data-csstext="margin-top:18px">'+esc(cta)+' <span data-csstext="font-size:11px">&#9658;</span></button>'
    +   '<div id="toolResult">'+ renderToolResult() +'</div>'
    + '</div></div>'
    + '</div>';
  applyCssText($('main'));
  const sel=$('toolSelect'); if(sel) sel.addEventListener('change', e=>{ state.toolId=e.target.value; state.toolInputs={}; state.toolResult=null; renderTools(); });
  (isEsc ? ESC_FIELDS : [{key:'context'}]).forEach(f=>{ const el=$('tf_'+f.key); if(el){ el.value=state.toolInputs[f.key]||''; el.addEventListener('input', e=>{ state.toolInputs[f.key]=e.target.value; }); } });
  const run=$('toolRun'); if(run) run.addEventListener('click', ()=>{
    const t=currentTool();
    if(t.id==='escalation'){
      if(!String(state.toolInputs.subject||'').trim()){ state.toolResult={error:'Subject name is required.'}; renderResultOnly(); const el=$('tf_subject'); if(el&&el.focus) el.focus(); return; }
      state.toolResult = escalationRun(state.toolInputs);
      renderResultOnly();
    } else {
      const ctx = String(state.toolInputs.context||'').trim();
      if(!ctx){ state.toolResult={error:'Please add some case context.'}; renderResultOnly(); const el=$('tf_context'); if(el&&el.focus) el.focus(); return; }
      state.toolResult = {kind:'loading'};
      renderResultOnly();
      const result = genericRun(t, ctx);
      setTimeout(()=>{ if(currentTool().id===t.id){ state.toolResult = result; renderResultOnly(); } }, 600);
    }
  });
}

function render(){
  renderTabs();
  if(state.tab==='ask') renderAsk();
  else if(state.tab==='tools') renderTools();
  else renderQa();
}

/* Boot */
renderAvatar();
render();

/* ── 1-hour unlock session — read-only countdown chip ──
   The Assessment page owns the encrypted session (key + expiry in localStorage);
   here we only display the time left and bump the shared "last activity" stamp so
   the 15-minute idle lock spans all three pages. No key is read or used here. */
(function(){
  var KEY = 'hsra.sess.v1', IDLE = 15*60*1000, el = document.getElementById('sessTimer');
  if(!el) return;
  function read(){
    try{ var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(!s || !s.exp) return null;
      var n = Date.now();
      if(n >= s.exp) return null;
      if(s.seen && (n - s.seen) >= IDLE) return null;
      return s;
    }catch(e){ return null; }
  }
  function touch(){
    try{ var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if(!s || !s.exp) return;
      /* Write only {exp,seen} — never spread `s` — so a legacy blob's raw key is
         never re-persisted by this read-only chip (the key now lives in IndexedDB). */
      var n = Date.now(); if(!s.seen || n - s.seen > 15000){ localStorage.setItem(KEY, JSON.stringify({exp:s.exp, seen:n})); }
    }catch(e){}
  }
  function render(){
    var s = read();
    if(!s){ el.classList.add('hidden'); return; }
    var ms = Math.max(0, s.exp - Date.now());
    var m = Math.floor(ms/60000), sec = Math.floor((ms%60000)/1000);
    el.classList.remove('hidden');
    el.classList.toggle('warn', ms <= 5*60000);
    var t = el.querySelector('.sess-t');
    if(t) t.textContent = (m<10?'0':'')+m+':'+(sec<10?'0':'')+sec;
  }
  ['click','keydown','mousemove','touchstart'].forEach(function(ev){ window.addEventListener(ev, touch, {passive:true}); });
  render(); setInterval(render, 1000);
})();


/* CSP-safe wiring: replaces the former inline onclick on the language toggle.
   hsToggleLang is a global defined in i18n.js (loaded earlier on the page). */
document.addEventListener('click', function (ev) {
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-act="hsToggleLang"]') : null;
  if (el && typeof window.hsToggleLang === 'function') window.hsToggleLang();
});
