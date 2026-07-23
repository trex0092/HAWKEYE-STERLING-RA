/* Hawkeye Sterling - Entity Risk Assessment app logic.
   Extracted from index.html so the Content-Security-Policy can drop
   'unsafe-inline' from script-src. Loaded as an external script from
   the same origin ('self'). See the EVENT DELEGATION block at the foot
   of this file for how former inline on* handlers are now wired. */
/* ══════════════════════════════════════════
   DATA (sourced directly from Data sheet)
══════════════════════════════════════════ */
const APP_VERSION = '3.7.2';
const TOAST_DURATION_MS = 2600; /* keeps toasts readable per accessibility guidelines */

const COUNTRIES = [{"name":"Åland Islands","score":1},{"name":"Svalbard and Jan Mayen","score":1},{"name":"Tokelau","score":1},{"name":"Finland","score":1},{"name":"Faroe Islands","score":1},{"name":"Iceland","score":1},{"name":"Norway","score":1},{"name":"Denmark","score":1},{"name":"Greenland","score":1},{"name":"San Marino","score":1},{"name":"Sweden","score":1},{"name":"Estonia","score":1},{"name":"Vatican City State (Holy See)","score":1},{"name":"Lithuania","score":1},{"name":"Andorra","score":1},{"name":"Bermuda","score":1},{"name":"New Zealand","score":1},{"name":"Liechtenstein","score":1},{"name":"Christmas Island","score":1},{"name":"Cocos (Keeling) Islands","score":1},{"name":"Norfolk Island","score":1},{"name":"French Polynesia","score":1},{"name":"Mayotte","score":1},{"name":"New Caledonia","score":1},{"name":"Saint Barthélemy","score":1},{"name":"Saint Martin (French part)","score":1},{"name":"Saint Pierre and Miquelon","score":1},{"name":"Wallis and Futuna","score":1},{"name":"Brunei Darussalam","score":1},{"name":"British Indian Ocean Territory","score":1},{"name":"Falkland Islands (Malvinas)","score":1},{"name":"French Guiana","score":1},{"name":"Pitcairn","score":1},{"name":"Saint Helena, Ascension and Tristan da Cunha","score":1},{"name":"Guadeloupe","score":1},{"name":"Martinique","score":1},{"name":"Réunion","score":1},{"name":"Latvia","score":1},{"name":"Portugal","score":1},{"name":"Singapore","score":1},{"name":"Bonaire, Sint Eustatius and Saba","score":1},{"name":"South Korea","score":1},{"name":"Uruguay","score":1},{"name":"Puerto Rico","score":1},{"name":"Oman","score":1},{"name":"Australia","score":1},{"name":"Guernsey","score":1},{"name":"Namibia","score":3},{"name":"Austria","score":1},{"name":"Japan","score":1},{"name":"Bhutan","score":1},{"name":"Czech Republic","score":1},{"name":"Malawi","score":2},{"name":"Mongolia","score":2},{"name":"Macau","score":1},{"name":"Isle of Man","score":1},{"name":"Belgium","score":1},{"name":"Poland","score":1},{"name":"Luxembourg","score":1},{"name":"Jersey","score":1},{"name":"Ireland","score":1},{"name":"Germany","score":1},{"name":"American Samoa","score":1},{"name":"Botswana","score":3},{"name":"France","score":1},{"name":"Northern Mariana Islands","score":1},{"name":"Hungary","score":2},{"name":"Mauritius","score":1},{"name":"Switzerland","score":1},{"name":"Fiji","score":2},{"name":"Malta","score":2},{"name":"Zambia","score":3},{"name":"Cook Islands","score":1},{"name":"Guam","score":1},{"name":"Georgia","score":2},{"name":"Slovakia","score":2},{"name":"Spain","score":1},{"name":"Taiwan","score":1},{"name":"Solomon Islands","score":2},{"name":"Canada","score":1},{"name":"Monaco","score":3},{"name":"Mauritania","score":2},{"name":"United States Virgin Islands","score":1},{"name":"Kuwait","score":3},{"name":"Netherlands","score":1},{"name":"Slovenia","score":1},{"name":"Gambia","score":2},{"name":"Aruba","score":2},{"name":"Marshall Islands","score":2},{"name":"Cape Verde","score":2},{"name":"Qatar","score":1},{"name":"Niue","score":2},{"name":"Rwanda","score":3},{"name":"Tonga","score":2},{"name":"Romania","score":2},{"name":"Saudi Arabia","score":1},{"name":"United Kingdom","score":1},{"name":"Greece","score":2},{"name":"Costa Rica","score":2},{"name":"Italy","score":1},{"name":"Chile","score":1},{"name":"Nauru","score":2},{"name":"Lesotho","score":2},{"name":"Montserrat","score":2},{"name":"Bulgaria","score":3},{"name":"Ghana","score":2},{"name":"Timor-Leste","score":2},{"name":"Dominican Republic","score":2},{"name":"Kazakhstan","score":2},{"name":"United States","score":1},{"name":"Anguilla","score":2},{"name":"Hong Kong","score":2},{"name":"Uzbekistan","score":2},{"name":"Antigua and Barbuda","score":2},{"name":"Grenada","score":2},{"name":"Togo","score":3},{"name":"Micronesia","score":2},{"name":"South Africa","score":2},{"name":"Sri Lanka","score":2},{"name":"Eswatini","score":3},{"name":"Maldives","score":2},{"name":"Cyprus","score":2},{"name":"Samoa","score":2},{"name":"Bahrain","score":1},{"name":"Tuvalu","score":2},{"name":"Kyrgyzstan","score":3},{"name":"Argentina","score":2},{"name":"Madagascar","score":3},{"name":"Guatemala","score":3},{"name":"Papua New Guinea","score":3},{"name":"Palau","score":2},{"name":"Suriname","score":2},{"name":"Congo (Brazzaville)","score":2},{"name":"Croatia","score":2},{"name":"St Kitts & Nevis","score":2},{"name":"Gabon","score":3},{"name":"São Tomé & Príncipe","score":2},{"name":"El Salvador","score":1},{"name":"Bangladesh","score":3},{"name":"Equatorial Guinea","score":3},{"name":"Honduras","score":3},{"name":"St Vincent & Gren","score":2},{"name":"Belize","score":2},{"name":"Kiribati","score":2},{"name":"Curacao","score":2},{"name":"Angola","score":3},{"name":"Bahamas","score":2},{"name":"Turkmenistan","score":3},{"name":"Turks & Caicos","score":2},{"name":"Paraguay","score":3},{"name":"Armenia","score":2},{"name":"Malaysia","score":2},{"name":"Moldova","score":2},{"name":"Seychelles","score":2},{"name":"Peru","score":2},{"name":"Egypt","score":2},{"name":"British Virgin Islands","score":3},{"name":"Guyana","score":2},{"name":"Sierra Leone","score":3},{"name":"St Lucia","score":2},{"name":"Algeria","score":3},{"name":"Mexico","score":3},{"name":"Bolivia","score":3},{"name":"North Macedonia","score":2},{"name":"Serbia","score":2},{"name":"Comoros","score":2},{"name":"Ethiopia","score":3},{"name":"Montenegro","score":2},{"name":"Djibouti","score":2},{"name":"Indonesia","score":2},{"name":"Benin","score":3},{"name":"Niger","score":3},{"name":"Tajikistan","score":3},{"name":"Azerbaijan","score":2},{"name":"Vietnam","score":3},{"name":"Ecuador","score":2},{"name":"Belarus","score":2},{"name":"Dominica","score":2},{"name":"India","score":2},{"name":"Nepal","score":3},{"name":"Colombia","score":3},{"name":"Cameroon","score":3},{"name":"Cote D'Ivoire","score":3},{"name":"Thailand","score":2},{"name":"Lao People's Democratic Republic","score":3},{"name":"Tunisia","score":2},{"name":"China","score":2},{"name":"Israel","score":2},{"name":"Brazil","score":2},{"name":"St Maarten","score":2},{"name":"Chad","score":3},{"name":"Gibraltar","score":2},{"name":"Bosnia-Herzegovina","score":3},{"name":"Liberia","score":3},{"name":"Cayman Islands","score":2},{"name":"Vanuatu","score":2},{"name":"Nigeria","score":3},{"name":"Trinidad & Tobago","score":2},{"name":"Guinea","score":3},{"name":"Sudan","score":3},{"name":"United Arab Emirates","score":1},{"name":"Cambodia","score":3},{"name":"Kenya","score":3},{"name":"Ukraine","score":3},{"name":"Eritrea","score":3},{"name":"Senegal","score":3},{"name":"Barbados","score":2},{"name":"Jordan","score":2},{"name":"Kosovo","score":3},{"name":"Cuba","score":3},{"name":"Jamaica","score":2},{"name":"Uganda","score":3},{"name":"Burkina Faso","score":3},{"name":"Morocco","score":2},{"name":"Western Sahara","score":2},{"name":"Guinea Bissau","score":3},{"name":"Central African Republic","score":3},{"name":"Albania","score":2},{"name":"Pakistan","score":3},{"name":"Venezuela","score":3},{"name":"West Bank (Palestinian Territory, Occupied)","score":3},{"name":"Gaza Strip","score":3},{"name":"Panama","score":2},{"name":"Zimbabwe","score":3},{"name":"Tanzania","score":2},{"name":"Lebanon","score":3},{"name":"Burundi","score":3},{"name":"Iraq","score":3},{"name":"Nicaragua","score":3},{"name":"Philippines","score":3},{"name":"Russian Federation","score":3},{"name":"Mozambique","score":3},{"name":"Turkey","score":2},{"name":"Libya","score":3},{"name":"Haiti","score":3},{"name":"South Sudan","score":3},{"name":"Somalia","score":3},{"name":"Mali","score":3},{"name":"Yemen","score":3},{"name":"The Democratic Republic Of Congo","score":3},{"name":"Syria","score":3},{"name":"Myanmar","score":3,"cfa":true},{"name":"Afghanistan","score":3},{"name":"North Korea","score":3,"cfa":true},{"name":"Islamic Republic of Iran","score":3,"cfa":true}];

const RECYCLED = [{"name":"N/A","score":0},{"name":"LBMA GD Bullion/DGD Good Delivery","score":1},{"name":"Rudimentary Bars","score":2},{"name":"Gold & Silver Coins","score":1},{"name":"Industrial Waste","score":1},{"name":"Gold Jewellery","score":2},{"name":"Collected waste","score":2},{"name":"Silver/Gold Grains","score":1},{"name":"Broken jewellery","score":2},{"name":"Gold-Processing Chemicals","score":3},{"name":"Others","score":0}];
const MINED = [{"name":"N/A","score":0},{"name":"LSM — Large Scale Mining","score":2},{"name":"MSM — Medium Scale Mining","score":2},{"name":"ASM — Artisanal Mining","score":3}];
const ACTIVITIES = [{"name":"Regulated Financial Entities","score":1},{"name":"Non-Manufactured Precious Metal Trading","score":3},{"name":"Mineral Processing Facility","score":3},{"name":"Mining Company","score":3},{"name":"Jewellery Trading","score":3},{"name":"Precious Metal Refinery","score":3},{"name":"Wholesalers/Pawn Shops","score":3}];

/* Scoring rules: Yes/No questions */
/* vlok  (standard): Yes=3 High, No=1 Low */
/* vlok2 (inverse):  Yes=1 Low,  No=3 High — AML/CFT control adequacy */
/* onboard: Yes (remote / non-F2F)=3 High, No (in-person)=1 Low */
/* `prohibit:true`   → a Yes makes the outcome PROHIBITED (do not onboard). */
/* `eddTrigger:true` → a Yes forces Enhanced Due Diligence regardless of score. */

const QUESTIONS_OC = [
  {id:'aml',       short:'AML/CFT control environment', text:'Does the legal entity have an adequate and effective AML/CFT control environment (where applicable)?', default:'Yes', type:'vlok2'},
  {id:'sanctions_person', short:'Sanctions — owners / directors / management', text:'Are any beneficial owners, controllers, directors, or senior management subject to sanctions?', default:'No', type:'vlok', prohibit:true},
  {id:'criminal',  short:'Criminal proceedings / investigations', text:'Is the entity subject to any criminal proceedings or ongoing legal investigations?', default:'No', type:'vlok'},
  {id:'adverse',   short:'Adverse media findings', text:'Are any beneficial owners, controllers, directors, or senior management subject to adverse media or negative reputational findings?', default:'No', type:'vlok'},
  {id:'sanctions_entity', short:'Sanctions — legal entity', text:'Is the legal entity itself subject to any national or international sanctions?', default:'No', type:'vlok', prohibit:true},
  {id:'sof',       short:'Source of funds / wealth concerns', text:'Are there any concerns regarding the source of funds and/or source of wealth of the beneficial owners or the legal entity (where applicable)?', default:'No', type:'vlok'},
  {id:'high_risk_ind', short:'High-risk industry involvement', text:'Is the entity involved in any high-risk industries (arms, gaming, casinos)?', default:'No', type:'vlok'},
  {id:'tf',        short:'Terrorist financing connections', text:'Are any beneficial owners, controllers, or managers connected to terrorist financing or designated terrorist organisations?', default:'No', type:'vlok', prohibit:true},
  {id:'pf',        short:'Proliferation financing connections', text:'Are any beneficial owners, controllers, or managers connected to proliferation financing or the trade of materials or technology related to weapons of mass destruction?', default:'No', type:'vlok', prohibit:true},
  {id:'pep',       short:'PEP exposure', text:'Are any beneficial owners, controllers, or senior management Politically Exposed Persons (PEPs)?', default:'No', type:'vlok', eddTrigger:true},
  {id:'gov',       short:'Government / state ownership', text:'Is the legal entity owned or controlled by a government, state authority, or public sector body?', default:'No', type:'vlok'},
];

const BAND_FULL = {CDD:'Customer Due Diligence', SDD:'Simplified Due Diligence', EDD:'Enhanced Due Diligence', PROHIBITED:'Do Not Onboard'};
/* Arabic band labels (machine-assisted; see #i18nCaveat). getLang() is defined
   later in the engine and resolved at call time. */
const BAND_FULL_AR = {CDD:'العناية الواجبة تجاه العميل', SDD:'العناية الواجبة المبسّطة', EDD:'العناية الواجبة المعزّزة', PROHIBITED:'عدم بدء العلاقة — محظور'};
function bandFull(code){ const ar = (typeof getLang==='function' && getLang()==='ar'); return (ar ? BAND_FULL_AR[code] : BAND_FULL[code]) || BAND_FULL[code] || code; }
const BAND_ICON = {CDD:'✓', SDD:'!', EDD:'⚠', PROHIBITED:'⛔'};
const REVIEW_MONTHS = {CDD:12, SDD:6, EDD:3}; /* KYC review cycles per compliance manual: low 12m, medium 6m, high 3m */

/* Policy names referenced in the narrative template — update here if policies are renamed. */
const POLICIES = {
  TFS:  'Targeted Financial Sanctions procedure',
  RAS:  'Risk Appetite Statement',
  SOFW: 'Source of Funds and Source of Wealth policy',
  RS:   'Responsible Sourcing and Supply Chain policy',
  KYC:  'Know Your Customer procedure',
  UBO:  'Ultimate Beneficial Owner procedure',
  RCP:  'Risk Control Plan'
};
const ASM_SOURCE = 'ASM — Artisanal Mining';
const SCREENING_GROUPS = [['sanctions','Sanctions screening'],['pep','PEP screening'],['adverse','Adverse media screening']];

const MAX_SCORE = 3 + 3 + QUESTIONS_OC.length*3 + 3 + 3 + 3 + 3*3 + 3*3; /* jurisdiction + activity + questions + onboard + 2×years + 6 suppliers */
const STORAGE_KEY = 'hsra.draft.v2';
const SEQ_KEY = 'hsra.seq';

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/* Strict-mode shared token (netlify/functions/_auth.js): when the operator has
   filled <meta name="hsra-app-token"> at deploy time, every function call must
   carry it as X-App-Token or strict mode 401s the browser path. Empty → no-op. */
function appToken(){
  try{
    const m = typeof document!=='undefined' && document.querySelector('meta[name="hsra-app-token"]');
    return ((m && m.getAttribute('content')) || '').trim();
  }catch(e){ return ''; }
}
function fnHeaders(){
  const h = {'Content-Type':'application/json'};
  const t = appToken();
  if(t) h['X-App-Token'] = t;
  return h;
}

/* ══════════════════════════════════════════
   DEVICE SECURITY — passphrase gate + encryption-at-rest (WebCrypto, no deps)
   Sensitive data (drafts, register, risk-data overrides, Asana payloads, the
   activity log) is encrypted at rest with AES-GCM under a key derived from the
   officer's passphrase via PBKDF2. While locked or never configured, the store
   is a transparent passthrough to localStorage — no behaviour change — so the
   scoring engine and its full test suite are unaffected. Closes the Identity &
   Access / Data Protection gaps for an on-device app (no backend to host them).
══════════════════════════════════════════ */
/* hsra.asana.tokenised.v1 must be listed here: SS reads/writes go through the
   in-memory mirror while unlocked, and _secActivate repopulates that mirror
   from SECURE_KEYS only — an unlisted key silently reads as null after every
   lock/unlock or reload, which reset the "tokenise (no PII)" opt-in. */
const SECURE_KEYS = ['hsra.draft.v2','hsra.riskdata.v1','hsra.register.v1','hsra.asana.delivered.v1','hsra.asana.failed.v1','hsra.audit.v1','hsra.asana.tokenised.v1'];
const SEC_META_KEY = 'hsra.sec.v1';        /* {v,salt,iter,iv,ct} passphrase verifier — never encrypted */
const SEC_OPTOUT_KEY = 'hsra.sec.optout';  /* '1' when the officer chose to store unencrypted */
const PBKDF2_ITER = 250000;
const IDLE_LOCK_MS = 15 * 60 * 1000;       /* auto-lock after inactivity (zero-trust session) */
const SESS_KEY = 'hsra.sess.v1';           /* {exp,seen}: 1-hour cross-page unlock metadata (the key object lives in IndexedDB, not here) */
const SESS_MAX_MS = 60 * 60 * 1000;        /* hard 1-hour cap from unlock, regardless of activity */
let _sessExp = 0;                          /* current session expiry (ms epoch); 0 = none */
let _sessTimer = null;                     /* countdown interval handle */
let _secKey = null;        /* CryptoKey, in memory only while unlocked */
let _secActive = false;    /* true once unlocked: reads/writes use the decrypted in-memory mirror */
let _secMode = 'unlock';
let _idleTimer = null;
const _secMem = {};        /* decrypted plaintext mirror, keyed by storage key */

function _hasCrypto(){ try{ return !!(crypto && crypto.subtle && crypto.getRandomValues); }catch(e){ return false; } }
const _u8 = s => new TextEncoder().encode(s);
const _b64 = u => {
  /* Chunk the byte→char conversion: String.fromCharCode.apply on a single large
     array overflows the call stack (~125 KB), which silently broke at-rest
     persistence of the (unbounded) audit log and register once they grew. The
     decrypt path uses atob() with no such limit, so without chunking, data that
     could be read back could never be re-written. */
  const bytes = new Uint8Array(u);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};
const _ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/* ── Session-key store (IndexedDB) ──────────────────────────────────────────
   The 1-hour cross-page unlock needs the derived AES key to survive a full page
   navigation. The previous design exported the RAW key bytes into localStorage
   (SESS_KEY.k), where any XSS or local read could recover them — defeating
   encryption-at-rest for the whole unlocked window. Instead we now:
     • derive the key NON-EXTRACTABLE (exportKey throws), and
     • persist the CryptoKey OBJECT in IndexedDB (structured clone stores it,
       and a non-extractable key can be used for encrypt/decrypt but never
       serialised back to bytes by script), keeping only the non-sensitive
       {exp,seen} metadata in localStorage for the synchronous cross-page checks.
   If IndexedDB is unavailable the session is simply NOT cached — the officer
   re-enters the passphrase on navigation (fail closed). The key is NEVER written
   to localStorage as a fallback. */
const SEC_IDB_DB = 'hsra-sec';
const SEC_IDB_STORE = 'sess';
const SEC_IDB_KEY = 'sessionKey';
function _idbOpen(){
  return new Promise((resolve, reject) => {
    try{
      if(typeof indexedDB === 'undefined' || !indexedDB) return reject(new Error('no-idb'));
      const req = indexedDB.open(SEC_IDB_DB, 1);
      req.onupgradeneeded = () => { try{ req.result.createObjectStore(SEC_IDB_STORE); }catch(e){} };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('idb-open'));
    }catch(e){ reject(e); }
  });
}
async function _idbPut(key, val){
  const db = await _idbOpen();
  try{
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SEC_IDB_STORE, 'readwrite');
      tx.objectStore(SEC_IDB_STORE).put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('idb-put'));
      tx.onabort = () => reject(tx.error || new Error('idb-abort'));
    });
  }finally{ try{ db.close(); }catch(e){} }
}
async function _idbGet(key){
  const db = await _idbOpen();
  try{
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SEC_IDB_STORE, 'readonly');
      const rq = tx.objectStore(SEC_IDB_STORE).get(key);
      rq.onsuccess = () => resolve(rq.result != null ? rq.result : null);
      rq.onerror = () => reject(rq.error || new Error('idb-get'));
    });
  }finally{ try{ db.close(); }catch(e){} }
}
async function _idbDel(key){
  const db = await _idbOpen();
  try{
    return await new Promise((resolve) => {
      const tx = db.transaction(SEC_IDB_STORE, 'readwrite');
      tx.objectStore(SEC_IDB_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  }finally{ try{ db.close(); }catch(e){} }
}

async function _deriveKey(pass, salt, iter){
  const base = await crypto.subtle.importKey('raw', _u8(pass), 'PBKDF2', false, ['deriveKey']);
  /* NON-extractable: the 1-hour session caches the key OBJECT in IndexedDB, not
     its raw bytes, so extractability is neither needed nor wanted (exportKey must
     stay impossible for XSS/local-read). encrypt/decrypt work regardless. */
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:iter, hash:'SHA-256'},
    base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}
async function encryptStr(key, str){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, _u8(str));
  return 'hsx1:' + _b64(iv) + ':' + _b64(ct);
}
async function decryptStr(key, blob){
  const p = String(blob).split(':');
  if(p[0] !== 'hsx1' || p.length !== 3) throw new Error('not-encrypted');
  const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:_ub64(p[1])}, key, _ub64(p[2]));
  return new TextDecoder().decode(pt);
}
async function sha256Hex(str){
  const d = await crypto.subtle.digest('SHA-256', _u8(str));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/* Secure-store facade: every sensitive key routes through this instead of
   localStorage directly. Synchronous reads after unlock come from the mirror;
   persistence is async-encrypted. */
/* True only on an encrypted device that is currently LOCKED (passphrase gate up):
   the passphrase verifier exists but the store has not been unlocked this session.
   In that window we must never touch localStorage for a secure key — writing
   plaintext would both leak PII at rest and clobber the ciphertext (which unlock
   then migrates as "legacy plaintext", destroying every other filed record). */
function _encLocked(){
  if(_secActive) return false;
  try{ return typeof localStorage !== 'undefined' && !!localStorage.getItem(SEC_META_KEY); }
  catch(e){ return false; }
}
const SS = {
  getItem(k){
    if(_secActive) return Object.prototype.hasOwnProperty.call(_secMem,k) ? _secMem[k] : null;
    try{ return localStorage.getItem(k); }catch(e){ return null; }
  },
  setItem(k,v){
    v = String(v);
    if(_secActive){ _secMem[k] = v; _secPersist(k, v); return; }
    if(_encLocked()) return;            /* locked encrypted device → drop; re-persisted (encrypted) on unlock */
    localStorage.setItem(k, v);         /* may throw on quota — callers handle storageWarn */
  },
  removeItem(k){
    if(_secActive){ delete _secMem[k]; try{ localStorage.removeItem(k); }catch(e){} return; }
    if(_encLocked()) return;            /* never mutate the encrypted store while locked */
    try{ localStorage.removeItem(k); }catch(e){}
  }
};
function _secWarn(show){ const w = $('storageWarn'); if(w) w.classList.toggle('hidden', !show); }
function _secPersist(k, v){
  encryptStr(_secKey, v)
    .then(blob => { try{ localStorage.setItem(k, blob); _secWarn(false); }catch(e){ _secWarn(true); } })
    .catch(() => _secWarn(true));
}

function _secError(msg){ const e = $('secErr'); if(e){ e.textContent = msg; e.classList.remove('hidden'); } }
function _secShow(mode, reason){
  _secMode = mode;
  const setup = mode === 'setup';
  const R = {
    expired: {t:'Session expired', m:'Your 1-hour session has ended — please re-enter your passphrase to continue.'},
    idle:    {t:'Session locked',  m:'Locked after 15 minutes of inactivity — please re-enter your passphrase to continue.'}
  }[reason];
  if($('secTitle')) $('secTitle').textContent = setup ? 'Protect this device' : (R ? R.t : 'Unlock');
  if($('secMsg')){
    $('secMsg').textContent = setup
      ? 'Encrypt every assessment, register entry and risk-data override stored in this browser with a passphrase (AES-256-GCM). You will enter it each time you open the tool on this device.'
      : (R ? R.m : 'Enter your passphrase to decrypt this device’s assessments.');
    $('secMsg').style.color = (R && !setup) ? '#E9C86A' : '';
  }
  if($('secPass')) $('secPass').value = '';
  if($('secPass2')){ $('secPass2').value = ''; $('secPass2').classList.toggle('hidden', !setup); }
  if($('secTotp')){ $('secTotp').value = ''; $('secTotp').classList.toggle('hidden', !(!setup && mfaOn())); }
  if($('secPrimary')) $('secPrimary').textContent = setup ? 'Set passphrase & encrypt' : 'Unlock';
  if($('secSkip')) $('secSkip').classList.toggle('hidden', !setup);
  if($('secNote')) $('secNote').textContent = setup
    ? '⚠ There is no recovery. If the passphrase is forgotten the stored data cannot be read — store the passphrase securely.'
    : '';
  if($('secBotCap')) $('secBotCap').textContent = setup ? 'Tap the bot to begin' : 'Tap the bot to unlock';
  if($('secErr')) $('secErr').classList.add('hidden');
  if($('secOverlay')) $('secOverlay').classList.add('open');
  const p = $('secPass'); if(p && p.focus) try{ p.focus(); }catch(e){}
}
function _secHide(){ if($('secOverlay')) $('secOverlay').classList.remove('open'); if($('secPass')) $('secPass').value=''; if($('secPass2')) $('secPass2').value=''; }
/* Tap-the-bot: playful nudge that drops focus into the passphrase field. */
function secBotTap(){
  const b = $('secBot');
  if(b && b.classList){ b.classList.add('tapped'); setTimeout(function(){ if(b.classList) b.classList.remove('tapped'); }, 500); }
  const p = $('secPass'); if(p && p.focus){ try{ p.focus(); }catch(e){} }
}

async function secSubmit(){
  if(!_hasCrypto()) return;
  const pass = ($('secPass') && $('secPass').value) || '';
  if(_secMode === 'setup'){
    if(pass.length < 8) return _secError('Use at least 8 characters.');
    if(pass !== (($('secPass2') && $('secPass2').value) || '')) return _secError('Passphrases do not match.');
    try{
      const salt = crypto.getRandomValues(new Uint8Array(16));
      _secKey = await _deriveKey(pass, salt, PBKDF2_ITER);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, _secKey, _u8('hsra-verify'));
      localStorage.setItem(SEC_META_KEY, JSON.stringify({v:1, salt:_b64(salt), iter:PBKDF2_ITER, iv:_b64(iv), ct:_b64(ct)}));
      localStorage.removeItem(SEC_OPTOUT_KEY);
      await _secActivate();          /* migrates existing plaintext → encrypted */
      await auditAppend('security.enabled', 'Encryption-at-rest enabled');
      _secFinish('Device encrypted — assessments are now protected.');
    }catch(e){ _secError('Could not enable encryption: ' + ((e && e.message) || e)); }
  } else {
    try{
      const meta = JSON.parse(localStorage.getItem(SEC_META_KEY));
      _secKey = await _deriveKey(pass, _ub64(meta.salt), meta.iter || PBKDF2_ITER);
      const check = await crypto.subtle.decrypt({name:'AES-GCM', iv:_ub64(meta.iv)}, _secKey, _ub64(meta.ct));
      if(new TextDecoder().decode(check) !== 'hsra-verify') throw new Error('bad');
      if(mfaOn()){                                   /* MFA step-up — require a valid TOTP code */
        const secret = await _mfaReadSecret();
        const code = ($('secTotp') && $('secTotp').value) || '';
        if(secret && !(await totpVerify(secret, code))){ _secKey = null; return _secError('Incorrect 2FA code.'); }
      }
      await _secActivate();
      await auditAppend('security.unlock', 'Device unlocked');
      _secFinish('Unlocked.');
    }catch(e){ _secKey = null; _secError('Incorrect passphrase.'); }
  }
}
/* First-run only: officer declines encryption — remember the choice, stay plaintext. */
function secSkip(){ try{ localStorage.setItem(SEC_OPTOUT_KEY, '1'); }catch(e){} _secHide(); }

async function _secActivate(){
  _secActive = true;
  for(const k of SECURE_KEYS){
    let raw = null; try{ raw = localStorage.getItem(k); }catch(e){}
    if(raw == null) continue;
    try{ _secMem[k] = await decryptStr(_secKey, raw); }
    catch(e){ _secMem[k] = raw; _secPersist(k, raw); }   /* legacy plaintext → upgrade in place */
  }
  _secArmIdle();
  if(!_sessExp || Date.now() >= _sessExp) _sessExp = Date.now() + SESS_MAX_MS;  /* a fresh unlock starts the hour; a silent resume keeps the stored expiry */
  await _sessSave();
  _sessStartChip();
}
function _secFinish(msg){
  _secHide();
  _syncHeaderLock(false);
  hydrateApp();
  toast(msg);
}
function _secArmIdle(){
  if(!_secActive || typeof window === 'undefined' || !window.addEventListener) return;
  ['click','keydown','mousemove','touchstart'].forEach(ev => window.addEventListener(ev, _secBumpIdle, {passive:true}));
  _secBumpIdle();
}
function _secBumpIdle(){ if(_idleTimer) clearTimeout(_idleTimer); _idleTimer = setTimeout(() => secLock('idle'), IDLE_LOCK_MS); _sessTouch(); }
function secLock(reason){
  if(!_secActive) return;
  try{ mirrorBeacon(); }catch(e){}   /* flush a last summary to Asana before the in-memory data is cleared */
  _secKey = null; _secActive = false;
  for(const k in _secMem) delete _secMem[k];
  if(typeof saveTimer !== 'undefined' && saveTimer){ clearTimeout(saveTimer); saveTimer = null; }  /* no pending plaintext write can land after lock */
  if(_idleTimer){ clearTimeout(_idleTimer); _idleTimer = null; }
  _sessClear();         /* destroy the 1-hour session so a reload cannot resume it */
  _syncHeaderLock(true);
  _secShow('unlock', reason);   /* opaque overlay hides the on-screen data until re-unlocked */
}

/* ── 1-hour unlock session (cross-page) ────────────────────────────────────
   Officer chose: cache the unlock so navigating between Assessment / Console /
   Advisor (each a full page load) does not re-prompt, for up to one hour. The
   key OBJECT is cached in IndexedDB (non-extractable — see the _idb helpers and
   _deriveKey); only the {exp,seen} metadata lives in localStorage. The passphrase
   and the raw key bytes are never stored. Locking (idle / manual / expiry)
   destroys the session so it cannot be resumed by reloading. */
async function _sessSave(){
  try{
    if(!_secKey || typeof localStorage === 'undefined') return;
    /* Cache the CryptoKey OBJECT in IndexedDB; fail CLOSED if IDB is unavailable
       (store nothing — the officer re-enters the passphrase on the next page). */
    let stored = false;
    try{ stored = await _idbPut(SEC_IDB_KEY, _secKey); }catch(e){ stored = false; }
    if(!stored){ try{ localStorage.removeItem(SESS_KEY); }catch(e){} return; }
    localStorage.setItem(SESS_KEY, JSON.stringify({exp:_sessExp, seen:Date.now()}));
  }catch(e){}
}
function _sessRead(){
  try{
    const s = JSON.parse(localStorage.getItem(SESS_KEY) || 'null');
    if(!s || !s.exp) return null;
    if(s.k) return null;   /* legacy blob carried the raw key — refuse it (scrubbed on boot by _sessExpiredReason) so an exposed key is never used */
    const now = Date.now();
    if(now >= s.exp) return null;                              /* 1-hour cap reached */
    if(s.seen && (now - s.seen) >= IDLE_LOCK_MS) return null;  /* idle beyond the lock window */
    return s;
  }catch(e){ return null; }
}
function _sessExpiredReason(){   /* a session blob exists but is no longer valid — why? (drives the unlock note) */
  try{
    const raw = localStorage.getItem(SESS_KEY);
    if(!raw) return null;
    let s = null; try{ s = JSON.parse(raw); }catch(e){}
    if(typeof localStorage !== 'undefined') localStorage.removeItem(SESS_KEY);   /* clear the stale blob */
    if(!s || !s.exp) return null;
    const now = Date.now();
    if(now >= s.exp) return 'expired';
    if(s.seen && (now - s.seen) >= IDLE_LOCK_MS) return 'idle';
    return null;
  }catch(e){ return null; }
}
function _sessClear(){
  try{ if(typeof localStorage !== 'undefined') localStorage.removeItem(SESS_KEY); }catch(e){}
  try{ _idbDel(SEC_IDB_KEY).catch(function(){}); }catch(e){}   /* best-effort: drop the cached key object (localStorage removal above is the authoritative gate) */
  _sessExp = 0;
  if(_sessTimer){ try{ clearInterval(_sessTimer); }catch(e){} _sessTimer = null; }
  _sessRenderChip();
}
function _sessTouch(){   /* throttled last-activity stamp so the idle window spans all three pages */
  try{
    const s = JSON.parse(localStorage.getItem(SESS_KEY) || 'null');
    if(!s || !s.exp) return;
    const now = Date.now();
    /* Re-write ONLY {exp,seen} — never spread `s`, so a legacy `k` (raw key) can
       never be resurrected into localStorage by an activity stamp. */
    if(!s.seen || now - s.seen > 15000){ localStorage.setItem(SESS_KEY, JSON.stringify({exp:s.exp, seen:now})); }
  }catch(e){}
}
async function _sessRestore(s){   /* silent unlock from the IndexedDB session key — no passphrase prompt */
  try{
    const meta = JSON.parse(localStorage.getItem(SEC_META_KEY) || 'null');
    if(!meta || !meta.salt) return false;
    /* Retrieve the cached CryptoKey OBJECT from IndexedDB. No key (or IDB gone)
       ⇒ fail closed: clear the session and fall back to the passphrase prompt. */
    let key = null;
    try{ key = await _idbGet(SEC_IDB_KEY); }catch(e){ key = null; }
    if(!key){ _sessClear(); return false; }
    _secKey = key;
    const check = await crypto.subtle.decrypt({name:'AES-GCM', iv:_ub64(meta.iv)}, _secKey, _ub64(meta.ct));
    if(new TextDecoder().decode(check) !== 'hsra-verify') throw new Error('bad-session');
    _sessExp = s.exp;
    await _secActivate();          /* load the encrypted register/draft into the mirror + arm idle */
    _secHide();
    _syncHeaderLock(false);
    hydrateApp();
    return true;
  }catch(e){ _secKey = null; _secActive = false; _sessClear(); return false; }
}
function _sessStartChip(){
  if(typeof setInterval === 'undefined') return;
  if(_sessTimer){ clearInterval(_sessTimer); }
  _sessRenderChip();
  _sessTimer = setInterval(_sessTick, 1000);
}
function _sessTick(){
  if(!_secActive){ if(_sessTimer){ clearInterval(_sessTimer); _sessTimer = null; } return; }
  if(_sessExp && Date.now() >= _sessExp){ secLock('expired'); return; }   /* 1-hour cap → re-login */
  _sessRenderChip();
}
function _sessRenderChip(){
  const el = (typeof $ === 'function') ? $('sessTimer') : null;
  if(!el) return;
  if(!_secActive || !_sessExp){ el.classList.add('hidden'); return; }
  const ms = Math.max(0, _sessExp - Date.now());
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  el.classList.remove('hidden');
  el.classList.toggle('warn', ms <= 5 * 60000);
  const t = el.querySelector('.sess-t');
  if(t) t.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
/* Boot entry point: decide whether to gate. Runs after the app has rendered, so
   a thrown error here can never blank the page (and the engine/CI smoke test
   always sees a computed verdict underneath the overlay). */
function initSecurity(){
  try{
    if(!_hasCrypto() || !$('secOverlay')) return;          /* no WebCrypto (or test stub) → unchanged */
    let meta = null; try{ meta = JSON.parse(localStorage.getItem(SEC_META_KEY) || 'null'); }catch(e){}
    const p = $('secPass');
    if(p && p.addEventListener) p.addEventListener('keydown', e => { if(e.key === 'Enter') secSubmit(); });
    const p2 = $('secPass2');
    if(p2 && p2.addEventListener) p2.addEventListener('keydown', e => { if(e.key === 'Enter') secSubmit(); });
    const pt = $('secTotp');
    if(pt && pt.addEventListener) pt.addEventListener('keydown', e => { if(e.key === 'Enter') secSubmit(); });
    if(meta && meta.salt){                                  /* returning, encrypted device */
      const sess = _sessRead();                             /* resume a live 1-hour session without re-prompting */
      if(sess) _sessRestore(sess).then(ok => { if(!ok) _secShow('unlock'); });
      else _secShow('unlock', _sessExpiredReason());
    }
    else if(localStorage.getItem(SEC_OPTOUT_KEY) === '1') return;  /* opted out previously */
    else _secShow('setup');                                 /* first run → offer protection */
  }catch(e){}
}

/* ── Tamper-evident activity log (AUDIT / LOG / TRACE) ──
   Append-only, SHA-256 hash-chained: each entry binds the previous hash so any
   edit or deletion to earlier rows is detectable. Stored via the encrypted layer. */
const AUDIT_KEY = 'hsra.audit.v1';
function auditAll(){ try{ const r = SS.getItem(AUDIT_KEY); return r ? JSON.parse(r) : []; }catch(e){ return []; } }
let _auditChain = Promise.resolve();
/* Serialise appends: concurrent auditAppend calls must not lose entries to a
   read-modify-write race on the stored log — the hash chain stays complete and
   verifiable. Callers may still await the returned promise. */
function auditAppend(event, detail){
  _auditChain = _auditChain.then(() => _auditAppendInner(event, detail), () => _auditAppendInner(event, detail));
  return _auditChain;
}
async function _auditAppendInner(event, detail){
  if(!_hasCrypto()) return;
  try{
    const log = auditAll();
    const prev = log.length ? log[log.length-1].hash : 'GENESIS';
    const e = {
      ts: new Date().toISOString(),
      who: (typeof state !== 'undefined' && state.meta && state.meta.assessor) || '',
      ref: (typeof state !== 'undefined' && state.meta && state.meta.ref) || '',
      event: String(event), detail: String(detail == null ? '' : detail)
    };
    e.hash = await sha256Hex(prev + '|' + e.ts + '|' + e.who + '|' + e.ref + '|' + e.event + '|' + e.detail);
    log.push(e);
    SS.setItem(AUDIT_KEY, JSON.stringify(log));
    scheduleMirror();
  }catch(err){}
}
async function auditVerify(){
  const log = auditAll();
  let prev = 'GENESIS';
  for(const e of log){
    const h = await sha256Hex(prev + '|' + e.ts + '|' + e.who + '|' + e.ref + '|' + e.event + '|' + e.detail);
    if(h !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}
function _auditRow(e){
  return '<div class="rd-row"><span class="rd-at w-auto">'+esc(fmtDateTime(e.ts))+'</span>'
    + '<span class="rd-name">'+esc(e.event)+(e.detail?' — '+esc(e.detail):'')+'</span>'
    + '<span class="rd-base">'+esc(e.who||'—')+(e.ref?' · '+esc(e.ref):'')+'</span></div>';
}
/* Local date + local time. Pairing toISOString() (UTC date) with toTimeString()
   (local time) mismatched the two east of UTC — an 02:00 UAE entry showed the
   previous day's date. Derive both from the local calendar via toISO(). */
function fmtDateTime(iso){ try{ const d = new Date(iso); return fmtDate(toISO(d)) + ' ' + d.toTimeString().slice(0,5); }catch(e){ return esc(iso); } }
/* Modal focus management (WCAG 2.4.3): remember what had focus, move focus into
   the panel on open, restore it on close. Guarded so it is a no-op under the
   test DOM stub (no querySelector / activeElement) and in older browsers. */
let _lastModalFocus = null;
function _focusDialog(overlayId){
  const o = $(overlayId); if(!o) return;
  try{ _lastModalFocus = (typeof document !== 'undefined' && document.activeElement) || null; }catch(e){ _lastModalFocus = null; }
  try{ const btn = o.querySelector && o.querySelector('.rd-close'); if(btn && btn.focus) btn.focus(); }catch(e){}
}
function _restoreDialogFocus(){
  try{ if(_lastModalFocus && _lastModalFocus.focus) _lastModalFocus.focus(); }catch(e){}
  _lastModalFocus = null;
}
async function openAudit(){
  const log = auditAll();
  if($('auditRows')) $('auditRows').innerHTML = log.length
    ? log.slice().reverse().map(_auditRow).join('')
    : '<div class="rd-empty">No activity recorded yet.</div>';
  if($('auditCountLbl')) $('auditCountLbl').textContent = log.length + (log.length===1?' entry':' entries');
  if($('auditMeta')) $('auditMeta').textContent = '';
  paintRole(); paintMfa();
  if($('auditOverlay')) $('auditOverlay').classList.add('open');
  _focusDialog('auditOverlay');
  const ok = await auditVerify();
  if($('auditMeta')) $('auditMeta').textContent = log.length ? (ok ? '✓ chain intact' : '⚠ integrity check failed') : '';
}
function closeAudit(){ if($('auditOverlay')) $('auditOverlay').classList.remove('open'); _restoreDialogFocus(); }
async function exportAudit(){
  const out = {app:'Hawkeye Sterling — Activity Log', exportedAt:new Date().toISOString(), entries:auditAll()};
  out.integrity = await exportIntegrity(out.entries);   /* SHA-256 over JSON.stringify(export.entries); chain head also in each entry */
  const blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'activity-log.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href), 1000);
  toast('Activity log exported');
}
function _auditReportBlock(){
  const log = auditAll();
  if(!log.length) return '';
  const rows = log.slice(-15).map(e =>
    '<tr><td class="t">'+esc(fmtDateTime(e.ts))+'</td>'
    + '<td>'+esc(e.event)+(e.detail?' - '+esc(e.detail):'')+(e.who?' - '+esc(e.who):'')+'</td></tr>').join('');
  return '<div class="audit"><div class="audit-h">Audit trail - assessment lifecycle '
    + '(tamper-evident, hash-chained - last '+Math.min(15,log.length)+' of '+log.length+')</div>'
    + '<table><tbody>'+rows+'</tbody></table></div>';
}
/* ══════════════════════════════════════════
   AI GOVERNANCE & SECURITY CONTROLS (in-code, no backend, no new deps)
   Closes the genuinely-addable Periodic-Table tiles for an on-device tool:
   RBAC/ABAC (operator-role gating), MFA (TOTP second factor), MASK (field
   masking), TOKEN (pseudonymised export) and RCause (structured RCA in the
   tamper-evident log). SSO / VDB / PIPE / central enterprise IAM remain N-A —
   they require an external integration/backend, out of scope by design.
══════════════════════════════════════════ */

/* ── Operator role — RBAC / ABAC (segregation of duties, recorded in the log) ──
   Defaults to 'admin' so the single-operator flow is unchanged; selecting a
   lower role enforces SoD (e.g. an analyst cannot record a second-line approval). */
const ROLE_KEY = 'hsra.role.v1';
const ROLES = ['analyst','reviewer','admin'];
const ROLE_LABEL = {analyst:'Analyst (first line)', reviewer:'Reviewer / MLRO (second line)', admin:'Administrator'};
function currentRole(){ try{ return localStorage.getItem(ROLE_KEY) || 'admin'; }catch(e){ return 'admin'; } }
function setRole(r){ if(ROLES.indexOf(r) < 0) return false; try{ localStorage.setItem(ROLE_KEY, r); }catch(e){} auditAppend('role.set', ROLE_LABEL[r] || r); paintRole(); return true; }
function roleAtLeast(min){ return ROLES.indexOf(currentRole()) >= ROLES.indexOf(min); }
/* ABAC: action → role predicate */
function can(action){
  switch(action){
    case 'approve':  return roleAtLeast('reviewer');   /* second-line sign-off / completion */
    case 'riskdata': return roleAtLeast('reviewer');   /* edit baseline overrides */
    case 'security': return roleAtLeast('admin');      /* change 2FA / reset security */
    default:         return true;
  }
}
function denyToast(what){ toast('Permission denied — role “'+(ROLE_LABEL[currentRole()] || currentRole())+'” cannot '+what+'.'); }
function paintRole(){ const sel = $('govRole'); if(sel) sel.value = currentRole(); }
function onRoleChange(v){ setRole(v); }

/* ── POLICY enforcement — completeness gate before an assessment is finalised ── */
function policyMissing(){
  const s = (typeof state !== 'undefined' && state.signoff) || {};
  const m = (typeof state !== 'undefined' && state.meta) || {};
  const out = [];
  if(!String(s.completedBy || '').trim()) out.push('First-line assessor (Assessed By) — ' + POLICIES.RCP);
  if(!String(s.approvedBy || '').trim()) out.push('Second-line approver (MLRO) — ' + POLICIES.RCP);
  if(!String(m.assessor || '').trim())   out.push('Assessor name (' + POLICIES.KYC + ')');
  return out;
}

/* ── MASK — field-level masking of sensitive identifiers ── */
let _maskOn = false;
function paintMaskBtn(){
  if(!$('btnMask')) return;
  const ar = (typeof getLang==='function' && getLang()==='ar');
  $('btnMask').textContent = ar
    ? (_maskOn ? '🙉 إظهار الحقول الحساسة' : '🙈 إخفاء الحقول الحساسة')
    : (_maskOn ? '🙉 Unmask sensitive fields' : '🙈 Mask sensitive fields');
}
function toggleMask(){
  _maskOn = !_maskOn;
  try{ if(document.body && document.body.classList) document.body.classList.toggle('mask-on', _maskOn); }catch(e){}
  paintMaskBtn();
}

/* ── TOKEN — pseudonymised export of the activity log (stable SHA-256 tokens) ── */
async function exportAuditTokenized(){
  const entries = auditAll();
  const map = {};
  const tok = async (s, pfx) => { s = String(s || ''); if(!s) return s; if(!map[s]) map[s] = pfx + '-' + (await sha256Hex('hsra-token|' + s)).slice(0, 8).toUpperCase(); return map[s]; };
  const out = [];
  for(const e of entries) out.push(Object.assign({}, e, { who: await tok(e.who, 'ID'), ref: await tok(e.ref, 'REF') }));
  const payload = { app: 'Hawkeye Sterling — Activity Log (pseudonymised)', note: 'Identifiers replaced by stable tokens; original hash chain is not re-verifiable against this file.', exportedAt: new Date().toISOString(), entries: out };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'activity-log-tokenised.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  auditAppend('export.audit.tokenised', out.length + ' entries');
  toast('Pseudonymised activity log exported');
}

/* ── RCause — structured root-cause analysis appended to the hash-chained log ── */
async function addRCA(rec){
  rec = rec || {};
  const detail = ['incident=' + String(rec.incident || '').trim(),
    'trigger=' + String(rec.trigger || '').trim(),
    'rootCause=' + String(rec.rootCause || '').trim(),
    'corrective=' + String(rec.corrective || '').trim(),
    'owner=' + String(rec.owner || '').trim()].join(' | ');
  await auditAppend('rca.record', detail);
  return detail;
}
function rcaSubmit(){
  const g = id => ($(id) && $(id).value) || '';
  const rec = { incident:g('rcaIncident'), trigger:g('rcaTrigger'), rootCause:g('rcaRoot'), corrective:g('rcaAction'), owner:g('rcaOwner') };
  if(!rec.incident.trim() || !rec.rootCause.trim()){ toast('Record an RCA needs at least an incident and a root cause.'); return; }
  addRCA(rec).then(() => {
    ['rcaIncident','rcaTrigger','rcaRoot','rcaAction','rcaOwner'].forEach(i => { if($(i)) $(i).value = ''; });
    openAudit();
    toast('Root-cause analysis recorded in the activity log.');
  });
}

/* ── MFA — TOTP second factor (RFC 6238, HMAC-SHA1, WebCrypto, no deps) ──
   The secret is stored encrypted under the device passphrase; a plaintext flag
   tells the unlock gate to require a code. Missing/corrupt secret fails open
   (skips 2FA) so the device can never be permanently locked out. */
const MFA_KEY = 'hsra.mfa.v1';      /* AES-GCM-encrypted base32 secret */
const MFA_FLAG = 'hsra.mfa.on';     /* '1' when 2FA is enabled */
const _B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function _b32encode(bytes){ let bits = 0, val = 0, out = ''; for(const b of bytes){ val = (val << 8) | b; bits += 8; while(bits >= 5){ out += _B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if(bits > 0) out += _B32[(val << (5 - bits)) & 31]; return out; }
function _b32decode(str){ str = String(str).toUpperCase().replace(/[^A-Z2-7]/g, ''); let bits = 0, val = 0; const out = []; for(const c of str){ const idx = _B32.indexOf(c); if(idx < 0) continue; val = (val << 5) | idx; bits += 5; if(bits >= 8){ out.push((val >>> (bits - 8)) & 0xff); bits -= 8; } } return new Uint8Array(out); }
function mfaGenSecret(){ return _b32encode(crypto.getRandomValues(new Uint8Array(20))); }
async function totpAt(secretB32, counter){
  const ck = await crypto.subtle.importKey('raw', _b32decode(secretB32), {name:'HMAC', hash:'SHA-1'}, false, ['sign']);
  const buf = new ArrayBuffer(8), dv = new DataView(buf);
  dv.setUint32(4, counter >>> 0); dv.setUint32(0, Math.floor(counter / 4294967296) >>> 0);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', ck, buf));
  const off = sig[sig.length - 1] & 0xf;
  const bin = ((sig[off] & 0x7f) << 24) | ((sig[off+1] & 0xff) << 16) | ((sig[off+2] & 0xff) << 8) | (sig[off+3] & 0xff);
  return String(bin % 1000000).padStart(6, '0');
}
/* eslint-disable-next-line no-unused-vars -- public API exercised by test/app.test.js */
function totpNow(secretB32){ return totpAt(secretB32, Math.floor(Date.now() / 30000)); }
async function totpVerify(secretB32, code){
  code = String(code || '').trim();
  if(!/^\d{6}$/.test(code)) return false;
  const c = Math.floor(Date.now() / 30000);
  for(const w of [-1, 0, 1]) if((await totpAt(secretB32, c + w)) === code) return true;   /* ±30s drift */
  return false;
}
function mfaOn(){ try{ return localStorage.getItem(MFA_FLAG) === '1'; }catch(e){ return false; } }
async function _mfaReadSecret(){ try{ const raw = localStorage.getItem(MFA_KEY); return raw ? await decryptStr(_secKey, raw) : null; }catch(e){ return null; } }
function paintMfa(){
  if($('mfaStatus')) $('mfaStatus').textContent = 'Two-factor (TOTP): ' + (mfaOn() ? 'on' : 'off');
  if($('btnMfa')) $('btnMfa').textContent = mfaOn() ? 'Disable 2FA' : 'Enable 2FA';
}
async function mfaToggle(){
  if(!can('security')) return denyToast('change security settings');
  if(mfaOn()){
    try{ localStorage.removeItem(MFA_FLAG); localStorage.removeItem(MFA_KEY); }catch(e){}
    await auditAppend('security.mfa', 'Two-factor disabled');
    paintMfa(); toast('Two-factor disabled.'); return;
  }
  if(!_secActive || !_secKey){ toast('Enable device encryption first, then 2FA.'); return; }
  const secret = mfaGenSecret();
  try{ localStorage.setItem(MFA_KEY, await encryptStr(_secKey, secret)); localStorage.setItem(MFA_FLAG, '1'); }
  catch(e){ toast('Could not enable 2FA.'); return; }
  await auditAppend('security.mfa', 'Two-factor enabled');
  paintMfa();
  if($('mfaStatus')) $('mfaStatus').innerHTML = 'Two-factor (TOTP): ON — add this key to your authenticator: <code class="totp-key">' + esc(secret) + '</code>';
  toast('2FA enabled — store the key shown in your authenticator app.');
}

function scoreFromYesNo(val, type) {
  if(type==='vlok')  return val==='Yes' ? 3 : 1;
  if(type==='vlok2') return val==='Yes' ? 1 : 3;
  if(type==='onboard') return val==='Yes' ? 3 : 1;
  return 1;
}
function ratingLabel(s){ return ['No Risk','Low','Medium','High'][s] || '—'; }
function ratingClass(s){ return ['b0','b1','b2','b3'][s] || 'b0'; }
function scoreTagClass(s){ return ['st-0','st-1','st-2','st-3'][s] || 'st-0'; }
function yearsToScore(y){ return y<=0 ? 3 : y===1 ? 2 : 1; }
function toISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function todayISO(){ return toISO(new Date()); }
/* All dates display as DD/MM/YYYY; state and storage stay ISO (yyyy-mm-dd). */
function fmtDate(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));
  return m ? m[3]+'/'+m[2]+'/'+m[1] : '';
}
function dmyToISO(s){
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(String(s||''));
  if(!m) return '';
  const d = parseInt(m[1],10), mo = parseInt(m[2],10), y = parseInt(m[3],10);
  if(mo<1 || mo>12 || d<1 || d>new Date(y, mo, 0).getDate()) return '';
  return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function dateFieldChanged(el, apply){
  const iso = dmyToISO(el.value);
  if(iso) el.value = fmtDate(iso); /* normalise e.g. 1/6/2026 → 01/06/2026 */
  else el.value = ''; /* invalid text never lingers while the state is cleared */
  apply(iso);
}
function addMonths(iso, m){
  const p = (iso || todayISO()).split('-').map(Number);
  const y = p[0], mo = (p[1]||1)-1+m, day = p[2]||1;
  const lastDay = new Date(y, mo+1, 0).getDate(); /* clamp: 29 Feb + 12mo → 28 Feb, not 1 Mar */
  return toISO(new Date(y, mo, Math.min(day, lastDay)));
}
function addDays(iso, n){
  const p = (iso || todayISO()).split('-').map(Number);
  return toISO(new Date(p[0], (p[1]||1)-1, (p[2]||1)+n));
}
function newRef(){
  const d = new Date();
  const ymd = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  let seq = 1;
  try{ seq = (parseInt(localStorage.getItem(SEQ_KEY))||0) + 1; localStorage.setItem(SEQ_KEY, seq); }catch(e){}
  return 'RA-' + ymd + '-' + String(seq).padStart(3,'0');
}

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
function defaultState(){
  const questions = {};
  QUESTIONS_OC.forEach(q => questions[q.id] = q.default);
  return {
    meta:    {ref:'', date:'', assessor:'', role:''},
    entity:  {name:'', trading:'', regno:'', address:'', contact:'', jurisdiction:'United Kingdom', principals:''},
    profile: {activity:'Non-Manufactured Precious Metal Trading', onboard:'No', entityYears:2, relYears:2},
    questions,
    suppliers:{recycled:['LBMA GD Bullion/DGD Good Delivery','N/A','N/A'], mined:['N/A','N/A','N/A']},
    screening:{sanctions:{system:'',date:'',ref:''}, pep:{system:'',date:'',ref:''}, adverse:{system:'',date:'',ref:''}},
    notes:   '',
    override:{band:'', reason:'', at:''},
    signoff: {completedBy:'', completedTitle:'', completedDate:'', approvedBy:'', approvedTitle:'', approvedDate:'', nextReview:'', reviewManual:false},
    complete: false,
    prior: null
  };
}
function freshState(){
  const s = defaultState();
  /* While the encryption gate is up, the draft is unreadable ciphertext, so
     boot lands here even though a real draft exists behind the lock. Allocating
     a reference now would burn one hsra.seq number on every locked page load
     (unlock re-runs hydrateApp, restores the draft, and discards this state).
     Leave the ref empty; the post-unlock hydrate allocates it properly. */
  s.meta.ref = _encLocked() ? '' : newRef();
  s.meta.date = todayISO();
  return s;
}
/** Merge an untrusted source object into a clean default state. Only whitelisted scalar fields
 *  cross the boundary; unknown keys and non-scalar values are silently dropped. */
function mergeState(src){
  const out = defaultState();
  if(!src || typeof src!=='object') return out;
  /* Only known scalar fields cross the import boundary; objects/functions are rejected
     so a hand-edited file can never plant "[object Object]" or junk keys in state. */
  const SCALARS = {
    meta:   ['ref','date','assessor','role'],
    entity: ['name','trading','regno','address','contact','jurisdiction','principals'],
    profile:['activity','onboard','entityYears','relYears'],
    signoff:['completedBy','completedTitle','completedDate','approvedBy','approvedTitle','approvedDate','nextReview','reviewManual']
  };
  /* Date fields feed addMonths() and the review scheduler, where a non-ISO
     value becomes 'NaN-NaN-NaN' in nextReview and silently drops the
     assessment from review tracking — only YYYY-MM-DD may cross; anything
     else keeps the clean default. */
  const DATE_FIELDS = {meta:['date'], signoff:['completedDate','approvedDate','nextReview']};
  const isoDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v));
  Object.keys(SCALARS).forEach(k => {
    if(!src[k] || typeof src[k]!=='object') return;
    SCALARS[k].forEach(f => {
      const v = src[k][f];
      if(v==null || typeof v==='object' || typeof v==='function') return;
      if(f==='reviewManual') out.signoff.reviewManual = (v===true || v==='true');
      else if((DATE_FIELDS[k]||[]).indexOf(f)!==-1){ if(isoDay(v)) out[k][f] = String(v); }
      else out[k][f] = String(v);
    });
  });
  if(src.questions && typeof src.questions==='object'){
    QUESTIONS_OC.forEach(q => {
      const v = src.questions[q.id];
      if(v==='Yes' || v==='No') out.questions[q.id] = v;
    });
  }
  if(src.suppliers && typeof src.suppliers==='object'){
    [['recycled',RECYCLED],['mined',MINED]].forEach(([k,list]) => {
      if(Array.isArray(src.suppliers[k])){
        src.suppliers[k].slice(0,3).forEach((v,i) => {
          out.suppliers[k][i] = list.some(o=>o.name===v) ? v : 'N/A';
        });
      }
    });
  }
  if(src.screening && typeof src.screening==='object'){
    /* evidence-of-screening record: system / date / reference per check */
    Object.keys(out.screening).forEach(g => {
      const m = src.screening[g];
      if(!m || typeof m!=='object') return;
      ['system','date','ref'].forEach(f => {
        const v = m[f];
        if(v==null || typeof v==='object' || typeof v==='function') return;
        if(f==='date' && !isoDay(v)) return; /* non-ISO dates never enter the record */
        out.screening[g][f] = String(v);
      });
    });
  }
  if(typeof src.notes==='string') out.notes = src.notes;
  if(src.override && typeof src.override==='object' && (src.override.band==='SDD' || src.override.band==='EDD')){
    out.override.band = src.override.band;
    const r = src.override.reason;
    if(r!=null && typeof r!=='object' && typeof r!=='function') out.override.reason = String(r);
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(src.override.at||''))) out.override.at = String(src.override.at);
  }
  out.complete = (src.complete===true || src.complete==='true');
  if(src.prior && typeof src.prior==='object' && !Array.isArray(src.prior)){
    /* prior-review snapshot kept by the re-assessment flow */
    const p = src.prior, total = parseInt(p.total);
    if(!isNaN(total) && ['CDD','SDD','EDD','PROHIBITED'].indexOf(String(p.outcome))!==-1){
      const prior = {ref:'', date:'', total, outcome:String(p.outcome), parts:[]};
      ['ref','date'].forEach(f => {
        const v = p[f];
        if(v!=null && typeof v!=='object' && typeof v!=='function') prior[f] = String(v);
      });
      if(Array.isArray(p.parts)) p.parts.slice(0,40).forEach(row => {
        if(!row || typeof row!=='object') return;
        const sc = parseInt(row.score);
        if(row.label==null || typeof row.label==='object' || isNaN(sc)) return;
        prior.parts.push({label:String(row.label), value:(row.value!=null && typeof row.value!=='object') ? String(row.value) : '', score:Math.max(0, Math.min(3, sc))});
      });
      out.prior = prior;
    }
  }
  if(!COUNTRIES.some(c=>c.name===out.entity.jurisdiction)) out.entity.jurisdiction = 'United Kingdom';
  /* Unknown activity falls back to the state DEFAULT (score 3), mirroring the
     jurisdiction guard above — never to ACTIVITIES[0], the lowest-scoring
     entry, which would silently downgrade a re-imported assessment's risk. */
  if(!ACTIVITIES.some(a=>a.name===out.profile.activity)) out.profile.activity = 'Non-Manufactured Precious Metal Trading';
  out.profile.onboard = out.profile.onboard==='Yes' ? 'Yes' : 'No';
  out.profile.entityYears = Math.max(0, Math.min(99, parseInt(out.profile.entityYears)||0));
  out.profile.relYears = Math.max(0, Math.min(99, parseInt(out.profile.relYears)||0));
  return out;
}

let state = defaultState();

/* ══════════════════════════════════════════
   RISK DATA — baseline arrays + compliance overrides
   The arrays above are the firm-approved baseline (changes to them go
   through a PR). The compliance officer can layer per-item overrides on
   top — each with a mandatory reason — kept in localStorage and shareable
   as an exported "risk data sheet" file.
══════════════════════════════════════════ */
const RISK_DATA_VERSION = '2026-06'; /* bump when the baseline arrays change */
const RD_STORAGE_KEY = 'hsra.riskdata.v1';
const RD_KINDS = {
  countries: {list:COUNTRIES,  label:'Countries',  min:1},
  activities:{list:ACTIVITIES, label:'Activities', min:1},
  recycled:  {list:RECYCLED,   label:'Recycled',   min:0},
  mined:     {list:MINED,      label:'Mined',      min:0}
};

function freshRiskData(){ return {overrides:{countries:{}, activities:{}, recycled:{}, mined:{}}, updatedAt:''}; }
let riskData = freshRiskData();

function rdBase(kind, name){ return RD_KINDS[kind] ? (RD_KINDS[kind].list.find(o=>o.name===name) || null) : null; }
function rdOv(kind, name){ return (riskData.overrides[kind] && riskData.overrides[kind][name]) || null; }
function rdCount(){ return Object.values(riskData.overrides).reduce((n,m)=>n+Object.keys(m).length, 0); }
/* Effective item: baseline merged with any override, plus audit fields when overridden */
function effOf(kind, name){
  const b = rdBase(kind, name);
  if(!b) return null;
  const o = rdOv(kind, name);
  if(!o) return b;
  const e = {name:b.name, score:o.score, overridden:true, baseScore:b.score, reason:o.reason, at:o.at};
  if(kind==='countries'){ e.cfa = !!o.cfa; e.baseCfa = !!b.cfa; }
  return e;
}
function effCountry(name){ return effOf('countries', name); }

function mergeRiskData(src){
  /* Same philosophy as mergeState: only known items, sane values, deltas only. */
  const out = freshRiskData();
  if(!src || typeof src!=='object') return out;
  const map = (src.overrides && typeof src.overrides==='object') ? src.overrides : src;
  Object.keys(RD_KINDS).forEach(kind => {
    const m = map[kind];
    if(!m || typeof m!=='object') return;
    Object.keys(m).forEach(name => {
      const b = rdBase(kind, name), v = m[name];
      if(!b || b.name==='N/A' || !v || typeof v!=='object') return;
      const score = parseInt(v.score);
      if(isNaN(score) || score < RD_KINDS[kind].min || score > 3) return;
      const cfa = kind==='countries' ? (v.cfa===true || v.cfa==='true') : undefined;
      if(score===b.score && (kind!=='countries' || cfa===!!b.cfa)) return; /* not a delta */
      const entry = {
        score,
        reason: (typeof v.reason==='string' && v.reason.trim()) ? v.reason.trim() : '(no reason recorded)',
        at: /^\d{4}-\d{2}-\d{2}$/.test(String(v.at||'')) ? String(v.at) : todayISO()
      };
      if(kind==='countries') entry.cfa = cfa;
      out.overrides[kind][name] = entry;
    });
  });
  if(typeof src.updatedAt==='string') out.updatedAt = src.updatedAt;
  return out;
}
function loadRiskData(){
  try{
    const raw = SS.getItem(RD_STORAGE_KEY);
    return raw ? mergeRiskData(JSON.parse(raw)) : freshRiskData();
  }catch(e){ return freshRiskData(); }
}
function saveRiskData(){
  riskData.updatedAt = todayISO();
  try{ SS.setItem(RD_STORAGE_KEY, JSON.stringify(riskData)); }catch(e){}
}
function rdAfterChange(){
  saveRiskData();
  refreshSelectLabels();
  paintJurisdiction();
  paintActivity();
  ['recycled','mined'].forEach(p => state.suppliers[p].forEach((v,i) => paintSupplier(p,i)));
  recalc();
  rdRender();
  scheduleRiskBackup();
}
/* Off-device backup: every override change mirrors the full risk-data sheet
   to a dedicated Asana task via a Netlify function; the monthly watchdog
   commits that mirror to the repository. Deployed site only, silent. */
let rdBackupTimer = null;
function scheduleRiskBackup(){
  if(typeof fetch !== 'function' || typeof location === 'undefined' || location.protocol.indexOf('http') !== 0) return;
  clearTimeout(rdBackupTimer);
  rdBackupTimer = setTimeout(function(){
    fetch('/.netlify/functions/risk-backup', {
      method: 'POST',
      headers: fnHeaders(),
      body: JSON.stringify({sheet: {app: 'Hawkeye Sterling — Entity Risk Assessment', version: APP_VERSION,
        riskDataVersion: RISK_DATA_VERSION, updatedAt: riskData.updatedAt, overrides: riskData.overrides}})
    }).catch(function(){});
  }, 1500);
}
/* Set one override. A reason is mandatory for any deviation from baseline;
   setting values equal to baseline clears the override instead. */
/** Apply one risk-data override. Reason is mandatory for any deviation from baseline;
 *  setting values equal to baseline clears the override. Returns false if validation fails. */
function rdSetOverride(kind, name, vals){
  const b = rdBase(kind, name);
  if(!b || b.name==='N/A' || !vals) return false;
  if(!can('riskdata')){ denyToast('edit risk-data overrides'); return false; }
  const score = parseInt(vals.score);
  if(isNaN(score) || score < RD_KINDS[kind].min || score > 3) return false;
  const cfa = kind==='countries' ? !!vals.cfa : undefined;
  if(score===b.score && (kind!=='countries' || cfa===!!b.cfa)){
    if(rdOv(kind, name)) rdClearOverride(kind, name);
    return true;
  }
  const reason = String(vals.reason==null ? '' : vals.reason).trim().slice(0, 500);
  if(!reason) return false;
  const entry = {score, reason, at:todayISO()};
  if(kind==='countries') entry.cfa = cfa;
  riskData.overrides[kind][name] = entry;
  rdAfterChange();
  auditAppend('riskdata.override', kind+'/'+name+' → '+score+(cfa?' (CFA)':''));
  return true;
}
function rdClearOverride(kind, name){
  if(rdOv(kind, name)){
    delete riskData.overrides[kind][name];
    rdAfterChange();
  }
}
function rdResetAll(){
  riskData = freshRiskData();
  rdAfterChange();
}
function rdResetConfirm(){
  if(!can('riskdata')){ denyToast('reset risk data'); return; }
  if(!confirm('Remove all risk-data overrides and restore the baseline scores?')) return;
  rdResetAll();
  toast('Risk data reset to baseline');
}
async function rdExportSheet(){
  const out = {
    app: 'Hawkeye Sterling — Risk Data Sheet',
    version: APP_VERSION,
    baseline: RISK_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    updatedAt: riskData.updatedAt,
    overrides: riskData.overrides
  };
  out.integrity = await exportIntegrity(out.overrides);   /* SHA-256 over JSON.stringify(export.overrides) */
  const blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'hs-risk-data-sheet-' + todayISO().replace(/-/g,'') + '.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href), 1000);
  toast('Risk data sheet exported');
}
function rdImportSheet(){ $('rdImportFile').click(); }
$('rdImportFile').addEventListener('change', function(e){
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = function(){
    if(r.result && r.result.length > 10 * 1024 * 1024){ alert('File too large. Maximum allowed size is 10 MB.'); e.target.value = ''; return; }
    let data;
    try{ data = JSON.parse(r.result); }
    catch(err){ alert('The file contains invalid JSON. Expected a risk data sheet exported from this application.'); e.target.value = ''; return; }
    const looks = data && typeof data==='object' && (data.overrides || Object.keys(RD_KINDS).some(k => data[k]));
    if(!looks){ alert('Invalid risk data sheet. Expected a sheet exported from this application.'); e.target.value = ''; return; }
    if(typeof data.updatedAt !== 'undefined' && !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(String(data.updatedAt))){
      alert('The file has an invalid date format. Expected a sheet exported from this application.'); e.target.value = ''; return;
    }
    riskData = mergeRiskData(data);
    rdAfterChange();
    toast('Risk data sheet imported — ' + rdCount() + ' override' + (rdCount()===1?'':'s'));
    e.target.value = '';
  };
  r.readAsText(f);
});

/* ── Risk Data panel UI ── */
let rdTab = 'countries', rdShowOvOnly = false, rdSearchTimer = null;
function openRiskData(){ const o = $('rdOverlay'); if(o) o.classList.add('open'); rdRender(); _focusDialog('rdOverlay'); }
function closeRiskData(){ const o = $('rdOverlay'); if(o) o.classList.remove('open'); _restoreDialogFocus(); }
function rdSetTab(kind){ rdTab = kind; rdRender(); }
function rdToggleOvOnly(){ rdShowOvOnly = !rdShowOvOnly; rdRender(); }
/** Debounce keystrokes so the 380-row DOM rebuild doesn't fire on every character. */
function rdSearchInput(){ clearTimeout(rdSearchTimer); rdSearchTimer = setTimeout(rdRender, 200); }
function rdRender(){
  const rows = $('rdRows');
  if(!rows) return;
  Object.keys(RD_KINDS).forEach(k => {
    const t = $('rdTab_'+k);
    if(t){
      t.className = 'rd-tab' + (k===rdTab ? ' active' : '');
      t.textContent = RD_KINDS[k].label + ' · ' + RD_KINDS[k].list.filter(o => o.name!=='N/A').length;
    }
  });
  const oo = $('rdOvOnly');
  if(oo) oo.className = 'rd-tab' + (rdShowOvOnly ? ' active' : '');
  const q = (($('rdSearch') && $('rdSearch').value) || '').toLowerCase();
  const def = RD_KINDS[rdTab];
  let list = def.list.filter(o => o.name!=='N/A');
  if(rdTab==='countries') list = [...list].sort((a,b)=>a.name.localeCompare(b.name));
  const html = list.map(b => {
    const o = rdOv(rdTab, b.name);
    if(rdShowOvOnly && !o) return '';
    if(q && b.name.toLowerCase().indexOf(q)===-1) return '';
    const eff = o ? o.score : b.score;
    const effCfa = o ? !!o.cfa : !!b.cfa;
    const opts = [];
    for(let sc=def.min; sc<=3; sc++) opts.push('<option value="'+sc+'"'+(sc===eff?' selected':'')+'>'+sc+'</option>');
    return '<div class="rd-row'+(o?' rd-ov':'')+'" data-kind="'+rdTab+'" data-name="'+esc(b.name)+'">'
      + '<span class="rd-name">'+(o?'<span class="ov-mark">✱</span> ':'')+esc(b.name)+'</span>'
      + '<span class="rd-base" title="Baseline">base '+b.score+(rdTab==='countries'&&b.cfa?' · CFA':'')+'</span>'
      + '<select class="rd-score">'+opts.join('')+'</select>'
      + (rdTab==='countries' ? '<label class="rd-cfa"><input type="checkbox" class="rd-cfa-box"'+(effCfa?' checked':'')+'>CFA</label>' : '')
      + '<input class="rd-reason" placeholder="Reason (required)" value="'+esc(o?o.reason:'')+'">'
      + '<span class="rd-at">'+(o?esc(fmtDate(o.at)||o.at):'')+'</span>'
      + '<button class="rd-clear'+(o?'':' invisible')+'" title="Clear override — restore baseline" aria-label="Clear override for '+esc(b.name)+'">✕</button>'
      + '</div>';
  }).join('');
  rows.innerHTML = html || '<div class="rd-empty">No matches'+(rdShowOvOnly?' — no overrides on this tab':'')+'.</div>';
  const c = $('rdCountLbl');
  if(c) c.textContent = rdCount() + ' override' + (rdCount()===1?'':'s');
  const m = $('rdMeta');
  if(m) m.textContent = riskData.updatedAt ? 'Sheet updated ' + (fmtDate(riskData.updatedAt) || riskData.updatedAt) : '';
}
function refreshSelectLabels(){
  const jSel = $('jurisdictionSelect');
  if(jSel && jSel.options){
    for(const opt of jSel.options){
      const e = effCountry(opt.value);
      if(e) opt.textContent = opt.value + (e.overridden ? ' ✱' : '');
    }
  }
  const aSel = $('activitySelect');
  if(aSel && aSel.options){
    for(const opt of aSel.options){
      const e = effOf('activities', opt.value);
      if(e) opt.textContent = opt.value + ' — ' + ratingLabel(e.score) + (e.overridden ? ' ✱' : '');
    }
  }
}
function initRiskDataPanel(){
  const rows = $('rdRows');
  if(!rows) return;
  const apply = function(target){
    const row = target && target.closest ? target.closest('.rd-row') : null;
    if(!row) return;
    const kind = row.getAttribute('data-kind'), name = row.getAttribute('data-name');
    const b = rdBase(kind, name);
    if(!b) return;
    const score = parseInt(row.querySelector('.rd-score').value);
    const cfaBox = row.querySelector('.rd-cfa-box');
    const cfa = cfaBox ? cfaBox.checked : undefined;
    const reason = row.querySelector('.rd-reason').value.trim();
    const isBaseline = score===b.score && (kind!=='countries' || cfa===!!b.cfa);
    if(isBaseline){
      if(rdOv(kind, name)) rdClearOverride(kind, name); else rdRender();
      return;
    }
    if(!reason){
      row.classList.add('rd-pending');
      row.querySelector('.rd-reason').focus();
      return;
    }
    row.classList.remove('rd-pending');
    rdSetOverride(kind, name, {score, cfa, reason});
  };
  rows.addEventListener('change', function(e){ apply(e.target); });
  rows.addEventListener('click', function(e){
    const t = e.target;
    if(t && t.className==='rd-clear'){
      const row = t.closest ? t.closest('.rd-row') : null;
      if(row) rdClearOverride(row.getAttribute('data-kind'), row.getAttribute('data-name'));
    }
  });
  const ov = $('rdOverlay');
  if(ov) ov.addEventListener('click', function(e){ if(e.target===ov) closeRiskData(); });
  if(document.addEventListener) document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ closeRiskData(); closeRegister(); closeAudit(); closeBatch(); } });
}

/* ══════════════════════════════════════════
   BUILD UI
══════════════════════════════════════════ */
function buildCountrySelect() {
  const sel = $('jurisdictionSelect');
  const sorted = [...COUNTRIES].sort((a,b)=>a.name.localeCompare(b.name));
  sorted.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function buildActivitySelect() {
  const sel = $('activitySelect');
  ACTIVITIES.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.name;
    opt.textContent = a.name + ' — ' + ratingLabel(a.score);
    sel.appendChild(opt);
  });
}

function buildQuestions() {
  const container = $('questions-oc');
  QUESTIONS_OC.forEach((q, idx) => {
    const div = document.createElement('div');
    div.className = 'q-row';
    const crit = q.prohibit
      ? '<span class="crit-tag" data-i18n="tag.prohibitive" title="If Yes, the outcome is PROHIBITED — the relationship must not be onboarded; freeze funds where held and report to the FIU.">Prohibitive</span>'
      : q.eddTrigger
        ? '<span class="edd-tag" data-i18n="tag.edd" title="If Yes, Enhanced Due Diligence is mandatory regardless of the numeric score.">EDD trigger</span>'
        : '';
    div.innerHTML = `
      <span class="q-num">${String(idx+1).padStart(2,'0')}</span>
      <span class="q-text" id="qtext_${q.id}"><span data-i18n="q.${q.id}">${q.text}</span>${crit}</span>
      <div class="q-controls">
        <div class="toggle-group" role="group" aria-labelledby="qtext_${q.id}">
          <button class="toggle-btn" id="btn_${q.id}_yes" data-act="toggle" data-a1="${q.id}" data-a2="Yes" data-i18n="btn.yes">Yes</button>
          <button class="toggle-btn" id="btn_${q.id}_no" data-act="toggle" data-a1="${q.id}" data-a2="No" data-i18n="btn.no">No</button>
        </div>
        <span class="q-score-pill" id="pill_${q.id}"></span>
      </div>`;
    container.appendChild(div);
  });
}

function buildSuppliers() {
  buildSupplierGroup('recycled-grid', RECYCLED, 'recycled');
  buildSupplierGroup('mined-grid', MINED, 'mined');
}

function buildSupplierGroup(containerId, options, prefix) {
  const container = $(containerId);
  for(let i=0;i<3;i++){
    const item = document.createElement('div');
    item.className = 'supplier-item';
    const opts = options.map(o=>`<option value="${esc(o.name)}">${esc(o.name)}</option>`).join('');
    item.innerHTML = `
      <label for="sel_${prefix}_${i}">Supplier ${i+1}</label>
      <select id="sel_${prefix}_${i}" data-act="supplier" data-evt="change" data-a1="${prefix}" data-a2="${i}">${opts}</select>
      <span id="sup_score_${prefix}_${i}" class="sup-score"></span>`;
    container.appendChild(item);
  }
}

/* ══════════════════════════════════════════
   PAINT (state → UI)
══════════════════════════════════════════ */
function paintToggle(id, val, type) {
  const inv = type==='vlok2';
  const score = scoreFromYesNo(val, type);
  const y = $('btn_'+id+'_yes'), n = $('btn_'+id+'_no');
  y.className = 'toggle-btn' + (val==='Yes' ? (inv?' active-yes-inv':' active-yes') : '');
  n.className = 'toggle-btn' + (val==='No'  ? (inv?' active-no-inv':' active-no')   : '');
  y.setAttribute('aria-pressed', val==='Yes' ? 'true' : 'false');
  n.setAttribute('aria-pressed', val==='No' ? 'true' : 'false');
  const pill = $('pill_'+id);
  if(pill){ pill.className = 'q-score-pill '+ratingClass(score); pill.textContent = score; }
  const tag = $(id+'_score_tag');
  if(tag){ tag.className = 'score-tag '+scoreTagClass(score); tag.textContent = 'Score: '+score+' · '+ratingLabel(score); }
}
function ovTitle(e){ return e && e.overridden ? 'Overridden from '+e.baseScore+' on '+(fmtDate(e.at)||e.at)+' — '+e.reason : ''; }
function paintJurisdiction() {
  const c = effCountry(state.entity.jurisdiction);
  const score = c ? c.score : 1;
  const tag = $('jurisdictionScore');
  tag.className = 'score-tag '+scoreTagClass(score);
  tag.textContent = 'Score: '+score+' · '+ratingLabel(score)+(c && c.overridden ? ' ✱' : '');
  tag.title = ovTitle(c);
}
function paintActivity() {
  const a = effOf('activities', state.profile.activity);
  const score = a ? a.score : 1;
  const tag = $('activityScore');
  tag.className = 'score-tag '+scoreTagClass(score);
  tag.textContent = 'Score: '+score+' · '+ratingLabel(score)+(a && a.overridden ? ' ✱' : '');
  tag.title = ovTitle(a);
}
function paintYears(which) {
  const y = which==='entity' ? state.profile.entityYears : state.profile.relYears;
  const score = yearsToScore(y);
  const tag = $(which==='entity'?'entityYearsScore':'relYearsScore');
  tag.className = 'score-tag '+scoreTagClass(score);
  tag.textContent = 'Score: '+score+' · '+ratingLabel(score);
}
function paintSupplier(prefix, i) {
  const item = effOf(prefix, state.suppliers[prefix][i]);
  const score = item ? item.score : 0;
  const el = $('sup_score_'+prefix+'_'+i);
  el.className = 'sup-score '+ratingClass(score);
  el.textContent = ratingLabel(score)+' ('+score+')'+(item && item.overridden ? ' ✱' : '');
  el.title = ovTitle(item);
}
function paintStatus() {
  const btn = $('btnComplete');
  if(btn){
    const ar = (typeof getLang==='function' && getLang()==='ar');
    btn.textContent = ar
      ? (state.complete ? '✓ وضع كمسودة' : '✓ إكمال التقييم')
      : (state.complete ? '✓ Mark as Draft' : '✓ Complete Assessment');
  }
  paintRetryButton();
}

/* ── UBO / ownership graph ── */
/* Parse the comma/semicolon-separated principals string into a deduped name
   list (case-insensitive dedupe, original spelling kept). Pure + unit-tested. */
function parsePrincipals(str){
  const seen = new Set(), out = [];
  for(const raw of String(str==null?'':str).split(/[,;]/)){
    const t = raw.trim().replace(/\s+/g, ' ');
    if(!t) continue;
    const k = t.toLowerCase();
    if(seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out;
}
function uboTrunc(s, n){ s = String(s==null?'':s); return s.length>n ? s.slice(0,n-1).trim()+'…' : s; }
function uboInitials(name){
  const parts = String(name==null?'':name).trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  return (parts[0][0] + (parts.length>1 ? parts[parts.length-1][0] : '')).toUpperCase();
}
/* Render an entity-centred radial ownership graph (entity → each principal).
   The data model is a flat principals list, so this is a one-level star. */
function renderUboGraph(){
  const box = $('uboGraph');
  if(!box) return;
  const name = String((state.entity && state.entity.name) || '').trim();
  const ppl = parsePrincipals(state.entity && state.entity.principals);
  if(!name && !ppl.length){
    box.innerHTML = '<div class="ubo-empty">Add a legal name and principals to see the ownership graph.</div>';
    return;
  }
  const W = 320, H = 244, cx = W/2, cy = 122, R = 84, n = ppl.length;
  let edges = '', nodes = '';
  ppl.forEach((p, i) => {
    const ang = (-Math.PI/2) + (i * 2*Math.PI / Math.max(n,1));
    const x = cx + R*Math.cos(ang), y = cy + R*Math.sin(ang);
    edges += '<line class="ubo-edge" x1="'+cx+'" y1="'+cy+'" x2="'+x.toFixed(1)+'" y2="'+y.toFixed(1)+'"/>';
    const anchor = x < cx-8 ? 'end' : (x > cx+8 ? 'start' : 'middle');
    const lx = x + (anchor==='end' ? -20 : anchor==='start' ? 20 : 0);
    const ly = anchor==='middle' ? (y >= cy ? y+30 : y-22) : y+3;
    nodes += '<g>'
      + '<circle class="ubo-ring" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="16"/>'
      + '<text class="ubo-init" x="'+x.toFixed(1)+'" y="'+(y+3.5).toFixed(1)+'">'+esc(uboInitials(p))+'</text>'
      + '<text class="ubo-label" text-anchor="'+anchor+'" x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'">'+esc(uboTrunc(p,16))+'</text>'
      + '</g>';
  });
  const summary = 'Ownership graph: ' + (name||'subject entity') + ' with ' + n + ' principal' + (n===1?'':'s');
  box.innerHTML =
    '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(summary)+'">'
    + edges
    + '<circle class="ubo-ring-entity" cx="'+cx+'" cy="'+cy+'" r="30"/>'
    + '<text class="ubo-init-entity" x="'+cx+'" y="'+(cy+4)+'">'+esc(uboInitials(name)||'•')+'</text>'
    + '<text class="ubo-name-entity" x="'+cx+'" y="'+(cy+50)+'">'+esc(uboTrunc(name||'Subject entity',24))+'</text>'
    + nodes
    + (n===0 ? '<text class="ubo-empty-svg" x="'+cx+'" y="'+(cy-44)+'">No principals recorded yet</text>' : '')
    + '</svg>';
}

function syncUI() {
  const s = state;
  $('refInput').value = s.meta.ref;
  $('assessDate').value = fmtDate(s.meta.date);
  $('assessorName').value = s.meta.assessor;
  $('assessorRole').value = s.meta.role;
  $('entityName').value = s.entity.name;
  $('entityTrading').value = s.entity.trading;
  $('entityRegno').value = s.entity.regno;
  $('entityAddress').value = s.entity.address;
  $('entityContact').value = s.entity.contact;
  $('entityPrincipals').value = s.entity.principals;
  renderUboGraph();
  $('jurisdictionSelect').value = s.entity.jurisdiction; paintJurisdiction();
  $('activitySelect').value = s.profile.activity; paintActivity();
  paintToggle('onboard', s.profile.onboard, 'onboard');
  $('entityYearsInput').value = s.profile.entityYears; paintYears('entity');
  $('relYearsInput').value = s.profile.relYears; paintYears('rel');
  QUESTIONS_OC.forEach(q => paintToggle(q.id, s.questions[q.id], q.type));
  ['recycled','mined'].forEach(p => s.suppliers[p].forEach((v,i) => {
    $('sel_'+p+'_'+i).value = v; paintSupplier(p,i);
  }));
  $('notesInput').value = s.notes;
  SCREENING_GROUPS.forEach(([g]) => ['system','date','ref'].forEach(f => {
    $('scr_'+g+'_'+f).value = f==='date' ? fmtDate(s.screening[g][f]) : s.screening[g][f];
  }));
  $('completedBy').value = s.signoff.completedBy;
  $('completedTitle').value = s.signoff.completedTitle;
  $('completedDate').value = fmtDate(s.signoff.completedDate);
  $('approvedBy').value = s.signoff.approvedBy;
  $('approvedTitle').value = s.signoff.approvedTitle;
  $('approvedDate').value = fmtDate(s.signoff.approvedDate);
  $('nextReview').value = fmtDate(s.signoff.nextReview);
  $('ovBand').value = s.override.band;
  $('ovReason').value = s.override.reason;
  paintStatus();
  recalc();
}

/* ══════════════════════════════════════════
   EVENT HANDLERS (UI → state)
══════════════════════════════════════════ */
function qType(id){
  if(id==='onboard') return 'onboard';
  const q = QUESTIONS_OC.find(q=>q.id===id);
  return q ? q.type : 'vlok';
}
function onField(section, key, val) {
  if(section==='meta' && key==='ref'){
    /* Renaming the reference MOVES its register entry instead of duplicating it. */
    const prev = String(state.meta.ref||'').trim(), next = String(val||'').trim();
    if(prev && prev!==next) regDelete(prev);
  }
  state[section][key] = val;
  if(section==='entity' && (key==='principals' || key==='name')) renderUboGraph();
  if(section==='meta' && key==='date'){ recalc(); return; }
  scheduleSave();
}
function onNotes(val){ state.notes = val; scheduleSave(); }
function onScreening(group, key, val){ state.screening[group][key] = val; scheduleSave(); }

/* ── Narrative template: general, band-matching risk rationale citing the
   Company's policies by full name (Risk Assessment, Know Your Customer,
   Risk Appetite Statement, Targeted Financial Sanctions, Source of Funds
   and Wealth, Responsible Sourcing). One text serves every assessed
   entity; entity, date, score and jurisdiction band fill automatically,
   [bracketed] fields need officer review. No em-dashes. ── */
/** Generate a band-appropriate narrative template for the notes field. Policy names come
 *  from the POLICIES constant so they stay consistent if policies are renamed. */
function buildNarrative(){
  const a = computeAssessment();
  const s = state;
  const name = String(s.entity.name||'').trim() || '[Entity Legal Name]';
  const when = fmtDate(s.meta.date) || '[DD/MM/YYYY]';
  const jC = effCountry(s.entity.jurisdiction);
  const jScore = jC ? jC.score : 1;
  const jurWord = ['', 'a low risk jurisdiction under our country risk assessment',
    'a medium risk jurisdiction under our country risk assessment',
    'a high risk jurisdiction under our country risk assessment'][jScore];
  const score = a.total + ' / 30+';
  let t;
  if(a.prohibited){
    t = 'We assessed ' + name + ' on ' + when + ' using the Company\'s Risk Assessment methodology. The total score is ' + score + '. Designated party exposure was identified: '
      + a.escalations.filter(e=>e.level==='prohibit').map(e=>e.reason).join('; ')
      + '. The relationship is prohibited under our ' + POLICIES.TFS + ' and our ' + POLICIES.RAS + '. We will not onboard or continue with this customer. Funds are frozen where held, and the Compliance Officer will decide whether a report must be filed with the Financial Intelligence Unit under Federal Decree-Law No. (10) of 2025 and the Cabinet Decision on Targeted Financial Sanctions. No review date is set because the relationship is declined. This note is kept as the record of our decision.';
  } else if(a.outcome==='CDD'){
    t = 'We assessed ' + name + ' on ' + when + ' using the Company\'s Risk Assessment methodology. The total score is ' + score + ', which places the customer in the low risk band. The customer operates from ' + jurWord + ', and its licensed activity is within the sectors accepted by our ' + POLICIES.RAS + '. Screening for sanctions, PEP and adverse media was completed and cleared before onboarding under our ' + POLICIES.TFS + '. We found no concerns under our ' + POLICIES.SOFW + ', and the declared material sources fall within our ' + POLICIES.RS + '. Standard due diligence applies. We will review the file at least every twelve months, re-screen the customer annually, and bring the review forward if anything changes, in line with our ' + POLICIES.KYC + '. Transaction monitoring follows the low risk cycle. The relationship is within our risk appetite and is approved. This note is kept as the record of our decision.';
  } else if(a.outcome==='SDD'){
    /* SDD can be reached numerically (20-22) or by an analyst override from CDD
       (score 19 or below) — the band sentence must state the band the numbers
       actually support, and the override path must appear in the record. */
    t = 'We assessed ' + name + ' on ' + when + ' using the Company\'s Risk Assessment methodology. The total score is ' + score + ', which places the customer in the ' + (a.numericBand==='CDD' ? 'low' : 'medium') + ' risk band.'
      + (a.analystOv ? ' The outcome was raised from ' + a.analystOv.from + ' by an analyst override: ' + a.analystOv.reason + '.' : '')
      + ' Some factors raise the profile, such as the jurisdiction, the business activity, the material sources or the length of trading history. Screening was completed and cleared under our ' + POLICIES.TFS + ', the source of funds is verifiable under our ' + POLICIES.SOFW + ', and the activity remains within the sectors accepted by our ' + POLICIES.RAS + '.'
      + (a.total===22 ? ' The score is one point below the high risk threshold, so a change in a single factor will raise the required diligence.' : '')
      + ' Simplified due diligence applies, with closer monitoring where needed. We will review the file every six months, or sooner if a trigger event occurs, in line with our ' + POLICIES.KYC + '. Transaction monitoring follows the medium risk cycle. We continue the relationship on a conditional basis under our ' + POLICIES.RCP + '. This note is kept as the record of our decision.';
  } else {
    t = 'We assessed ' + name + ' on ' + when + ' using the Company\'s Risk Assessment methodology. The total score is ' + score + ', which places the customer in the high risk band.'
      + (a.escalations.length ? ' This includes a mandatory escalation: ' + a.escalations.map(e=>e.reason).join('; ') + '.' : '')
      + (a.analystOv ? ' The outcome was raised from ' + a.analystOv.from + ' by an analyst override: ' + a.analystOv.reason + '.' : '')
      /* The FATF sentence must match the jurisdiction's actual status: for a
         call-for-action jurisdiction the "not blacklisted" claim would
         contradict the escalation recorded above. */
      + ' The main concerns come from factors such as the jurisdiction, the material sources, the delivery channel or the ownership structure. The customer is '
      + ((jC && jC.cfa) ? 'based in a FATF call-for-action (blacklisted) jurisdiction, which drives the escalation above' : 'not based in a FATF blacklisted country')
      + ', screening returned no matches on the UN, EU, OFAC or UAE lists under our ' + POLICIES.TFS + ', and the source of funds can be verified, so we may continue under enhanced controls within our ' + POLICIES.RAS + '. Enhanced due diligence applies and senior management approval is recorded. We verify the owners and controllers under our ' + POLICIES.UBO + ', obtain documents that support the source of funds and wealth, and carry out enhanced checks under our ' + POLICIES.RS + '. We will review the file at least every three months, or immediately if a trigger event occurs, in line with our ' + POLICIES.KYC + '. Transaction monitoring follows the high risk cycle. Approved by [MLRO name] on [DD/MM/YYYY]. This note is kept as the record of our decision.';
  }
  return t.replace(/—/g, '-'); /* narrative stays em-dash free per client style */
}
function insertNarrative(){
  const t = buildNarrative();
  if(String(state.notes||'').trim() && !confirm('Replace the current notes with the generated narrative template?')) return;
  state.notes = t;
  $('notesInput').value = t;
  scheduleSave();
  toast('Narrative inserted');
}

/* ── Asana delivery: marking an assessment Complete creates a task in the
   RISK ASSESSMENTS project via a Netlify function (token stays server side).
   One task per reference: the created task's gid is remembered on this
   device, so completing again UPDATES that task instead of duplicating it. ── */
const ASANA_DELIVERED_KEY = 'hsra.asana.delivered.v1';
function deliveredGid(ref){
  if(!ref) return '';
  try{
    const m = JSON.parse(SS.getItem(ASANA_DELIVERED_KEY)) || {};
    return typeof m[ref]==='string' ? m[ref] : '';
  }catch(e){ return ''; }
}
function rememberDelivered(ref, gid){
  if(!ref || !gid) return;
  try{
    const m = JSON.parse(SS.getItem(ASANA_DELIVERED_KEY)) || {};
    m[ref] = String(gid);
    SS.setItem(ASANA_DELIVERED_KEY, JSON.stringify(m));
  }catch(e){}
}
/* ── Tokenised delivery: keep customer PII (entity name, jurisdiction, activity,
   assessor/MLRO names, the narrative) IN THE BROWSER and send Asana only the
   non-identifying triage fields (ref, risk tier, score, dates). Off by default;
   the choice is persisted per device. ── */
const ASANA_TOKENISED_KEY = 'hsra.asana.tokenised.v1';
function asanaTokenised(){
  try{ return SS.getItem(ASANA_TOKENISED_KEY) === '1'; }catch(e){ return false; }
}
function setAsanaTokenised(on){
  try{ SS.setItem(ASANA_TOKENISED_KEY, on ? '1' : '0'); }catch(e){}
  paintTokeniseBtn();
}
function toggleAsanaTokenised(){
  setAsanaTokenised(!asanaTokenised());
  toast(asanaTokenised() ? 'Asana delivery: PII kept on device (tokenised)' : 'Asana delivery: full detail');
}
function paintTokeniseBtn(){
  const btn = $('btnTokeniseAsana');
  if(!btn) return;
  const on = asanaTokenised();
  const ar = (typeof getLang==='function' && getLang()==='ar');
  btn.textContent = ar
    ? (on ? '🔓 إرسال التفاصيل الكاملة إلى Asana' : '🔒 إرسال مرمّز إلى Asana (بدون بيانات شخصية)')
    : (on ? '🔓 Asana: send full detail' : '🔒 Asana: tokenise (no PII)');
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}
function asanaPayload(){
  const a = computeAssessment();
  const s = state;
  const name = String(s.entity.name||'').trim() || '[Unnamed entity]';
  const refPart = String(s.meta.ref||'').trim() || '(no ref)';
  const tok = asanaTokenised();
  const notes = tok
    /* Tokenised: no customer/staff identifiers leave the device — only triage data. */
    ? 'Tokenised delivery — customer identity withheld and kept on the assessing device.'
      + '\n\nRef: ' + (s.meta.ref || '-')
      + '\nAssessment date: ' + (fmtDate(s.meta.date) || '-')
      + '\nResult: ' + a.total + ' / 30+ (' + a.outcome + ')'
      + '\nNext review: ' + (fmtDate(s.signoff.nextReview) || '-')
    : (String(s.notes||'').trim() || buildNarrative())
      + '\n\nRef: ' + (s.meta.ref || '-')
      + '\nAssessment date: ' + (fmtDate(s.meta.date) || '-')
      + '\nEntity: ' + name
      + '\nJurisdiction: ' + s.entity.jurisdiction
      + '\nActivity: ' + s.profile.activity
      + '\nResult: ' + a.total + ' / 30+ (' + a.outcome + ')'
      + '\nNext review: ' + (fmtDate(s.signoff.nextReview) || '-')
      + '\nAssessed by: ' + (String(s.signoff.completedBy||'').trim() || '-')
      + (String(s.signoff.completedTitle||'').trim() ? ' (' + s.signoff.completedTitle.trim() + ')' : '')
      + (s.signoff.completedDate ? ', ' + (fmtDate(s.signoff.completedDate) || s.signoff.completedDate) : '')
      + '\nApproved by (MLRO): ' + (String(s.signoff.approvedBy||'').trim() || '-')
      + (String(s.signoff.approvedTitle||'').trim() ? ' (' + s.signoff.approvedTitle.trim() + ')' : '')
      + (s.signoff.approvedDate ? ', ' + (fmtDate(s.signoff.approvedDate) || s.signoff.approvedDate) : '');
  return {
    /* Tokenised drops the entity name from the display title too. */
    name: tok ? (refPart + ' · ' + a.outcome + ' ' + a.total)
              : (refPart + ' · ' + name + ' · ' + a.outcome + ' ' + a.total),
    /* The stable reference, sent separately from the display name so the function
       can dedup on it (the name embeds the mutable outcome+score, so it can't).
       This keeps one task per reference even when re-scored on another device. */
    ref: String(s.meta.ref||'').trim(),
    /* The serverless function files the task into the matching risk-band
       section: LOW (CDD) / MEDIUM (SDD) / HIGH (EDD) / PROHIBITED. */
    band: a.outcome,
    /* Numeric score — surfaced to the optional Asana "Score" custom field so the
       project is sortable/reportable without parsing the task name. */
    score: a.total,
    gid: deliveredGid(String(s.meta.ref||'').trim()),
    /* Task due date mirrors the Next Review Date field: suggested by risk
       level (12/6/3 months), auto-updated when risk data changes the band,
       and always overridable by manual entry (e.g. on a change in law).
       Prohibited relationships are declined, so they carry no due date. */
    due_on: (!a.prohibited && /^\d{4}-\d{2}-\d{2}$/.test(String(s.signoff.nextReview||''))) ? s.signoff.nextReview : '',
    notes
  };
}
const ASANA_FAILED_KEY = 'hsra.asana.failed.v1';
/** Store a failed delivery payload for manual retry; shows the retry button. */
function storeFailedDelivery(ref, payload){
  if(!ref) return;
  try{ const m = JSON.parse(SS.getItem(ASANA_FAILED_KEY)) || {}; m[ref] = payload; SS.setItem(ASANA_FAILED_KEY, JSON.stringify(m)); }catch(e){}
  paintRetryButton();
}
function clearFailedDelivery(ref){
  if(!ref) return;
  try{ const m = JSON.parse(SS.getItem(ASANA_FAILED_KEY)) || {}; delete m[ref]; SS.setItem(ASANA_FAILED_KEY, JSON.stringify(m)); }catch(e){}
  paintRetryButton();
}
function getFailedPayload(ref){
  if(!ref) return null;
  try{ const m = JSON.parse(SS.getItem(ASANA_FAILED_KEY)) || {}; return m[ref] || null; }catch(e){ return null; }
}
/** All references that currently have a stored failed delivery, across every assessment. */
function pendingFailedRefs(){
  try{ return Object.keys(JSON.parse(SS.getItem(ASANA_FAILED_KEY)) || {}); }catch(e){ return []; }
}
/** Asana delivery state for a register row: failed → delivered → (completed but not
    yet delivered) → none (draft). Drives the small status chip in the register. */
function asanaStatus(ref, complete){
  if(!ref) return null;
  if(getFailedPayload(ref)) return {cls:'reg-st-fail', txt:'ASANA ✗', title:'Asana delivery failed — open and use ↻ Retry'};
  if(deliveredGid(ref))     return {cls:'reg-st-done', txt:'ASANA ✓', title:'Delivered to Asana'};
  if(complete)              return {cls:'reg-st-draft', txt:'ASANA …', title:'Marked complete but not yet delivered to Asana'};
  return null;
}
/** Show the retry button whenever ANY delivery is pending (not only the current ref),
    so a failure on a different assessment stays visible and recoverable. The count is
    surfaced in the button title. */
function paintRetryButton(){
  const btn = $('btnRetryAsana');
  if(!btn) return;
  const pending = pendingFailedRefs();
  btn.classList.toggle('hidden', pending.length === 0);
  if(pending.length){
    const ref = String(state.meta.ref||'').trim();
    const others = pending.filter(r => r !== ref).length;
    btn.setAttribute('title', pending.length === 1
      ? 'Retry the pending Asana delivery'
      : 'Retry ' + pending.length + ' pending Asana deliveries' + (others && ref && getFailedPayload(ref) ? ' (including this one)' : ''));
  }
}
function sendToAsana(){
  /* Only meaningful on the deployed site (needs the Netlify function + token). */
  if(typeof fetch !== 'function' || typeof location === 'undefined' || location.protocol.indexOf('http') !== 0){
    toast('↗ Send to Asana works on the deployed site only.');
    return;
  }
  toast('↗ Sending to Asana…');
  const p = asanaPayload();
  const ref = String(state.meta.ref||'').trim();
  doSendToAsana(p, ref, false);
}
/** Retry EVERY pending failed delivery (current ref first), so failures on other
    assessments are not stranded. Falls back to the current ref if the map is empty. */
function retryAsanaDelivery(){
  const cur = String(state.meta.ref||'').trim();
  const refs = pendingFailedRefs();
  const order = refs.includes(cur) ? [cur, ...refs.filter(r => r !== cur)] : refs;
  const targets = order.length ? order : (cur ? [cur] : []);
  targets.forEach(ref => { const p = getFailedPayload(ref); if(p) doSendToAsana(p, ref, true); });
}
function doSendToAsana(p, ref, isRetry){
  if(typeof fetch !== 'function' || typeof location === 'undefined' || location.protocol.indexOf('http') !== 0) return;
  fetch('/.netlify/functions/asana-task', {
    method: 'POST',
    headers: fnHeaders(),
    body: JSON.stringify(p)
  }).then(r => r.json()).then(d => {
    if(d && d.ok && d.gid){
      rememberDelivered(ref, d.gid); clearFailedDelivery(ref);
      /* Durable, tamper-evident record that the assessment reached Asana. */
      auditAppend('asana.delivery.ok', (d.updated ? 'Updated' : 'Created') + ' Asana task for ' + (p.name||ref) + (d.section ? ' [' + d.section + ']' : ''));
    } else {
      storeFailedDelivery(ref, p);
      /* Log the failure so it is diagnosable later without re-running an audit. */
      auditAppend('asana.delivery.failed', 'Asana delivery failed for ' + (p.name||ref) + (d && d.error ? ': ' + d.error : ''));
    }
    toast(d && d.ok ? (d.updated ? 'Updated in Asana: ' : 'Delivered to Asana: ') + p.name
                    : 'Asana delivery failed' + (d && d.error ? ' (' + d.error + ')' : ''));
  }).catch(() => {
    storeFailedDelivery(ref, p);
    auditAppend('asana.delivery.failed', 'Asana delivery unavailable for ' + (p.name||ref) + (isRetry ? ' (retry)' : ''));
    toast(isRetry ? 'Retry failed — Asana still unavailable' : 'Asana delivery unavailable');
  });
}
function onSign(key, val) {
  state.signoff[key] = val;
  if(key==='nextReview'){ state.signoff.reviewManual = true; recalc(); return; }
  scheduleSave();
}
function useSuggestedReview(){ state.signoff.reviewManual = false; recalc(); }
function onJurisdiction() {
  state.entity.jurisdiction = $('jurisdictionSelect').value;
  paintJurisdiction();
  recalc();
}
function onActivity() {
  state.profile.activity = $('activitySelect').value;
  paintActivity();
  recalc();
}
function setToggle(id, val) {
  if(id==='onboard') state.profile.onboard = val;
  else state.questions[id] = val;
  paintToggle(id, val, qType(id));
  recalc();
}
function onYears(which) {
  const inp = $(which==='entity'?'entityYearsInput':'relYearsInput');
  let y = parseInt(inp.value);
  if(isNaN(y) || y<0) y = 0;
  if(y>99) y = 99;
  if(which==='entity') state.profile.entityYears = y; else state.profile.relYears = y;
  paintYears(which);
  recalc();
}
function onSupplier(prefix, i) {
  state.suppliers[prefix][i] = $('sel_'+prefix+'_'+i).value;
  paintSupplier(prefix, i);
  recalc();
}
function toggleComplete() {
  if(!state.complete){                                 /* finalising — enforce RBAC + POLICY */
    if(!can('approve')){ denyToast('mark an assessment complete (second-line approval)'); return; }
    const missing = policyMissing();
    if(missing.length && typeof confirm === 'function'
       && !confirm('Policy check — these are incomplete before completion:\n• ' + missing.join('\n• ') + '\n\nMark complete anyway?')) return;
  }
  state.complete = !state.complete;
  paintStatus();
  scheduleSave();
  if(state.complete) sendToAsana();
  auditAppend('assessment.complete', state.complete ? 'Marked complete' : 'Reverted to draft');
  toast(state.complete ? 'Assessment marked complete' : 'Assessment back to draft');
}

/* ══════════════════════════════════════════
   ASSESSMENT ENGINE
══════════════════════════════════════════ */
/** Compute the full assessment result from current state. Returns {parts, total, numericBand,
 *  engineOutcome, outcome, escalations, prohibited, analystOv, forced}. Pure — does not mutate state. */
function computeAssessment() {
  const s = state, parts = [];

  const jC = effCountry(s.entity.jurisdiction);
  parts.push({label:'Jurisdiction of incorporation & operation', value:s.entity.jurisdiction, score:jC?jC.score:1, ov:(jC && jC.overridden)?jC:null});

  const aAct = effOf('activities', s.profile.activity);
  parts.push({label:'Nature & complexity of business activities', value:s.profile.activity, score:aAct?aAct.score:1, ov:(aAct && aAct.overridden)?aAct:null});

  QUESTIONS_OC.forEach(q => {
    const val = s.questions[q.id];
    parts.push({label:q.short, value:val, score:scoreFromYesNo(val, q.type)});
  });

  parts.push({label:'Onboarding channel', value:s.profile.onboard==='Yes'?'Remote / non-face-to-face':'In-person', score:scoreFromYesNo(s.profile.onboard,'onboard')});
  parts.push({label:'Operational history — entity', value:s.profile.entityYears+' years', score:yearsToScore(s.profile.entityYears)});
  parts.push({label:'Relationship duration', value:s.profile.relYears+' years', score:yearsToScore(s.profile.relYears)});

  s.suppliers.recycled.forEach((v,i) => {
    const item = effOf('recycled', v);
    parts.push({label:'Recycled source — Supplier '+(i+1), value:v, score:item?item.score:0, ov:(item && item.overridden)?item:null});
  });
  s.suppliers.mined.forEach((v,i) => {
    const item = effOf('mined', v);
    parts.push({label:'Mined source — Supplier '+(i+1), value:v, score:item?item.score:0, ov:(item && item.overridden)?item:null});
  });

  const total = parts.reduce((sum,p)=>sum+p.score, 0);
  const numericBand = total<=19 ? 'CDD' : total<=22 ? 'SDD' : 'EDD';

  /* Hard-outcome escalations, in priority order */
  const escalations = [];
  QUESTIONS_OC.forEach(q => {
    if(q.prohibit && s.questions[q.id]==='Yes') escalations.push({level:'prohibit', reason:q.short});
  });
  QUESTIONS_OC.forEach(q => {
    if(q.eddTrigger && s.questions[q.id]==='Yes') escalations.push({level:'edd', reason:q.short+' (FATF R.12)'});
  });
  if(jC && jC.cfa) escalations.push({level:'edd', reason:'FATF call-for-action jurisdiction ('+s.entity.jurisdiction+')'});
  if((jC?jC.score:1)===3 && s.suppliers.mined.includes(ASM_SOURCE)) escalations.push({level:'edd', reason:'OECD Annex II red flag — artisanal (ASM) gold from a high-risk jurisdiction'});

  const prohibited = escalations.some(e=>e.level==='prohibit');
  const engineOutcome = prohibited ? 'PROHIBITED' : (escalations.length ? 'EDD' : numericBand);

  /* Analyst override — one-way ratchet: may only RAISE the required diligence
     above the computed outcome, never weaken it, and never applies to
     prohibited relationships. Requires a justification to take effect. */
  const RANK = {CDD:0, SDD:1, EDD:2};
  let outcome = engineOutcome, analystOv = null;
  const ao = s.override;
  if(!prohibited && ao && (ao.band==='SDD' || ao.band==='EDD')
     && String(ao.reason||'').trim() && RANK[ao.band] > RANK[engineOutcome]){
    outcome = ao.band;
    analystOv = {from:engineOutcome, band:ao.band, reason:ao.reason, at:ao.at};
  }
  return {parts, total, numericBand, engineOutcome, outcome, escalations, prohibited, analystOv, forced:outcome!==numericBand};
}

function setAnalystOverride(band, reason){
  if(band==='SDD' || band==='EDD'){
    state.override = {band, reason:String(reason==null?'':reason), at:todayISO()};
  } else {
    state.override = {band:'', reason:'', at:''};
  }
  recalc();
}
function onOvField(){ setAnalystOverride($('ovBand').value, $('ovReason').value); }
function toggleOvForm(){
  const f = $('ovForm');
  f.classList.toggle('open');
  $('ovArrow').textContent = f.classList.contains('open') ? '▼' : '▶';
}

/* AI Risk Advisor personas — the sidebar robot whose head, HUD colour, and
   advisory note follow the operative outcome (CDD → Vale, SDD → Cypher,
   EDD / PROHIBITED → Ember). Mirrors the design's advisorFor() mapping. */
/* role/note carry Arabic variants (roleAr/noteAr) used in Arabic mode;
   machine-assisted per #i18nCaveat. The persona names stay as-is. */
const ADVISORS = {
  high: {img:'assets/persona-ember.webp',  pos:'50% 26%', name:'Ember',  role:'Sanctions & high-risk', rgb:'255,87,87',
         note:'High risk. Escalate for enhanced due diligence, full sanctions screening, and senior-management sign-off.',
         roleAr:'العقوبات والمخاطر العالية',
         noteAr:'مخاطر عالية. صعّد المعاملة للعناية الواجبة المعزّزة، والفحص الكامل للعقوبات، واعتماد الإدارة العليا.'},
  med:  {img:'assets/persona-cypher.webp', pos:'42% 30%', name:'Cypher', role:'Active monitoring',      rgb:'247,197,60',
         note:'Elevated risk. Apply enhanced monitoring, refresh KYC records, and document the rationale for the rating.',
         roleAr:'مراقبة نشطة',
         noteAr:'مخاطر مرتفعة. طبّق مراقبة معزّزة، وحدّث سجلات «اعرف عميلك»، ووثّق مسوّغات التصنيف.'},
  low:  {img:'assets/persona-vale.webp',   pos:'50% 22%', name:'Vale',   role:'KYC & onboarding',       rgb:'59,229,208',
         note:'Standard customer due diligence is sufficient. Proceed with routine onboarding and a periodic review cycle.',
         roleAr:'«اعرف عميلك» والإلحاق',
         noteAr:'العناية الواجبة المعيارية كافية. تابع الإلحاق الاعتيادي مع دورة مراجعة دورية.'}
};

/* Gauge-core robot — face + accent for the score gauge, swapped by risk band:
   green robot (low) → gold robot (medium) → red robot (high). */
const GAUGE_ROBOTS = {
  high: {img:'assets/robot-high.webp', pos:'50% 16%', size:'170%', rgb:'255,87,87'},
  med:  {img:'assets/robot-med.webp',  pos:'50% 20%', size:'176%', rgb:'247,197,60'},
  low:  {img:'assets/robot-low.webp',  pos:'52% 32%', size:'172%', rgb:'52,211,120'}
};
function advisorKind(outcome){ return (outcome==='EDD'||outcome==='PROHIBITED') ? 'high' : outcome==='SDD' ? 'med' : 'low'; }
function updateAdvisor(outcome){
  const a = ADVISORS[advisorKind(outcome)];
  const set = (id,fn)=>{ const el=$(id); if(el) fn(el); };
  set('advImg',     el=>{ el.style.backgroundImage="url('"+a.img+"')"; el.style.backgroundPosition=a.pos; });
  set('advImgRing', el=>{ el.style.border='2px solid rgba('+a.rgb+',0.75)'; el.style.boxShadow='0 0 18px rgba('+a.rgb+',0.4),inset 0 0 16px rgba(0,0,0,0.5)'; });
  set('advGlow',    el=>{ el.style.background='radial-gradient(circle,rgba('+a.rgb+',0.4),transparent 70%)'; });
  set('advSweep',   el=>{ el.style.background='conic-gradient(from 0deg,transparent,rgba('+a.rgb+',0.32) 60deg,transparent 130deg)'; });
  set('advCircle1', el=>el.setAttribute('stroke','rgba('+a.rgb+',0.45)'));
  set('advCircle2', el=>el.setAttribute('stroke','rgba('+a.rgb+',0.65)'));
  set('advDot',     el=>{ el.style.background='rgb('+a.rgb+')'; el.style.boxShadow='0 0 9px rgb('+a.rgb+')'; });
  const ar = (typeof getLang==='function' && getLang()==='ar');
  set('advName',    el=>el.textContent=a.name);
  set('advRole',    el=>{ el.textContent=(ar && a.roleAr) ? a.roleAr : a.role; el.style.color='rgb('+a.rgb+')'; });
  set('advNote',    el=>el.textContent=(ar && a.noteAr) ? a.noteAr : a.note);
  /* Gauge-core robot — head image + accent swap to match the band. */
  const g = GAUGE_ROBOTS[advisorKind(outcome)];
  set('grImg',     el=>{ el.style.backgroundImage="url('"+g.img+"')"; el.style.backgroundPosition=g.pos; el.style.backgroundSize=g.size||'cover'; });
  set('grImgRing', el=>{ el.style.border='2px solid rgba('+g.rgb+',0.78)'; el.style.boxShadow='0 0 16px rgba('+g.rgb+',0.45),inset 0 0 14px rgba(0,0,0,0.55)'; });
  set('grGlow',    el=>{ el.style.background='radial-gradient(circle,rgba('+g.rgb+',0.42),transparent 70%)'; });
  set('grDot',     el=>{ el.style.background='rgb('+g.rgb+')'; el.style.boxShadow='0 0 9px rgb('+g.rgb+')'; });
  set('totalScore',el=>{ el.style.color='rgb('+g.rgb+')'; el.style.textShadow='0 0 16px rgba('+g.rgb+',0.5)'; });
  /* Gauge HUD halo + dashed rings recolour to the band accent. */
  set('gaugeWrap', el=>{ if(el.style && el.style.setProperty) el.style.setProperty('--gauge-rgb', g.rgb); });
}

function recalc() {
  const a = computeAssessment();
  const s = state;

  $('totalScore').textContent = a.total;

  /* Gauge arc: 270° sweep on r=84 circle. 396 ≈ 2π×84×0.75 (fitted to the visual sweep including round linecap).
     600 = circumference buffer; must be > 396 so the gap stays hidden. Display scale: 0–30. */
  const arc = $('gaugeArc');
  if(arc) arc.style.strokeDasharray = (Math.min(a.total/30, 1)*396).toFixed(1) + ' 600';


  /* Verdict pill (operative outcome) + threshold chips (numeric band) */
  const vpEl = $('verdictPill');
  vpEl.className = 'verdict-pill ' + {CDD:'vp-cdd', SDD:'vp-sdd', EDD:'vp-edd', PROHIBITED:'vp-proh'}[a.outcome];
  $('verdictText').textContent = a.outcome + ' — ' + bandFull(a.outcome) + (a.analystOv ? ' ✱' : '');
  $('verdictIcon').textContent = BAND_ICON[a.outcome];

  /* AI Risk Advisor — robot persona recolours to the operative outcome */
  updateAdvisor(a.outcome);

  /* Analyst override banner + form hint */
  const ovB = $('ovBanner');
  if(a.analystOv){
    ovB.style.display = 'block';
    ovB.textContent = '⚑ Analyst override: ' + a.analystOv.from + ' → ' + a.analystOv.band + ' — ' + a.analystOv.reason
      + (a.analystOv.at ? ' (' + (fmtDate(a.analystOv.at) || a.analystOv.at) + ')' : '');
  } else {
    ovB.style.display = 'none';
  }
  const ovH = $('ovHint');
  if(ovH){
    const sel = s.override && s.override.band;
    ovH.textContent = a.prohibited
      ? 'Not applicable to prohibited relationships.'
      : (sel && !String(s.override.reason||'').trim()) ? 'Justification required to apply the override.'
      : (sel && !a.analystOv) ? 'Inactive — computed outcome is already ' + a.engineOutcome + ' or higher.'
      : a.analystOv ? 'Applied — review cadence follows ' + a.analystOv.band + '.'
      : 'May only raise the required diligence level.';
  }
  const chips = {CDD:$('tc-low'), SDD:$('tc-med'), EDD:$('tc-high')};
  Object.values(chips).forEach(el=>el.classList.remove('tc-active'));
  chips[a.numericBand].classList.add('tc-active');

  /* Hard-outcome banner */
  const banner = $('critBanner');
  if(a.prohibited){
    const reasons = a.escalations.filter(e=>e.level==='prohibit').map(e=>e.reason).join('; ');
    banner.style.display = 'block';
    banner.textContent = '⛔ PROHIBITED — designated-party exposure: ' + reasons
      + '. Do not onboard. Freeze funds where held and file a report with the FIU / relevant authority.';
  } else if(a.escalations.length){
    banner.style.display = 'block';
    banner.textContent = '⚠ Enhanced Due Diligence mandatory — '
      + a.escalations.map(e=>e.reason).join('; ') + '.';
  } else {
    banner.style.display = 'none';
  }

  /* Bar pointer: display scale 0–30 */
  $('barPointer').style.left = Math.min(a.total/30*100, 100) + '%';
  $('pointerLabel').textContent = a.total;

  /* Prior review block (re-assessments only) */
  const pb = $('priorBlock');
  if(pb){
    if(s.prior){
      pb.style.display = 'block';
      const ch = priorChanges(a) || [];
      $('priorInfo').textContent = s.prior.ref + ' · ' + (fmtDate(s.prior.date) || s.prior.date || '—') + ' · ' + s.prior.total + ' · ' + s.prior.outcome;
      $('priorChangesLbl').textContent = ch.length ? ch.length + ' change' + (ch.length===1?'':'s') + ' since prior' : 'No changes since prior';
      $('priorList').innerHTML = ch.length ? ch.map(c => '<div>'+esc(c)+'</div>').join('') : '<div>No factor changes.</div>';
    } else {
      pb.style.display = 'none';
    }
  }

  /* Next review date suggestion — none for prohibited relationships */
  const suggested = a.prohibited ? '' : addMonths(s.meta.date, REVIEW_MONTHS[a.outcome]);
  if(!s.signoff.reviewManual){
    s.signoff.nextReview = suggested;
    $('nextReview').value = fmtDate(suggested);
  }
  const manualLate = s.signoff.reviewManual && suggested && s.signoff.nextReview && s.signoff.nextReview > suggested;
  $('reviewHint').innerHTML = (a.prohibited
      ? 'No review — relationship prohibited'
      : 'Suggested: ' + fmtDate(suggested) + ' (' + REVIEW_MONTHS[a.outcome] + ' months — ' + a.outcome + ')')
    + (s.signoff.reviewManual ? ' · <a data-act="useSuggestedReview">use suggested</a>' : '')
    + (manualLate ? ' <b class="warn-amber">⚠ manual date is later than the ' + a.outcome + ' schedule</b>' : '');

  scheduleSave();
}

/* ══════════════════════════════════════════
   PERSISTENCE — autosave / export / import
══════════════════════════════════════════ */
let saveTimer = null, toastTimer = null;

function toast(msg){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), TOAST_DURATION_MS);
}
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 400);
}
function saveDraft(){
  try{
    SS.setItem(STORAGE_KEY, JSON.stringify({version:APP_VERSION, savedAt:new Date().toISOString(), state}));
    $('saveStamp').textContent = 'Autosaved '+new Date().toLocaleTimeString();
    const warn = $('storageWarn'); if(warn) warn.classList.add('hidden');
  }catch(e){
    /* Storage blocked (private mode, quota exceeded, or security policy). Show a persistent banner
       so the user knows to export manually before closing the tab. */
    const warn = $('storageWarn'); if(warn) warn.classList.remove('hidden');
  }
  regUpsert(); /* the register mirrors every named save */
}
function loadDraft(){
  try{
    const raw = SS.getItem(STORAGE_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(!data || !data.state) return null;
    return {state:mergeState(data.state), savedAt:data.savedAt};
  }catch(e){ return null; }
}

/* Retention control (data-governance, Layer 2): drop a loose working draft that
   has gone untouched beyond the retention window. Assessments already filed in
   the register are the AML record (5-yr retention) and are NEVER purged here —
   only an abandoned, unfiled draft is. Returns true if it purged. */
const RETENTION_DAYS = 90;
function purgeStaleDraft(now){
  try{
    const raw = SS.getItem(STORAGE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    const savedAt = data && data.savedAt ? Date.parse(data.savedAt) : NaN;
    if(!isFinite(savedAt)) return false;
    const ref = data && data.state && data.state.meta ? data.state.meta.ref : '';
    const reg = regAll();
    if(ref && reg && reg[ref]) return false; /* already filed in the register → keep */
    const ageDays = ((now || Date.now()) - savedAt) / 86400000;
    if(ageDays < RETENTION_DAYS) return false;
    SS.removeItem(STORAGE_KEY);
    auditAppend('retention.purge', 'Stale working draft purged ('+Math.floor(ageDays)+'d ≥ '+RETENTION_DAYS+'d retention)');
    return true;
  }catch(e){ return false; }
}

/* ══════════════════════════════════════════
   ASSESSMENT REGISTER — the filing cabinet
   Every assessment with an entity legal name files itself here on save,
   keyed by its reference, so Reset and Open never lose work. Snapshots
   re-enter through mergeState, exactly like an imported file.
══════════════════════════════════════════ */
const REG_KEY = 'hsra.register.v1';

function regAll(){
  try{
    const data = JSON.parse(SS.getItem(REG_KEY));
    return (data && data.items && typeof data.items==='object' && !Array.isArray(data.items)) ? data.items : {};
  }catch(e){ return {}; }
}
function regWrite(items){
  try{ SS.setItem(REG_KEY, JSON.stringify({version:1, items})); }catch(e){}
}

/* ── Off-device mirror: push a summary of the Register + Activity Log to Asana
   (best-effort; failures never block the UI). Pulled back on the Console via a
   "Refresh from Asana" button. Disabled outside a browser (no navigator). ── */
const ASANA_MIRROR_EP = '/.netlify/functions/asana-mirror';
function mirrorPayload(){
  const items = regAll();
  /* Honour the tokenised-delivery opt-in here too: when the officer chose
     "tokenise (no PII)", customer identity must not reach Asana via the
     register mirror either — only the non-identifying triage fields go. */
  const tok = (typeof asanaTokenised==='function') && asanaTokenised();
  const register = Object.keys(items).map(ref=>{
    const it = items[ref]||{}, s = it.summary||{}, st = it.state||{};
    return { ref, entity: tok ? '' : (s.entity||''), outcome: s.outcome||'', total: (s.total==null?'':s.total),
      prohibited: !!s.prohibited, complete: !!s.complete, date: s.date||'',
      nextReview: s.nextReview||'', jurisdiction: tok ? '' : ((st.entity&&st.entity.jurisdiction)||''),
      activity: tok ? '' : ((st.profile&&st.profile.activity)||''), savedAt: it.savedAt||'' };
  });
  return { action:'write', register, audit: (typeof auditAll==='function'?auditAll():[]).slice(-1000) };
}
let _mirrorTimer = null;
function scheduleMirror(){
  if(typeof navigator==='undefined') return;          /* browser-only */
  if(_mirrorTimer) clearTimeout(_mirrorTimer);
  _mirrorTimer = setTimeout(mirrorPush, 8000);         /* debounce bursts of edits */
}
function mirrorPush(){
  if(typeof navigator==='undefined' || typeof fetch==='undefined') return;
  try{
    const p = mirrorPayload();
    if(!p.register.length && !p.audit.length) return;
    fetch(ASANA_MIRROR_EP, {method:'POST', headers: fnHeaders(), body: JSON.stringify(p)}).then(()=>{}).catch(()=>{});
  }catch(e){}
}
function mirrorBeacon(){
  if(typeof navigator==='undefined') return;
  try{
    const p = mirrorPayload();
    if(!p.register.length && !p.audit.length) return;
    /* sendBeacon cannot set headers, so with a strict-mode token configured the
       beacon would 401 — use keepalive fetch (survives unload) to carry it. */
    if(appToken() && typeof fetch==='function'){
      fetch(ASANA_MIRROR_EP, {method:'POST', headers: fnHeaders(), body: JSON.stringify(p), keepalive:true}).then(()=>{}).catch(()=>{});
    }
    else if(navigator.sendBeacon) navigator.sendBeacon(ASANA_MIRROR_EP, new Blob([JSON.stringify(p)], {type:'application/json'}));
    else mirrorPush();
  }catch(e){}
}
function regUpsert(){
  const ref = String(state.meta.ref||'').trim();
  if(!ref || !String(state.entity.name||'').trim()) return false; /* files are labelled by customer */
  const a = computeAssessment();
  const items = regAll();
  items[ref] = {
    savedAt: new Date().toISOString(),
    summary: {entity:state.entity.name, total:a.total, outcome:a.outcome, prohibited:a.prohibited,
              complete:!!state.complete, date:state.meta.date, nextReview:state.signoff.nextReview},
    state: JSON.parse(JSON.stringify(state))
  };
  regWrite(items);
  scheduleMirror();
  return true;
}
function regDelete(ref){
  const items = regAll();
  if(!items[ref]) return false;
  delete items[ref];
  regWrite(items);
  auditAppend('register.delete', ref);
  return true;
}
/** Load an assessment from the register by reference. Saves the current assessment first
 *  so no work is lost. Returns false if the ref is not found. */
function regOpenEntry(ref){
  const e = regAll()[ref];
  if(!e || !e.state || typeof e.state!=='object') return false;
  regUpsert(); /* file the assessment being put down before picking up another */
  state = mergeState(e.state);
  syncUI();
  saveDraft();
  return true;
}

/* Pure review-scheduler helpers (unit-tested). A summary's review state is one
   of: 'prohibited' (no review), 'overdue' (next review in the past),
   'soon' (due within the window, default 30d), 'scheduled' (further out), or
   'none' (no valid next-review date). */
function reviewStatus(sm, today, soon){
  if(sm && sm.prohibited) return 'prohibited';
  const nr = String((sm && sm.nextReview) || '');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(nr)) return 'none';
  if(nr < today) return 'overdue';
  if(nr <= soon) return 'soon';
  return 'scheduled';
}
/* Count overdue / due-soon reviews across a register items map. */
function reviewCounts(items, today, soon){
  let overdue = 0, soon_ = 0;
  for(const ref of Object.keys(items || {})){
    const st = reviewStatus((items[ref] || {}).summary || {}, today, soon);
    if(st === 'overdue') overdue++; else if(st === 'soon') soon_++;
  }
  return { overdue, soon: soon_ };
}

let regView = [];
function regRender(){
  const rows = $('regRows');
  if(!rows) return;
  const items = regAll();
  const q = (($('regSearch') && $('regSearch').value) || '').toLowerCase();
  const fv = (($('regReviewFilter') && $('regReviewFilter').value) || 'all');
  const refs = Object.keys(items).sort((x,y)=>String(items[y].savedAt||'').localeCompare(String(items[x].savedAt||'')));
  regView = [];
  /* A true 30-day window — the filter and summary are labelled "30 days", and
     a calendar month here drifted 28–31 days with the month. */
  const today = todayISO(), soon = addDays(today, 30);
  const html = refs.map(ref => {
    const it = items[ref] || {}, sm = it.summary || {};
    if(q && (ref+' '+(sm.entity||'')).toLowerCase().indexOf(q)===-1) return '';
    const rs = reviewStatus(sm, today, soon);
    if(fv==='due' && !(rs==='overdue' || rs==='soon')) return '';
    if(fv==='overdue' && rs!=='overdue') return '';
    if(fv==='soon' && rs!=='soon') return '';
    const i = regView.push(ref) - 1;
    const band = {CDD:'reg-cdd', SDD:'reg-sdd', EDD:'reg-edd', PROHIBITED:'reg-proh'}[sm.outcome] || 'reg-st-draft';
    const result = sm.outcome==='PROHIBITED' ? 'PROHIBITED' : (sm.outcome||'?') + ' · ' + (isNaN(parseInt(sm.total)) ? '?' : sm.total);
    let review = '', revCls = '';
    if(rs==='prohibited'){ review = 'no review — prohibited'; }
    else if(rs==='overdue'){ review = 'REVIEW OVERDUE — ' + fmtDate(sm.nextReview); revCls = ' reg-over'; }
    else if(rs==='soon'){ review = 'review ' + fmtDate(sm.nextReview); revCls = ' reg-soon'; }
    else if(rs==='scheduled'){ review = 'review ' + fmtDate(sm.nextReview); }
    const cur = state.meta.ref===ref;
    return '<div class="reg-row'+(cur?' reg-cur':'')+'">'
      + '<span class="reg-ref">'+esc(ref)+(cur?' ✱':'')+'</span>'
      + '<span class="reg-name">'+esc(sm.entity||'')+'</span>'
      + '<span class="reg-chip '+band+'">'+esc(result)+'</span>'
      + '<span class="reg-chip '+(sm.complete?'reg-st-done':'reg-st-draft')+'">'+(sm.complete?'COMPLETE':'DRAFT')+'</span>'
      + (function(as){ return as ? '<span class="reg-chip '+as.cls+'" title="'+esc(as.title)+'">'+esc(as.txt)+'</span>' : ''; })(asanaStatus(ref, sm.complete))
      + '<span class="reg-review'+revCls+'">'+esc(review)+'</span>'
      + '<button class="btn btn-blue btn-mini" data-act="regOpen" data-a1="'+i+'" aria-label="Open '+esc(ref)+'">Open</button>'
      + '<button class="btn btn-red btn-mini" data-act="regDelete" data-a1="'+i+'" aria-label="Remove '+esc(ref)+' from register">Delete</button>'
      + '</div>';
  }).join('');
  rows.innerHTML = html || '<div class="rd-empty">'+(refs.length ? 'No matches.' : 'Nothing filed yet — an assessment files itself once the entity has a legal name.')+'</div>';
  const c = $('regCountLbl');
  if(c) c.textContent = refs.length + ' assessment' + (refs.length===1?'':'s') + ' filed';
  const m = $('regMeta');
  if(m) m.textContent = regView.length===refs.length ? '' : regView.length + ' of ' + refs.length + ' shown';
  const rsum = $('regReviewSummary');
  if(rsum){
    const cts = reviewCounts(items, today, soon);
    const parts = [];
    if(cts.overdue) parts.push(cts.overdue + ' overdue');
    if(cts.soon) parts.push(cts.soon + ' due ≤30d');
    rsum.textContent = parts.length ? ('Reviews: ' + parts.join(' · ')) : 'No reviews due';
    rsum.className = 'reg-review-summary' + (cts.overdue ? ' reg-over' : (cts.soon ? ' reg-soon' : ''));
  }
}
/* ══════════════════════════════════════════
   BATCH SCREENING (CSV triage — pure helpers + UI)
══════════════════════════════════════════ */
/* RFC4180-ish CSV → { headers, rows:[{lower-cased-header: value}] }. */
function batchParseCsv(text){
  const s = String(text==null?'':text);
  const grid = [];
  let row = [], field = '', inQ = false;
  for(let i=0;i<s.length;i++){
    const c = s[i];
    if(inQ){
      if(c==='"'){ if(s[i+1]==='"'){ field+='"'; i++; } else inQ=false; }
      else field += c;
      continue;
    }
    if(c==='"'){ inQ = true; continue; }
    if(c===','){ row.push(field); field=''; continue; }
    if(c==='\r'){ continue; }
    if(c==='\n'){ row.push(field); grid.push(row); row=[]; field=''; continue; }
    field += c;
  }
  if(field.length || row.length){ row.push(field); grid.push(row); }
  const nonEmpty = grid.filter(r => r.some(c => String(c).trim()!==''));
  if(!nonEmpty.length) return { headers:[], rows:[] };
  const headers = nonEmpty[0].map(h => String(h).trim());
  const rows = nonEmpty.slice(1).map(r => {
    const o = {};
    headers.forEach((h,idx) => { o[h.toLowerCase()] = r[idx]!=null ? String(r[idx]).trim() : ''; });
    return o;
  });
  return { headers, rows };
}
function batchPick(o, keys){ for(const k of keys){ if(o[k]!=null && o[k]!=='') return o[k]; } return ''; }
function batchYes(v){ return /^(y|yes|true|1)$/i.test(String(v==null?'':v).trim()); }
/* Map a raw CSV row (lower-cased keys) to the engine's input factors. */
function mapBatchRow(o){
  o = o || {};
  const onboardRaw = batchPick(o, ['onboard','remote','channel','non-face-to-face']);
  return {
    name: batchPick(o, ['name','entity','entity name','legal name','client']),
    jurisdiction: batchPick(o, ['jurisdiction','country','country of incorporation']),
    activity: batchPick(o, ['activity','business activity','nature of business']),
    onboard: /^(y|yes|true|1|remote|non.?face)/i.test(String(onboardRaw).trim()) ? 'Yes' : 'No',
    entityYears: batchPick(o, ['entityyears','entity years','years trading','operational history']),
    relYears: batchPick(o, ['relyears','relationship years','relationship duration']),
    flags: {
      sanctions_entity: batchYes(batchPick(o, ['sanctions','sanctioned'])) ? 'Yes' : 'No',
      pep: batchYes(batchPick(o, ['pep'])) ? 'Yes' : 'No',
      adverse: batchYes(batchPick(o, ['adverse','adverse media'])) ? 'Yes' : 'No',
      tf: batchYes(batchPick(o, ['tf','terrorist','terrorism'])) ? 'Yes' : 'No',
      pf: batchYes(batchPick(o, ['pf','proliferation'])) ? 'Yes' : 'No',
    }
  };
}
/* Score one mapped row through computeAssessment by temporarily swapping the
   live state, then restoring it (synchronous; no renders fire in between). */
function scoreBatchRow(m){
  const saved = state, notes = [];
  try{
    /* defaultState() — NOT freshState(): freshState() calls newRef() which
       increments the persisted RA sequence (hsra.seq). Batch rows are never
       filed, so they must not consume real reference numbers. */
    const s = defaultState();
    s.entity.name = m.name || '';
    if(m.jurisdiction){ s.entity.jurisdiction = m.jurisdiction; if(!effCountry(m.jurisdiction)) notes.push('jurisdiction not in risk data — scored low'); }
    else notes.push('no jurisdiction provided — scored on the default');
    if(m.activity){ s.profile.activity = m.activity; if(!effOf('activities', m.activity)) notes.push('activity not in risk data — scored low'); }
    else notes.push('no activity provided — scored on the default');
    s.profile.onboard = m.onboard;
    const ey = parseInt(m.entityYears, 10); if(!isNaN(ey)) s.profile.entityYears = ey;
    const ry = parseInt(m.relYears, 10); if(!isNaN(ry)) s.profile.relYears = ry;
    if(m.flags){ Object.keys(m.flags).forEach(k => { if(s.questions[k]!==undefined && m.flags[k]==='Yes') s.questions[k]='Yes'; }); }
    state = s;
    const r = computeAssessment();
    return { name:m.name||'', jurisdiction:s.entity.jurisdiction, activity:s.profile.activity,
      total:r.total, outcome:r.outcome, prohibited:r.prohibited, escalations:r.escalations.map(e=>e.reason), notes };
  } finally { state = saved; }
}
function scoreBatch(text){ return batchParseCsv(text).rows.map(o => scoreBatchRow(mapBatchRow(o))); }
function batchCsvCell(v){
  v = String(v==null?'':v);
  /* A leading = + - @ tab or CR executes as a formula when the export is opened
     in Excel/Sheets (CSV injection) — neutralised with a literal apostrophe.
     The app's own numeric cells (Score) are non-negative, so they never match. */
  if(/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
}
function batchToCsv(results){
  const head = ['Name','Jurisdiction','Activity','Score','Outcome','Prohibited','Escalations','Notes'];
  const lines = [head.join(',')];
  (results||[]).forEach(r => {
    lines.push([r.name, r.jurisdiction, r.activity, r.total, r.outcome, r.prohibited?'YES':'',
      (r.escalations||[]).join('; '), (r.notes||[]).join('; ')].map(batchCsvCell).join(','));
  });
  return lines.join('\n');
}
function batchDownload(filename, text, mime){
  const blob = new Blob([text], {type: mime||'text/csv'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => { try{ URL.revokeObjectURL(link.href); }catch(e){} }, 0);
}
let batchResults = [];
function batchOutcomeClass(o){ return {CDD:'reg-cdd', SDD:'reg-sdd', EDD:'reg-edd', PROHIBITED:'reg-proh'}[o] || 'reg-st-draft'; }
function renderBatchResults(results){
  const box = $('batchRows');
  if(!box) return;
  if(!results.length){ box.innerHTML = '<div class="rd-empty">No rows scored — add a header row and at least one entity.</div>'; return; }
  const body = results.map(r => {
    const label = r.prohibited ? 'PROHIBITED' : (r.outcome + ' · ' + r.total);
    const cls = batchOutcomeClass(r.prohibited ? 'PROHIBITED' : r.outcome);
    const note = (r.notes && r.notes.length) ? r.notes.join('; ') : (r.escalations && r.escalations.length ? r.escalations.join('; ') : '');
    return '<div class="batch-row">'
      + '<span class="batch-name">'+esc(r.name||'—')+'</span>'
      + '<span class="batch-jur">'+esc(r.jurisdiction||'—')+'</span>'
      + '<span class="reg-chip '+cls+'">'+esc(label)+'</span>'
      + '<span class="batch-note">'+esc(note)+'</span>'
      + '</div>';
  }).join('');
  box.innerHTML = '<div class="batch-row batch-head"><span class="batch-name">Entity</span><span class="batch-jur">Jurisdiction</span><span>Outcome</span><span class="batch-note">Notes / escalations</span></div>' + body;
}
function runBatch(){
  const text = ($('batchInput') && $('batchInput').value) || '';
  if(!text.trim()){ toast('Paste CSV or choose a file first'); return; }
  batchResults = scoreBatch(text);
  renderBatchResults(batchResults);
  const c = $('batchCountLbl'); if(c) c.textContent = batchResults.length + ' entit' + (batchResults.length===1?'y':'ies') + ' scored';
  const prohibited = batchResults.filter(r=>r.prohibited).length;
  const m = $('batchMeta'); if(m) m.textContent = prohibited ? (prohibited + ' PROHIBITED') : '';
  const xb = $('batchExportBtn'); if(xb) xb.classList.toggle('hidden', !batchResults.length);
}
function onBatchFile(e){
  const f = e && e.target && e.target.files && e.target.files[0];
  if(!f) return;
  const rd = new FileReader();
  rd.onload = () => { const ta = $('batchInput'); if(ta) ta.value = String(rd.result||''); toast('Loaded '+f.name); };
  rd.readAsText(f);
}
function downloadBatchTemplate(){
  const tmpl = 'name,jurisdiction,activity,onboard,entityYears,relYears,sanctions,pep,adverse,tf,pf\n'
    + 'Acme Trading FZE,United Arab Emirates,Non-Manufactured Precious Metal Trading,No,3,2,No,No,No,No,No\n'
    + 'Example Holdings Ltd,United Kingdom,Non-Manufactured Precious Metal Trading,Yes,1,1,No,Yes,No,No,No\n';
  batchDownload('batch-template.csv', tmpl, 'text/csv');
}
function exportBatchResults(){
  if(!batchResults.length){ toast('Score a batch first'); return; }
  batchDownload('batch-results-' + todayISO().replace(/-/g,'') + '.csv', batchToCsv(batchResults), 'text/csv');
}
function openBatch(){ const o = $('batchOverlay'); if(o) o.classList.add('open'); _focusDialog('batchOverlay'); }
function closeBatch(){ const o = $('batchOverlay'); if(o) o.classList.remove('open'); _restoreDialogFocus(); }

function openRegister(){
  regUpsert(); /* show the current assessment as it stands right now */
  regRender();
  const o = $('regOverlay');
  if(o) o.classList.add('open');
  _focusDialog('regOverlay');
}
function closeRegister(){ const o = $('regOverlay'); if(o) o.classList.remove('open'); _restoreDialogFocus(); }
function regOpenIdx(i){
  const ref = regView[i];
  if(ref==null) return;
  if(state.meta.ref===ref){ closeRegister(); toast('Already open — '+ref); return; }
  if(!regOpenEntry(ref)) return;
  closeRegister();
  toast('Opened '+ref);
}
function regDeleteIdx(i){
  const ref = regView[i];
  if(ref==null) return;
  if(!confirm('Remove '+ref+' from the register? Exported files and printed reports are not affected.')) return;
  regDelete(ref);
  regRender();
  toast('Removed from register — '+ref);
}
/* ══════════════════════════════════════════
   BILINGUAL (EN / AR) — interface i18n + RTL
   Machine-assisted UI translation for accessibility. The detailed legal /
   regulatory content (the Q&A corpus, legal narratives, risk-data text)
   intentionally stays English until a qualified Arabic AML reviewer signs it
   off — surfaced to the user via #i18nCaveat in Arabic mode.
══════════════════════════════════════════ */
const LANG_KEY = 'hsra.lang';
const I18N = {
  'nav.assessment': {en:'Assessment', ar:'التقييم'},
  'nav.console':    {en:'Console', ar:'لوحة العمليات'},
  'nav.advisor':    {en:'Advisor', ar:'المستشار'},
  'btn.lock':       {en:'⚿ Lock', ar:'⚿ قفل'},
  'sec.01': {en:'Assessment Administration', ar:'إدارة التقييم'},
  'sec.02': {en:'Entity Identification', ar:'تعريف الكيان'},
  'sec.03': {en:'Business Profile', ar:'ملف النشاط التجاري'},
  'sec.04': {en:'Ownership, Control & Compliance', ar:'الملكية والسيطرة والامتثال'},
  'sec.05': {en:'Supply Chain — Material Sources', ar:'سلسلة التوريد — مصادر المواد'},
  'sec.06': {en:'Sign-Off & Attestation', ar:'التوقيع والإقرار'},
  'panel.riskdata': {en:'Risk Data — Reference Scores', ar:'بيانات المخاطر — الدرجات المرجعية'},
  'panel.register': {en:'Assessment Register', ar:'سجل التقييمات'},
  'panel.batch':    {en:'Batch Screening', ar:'الفحص المجمّع'},
  'panel.audit':    {en:'Activity Log', ar:'سجل النشاط'},
  'btn.print':    {en:'⎙ Print / Export PDF', ar:'⎙ طباعة / تصدير PDF'},
  'btn.register': {en:'≡ Register', ar:'≡ السجل'},
  'btn.batch':    {en:'⊞ Batch Screening', ar:'⊞ الفحص المجمّع'},
  'btn.audit':    {en:'▤ Activity Log', ar:'▤ سجل النشاط'},
  'btn.asana':    {en:'↗ Send to Asana', ar:'↗ إرسال إلى Asana'},
  'btn.reassess': {en:'⟳ Re-assess', ar:'⟳ إعادة التقييم'},
  'btn.riskdata': {en:'⚙ Risk Data', ar:'⚙ بيانات المخاطر'},
  'fld.ref':        {en:'Reference Number', ar:'الرقم المرجعي'},
  'fld.assessDate': {en:'Assessment Date', ar:'تاريخ التقييم'},
  'fld.nextReview': {en:'Next Review Date', ar:'تاريخ المراجعة القادمة'},
  'fld.assessedBy': {en:'Assessed By', ar:'أجري التقييم بواسطة'},
  'fld.role':       {en:'Role / Department', ar:'الدور / القسم'},
  'fld.legalName':  {en:'Legal Entity Name', ar:'الاسم القانوني للكيان'},
  'fld.trading':    {en:'Trading Name (If Different)', ar:'الاسم التجاري (إن اختلف)'},
  'fld.regno':      {en:'Registration / Licence No.', ar:'رقم التسجيل / الرخصة'},
  'fld.address':    {en:'Registered Address', ar:'العنوان المسجَّل'},
  'fld.contact':    {en:'Website / Email', ar:'الموقع الإلكتروني / البريد الإلكتروني'},
  'fld.principals': {en:'Principals — Beneficial Owners / Controllers / Directors', ar:'الأطراف الرئيسية — المالكون المستفيدون / المسيطرون / المديرون'},
  'fld.jurisdiction': {en:'Jurisdiction & Incorporation', ar:'الولاية القضائية والتأسيس'},
  'fld.activity':     {en:'Business Activity', ar:'النشاط التجاري'},
  'fld.onboard':      {en:'Onboarding Channel', ar:'قناة الإلحاق'},
  'fld.opHistory':    {en:'Operational History — Entity', ar:'السجل التشغيلي — الكيان'},
  'fld.relDuration':  {en:'Relationship Duration', ar:'مدة العلاقة'},
  'fld.fullName':     {en:'Full Name', ar:'الاسم الكامل'},
  'fld.titleRole':    {en:'Title / Role', ar:'المسمى الوظيفي / الدور'},
  'fld.date':         {en:'Date', ar:'التاريخ'},
  'tag.prohibitive':  {en:'Prohibitive', ar:'مانع'},
  'tag.edd':          {en:'EDD trigger', ar:'موجب للعناية المعزّزة'},
  'btn.yes':          {en:'Yes', ar:'نعم'},
  'btn.no':           {en:'No', ar:'لا'},
  'fld.sanctionsScreening': {en:'Sanctions Screening — System / Provider', ar:'فحص العقوبات — النظام / المزوّد'},
  'fld.pepScreening':       {en:'PEP Screening — System / Provider', ar:'فحص الأشخاص المعرَّضين سياسياً — النظام / المزوّد'},
  'fld.adverseScreening':   {en:'Adverse Media — System / Provider', ar:'الإعلام السلبي — النظام / المزوّد'},
  'fld.screenedOn':   {en:'Screened On', ar:'تاريخ الفحص'},
  'fld.refId':        {en:'Reference ID', ar:'المعرّف المرجعي'},
  'fld.notes':        {en:'Assessment Notes & Risk Rationale', ar:'ملاحظات التقييم ومسوّغات المخاطر'},
  'fld.operatorRole': {en:'Operator role', ar:'دور المشغّل'},
  'fld.riskScore':        {en:'Out of 30+ · Risk Score', ar:'من أصل 30+ · درجة المخاطر'},
  'fld.requiredDiligence':{en:'Required Diligence', ar:'العناية الواجبة المطلوبة'},
  'fld.aiAdvisor':        {en:'AI Risk Advisor', ar:'مستشار المخاطر الذكي'},
  'fld.riskPosition':     {en:'Risk Position', ar:'موضع المخاطر'},
  'fld.analystOverride':  {en:'Analyst Override', ar:'تجاوز المحلِّل'},
};
/* Arabic for the ownership/compliance questions (section 04). Machine-assisted
   per #i18nCaveat — review before official use. Folded into I18N keyed q.<id>
   so applyLang translates the rendered question text. */
const Q_AR = {
  aml:'هل لدى الكيان القانوني بيئة رقابة كافية وفعّالة لمكافحة غسل الأموال وتمويل الإرهاب (حيثما ينطبق)؟',
  sanctions_person:'هل يخضع أيٌّ من المالكين المستفيدين أو المسيطرين أو المديرين أو الإدارة العليا لعقوبات؟',
  criminal:'هل يخضع الكيان لأي إجراءات جنائية أو تحقيقات قانونية جارية؟',
  adverse:'هل يخضع أيٌّ من المالكين المستفيدين أو المسيطرين أو المديرين أو الإدارة العليا لتغطية إعلامية سلبية أو نتائج تمسّ السمعة؟',
  sanctions_entity:'هل يخضع الكيان القانوني نفسه لأي عقوبات وطنية أو دولية؟',
  sof:'هل توجد أي مخاوف بشأن مصدر الأموال و/أو مصدر الثروة للمالكين المستفيدين أو الكيان القانوني (حيثما ينطبق)؟',
  high_risk_ind:'هل يعمل الكيان في أي صناعات عالية المخاطر (الأسلحة، المقامرة، الكازينوهات)؟',
  tf:'هل يرتبط أيٌّ من المالكين المستفيدين أو المسيطرين أو المديرين بتمويل الإرهاب أو بمنظمات إرهابية مُدرجة؟',
  pf:'هل يرتبط أيٌّ من المالكين المستفيدين أو المسيطرين أو المديرين بتمويل انتشار التسلح أو بتجارة المواد أو التقنيات المتصلة بأسلحة الدمار الشامل؟',
  pep:'هل يُعدّ أيٌّ من المالكين المستفيدين أو المسيطرين أو الإدارة العليا من الأشخاص المعرَّضين سياسياً (PEPs)؟',
  gov:'هل يملك الكيانَ القانوني أو يسيطر عليه حكومة أو سلطة حكومية أو جهة من القطاع العام؟',
};
QUESTIONS_OC.forEach(q => { if(Q_AR[q.id]) I18N['q.'+q.id] = {en:q.text, ar:Q_AR[q.id]}; });
function translateKey(key, lang){ const t = I18N[key]; return t ? (t[lang]!=null ? t[lang] : t.en) : null; }
function getLang(){ try{ return localStorage.getItem(LANG_KEY)==='ar' ? 'ar' : 'en'; }catch(e){ return 'en'; } }
function applyLang(lang){
  lang = (lang==='ar') ? 'ar' : 'en';
  try{ localStorage.setItem(LANG_KEY, lang); }catch(e){}
  const html = document.documentElement;
  if(html){ html.lang = lang; if(html.setAttribute) html.setAttribute('dir', lang==='ar' ? 'rtl' : 'ltr'); }
  const nodes = (document.querySelectorAll) ? document.querySelectorAll('[data-i18n]') : null;
  if(nodes && nodes.forEach) nodes.forEach(el => {
    const t = translateKey(el.getAttribute('data-i18n'), lang);
    if(t!=null) el.textContent = t;
  });
  const tog = $('langToggle'); if(tog) tog.textContent = (lang==='ar') ? 'EN' : 'عربي';
  const cav = $('i18nCaveat'); if(cav) cav.classList.toggle('hidden', lang!=='ar');
  /* Repaint JS-set strings (verdict, complete/mask buttons) in the new language.
     Guarded: at first load state may not be ready yet — the normal init paint
     handles it then; on a user toggle these run with state ready. */
  try{ if(typeof recalc==='function') recalc(); }catch(e){}
  try{ if(typeof paintStatus==='function') paintStatus(); }catch(e){}
  try{ if(typeof paintMaskBtn==='function') paintMaskBtn(); }catch(e){}
  try{ if(typeof paintTokeniseBtn==='function') paintTokeniseBtn(); }catch(e){}
}
function toggleLang(){ applyLang(getLang()==='ar' ? 'en' : 'ar'); }
function initLang(){ applyLang(getLang()); }

function initRegisterPanel(){
  const ov = $('regOverlay');
  if(ov && ov.addEventListener) ov.addEventListener('click', function(e){ if(e.target===ov) closeRegister(); });
  const bo = $('batchOverlay');
  if(bo && bo.addEventListener) bo.addEventListener('click', function(e){ if(e.target===bo) closeBatch(); });
}

/* eslint-disable-next-line no-unused-vars -- public API exercised by test/app.test.js */
function newAssessment(){
  const named = !!String(state.entity.name||'').trim();
  if(!confirm(named
    ? 'Start a new assessment? The current one stays filed in the Register.'
    : 'Start a new assessment? The current draft in this browser will be replaced.')) return;
  regUpsert();
  state = freshState();
  syncUI();
  saveDraft();
  toast('New assessment started — '+state.meta.ref);
}

/* Periodic re-assessment: clone the current record under a new reference,
   keeping the outgoing assessment as the prior for comparison. Facts carry
   over; rationale, sign-off, status, and analyst override start fresh. */
function reassess(){
  const a = computeAssessment();
  if(!confirm('Start a periodic re-assessment? A new reference will be issued and the current assessment is kept as the prior for comparison.')) return;
  regUpsert(); /* the outgoing assessment stays filed under its own reference */
  const prior = {
    ref: state.meta.ref, date: state.meta.date, total: a.total, outcome: a.outcome,
    parts: a.parts.map(p => ({label:p.label, value:String(p.value), score:p.score}))
  };
  const next = mergeState(JSON.parse(JSON.stringify(state)));
  next.meta.ref = newRef();
  next.meta.date = todayISO();
  next.notes = '';
  next.signoff = defaultState().signoff;
  next.override = defaultState().override;
  next.complete = false;
  next.prior = prior;
  state = next;
  syncUI();
  saveDraft();
  toast('Re-assessment started — ' + state.meta.ref + ' (prior ' + prior.ref + ')');
}
function priorChanges(a){
  const p = state.prior;
  if(!p) return null;
  const prev = {};
  (p.parts || []).forEach(r => prev[r.label] = r);
  const changes = [];
  a.parts.forEach(cur => {
    const old = prev[cur.label];
    if(old && (String(old.value)!==String(cur.value) || old.score!==cur.score)){
      changes.push(cur.label + ': ' + old.value + ' (' + old.score + ') → ' + cur.value + ' (' + cur.score + ')');
    }
  });
  if(p.total!==a.total || p.outcome!==a.outcome) changes.push('Result: ' + p.total + ' · ' + p.outcome + ' → ' + a.total + ' · ' + a.outcome);
  return changes;
}
function togglePrior(){
  const p = $('priorPanel');
  p.classList.toggle('open');
  $('priorArrow').textContent = p.classList.contains('open') ? '▼' : '▶';
}

function exportFileName(){
  /* keep the download name safe across platforms */
  return (String(state.meta.ref||'').trim() || 'risk-assessment').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-') + '.json';
}
/* Integrity envelope for exported records — makes an export independently
   verifiable: `value` is the SHA-256 of the canonical JSON of `record`, and
   `auditChainHead` binds the export to the tamper-evident activity log. Verify
   procedure: SHA-256 over JSON.stringify(<the corresponding field in the file>).
   See docs/governance/backup-recovery.md. */
async function exportIntegrity(record){
  let value = null, auditChainHead = null;
  try{ value = await sha256Hex(JSON.stringify(record)); }catch(e){}
  try{ const log = auditAll(); auditChainHead = log.length ? log[log.length-1].hash : null; }catch(e){}
  return { algorithm: 'SHA-256', value, auditChainHead };
}
/* eslint-disable-next-line no-unused-vars -- public API exercised by test/app.test.js */
async function exportJSON(){
  const a = computeAssessment();
  const out = {
    app: 'Hawkeye Sterling — Entity Risk Assessment',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
    result: {totalScore:a.total, maxScore:MAX_SCORE, numericBand:a.numericBand, engineOutcome:a.engineOutcome, outcome:a.outcome, escalations:a.escalations, analystOverride:a.analystOv},
    riskData: {baseline:RISK_DATA_VERSION, overrides:rdCount(), updatedAt:riskData.updatedAt}
  };
  out.integrity = await exportIntegrity(state);   /* SHA-256 over JSON.stringify(export.state) */
  const blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = exportFileName();
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href), 1000);
  await auditAppend('export.json', state.meta.ref || '(unsaved)');
  toast('Assessment exported');
}

/* eslint-disable-next-line no-unused-vars -- code-only JSON import API (counterpart to exportJSON); see README */
function importJSON(){ $('importFile').click(); }
$('importFile').addEventListener('change', function(e){
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = function(){
    if(r.result && r.result.length > 10 * 1024 * 1024){ alert('File too large. Maximum allowed size is 10 MB.'); e.target.value = ''; return; }
    let data;
    try{ data = JSON.parse(r.result); }
    catch(err){ alert('The file contains invalid JSON. Expected an assessment exported from this application.'); e.target.value = ''; return; }
    const src = data && data.state ? data.state : data;
    if(!src || typeof src!=='object' || !src.questions){ alert('Invalid assessment file. Expected a JSON export from this application.'); e.target.value = ''; return; }
    state = mergeState(src);
    syncUI();
    toast('Assessment imported'+(state.meta.ref?' — '+state.meta.ref:''));
    e.target.value = '';
  };
  r.readAsText(f);
});

/* ══════════════════════════════════════════
   PRINT REPORT (black/pink A4)
══════════════════════════════════════════ */
function buildPrintReport(){
  const a = computeAssessment();
  const s = state;
  const dash = v => (v && String(v).trim()) ? esc(v) : '-';
  const dDate = iso => { const f = fmtDate(iso); return f ? esc(f) : '-'; };
  const chip = sc => `<span class="chip c${sc}">${sc} · ${ratingLabel(sc)}</span>`;

  const jC = effCountry(s.entity.jurisdiction);
  const jScore = jC ? jC.score : 1;
  const act = effOf('activities', s.profile.activity);
  const aScore = act ? act.score : 1;
  const obScore = scoreFromYesNo(s.profile.onboard,'onboard');
  const eyScore = yearsToScore(s.profile.entityYears), ryScore = yearsToScore(s.profile.relYears);

  /* Risk-data overrides applied to factors used by THIS assessment */
  const ovNotes = [], ovMark = '<span class="rd-mark">✱</span>';
  const ovWhen = e => fmtDate(e.at) || e.at || '-';
  if(jC && jC.overridden){
    let chg = jC.baseScore + ' → ' + jC.score;
    if(!!jC.cfa !== !!jC.baseCfa) chg += jC.cfa ? ' (CFA flag added)' : ' (CFA flag removed)';
    ovNotes.push('Jurisdiction - ' + s.entity.jurisdiction + ': ' + chg + ', overridden ' + ovWhen(jC) + ' - ' + jC.reason);
  }
  if(act && act.overridden) ovNotes.push('Business activity - ' + s.profile.activity + ': ' + act.baseScore + ' → ' + act.score + ', overridden ' + ovWhen(act) + ' - ' + act.reason);

  const qRows = QUESTIONS_OC.map(q =>
    `<tr><td class="q">${esc(q.text)}</td><td class="qa">${esc(s.questions[q.id])}</td><td class="s">${chip(scoreFromYesNo(s.questions[q.id], q.type))}</td></tr>`).join('');

  const scrRows = SCREENING_GROUPS.map(([g,label]) => {
    const v = s.screening[g];
    const has = (v.system || v.date || v.ref);
    const txt = has
      ? [(v.system || '-'), (v.date ? (fmtDate(v.date)||v.date) : '-'), (v.ref ? 'Ref ' + v.ref : '-')].join(' · ')
      : '-';
    return `<tr><td class="k">${esc(label)}</td><td class="v">${esc(txt)}</td><td class="s"></td></tr>`;
  }).join('');

  let supRows = '';
  [['recycled','Recycled'],['mined','Mined']].forEach(([key,label]) => {
    s.suppliers[key].forEach((v,i) => {
      if(v && v!=='N/A'){
        const item = effOf(key, v);
        if(item && item.overridden) ovNotes.push(label + ' material - ' + v + ': ' + item.baseScore + ' → ' + item.score + ', overridden ' + ovWhen(item) + ' - ' + item.reason);
        supRows += `<tr><td class="k">${label} - Supplier ${i+1}</td><td class="v">${esc(v)}</td><td class="s">${chip(item?item.score:0)}${item && item.overridden ? ovMark : ''}</td></tr>`;
      }
    });
  });
  if(!supRows) supRows = '<tr><td class="k">Material sources</td><td class="v">None declared</td><td class="s"></td></tr>';
  const ovBox = ovNotes.length ? '<div class="advise info"><div class="ic">✱</div><div class="tx"><b>Risk data overrides applied:</b> ' + esc(ovNotes.join('; ')) + '.</div></div>' : '';
  const pCh = s.prior ? (priorChanges(a) || []) : [];
  const priorBox = s.prior
    ? `<div class="advise info"><div class="ic">⟳</div><div class="tx"><b>Periodic re-assessment</b> of ${dash(s.prior.ref)} (${fmtDate(s.prior.date) ? esc(fmtDate(s.prior.date)) : dash(s.prior.date)} - ${s.prior.total} · ${esc(s.prior.outcome)}). ${pCh.length ? 'Changes since prior: ' + esc(pCh.join('; ')) + '.' : 'No factor changes since the prior review.'}</div></div>`
    : '';

  const prohibitReasons = a.escalations.filter(e=>e.level==='prohibit').map(e=>e.reason);
  const eddReasons = a.escalations.filter(e=>e.level==='edd').map(e=>e.reason);
  const escBoxes =
    (prohibitReasons.length ? `<div class="advise crit"><div class="ic">⛔</div><div class="tx"><b>PROHIBITED - designated-party exposure:</b> ${esc(prohibitReasons.join('; '))}. Do not onboard. Freeze funds where held and file a report with the FIU / relevant authority.</div></div>` : '')
    + (eddReasons.length ? `<div class="advise"><div class="ic">⚠</div><div class="tx"><b>Enhanced Due Diligence mandatory</b> - ${esc(eddReasons.join('; '))}.</div></div>` : '')
    + (a.analystOv ? `<div class="advise"><div class="ic">⚑</div><div class="tx"><b>Analyst override</b> - required diligence raised to ${a.analystOv.band} (computed ${a.analystOv.from}): ${esc(a.analystOv.reason)}${a.analystOv.at ? ' (' + (fmtDate(a.analystOv.at) || esc(a.analystOv.at)) + ')' : ''}.</div></div>` : '');

  /* Verdict graphic — mini gauge + band robot, recoloured by band (low green /
     med gold / high red); the score sits at the top where the band line used to. */
  const kind = advisorKind(a.outcome);
  const g = GAUGE_ROBOTS[kind];
  const arcLen = (Math.min(a.total/30, 1)*250).toFixed(0);
  const verdictTitle = a.prohibited ? 'PROHIBITED - DO NOT ONBOARD' : (a.outcome + ' - ' + BAND_FULL[a.outcome]);
  const verdictDesc = ADVISORS[kind].note;
  const thOn = {CDD:'L', SDD:'M', EDD:'H'}[a.numericBand];
  const nextReview = a.prohibited
    ? 'None - relationship prohibited'
    : (s.signoff.nextReview ? (fmtDate(s.signoff.nextReview) || s.signoff.nextReview) : '-');

  $('printReport').innerHTML = `
    <section class="page">
      <div class="page-body">
        <div class="mast">
          <div class="mast-brand">
            <div class="avatar"><div></div></div>
            <div>
              <div class="mast-name">HAWKEYE STERLING</div>
              <div class="mast-tag">Entity Risk Assessment · AML / CFT - DPMS</div>
            </div>
          </div>
          <div class="mast-doc">
            <div class="s">DPMS Template · v3.2</div>
            <div class="conf">Confidential</div>
          </div>
        </div>
        <div class="meta">
          <div><div class="k">Reference</div><div class="v">${dash(s.meta.ref)}</div></div>
          <div><div class="k">Assessment date</div><div class="v">${dDate(s.meta.date)}</div></div>
          <div><div class="k">Next review</div><div class="v">${esc(nextReview)}</div></div>
        </div>
        <div class="verdict">
          <div class="gauge-col">
            <div class="gauge">
              <svg viewBox="0 0 152 152" width="124" height="124" aria-hidden="true">
                <circle cx="76" cy="76" r="53" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="6" stroke-dasharray="250 84" stroke-linecap="round" transform="rotate(135,76,76)"></circle>
                <circle class="arc" cx="76" cy="76" r="53" fill="none" stroke-width="6" stroke-dasharray="${arcLen} 250" stroke-linecap="round" transform="rotate(135,76,76)"></circle>
                <circle class="ring" cx="76" cy="76" r="59" fill="none" stroke-width="1" stroke-dasharray="2 6"></circle>
              </svg>
              <div class="g-face"><div class="g-face-bg"></div></div>
            </div>
          </div>
          <div class="v-main">
            <div class="g-read"><span class="g-num">${a.total}</span><span class="g-cap">/ 30+</span></div>
            <div class="v-title">${verdictTitle}</div>
            ${a.analystOv ? '<div class="v-sub">Computed outcome: ' + a.analystOv.from + ' - raised by analyst override ✱</div>' : ''}
            <div class="v-desc">${esc(verdictDesc)}</div>
            <div class="v-thresh">
              <b${thOn==='L'?' class="on"':''}>CDD · 0-19</b><b${thOn==='M'?' class="on"':''}>SDD · 20-22</b><b${thOn==='H'?' class="on"':''}>EDD · 23+</b>
            </div>
          </div>
        </div>
        ${escBoxes}${ovBox}${priorBox}
        <h2 class="sec"><span class="n">01</span>Assessment Administration</h2>
        <table class="kv"><tbody>
          <tr><td class="k">Assessed by</td><td class="v">${dash(s.meta.assessor)}</td><td class="s"></td></tr>
          <tr><td class="k">Role / Department</td><td class="v">${dash(s.meta.role)}</td><td class="s"></td></tr>
        </tbody></table>
        <h2 class="sec"><span class="n">02</span>Entity Identification</h2>
        <table class="kv"><tbody>
          <tr><td class="k">Legal entity name</td><td class="v">${dash(s.entity.name)}</td><td class="s"></td></tr>
          <tr><td class="k">Trading name</td><td class="v">${dash(s.entity.trading)}</td><td class="s"></td></tr>
          <tr><td class="k">Registration / licence no.</td><td class="v">${dash(s.entity.regno)}</td><td class="s"></td></tr>
          <tr><td class="k">Jurisdiction &amp; incorporation</td><td class="v">${dash(s.entity.jurisdiction)}</td><td class="s">${chip(jScore)}${jC && jC.overridden ? ovMark : ''}</td></tr>
          <tr><td class="k">Registered address</td><td class="v">${dash(s.entity.address)}</td><td class="s"></td></tr>
          <tr><td class="k">Website / email</td><td class="v">${dash(s.entity.contact)}</td><td class="s"></td></tr>
          <tr><td class="k">Principals / UBOs</td><td class="v">${dash(s.entity.principals)}</td><td class="s"></td></tr>
        </tbody></table>
        <h2 class="sec"><span class="n">03</span>Business Profile</h2>
        <table class="kv"><tbody>
          <tr><td class="k">Business activity</td><td class="v">${dash(s.profile.activity)}</td><td class="s">${chip(aScore)}${act && act.overridden ? ovMark : ''}</td></tr>
          <tr><td class="k">Onboarding channel</td><td class="v">${s.profile.onboard==='Yes'?'Remote / Non-face-to-face':'In-Person'}</td><td class="s">${chip(obScore)}</td></tr>
          <tr><td class="k">Operational history</td><td class="v">${esc(String(s.profile.entityYears))} years in operation</td><td class="s">${chip(eyScore)}</td></tr>
          <tr><td class="k">Relationship duration</td><td class="v">${esc(String(s.profile.relYears))} years with entity</td><td class="s">${chip(ryScore)}</td></tr>
        </tbody></table>
      </div>
      <div class="foot"><span>CONFIDENTIAL · Entity Risk Assessment</span><span class="pg">Page 1 / 2</span></div>
    </section>
    <section class="page">
      <div class="page-body">
        <h2 class="sec"><span class="n">04</span>Ownership, Control &amp; Compliance</h2>
        <table class="kv qs"><tbody>${qRows}</tbody></table>
        <h2 class="sec"><span class="n">05</span>Supply Chain - Material Sources</h2>
        <table class="kv"><tbody>${supRows}</tbody></table>
        <h2 class="sec"><span class="n">06</span>Assessment Notes &amp; Risk Rationale</h2>
        <div class="notes">${s.notes.trim() ? esc(s.notes).replace(/\n/g,'<br>') : '<span class="notes-empty">No additional notes recorded.</span>'}</div>
        <h2 class="sec"><span class="n">07</span>Screening &amp; Register Checks</h2>
        <table class="kv"><tbody>${scrRows}</tbody></table>
        <h2 class="sec"><span class="n">08</span>Sign-Off &amp; Attestation</h2>
        <div class="attest">I confirm that this risk assessment has been completed in accordance with Hawkeye Sterling LLC&rsquo;s AML/CFT Risk Assessment Policy, the applicable DPMS regulatory guidelines, and all relevant national and international sanctions obligations. The information provided is accurate to the best of my knowledge.</div>
        <div class="signs">
          <div class="sign">
            <div class="role">First Line - Assessed By</div>
            <table><tbody>
              <tr><td class="k">Name</td><td class="v">${dash(s.signoff.completedBy)}</td></tr>
              <tr><td class="k">Title</td><td class="v">${dash(s.signoff.completedTitle)}</td></tr>
              <tr><td class="k">Date</td><td class="v">${dDate(s.signoff.completedDate)}</td></tr>
            </tbody></table>
            <div class="sign-line"></div><div class="sign-cap">Signature</div>
          </div>
          <div class="sign">
            <div class="role">Second Line - Reviewed &amp; Approved By</div>
            <table><tbody>
              <tr><td class="k">Name</td><td class="v">${dash(s.signoff.approvedBy)}</td></tr>
              <tr><td class="k">Title</td><td class="v">${dash(s.signoff.approvedTitle)}</td></tr>
              <tr><td class="k">Date</td><td class="v">${dDate(s.signoff.approvedDate)}</td></tr>
            </tbody></table>
            <div class="sign-line"></div><div class="sign-cap">Signature</div>
          </div>
        </div>
        ${_auditReportBlock()}
      </div>
      <div class="foot"><span>CONFIDENTIAL · Entity Risk Assessment</span><span class="pg">Page 2 / 2</span></div>
    </section>`;
  const _pr = $('printReport');
  if(_pr && typeof _pr.querySelector === 'function'){
    const _v = _pr.querySelector('.verdict'); if(_v) _v.style.setProperty('--bc', g.rgb);
    const _gf = _pr.querySelector('.g-face-bg');
    if(_gf){ _gf.style.backgroundImage = "url('" + g.img + "')"; _gf.style.backgroundSize = g.size || 'cover'; _gf.style.backgroundPosition = g.pos; }
  }
}
function printReport(){
  buildPrintReport();
  window.print();
}
/** Pre-flight checklist for PDF export — warns about Safari's "Print backgrounds" requirement. */
function printPreflight(){
  const ok = confirm(
    'Before printing / exporting PDF:\n\n'
    + '• Set paper size to A4 (portrait recommended)\n'
    + '• Safari: enable "Print backgrounds" in the print dialog\n'
    + '• Firefox: check "Print backgrounds" in "More settings"\n\n'
    + 'Proceed?'
  );
  if(ok) printReport();
}
window.addEventListener('beforeprint', buildPrintReport);
/* Flush the debounced autosave so closing the tab right after typing loses nothing */
window.addEventListener('beforeunload', saveDraft);
/* Flush a last Register/Log summary to Asana when the tab is hidden or closed. */
if(typeof window!=='undefined' && window.addEventListener){
  window.addEventListener('pagehide', function(){ try{ mirrorBeacon(); }catch(e){} });
  window.addEventListener('visibilitychange', function(){ try{ if(typeof document!=='undefined' && document.hidden) mirrorBeacon(); }catch(e){} });
}

/* ══════════════════════════════════════════
   INTRO MOTION — gauge draw-in, count-up, pop
══════════════════════════════════════════ */
function initAnimations(){
  /* Browser-only; inert under the test DOM stub (no rAF / matchMedia / MutationObserver there). */
  if(typeof requestAnimationFrame!=='function' || typeof MutationObserver!=='function'
     || typeof performance==='undefined' || typeof window.matchMedia!=='function') return;
  const scoreEl = $('totalScore'), arc = $('gaugeArc');
  if(!scoreEl || !arc) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function attachPop(){
    if(reduced) return;
    const obs = new MutationObserver(() => {
      scoreEl.classList.remove('score-pop');
      void scoreEl.offsetWidth;                 // restart animation
      scoreEl.classList.add('score-pop');
      setTimeout(() => scoreEl.classList.remove('score-pop'), 500);
    });
    obs.observe(scoreEl, {childList:true, characterData:true, subtree:true});
  }

  if(reduced){ attachPop(); return; }

  /* Draw-in: rewind to 0, then animate to the value recalc() computed. */
  const target = arc.style.strokeDasharray || arc.getAttribute('stroke-dasharray');
  const finalScore = parseInt(scoreEl.textContent, 10) || 0;
  arc.style.transition = 'none';
  arc.style.strokeDasharray = '0 600';
  scoreEl.textContent = '0';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    arc.style.transition = 'stroke-dasharray 1.1s cubic-bezier(0.3,0.7,0.2,1)';
    arc.style.strokeDasharray = target;
    const t0 = performance.now(), dur = 1000;
    function tick(now){
      const p = Math.min((now - t0)/dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      scoreEl.textContent = Math.round(eased * finalScore);
      if(p < 1){ requestAnimationFrame(tick); }
      else {
        scoreEl.textContent = String(finalScore);
        arc.style.transition = 'stroke-dasharray 0.5s cubic-bezier(0.4,0,0.2,1)';
        attachPop();
      }
    }
    requestAnimationFrame(tick);
  }));
}

/* Header lock toggle. When device encryption is configured it performs the real
   at-rest lock (secLock); otherwise it is a visual indicator, matching the
   prototype where "Lock" is cosmetic until encryption is enabled. */
function headerLock(){
  if(typeof _secActive !== 'undefined' && _secActive){ secLock(); return; }
  const btn = $('hdrLock');
  if(!btn) return;
  const locked = btn.classList.toggle('locked');
  btn.textContent = locked ? '⚿ Locked' : '⚿ Lock';
  toast(locked
    ? 'Screen locked. Enable device encryption (sidebar) for at-rest protection.'
    : 'Unlocked.');
}
function _syncHeaderLock(locked){
  const btn = $('hdrLock'); if(!btn) return;
  btn.classList.toggle('locked', !!locked);
  btn.textContent = locked ? '⚿ Locked' : '⚿ Lock';
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
$('footVer').textContent = 'v'+APP_VERSION;

/* Init order: risk data loads first so effCountry/effOf have overrides ready;
   country and activity selects must be built before initRiskDataPanel() and
   refreshSelectLabels() can enrich their <option> elements with override marks. */
riskData = loadRiskData();
buildCountrySelect();
buildActivitySelect();
buildQuestions();
buildSuppliers();
refreshSelectLabels(); /* add override marks (✱) to the now-built selects */
initRiskDataPanel();
initRegisterPanel();
initLang();

/* (Re)load persisted risk data + draft into the UI. Safe to re-run after the
   device is unlocked, when the encrypted store first becomes readable. */
function hydrateApp(){
  riskData = loadRiskData();
  refreshSelectLabels();
  paintJurisdiction();
  paintActivity();
  purgeStaleDraft();
  const draft = loadDraft();
  state = draft ? draft.state : freshState();
  syncUI();
  /* The tokenise opt-in lives in the encrypted store: while locked it reads as
     ciphertext (never '1'), so the boot-time paint can show the inverse of the
     real setting — repaint once the decrypted value is readable. */
  paintTokeniseBtn();
  return draft;
}

const draft = hydrateApp();
if(draft) toast('Draft restored'+(draft.savedAt?' — last saved '+new Date(draft.savedAt).toLocaleString():''));
initAnimations();
initSecurity();   /* gate the app behind the passphrase, if configured/offered */


/* --------------------------------------------------------------------------
   EVENT DELEGATION (CSP-safe; replaces former inline on* handlers)

   Markup declares intent declaratively:
     data-act="<key>"  + optional  data-evt="input|change"  (default click)
                        + optional  data-a1 / data-a2  (string args)
   A single bubbling listener per event type dispatches to UI_ACTIONS, so both
   static and dynamically-rendered elements are handled with one registration.
   This lets the Content-Security-Policy drop 'unsafe-inline' from script-src.
-------------------------------------------------------------------------- */
const UI_ACTIONS = {
  toggleLang, headerLock, insertNarrative, toggleOvForm, togglePrior,
  printPreflight, toggleComplete, retryAsanaDelivery, toggleAsanaTokenised, openRegister, openBatch,
  openAudit, toggleMask, sendToAsana, reassess, openRiskData, closeRiskData,
  rdToggleOvOnly, rdExportSheet, rdImportSheet, rdResetConfirm, closeRegister,
  closeBatch, downloadBatchTemplate, runBatch, exportBatchResults, closeAudit,
  exportAudit, exportAuditTokenized, mfaToggle, rcaSubmit, secBotTap, secSubmit,
  secSkip, onJurisdiction, onActivity, onOvField, rdSearchInput, regRender,
  useSuggestedReview,
  field:         (el) => onField(el.dataset.a1, el.dataset.a2, el.value),
  sign:          (el) => onSign(el.dataset.a1, el.value),
  screening:     (el) => onScreening(el.dataset.a1, el.dataset.a2, el.value),
  notes:         (el) => onNotes(el.value),
  years:         (el) => onYears(el.dataset.a1),
  toggle:        (el) => setToggle(el.dataset.a1, el.dataset.a2),
  rdTab:         (el) => rdSetTab(el.dataset.a1),
  roleChange:    (el) => onRoleChange(el.value),
  batchFile:     (el, ev) => onBatchFile(ev),
  supplier:      (el) => onSupplier(el.dataset.a1, Number(el.dataset.a2)),
  regOpen:       (el) => regOpenIdx(Number(el.dataset.a1)),
  regDelete:     (el) => regDeleteIdx(Number(el.dataset.a1)),
  dateField:     (el) => dateFieldChanged(el, (v) => onField(el.dataset.a1, el.dataset.a2, v)),
  dateSign:      (el) => dateFieldChanged(el, (v) => onSign(el.dataset.a1, v)),
  dateScreening: (el) => dateFieldChanged(el, (v) => onScreening(el.dataset.a1, el.dataset.a2, v)),
};

function _delegate(ev){
  const t = ev.target;
  const el = t && t.closest ? t.closest('[data-act]') : null;
  if(!el) return;
  if((el.dataset.evt || 'click') !== ev.type) return;
  const fn = UI_ACTIONS[el.dataset.act];
  if(typeof fn === 'function') fn(el, ev);
}

['click','input','change'].forEach((t) => document.addEventListener(t, _delegate));
