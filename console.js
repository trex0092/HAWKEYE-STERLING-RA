/* Hawkeye Sterling - /home/user/HAWKEYE-STERLING-RA/console.html page logic.
   Extracted from /home/user/HAWKEYE-STERLING-RA/console.html so the Content-Security-Policy can drop
   'unsafe-inline' from script-src. Loaded from the same origin. */
/* ══════════════════════════════════════════
   AI Operations Console — live monitoring HUD.
   All portfolio telemetry (entities, alerts, mix,
   jurisdictions, activity) is derived from the
   on-device assessment register written by the
   Entity Risk Assessment screen. A new app with no
   filed assessments shows zeros and empty states —
   no fabricated numbers.
══════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const OPERATORS = [
  {id:'cypher',  img:'assets/persona-cypher.webp',  pos:'42% 30%', name:'Cypher',  role:'Transaction Monitoring Unit', ac:'255,92,168'},
  {id:'sterling',img:'assets/persona-sterling.webp',pos:'36% 22%', name:'Sterling',role:'Entity Risk Assessment',     ac:'59,229,208'},
  {id:'vale',    img:'assets/persona-vale.webp',    pos:'50% 22%', name:'Vale',    role:'KYC & Onboarding',           ac:'120,170,255'},
  {id:'ember',   img:'assets/persona-ember.webp',   pos:'50% 26%', name:'Ember',   role:'PEP & Adverse Media Screening',  ac:'255,87,87'},
  {id:'brass',   img:'assets/persona-brass.webp',   pos:'46% 26%', name:'Brass',   role:'Records & Audit',            ac:'247,197,60'},
  {id:'iris',    img:'assets/persona-iris.webp',    pos:'42% 26%', name:'Iris',    role:'Typologies & Training',      ac:'180,92,255'},
  {id:'bullion', img:'assets/persona-bullion.webp', pos:'50% 20%', name:'Bullion', role:'Precious Metals & Stones (DPMS)',     ac:'255,90,200'},
  {id:'cinder',  img:'assets/persona-cinder.webp',  pos:'40% 30%', name:'Cinder',  role:'Terrorism & Proliferation Financing', ac:'70,150,255'},
  {id:'verde',   img:'assets/persona-verde.webp',   pos:'46% 26%', name:'Verde',   role:'ESG & Human Rights',                  ac:'60,200,130'},
  {id:'haven',   img:'assets/persona-haven.webp',   pos:'42% 26%', name:'Haven',   role:'Artificial Intelligence',             ac:'230,180,70'},
  {id:'cobalt',  img:'assets/persona-cobalt.webp', pos:'55% 22%', name:'Cobalt',  role:'Trade-Based ML & Trade Finance',      ac:'235,190,90'},
  {id:'sentinel',img:'assets/persona-sentinel.webp',pos:'55% 20%', name:'Sentinel',role:'Sanctions Evasion & Watchlists',      ac:'255,70,90'},
  {id:'lattice', img:'assets/persona-lattice.webp', pos:'55% 18%', name:'Lattice', role:'Beneficial Ownership & UBO',          ac:'90,160,255'},
  {id:'talon',   img:'assets/persona-talon.webp',   pos:'55% 20%', name:'Talon',   role:'Trade Sanctions & Export Controls',    ac:'170,90,255'},
  {id:'quartz',  img:'assets/persona-quartz.webp',  pos:'55% 20%', name:'Quartz',  role:'Source of Wealth / Source of Funds',   ac:'60,210,120'},
  {id:'beacon',  img:'assets/persona-beacon.webp',  pos:'55% 20%', name:'Beacon',  role:'Whistleblowing & Internal Investigations', ac:'255,150,40'},
  {id:'warden',  img:'assets/persona-warden.webp',  pos:'52% 18%', name:'Warden',  role:'Board & MLRO Governance',              ac:'210,80,200'}
];

/* ── Data source: the assessment register (localStorage). Absent (new app) or
      encrypted-at-rest ("hsx1:" prefix) → treated as empty. ── */
const REG_KEY = 'hsra.register.v1';
/* Register pulled from Asana via the Refresh button — display-only, never
   written to localStorage (avoids clashing with index.html's encrypted store). */
let _asanaFetched = [];
function readLocalRegister(){
  let raw=null;
  try{ raw = localStorage.getItem(REG_KEY); }catch(e){}
  if(!raw || raw.indexOf('hsx1:')===0) return [];        /* none filed, or locked/encrypted */
  let data; try{ data = JSON.parse(raw); }catch(e){ return []; }
  const items = (data && data.items && typeof data.items==='object') ? data.items : {};
  return Object.keys(items).map(ref=>{
    const it=items[ref]||{}, s=it.summary||{}, st=it.state||{};
    return {
      ref,
      entity: s.entity || (st.entity&&st.entity.name) || ref,
      outcome: s.outcome || 'CDD',
      prohibited: !!s.prohibited,
      complete: !!s.complete,
      date: s.date || '',
      nextReview: s.nextReview || (st.signoff&&st.signoff.nextReview) || '',
      jurisdiction: (st.entity&&st.entity.jurisdiction) || '—',
      savedAt: it.savedAt || ''
    };
  });
}
/* Merge local + Asana-fetched by reference, local taking precedence. */
function readRegister(){
  const byRef = {};
  (_asanaFetched||[]).forEach(r=>{ if(r&&r.ref) byRef[r.ref]=r; });
  readLocalRegister().forEach(r=>{ if(r&&r.ref) byRef[r.ref]=r; });
  return Object.keys(byRef).map(k=>byRef[k]);
}
/* Pull the Register/Activity-Log summary back from Asana and re-render (display
   only — does not write localStorage, so an encrypted device is never touched). */
const ASANA_MIRROR_EP = '/.netlify/functions/asana-mirror';
function rerenderConsole(){ AGG = aggregate(readRegister()); updateThreat(); renderStats(); renderMix(); renderJur(); renderAlerts(); }
function refreshFromAsana(btn){
  if(typeof fetch==='undefined') return;
  if(btn){ btn.disabled=true; btn.classList.add('spinning'); btn.setAttribute('title','Refreshing…'); }
  const done = t => { if(btn){ btn.disabled=false; btn.classList.remove('spinning'); btn.setAttribute('title', t); } };
  fetch(ASANA_MIRROR_EP, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'read'})})
    .then(r=>r.json()).then(d=>{
      if(d && d.ok && Array.isArray(d.register)){
        _asanaFetched = d.register.map(r=>({ ref:String(r.ref||''), entity:String(r.entity||r.ref||''),
          outcome:String(r.outcome||'CDD'), prohibited:!!r.prohibited, complete:!!r.complete,
          date:String(r.date||''), nextReview:String(r.nextReview||''), jurisdiction:String(r.jurisdiction||'—'),
          savedAt:String(r.savedAt||'') })).filter(r=>r.ref);
        rerenderConsole();
        done('Refreshed '+_asanaFetched.length+' from Asana');
      } else done('Refresh failed — try again');
    }).catch(()=> done('Refresh failed — try again'));
}
function aggregate(items){
  const today=new Date().toISOString().slice(0,10);
  const fold=o=> o==='PROHIBITED'?'EDD':o;
  const counts={CDD:0,SDD:0,EDD:0};
  let prohibited=0, complete=0, overdue=0, drafts=0;
  items.forEach(it=>{
    counts[fold(it.outcome)]=(counts[fold(it.outcome)]||0)+1;
    if(it.prohibited) prohibited++;
    if(it.complete) complete++; else drafts++;
    if(it.nextReview && it.nextReview < today) overdue++;
  });
  const n=items.length;
  const mix=['CDD','SDD','EDD'].map(b=>({band:b,count:counts[b],pct:n?Math.round(counts[b]/n*100):0}));
  const jmap={};
  items.forEach(it=>{
    const j=it.jurisdiction||'—';
    if(!jmap[j]) jmap[j]={name:j,count:0,worst:0};
    jmap[j].count++;
    const sev=it.prohibited?4:it.outcome==='EDD'?3:it.outcome==='SDD'?2:1;
    if(sev>jmap[j].worst) jmap[j].worst=sev;
  });
  const jurisdictions=Object.keys(jmap).map(k=>jmap[k]).sort((a,b)=> b.worst-a.worst || b.count-a.count);
  const recent=items.slice().sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||''))).slice(0,6);
  const threat = prohibited?{label:'CRITICAL',color:'#FF6B6B'}
    : counts.EDD?{label:'ELEVATED',color:'#FFAE57'}
    : n?{label:'GUARDED',color:'#7FB3E8'}
    : {label:'NOMINAL',color:'#4FD6A0'};
  return {n,openAlerts:overdue+drafts,drafts,overdue,prohibited,complete,mix,jurisdictions,recent,threat};
}
let AGG = aggregate([]);

const BAND_FULL={CDD:'Customer Due Diligence',SDD:'Simplified Due Diligence',EDD:'Enhanced Due Diligence',PROHIBITED:'Prohibited — do not onboard'};
function bandTone(o){
  if(o==='PROHIBITED'||o==='EDD') return {c:'#FF6B6B',bg:'rgba(255,87,87,0.14)',bd:'rgba(255,87,87,0.4)',l:o==='PROHIBITED'?'PROH':'EDD'};
  if(o==='SDD') return {c:'#FFAE57',bg:'rgba(255,148,52,0.14)',bd:'rgba(255,148,52,0.4)',l:'SDD'};
  return {c:'#7FB3E8',bg:'rgba(91,155,216,0.14)',bd:'rgba(91,155,216,0.4)',l:'CDD'};
}

let state = {operatorId:'cypher', prog:0, uptime:0};

function op(){ return OPERATORS.find(o=>o.id===state.operatorId) || OPERATORS[0]; }
function setAccent(){ document.documentElement.style.setProperty('--ac', op().ac); }
function fmtUptime(s){ const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), x=s%60; return [h,m,x].map(n=>String(n).padStart(2,'0')).join(':'); }

function renderOperator(){
  const o = op();
  $('robotImg').style.backgroundImage = "url('"+o.img+"')";
  $('robotImg').style.backgroundPosition = o.pos;
  $('operatorName').textContent = o.name;
  $('operatorRole').textContent = o.role;
}
function renderOperatorStrip(){
  const cur = op();
  $('operatorStrip').innerHTML = OPERATORS.map(o=>{
    const on = o.id===cur.id;
    const style = "border:2px solid rgba("+o.ac+","+(on?'0.95':'0.28')+");"
      + "box-shadow:"+(on?'0 0 15px rgba('+o.ac+',0.6)':'none')+";"
      + "opacity:"+(on?'1':'0.55')+";filter:"+(on?'none':'grayscale(0.4)')+";";
    const img = "background-image:url('"+o.img+"');background-position:"+o.pos+";";
    return '<button class="op-btn" title="'+esc(o.name)+'" data-id="'+o.id+'" style="'+style+'"><div style="'+img+'"></div></button>';
  }).join('');
  Array.from(document.querySelectorAll('.op-btn')).forEach(b=>{
    b.addEventListener('click', ()=>{ state.operatorId = b.getAttribute('data-id'); setAccent(); renderOperator(); renderOperatorStrip(); });
  });
}

function updateThreat(){ const el=$('threatLevel'); if(!el) return; el.textContent=AGG.threat.label; el.style.color=AGG.threat.color; }

function renderStats(){
  const a=AGG, prog=state.prog;
  const alertSub = a.overdue&&a.drafts ? a.overdue+' overdue · '+a.drafts+' draft'
    : a.overdue ? a.overdue+' review overdue'
    : a.drafts ? a.drafts+' in draft' : 'none open';
  const tiles=[
    {label:'Entities Monitored', value:a.n,         color:'#4FD6A0', sub:a.n? a.complete+' complete' : 'no entities yet'},
    {label:'Open Alerts',        value:a.openAlerts, color:'#FFAE57', sub:alertSub},
    {label:'Sanctions Hits',     value:a.prohibited, color:'#FF6B6B', sub:a.prohibited? 'do not onboard' : 'none flagged'},
    {label:'Cases Cleared',      value:a.complete,   color:'#7FB3E8', sub:a.complete? 'marked complete' : 'none yet'}
  ];
  $('statTiles').innerHTML = tiles.map(t=>{
    const v = Math.round(t.value*prog).toLocaleString('en-US');
    return '<div class="tile"><div class="t-l" style="color:'+t.color+'">'+t.label+'</div>'
      + '<div class="t-v">'+v+'</div>'
      + '<div class="t-s" style="color:'+t.color+'">'+esc(t.sub)+'</div></div>';
  }).join('');
}
function renderMix(){
  const a=AGG, prog=state.prog;
  if(!a.n){ $('riskBars').innerHTML='<div class="empty-note">No assessments yet — the diligence mix appears as entities are filed.</div>'; return; }
  const rgb={CDD:'91,155,216',SDD:'255,148,52',EDD:'255,87,87'};
  const lab={CDD:'CDD · Standard',SDD:'SDD · Enhanced monitoring',EDD:'EDD · Enhanced'};
  $('riskBars').innerHTML = a.mix.map(m=>{
    const c=rgb[m.band], w=(m.pct*prog).toFixed(1);
    const fill="height:100%;border-radius:99px;width:"+w+"%;background:linear-gradient(90deg,rgba("+c+",0.7),rgb("+c+"));box-shadow:0 0 10px rgba("+c+",0.5)";
    return '<div class="bar-row"><div class="bar-top"><span class="l">'+lab[m.band]+'</span><span class="p">'+m.pct+'%</span></div>'
      + '<div class="bar-track"><div class="bar-fill" style="'+fill+'"></div></div></div>';
  }).join('');
}
function renderJur(){
  const a=AGG, prog=state.prog;
  if(!a.jurisdictions.length){ $('jurWatch').innerHTML='<div class="empty-note">No jurisdictions yet.</div>'; return; }
  const maxc=Math.max.apply(null, a.jurisdictions.map(j=>j.count)) || 1;
  const sev={1:{l:'Low',c:'#7FB3E8',rgb:'91,155,216'},2:{l:'Med',c:'#FFAE57',rgb:'255,148,52'},3:{l:'High',c:'#FF6B6B',rgb:'255,87,87'},4:{l:'Proh',c:'#FF6B6B',rgb:'255,87,87'}};
  $('jurWatch').innerHTML = a.jurisdictions.slice(0,6).map(j=>{
    const s=sev[j.worst]||sev[1], w=(j.count/maxc*100*prog).toFixed(1);
    const fill="height:100%;border-radius:99px;width:"+w+"%;background:rgb("+s.rgb+");box-shadow:0 0 8px rgba("+s.rgb+",0.5)";
    return '<div class="jur-row"><span class="jn">'+esc(j.name)+'</span>'
      + '<div class="jt"><div style="'+fill+'"></div></div>'
      + '<span class="jb" style="color:'+s.c+'">'+s.l+'</span></div>';
  }).join('');
}
function renderAlerts(){
  const a=AGG;
  if(!a.recent.length){ $('alertStream').innerHTML='<div class="empty-note">No assessments filed yet — file one in the Assessment tab to populate the console.</div>'; return; }
  $('alertStream').innerHTML = a.recent.map((it,i)=>{
    const key = it.prohibited?'PROHIBITED':it.outcome;
    const t=bandTone(key);
    let when='';
    if(it.savedAt){ try{ when=new Date(it.savedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }catch(e){ when=it.date||''; } }
    else when=it.date||'';
    const row='animation-delay:'+(0.2+i*0.07).toFixed(2)+'s';
    return '<div class="alert-row" style="'+row+'">'
      + '<span class="at">'+esc(when)+'</span>'
      + '<div style="flex:1;min-width:0"><div class="ae">'+esc(it.entity)+'</div><div class="ay">'+esc(BAND_FULL[key]||key)+'</div></div>'
      + '<span class="aj" title="'+esc(it.jurisdiction)+'">'+esc(it.jurisdiction)+'</span>'
      + '<span class="ab" style="color:'+t.c+';background:'+t.bg+';border-color:'+t.bd+'">'+t.l+'</span></div>';
  }).join('');
}
function renderAnimated(){ renderStats(); renderMix(); renderJur(); }

/* Count-up tween (rAF, easeOutCubic) — scales values 0 → actual */
function tween(){
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ state.prog = 1; renderAnimated(); return; }
  const start = performance.now(), dur = 1300, ease = p => 1 - Math.pow(1-p, 3);
  function loop(now){ const p = Math.min((now-start)/dur, 1); state.prog = ease(p); renderAnimated(); if(p<1) requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
}

function startClock(){
  const tick = ()=>{
    state.uptime++; $('uptime').textContent = fmtUptime(state.uptime);
  };
  $('uptime').textContent = fmtUptime(state.uptime);
  tick();
  setInterval(tick, 1000);
}

/* Boot */
AGG = aggregate(readRegister());
setAccent();
renderOperator();
renderOperatorStrip();
updateThreat();
renderAlerts();
renderAnimated();
tween();
startClock();
(function(){ var b=document.getElementById('asanaRefresh'); if(b&&b.addEventListener) b.addEventListener('click', function(){ refreshFromAsana(b); }); })();

/* ── 1-hour unlock session — read-only countdown chip (see index.html for the owner) ── */
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
    try{ var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if(!s) return;
      var n = Date.now(); if(!s.seen || n - s.seen > 15000){ s.seen = n; localStorage.setItem(KEY, JSON.stringify(s)); }
    }catch(e){}
  }
  function render(){
    var s = read();
    if(!s){ el.style.display = 'none'; return; }
    var ms = Math.max(0, s.exp - Date.now());
    var m = Math.floor(ms/60000), sec = Math.floor((ms%60000)/1000);
    el.style.display = '';
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
