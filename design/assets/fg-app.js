

const COUNTRIES = [{"name":"Åland Islands","score":1},{"name":"Svalbard and Jan Mayen","score":1},{"name":"Tokelau","score":1},{"name":"Finland","score":1},{"name":"Faroe Islands","score":1},{"name":"Iceland","score":1},{"name":"Norway","score":1},{"name":"Denmark","score":1},{"name":"Greenland","score":1},{"name":"San Marino","score":1},{"name":"Sweden","score":1},{"name":"Estonia","score":1},{"name":"Vatican City State (Holy See)","score":1},{"name":"Lithuania","score":1},{"name":"Andorra","score":1},{"name":"Bermuda","score":1},{"name":"New Zealand","score":1},{"name":"Liechtenstein","score":1},{"name":"Christmas Island","score":1},{"name":"Cocos (Keeling) Islands","score":1},{"name":"Norfolk Island","score":1},{"name":"French Polynesia","score":1},{"name":"Mayotte","score":1},{"name":"New Caledonia","score":1},{"name":"Saint Berthélemy","score":1},{"name":"Saint Martin (French part)","score":1},{"name":"Saint Pierre and Miquelon","score":1},{"name":"Wallis and Futuna","score":1},{"name":"Brunei Darussalam","score":1},{"name":"British Indian Ocean Territory","score":1},{"name":"Falkland Islands (Malvinas)","score":1},{"name":"French Guiana","score":1},{"name":"Pitcairn","score":1},{"name":"Saint Helena, Ascension and Tristan","score":1},{"name":"Guadeloupe","score":1},{"name":"Martinique","score":1},{"name":"Réunion","score":1},{"name":"Latvia","score":1},{"name":"Portugal","score":1},{"name":"Singapore","score":1},{"name":"Bonaire, Sint Eustatius and Saba","score":1},{"name":"South Korea","score":1},{"name":"Uruguay","score":1},{"name":"Puerto Rico","score":1},{"name":"Oman","score":1},{"name":"Australia","score":1},{"name":"Guernsey","score":1},{"name":"Namibia","score":3},{"name":"Austria","score":1},{"name":"Japan","score":1},{"name":"Bhutan","score":1},{"name":"Czech Republic","score":1},{"name":"Malawi","score":2},{"name":"Mongolia","score":2},{"name":"Macau","score":1},{"name":"Isle of Man","score":1},{"name":"Belgium","score":1},{"name":"Poland","score":1},{"name":"Luxembourg","score":1},{"name":"Jersey","score":1},{"name":"Ireland","score":1},{"name":"Germany","score":1},{"name":"American Samoa","score":1},{"name":"Botswana","score":3},{"name":"France","score":1},{"name":"North Mariana Islands","score":1},{"name":"Hungary","score":2},{"name":"Mauritius","score":1},{"name":"Switzerland","score":1},{"name":"Fiji","score":2},{"name":"Malta","score":2},{"name":"Zambia","score":3},{"name":"Cook Islands","score":1},{"name":"Guam","score":1},{"name":"Georgia","score":2},{"name":"Slovakia","score":2},{"name":"Spain","score":1},{"name":"Taiwan","score":1},{"name":"Solomon Islands","score":2},{"name":"Canada","score":1},{"name":"Monaco","score":3},{"name":"Mauritania","score":2},{"name":"United States Virgin Islands","score":1},{"name":"Kuwait","score":3},{"name":"Netherlands","score":1},{"name":"Slovenia","score":1},{"name":"Gambia","score":2},{"name":"Aruba","score":2},{"name":"Marshall Islands","score":2},{"name":"Cape Verde","score":2},{"name":"Qatar","score":1},{"name":"Niue","score":2},{"name":"Rwanda","score":3},{"name":"Tonga","score":2},{"name":"Romania","score":2},{"name":"Saudi Arabia","score":1},{"name":"United Kingdom","score":1},{"name":"Greece","score":2},{"name":"Costa Rica","score":2},{"name":"Italy","score":1},{"name":"Chile","score":1},{"name":"Nauru","score":2},{"name":"Lesotho","score":2},{"name":"Montserrat","score":2},{"name":"Bulgaria","score":3},{"name":"Ghana","score":2},{"name":"Timor-Leste","score":2},{"name":"Dominican Republic","score":2},{"name":"Kazakhstan","score":2},{"name":"United States","score":1},{"name":"Anguilla","score":2},{"name":"Hong Kong","score":2},{"name":"Uzbekistan","score":2},{"name":"Antigua and Barbuda","score":2},{"name":"Grenada","score":2},{"name":"Togo","score":3},{"name":"Micronesia","score":2},{"name":"South Africa","score":2},{"name":"Sri Lanka","score":2},{"name":"Eswatini","score":3},{"name":"Maldives","score":2},{"name":"Cyprus","score":2},{"name":"Samoa","score":2},{"name":"Bahrain","score":1},{"name":"Tuvalu","score":2},{"name":"Kyrgyzstan","score":3},{"name":"Argentina","score":2},{"name":"Madagascar","score":3},{"name":"Guatemala","score":3},{"name":"Papua New Guinea","score":3},{"name":"Palau","score":2},{"name":"Suriname","score":2},{"name":"Congo (Brazzaville)","score":2},{"name":"Croatia","score":2},{"name":"St Kitts & Nevis","score":2},{"name":"Gabon","score":3},{"name":"Sao Tome & Prin.","score":2},{"name":"El Salvador","score":1},{"name":"Bangladesh","score":3},{"name":"Equatorial Guinea","score":3},{"name":"Honduras","score":3},{"name":"St Vincent & Gren","score":2},{"name":"Belize","score":2},{"name":"Kiribati","score":2},{"name":"Curacao","score":2},{"name":"Angola","score":3},{"name":"Bahamas","score":2},{"name":"Turkmenistan","score":3},{"name":"Turks & Caicos","score":2},{"name":"Paraguay","score":3},{"name":"Armenia","score":2},{"name":"Malaysia","score":2},{"name":"Moldova","score":2},{"name":"Seychelles","score":2},{"name":"Peru","score":2},{"name":"Egypt","score":2},{"name":"British Virgin Islands","score":3},{"name":"Guyana","score":2},{"name":"Sierra Leone","score":3},{"name":"St Lucia","score":2},{"name":"Algeria","score":3},{"name":"Mexico","score":3},{"name":"Bolivia","score":3},{"name":"North Macedonia","score":2},{"name":"Serbia","score":2},{"name":"Comoros","score":2},{"name":"Ethiopia","score":3},{"name":"Montenegro","score":2},{"name":"Djibouti","score":2},{"name":"Indonesia","score":2},{"name":"Benin","score":3},{"name":"Niger","score":3},{"name":"Tajikistan","score":3},{"name":"Azerbaijan","score":2},{"name":"Vietnam","score":3},{"name":"Ecuador","score":2},{"name":"Belarus","score":2},{"name":"Dominica","score":2},{"name":"India","score":2},{"name":"Nepal","score":3},{"name":"Colombia","score":3},{"name":"Cameroon","score":3},{"name":"Cote D'Ivoire","score":3},{"name":"Thailand","score":2},{"name":"Lao People's Democratic Republic","score":3},{"name":"Tunisia","score":2},{"name":"China","score":2},{"name":"Israel","score":2},{"name":"Brazil","score":2},{"name":"St Maarten","score":2},{"name":"Chad","score":3},{"name":"Gibraltar","score":2},{"name":"Bosnia-Herzegovina","score":2},{"name":"Liberia","score":3},{"name":"Cayman Islands","score":2},{"name":"Vanuatu","score":2},{"name":"Nigeria","score":3},{"name":"Trinidad & Tobago","score":2},{"name":"Guinea","score":3},{"name":"Sudan","score":3},{"name":"United Arab Emirates","score":1},{"name":"Cambodia","score":3},{"name":"Kenya","score":3},{"name":"Ukraine","score":3},{"name":"Eritrea","score":3},{"name":"Senegal","score":3},{"name":"Barbados","score":2},{"name":"Jordan","score":2},{"name":"Kosovo","score":3},{"name":"Cuba","score":3},{"name":"Jamaica","score":2},{"name":"Uganda","score":3},{"name":"Burkina Faso","score":3},{"name":"Morocco","score":2},{"name":"Western Sahara","score":2},{"name":"Guinea Bissau","score":3},{"name":"Central African Republic","score":3},{"name":"Albania","score":2},{"name":"Pakistan","score":3},{"name":"Venezuela","score":3},{"name":"West Bank (Palestinian Territory, Occupied)","score":3},{"name":"Gaza Strip","score":3},{"name":"Panama","score":2},{"name":"Zimbabwe","score":3},{"name":"Tanzania","score":2},{"name":"Lebanon","score":3},{"name":"Burundi","score":3},{"name":"Iraq","score":3},{"name":"Nicaragua","score":3},{"name":"Philippines","score":3},{"name":"Russian Federation","score":3},{"name":"Mozambique","score":3},{"name":"Turkey","score":2},{"name":"Libya","score":3},{"name":"Haiti","score":3},{"name":"South Sudan","score":3},{"name":"Somalia","score":3},{"name":"Mali","score":3},{"name":"Yemen","score":3},{"name":"The Democratic Republic Of Congo","score":3},{"name":"Syria","score":3},{"name":"Myanmar","score":3},{"name":"Afghanistan","score":3},{"name":"North Korea","score":3},{"name":"Islamic Republic of Iran","score":3}];
const RECYCLED = [{"name":"N/A","score":0},{"name":"LBMA GD Bullion/DGD Good Delivery","score":1},{"name":"Rudimentary Bars","score":2},{"name":"Gold & Silver Coins","score":1},{"name":"Industrial Waste","score":1},{"name":"Gold Jewellery","score":2},{"name":"Collected waste","score":2},{"name":"Silver/Gold Grains","score":1},{"name":"Broken jewellery","score":2},{"name":"Gold-Processing Chemicals","score":3},{"name":"Others","score":0}];
const MINED = [{"name":"N/A","score":0},{"name":"LSM Large Scale Mining","score":2},{"name":"MSM - Medium Scale Mining","score":2},{"name":"ASM - Artisanal Mining","score":3}];
const ACTIVITIES = [{"name":"Regulated Financial Entities","score":1},{"name":"Non-Manufactured Precious Metal Trading","score":3},{"name":"Mineral Processing Facility","score":3},{"name":"Mining Company","score":3},{"name":"Jewellery Trading","score":3},{"name":"Precious Metal Refinery","score":3},{"name":"Wholesalers / Pawn Shops","score":3}];
const QUESTIONS_OC = [
  {id:'aml',text:'Does the legal entity have an adequate and effective AML/CFT control environment (where applicable)?',default:'Yes',type:'vlok2'},
  {id:'sanctions_person',text:'Are any beneficial owners, controllers, directors, or senior management subject to sanctions?',default:'No',type:'vlok'},
  {id:'criminal',text:'Is the entity subject to any criminal proceedings or ongoing legal investigations?',default:'No',type:'vlok'},
  {id:'adverse',text:'Are any beneficial owners, controllers, directors, or senior management subject to adverse media or negative reputational findings?',default:'No',type:'vlok'},
  {id:'sanctions_entity',text:'Is the legal entity itself subject to any national or international sanctions?',default:'No',type:'vlok'},
  {id:'sof',text:'Are there any concerns regarding the source of funds and/or source of wealth of the beneficial owners or the legal entity (where applicable)?',default:'No',type:'vlok'},
  {id:'high_risk_ind',text:'Is the entity involved in any high-risk industries (arms, gaming, casinos)?',default:'No',type:'vlok'},
  {id:'tf',text:'Are any beneficial owner, controllers, managers connected to terrorist financing or designated terrorist organizations?',default:'No',type:'vlok'},
  {id:'pf',text:'Are any beneficial owner, controllers, managers connected to Proliferation Financing or the trade of materials or technology related to weapons of mass destruction?',default:'No',type:'vlok'},
  {id:'pep',text:'Are any beneficial owners, controllers, or senior management Politically Exposed Persons (PEPs)?',default:'No',type:'vlok'},
  {id:'gov',text:'Is the legal entity owned or controlled by a government, state authority, or public sector body?',default:'No',type:'vlok'},
];

let state = {};
function scoreFromYesNo(val,type){if(type==='vlok')return val==='Yes'?3:1;if(type==='vlok2')return val==='Yes'?1:3;if(type==='onboard')return val==='Yes'?3:1;return 1;}
function ratingLabel(s){return['No Risk','Low','Medium','High'][s]||'—';}
function ratingClass(s){return['b0','b1','b2','b3'][s]||'b0';}
function scoreTagClass(s){return['st-0','st-1','st-2','st-3'][s]||'st-0';}
function yearsToScore(y){return y<=0?3:y===1?2:1;}

function buildCountrySelect(){
  const sel=document.getElementById('jurisdictionSelect');
  const sorted=[...COUNTRIES].sort((a,b)=>a.name.localeCompare(b.name));
  sorted.forEach(c=>{const opt=document.createElement('option');opt.value=c.name;opt.textContent=c.name+' — '+['','Low ✓','Medium','High ⚠'][c.score];if(c.name==='United Kingdom')opt.selected=true;sel.appendChild(opt);});
}
function buildActivitySelect(){
  const sel=document.getElementById('activitySelect');
  ACTIVITIES.forEach(a=>{const opt=document.createElement('option');opt.value=a.name;opt.textContent=a.name+' — '+ratingLabel(a.score);if(a.name==='Non-Manufactured Precious Metal Trading')opt.selected=true;sel.appendChild(opt);});
}
function buildQuestions(){
  const container=document.getElementById('questions-oc');
  QUESTIONS_OC.forEach((q,idx)=>{
    state[q.id]=q.default;
    const score=scoreFromYesNo(q.default,q.type);
    const row=document.createElement('div'); row.className='q-row';
    const numSpan=document.createElement('span'); numSpan.className='q-num'; numSpan.textContent=String(idx+1).padStart(2,'0');
    const txtSpan=document.createElement('span'); txtSpan.className='q-text'; txtSpan.textContent=q.text;
    const controls=document.createElement('div'); controls.className='q-controls';
    const tg=document.createElement('div'); tg.className='toggle-group';
    const yBtn=document.createElement('button');
    const yActive=q.default==='Yes'?(q.type==='vlok2'?' active-yes-inv':' active-yes'):'';
    yBtn.className='toggle-btn'+yActive; yBtn.id='btn_'+q.id+'_yes'; yBtn.textContent='Yes';
    yBtn.addEventListener('click',(function(id,type){return function(){setToggle(id,'Yes',type);};})(q.id,q.type));
    const nBtn=document.createElement('button');
    const nActive=q.default==='No'?(q.type==='vlok2'?' active-no-inv':' active-no'):'';
    nBtn.className='toggle-btn'+nActive; nBtn.id='btn_'+q.id+'_no'; nBtn.textContent='No';
    nBtn.addEventListener('click',(function(id,type){return function(){setToggle(id,'No',type);};})(q.id,q.type));
    tg.appendChild(yBtn); tg.appendChild(nBtn);
    const pill=document.createElement('span'); pill.className='q-score-pill '+ratingClass(score); pill.id='pill_'+q.id; pill.textContent=score;
    controls.appendChild(tg); controls.appendChild(pill);
    row.appendChild(numSpan); row.appendChild(txtSpan); row.appendChild(controls);
    container.appendChild(row);
  });
}
function buildSuppliers(){
  buildSupplierGroup('recycled-grid',RECYCLED,'recycled',3,['Supplier 1','Supplier 2','Supplier 3'],['LBMA GD Bullion/DGD Good Delivery','N/A','N/A']);
  buildSupplierGroup('mined-grid',MINED,'mined',3,['Supplier 1','Supplier 2','Supplier 3'],['N/A','N/A','N/A']);
}
function buildSupplierGroup(containerId,options,prefix,count,labels,defaults){
  const container=document.getElementById(containerId);
  for(let i=0;i<count;i++){
    const key=prefix+'_'+i;
    state[key]=defaults[i];
    const item=document.createElement('div'); item.className='supplier-item';
    const initScore=options.find(o=>o.name===defaults[i])?.score||0;
    const lbl=document.createElement('label'); lbl.textContent=labels[i];
    const opts=options.map(o=>'<option value="'+o.name+'"'+(o.name===defaults[i]?' selected':'')+'>'+o.name+'</option>').join('');
    const sel=document.createElement('select'); sel.id='sel_'+key; sel.innerHTML=opts;
    sel.addEventListener('change',(function(k,p){return function(){onSupplier(k,p);};})(key,prefix));
    const scoreSpan=document.createElement('span'); scoreSpan.id='sup_score_'+key; scoreSpan.className='sup-score '+ratingClass(initScore); scoreSpan.textContent=ratingLabel(initScore)+' ('+initScore+')';
    item.appendChild(lbl); item.appendChild(sel); item.appendChild(scoreSpan);
    container.appendChild(item);
  }
}
function onJurisdiction(){
  const sel=document.getElementById('jurisdictionSelect');
  const country=COUNTRIES.find(c=>c.name===sel.value);
  const score=country?country.score:1;
  state.jurisdiction=sel.value;state.jurisdiction_score=score;
  const tag=document.getElementById('jurisdictionScore');
  tag.className='score-tag '+scoreTagClass(score);tag.textContent='Score: '+score+' · '+ratingLabel(score);
  recalc();
}
function onActivity(){
  const sel=document.getElementById('activitySelect');
  const act=ACTIVITIES.find(a=>a.name===sel.value);
  const score=act?act.score:1;
  state.activity=sel.value;state.activity_score=score;
  const tag=document.getElementById('activityScore');
  tag.className='score-tag '+scoreTagClass(score);tag.textContent='Score: '+score+' · '+ratingLabel(score);
  recalc();
}
function setToggle(id,val,type){
  state[id]=val;
  const score=type?scoreFromYesNo(val,type):scoreFromYesNo(val,'vlok');
  const yBtn=document.getElementById('btn_'+id+'_yes');
  const nBtn=document.getElementById('btn_'+id+'_no');
  if(yBtn&&nBtn){
    yBtn.className='toggle-btn';nBtn.className='toggle-btn';
    if(val==='Yes'){if(type==='vlok2')yBtn.className+=' active-yes-inv';else yBtn.className+=' active-yes';}
    else{if(type==='vlok2')nBtn.className+=' active-no-inv';else nBtn.className+=' active-no';}
  }
  const pill=document.getElementById('pill_'+id);
  if(pill){pill.className='q-score-pill '+ratingClass(score);pill.textContent=score;}
  const tag=document.getElementById(id+'_score_tag');
  if(tag){tag.className='score-tag '+scoreTagClass(score);tag.textContent='Score: '+score+' · '+ratingLabel(score);}
  if(id==='onboard'){state.onboard_score=score;const st=document.getElementById('onboard_score_tag');if(st){st.className='score-tag '+scoreTagClass(score);st.textContent='Score: '+score+' · '+ratingLabel(score);}}
  recalc();
}
function onYears(which){
  const inp=document.getElementById(which==='entity'?'entityYearsInput':'relYearsInput');
  const y=parseInt(inp.value)||0;const score=yearsToScore(y);
  const tagId=which==='entity'?'entityYearsScore':'relYearsScore';
  const tag=document.getElementById(tagId);tag.className='score-tag '+scoreTagClass(score);tag.textContent='Score: '+score+' · '+ratingLabel(score);
  state[which+'_years']=y;state[which+'_years_score']=score;recalc();
}
function onSupplier(key,prefix){
  const sel=document.getElementById('sel_'+key);
  const arr=prefix==='recycled'?RECYCLED:MINED;
  const item=arr.find(o=>o.name===sel.value);const score=item?item.score:0;
  state[key]=sel.value;state[key+'_score']=score;
  const scoreEl=document.getElementById('sup_score_'+key);
  if(scoreEl){scoreEl.className='sup-score '+ratingClass(score);scoreEl.textContent=ratingLabel(score)+' ('+score+')';}
  recalc();
}

function recalc(){
  const parts=[];
  const jSel=document.getElementById('jurisdictionSelect');
  const jC=COUNTRIES.find(c=>c.name===jSel.value);const jScore=jC?jC.score:1;
  parts.push({label:'Jurisdiction',value:jSel.value,score:jScore});
  const aSel=document.getElementById('activitySelect');
  const aAct=ACTIVITIES.find(a=>a.name===aSel.value);const aScore=aAct?aAct.score:1;
  parts.push({label:'Business activity',value:aSel.value,score:aScore});
  QUESTIONS_OC.forEach(q=>{const val=state[q.id]||q.default;const sc=scoreFromYesNo(val,q.type);parts.push({label:q.text.substring(0,62)+'…',value:val,score:sc});});
  const ob=state.onboard||'No';const obScore=scoreFromYesNo(ob,'onboard');
  parts.push({label:'Onboarding channel',value:ob==='Yes'?'Remote':'In-Person',score:obScore});
  const ey=parseInt(document.getElementById('entityYearsInput').value)||0;const eyScore=yearsToScore(ey);
  parts.push({label:'Operational history',value:ey+' years',score:eyScore});
  const ry=parseInt(document.getElementById('relYearsInput').value)||0;const ryScore=yearsToScore(ry);
  parts.push({label:'Relationship duration',value:ry+' years',score:ryScore});
  for(let i=0;i<3;i++){const k='recycled_'+i;const sel=document.getElementById('sel_'+k);if(!sel)continue;const item=RECYCLED.find(o=>o.name===sel.value);const sc=item?item.score:0;parts.push({label:'Recycled Source S'+(i+1),value:sel.value,score:sc});}
  for(let i=0;i<3;i++){const k='mined_'+i;const sel=document.getElementById('sel_'+k);if(!sel)continue;const item=MINED.find(o=>o.name===sel.value);const sc=item?item.score:0;parts.push({label:'Mined Source S'+(i+1),value:sel.value,score:sc});}
  const total=parts.reduce((s,p)=>s+p.score,0);
  document.getElementById('totalScore').textContent=total;
  const vpEl=document.getElementById('verdictPill');const vtEl=document.getElementById('verdictText');
  const tcL=document.getElementById('tc-low');const tcM=document.getElementById('tc-med');const tcH=document.getElementById('tc-high');
  [tcL,tcM,tcH].forEach(el=>el.classList.remove('tc-active'));
  const si=document.getElementById('scoreIndicator');
  if(total<=19){vpEl.className='verdict-pill vp-cdd';vtEl.textContent='CDD — Customer Due Diligence';tcL.classList.add('tc-active');if(si)si.style.background='var(--cdd-text)';}
  else if(total<=22){vpEl.className='verdict-pill vp-sdd';vtEl.textContent='SDD — Simplified Due Diligence';tcM.classList.add('tc-active');if(si)si.style.background='var(--sdd-text)';}
  else{vpEl.className='verdict-pill vp-edd';vtEl.textContent='EDD — Enhanced Due Diligence';tcH.classList.add('tc-active');if(si)si.style.background='var(--high-text)';}
  const ga=document.getElementById('gaugeArc');if(ga){const al=Math.min(total/30,1)*339;ga.style.strokeDasharray=al+' 452';}
  const warn=document.getElementById('boundaryWarn');warn.style.display=total===19?'block':'none';
  const pct=Math.min(total/30*100,100);const ptr=document.getElementById('barPointer');ptr.style.left=pct+'%';
  document.getElementById('pointerLabel').textContent=total;
  const tbl=document.getElementById('bdTable');
  tbl.innerHTML=parts.map(p=>'<tr><td style="color:var(--text2);font-size:11px;max-width:360px;word-wrap:break-word">'+p.label+'</td><td style="color:var(--text3);font-size:11px;padding-left:8px">'+p.value+'</td><td><span class="badge '+ratingClass(p.score)+'">'+p.score+' · '+ratingLabel(p.score)+'</span></td></tr>').join('')
    +'<tr style="border-top:1px solid var(--border2)"><td colspan="2" style="font-weight:600;font-size:12px;padding-top:6px">TOTAL</td><td style="padding-top:6px"><span class="badge '+(total<=19?'b1':total<=22?'b2':'b3')+'" style="font-size:12px">'+total+'</span></td></tr>';
}

function toggleBreakdown(){
  const p=document.getElementById('breakdownPanel');const a=document.getElementById('bdArrow');
  p.classList.toggle('open');a.textContent=p.classList.contains('open')?'▼':'▶';
}

function resetForm(){
  document.getElementById('entityName').value='XXXX';
  const jsel=document.getElementById('jurisdictionSelect');for(let o of jsel.options){if(o.value==='United Kingdom'){o.selected=true;break;}}onJurisdiction();
  const asel=document.getElementById('activitySelect');for(let o of asel.options){if(o.value==='Non-Manufactured Precious Metal Trading'){o.selected=true;break;}}onActivity();
  QUESTIONS_OC.forEach(q=>setToggle(q.id,q.default,q.type));
  setToggle('onboard','No','onboard');
  document.getElementById('entityYearsInput').value=2;document.getElementById('relYearsInput').value=2;
  onYears('entity');onYears('rel');
  const rDefs=['LBMA GD Bullion/DGD Good Delivery','N/A','N/A'];
  for(let i=0;i<3;i++){const sel=document.getElementById('sel_recycled_'+i);if(sel){for(let o of sel.options){if(o.value===rDefs[i]){o.selected=true;break;}}onSupplier('recycled_'+i,'recycled');}}
  for(let i=0;i<3;i++){const sel=document.getElementById('sel_mined_'+i);if(sel){for(let o of sel.options){if(o.value==='N/A'){o.selected=true;break;}}onSupplier('mined_'+i,'mined');}}
}

/* ── AUDIT / ADMIN FUNCTIONS ── */
function generateRef(){const yr=new Date().getFullYear();const n=Math.floor(1000+Math.random()*9000);return 'HS-'+yr+'-'+n;}
function formatDate(s){if(!s)return '';const d=new Date(s+'T00:00:00');return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}

function onRefChange(){
  const ref=document.getElementById('refNumber').value||'—';
  document.getElementById('docRef').textContent='Ref: '+ref;
  const footer=document.getElementById('printFooter');if(footer)footer.textContent='CONFIDENTIAL — Hawkeye Sterling LLC — AML/CFT Entity Risk Assessment — Ref: '+ref+' — DPMS Template';
  saveLS();
}
function onDateChange(){
  const val=document.getElementById('assessmentDate').value;
  const p=val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  let display='—';
  if(p){const dt=new Date(parseInt(p[3]),parseInt(p[2])-1,parseInt(p[1]));if(!isNaN(dt.getTime()))display=dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
  document.getElementById('docDate').textContent=display;
  saveLS();
}

let isComplete=false;
function toggleComplete(){
  isComplete=!isComplete;
  const badge=document.getElementById('statusBadge');const btn=document.getElementById('btnComplete');
  if(isComplete){badge.className='status-badge s-complete';badge.textContent='Complete';btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Mark as Draft';}
  else{badge.className='status-badge s-draft';badge.textContent='Draft';btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Complete Assessment';}
}

function printReport(){saveLS();location.href='Hawkeye Sterling - Risk Report.html';}

function saveLS(){
  try{
    const d={
      ref:document.getElementById('refNumber').value,
      assessDate:document.getElementById('assessmentDate').value,
      nextReview:document.getElementById('nextReviewDate').value,
      assessor:document.getElementById('assessorName').value,
      role:document.getElementById('assessorRole').value,
      entityName:document.getElementById('entityName').value,
      jurisdiction:document.getElementById('jurisdictionSelect')?.value||'',
      jurisdictionScore:String(state.jurisdiction_score||1),
      activity:document.getElementById('activitySelect')?.value||'',
      activityScore:String(state.activity_score||1),
      onboard:state.onboard||'No',
      onboardScore:String(state.onboard_score||1),
      entityYears:document.getElementById('entityYearsInput')?.value||'2',
      entityYearsScore:String(state.entity_years_score||1),
      relYears:document.getElementById('relYearsInput')?.value||'2',
      relYearsScore:String(state.rel_years_score||1),
      totalScore:document.getElementById('totalScore')?.textContent||'0',
      verdict:document.getElementById('verdictText')?.textContent||'',
      notes:document.getElementById('assessmentNotes').value,
      sAssessor:document.getElementById('s_assessorName').value,
      sTitle:document.getElementById('s_assessorTitle').value,
      sAssessorDate:document.getElementById('s_assessorDate')?.value||'',
      sReviewer:document.getElementById('s_reviewerName').value,
      sRevTitle:document.getElementById('s_reviewerTitle').value,
      sReviewerDate:document.getElementById('s_reviewerDate')?.value||''
    };
    QUESTIONS_OC.forEach(q=>{d['q_'+q.id]=state[q.id]||q.default;d['q_'+q.id+'_score']=String(scoreFromYesNo(state[q.id]||q.default,q.type));});
    for(let i=0;i<3;i++){
      const rs=document.getElementById('sel_recycled_'+i);
      const ms=document.getElementById('sel_mined_'+i);
      d['r'+i]=rs?rs.value:'N/A';d['r'+i+'_score']=rs?String((RECYCLED.find(o=>o.name===rs.value)||{score:0}).score):'0';
      d['m'+i]=ms?ms.value:'N/A';d['m'+i+'_score']=ms?String((MINED.find(o=>o.name===ms.value)||{score:0}).score):'0';
    }
    localStorage.setItem('fg_ra_v2',JSON.stringify(d));
    localStorage.setItem('fg_ra_v1',JSON.stringify({ref:d.ref,assessor:d.assessor,role:d.role,notes:d.notes,sAssessor:d.sAssessor,sTitle:d.sTitle,sReviewer:d.sReviewer,sRevTitle:d.sRevTitle}));
  }catch(e){}
}
function loadLS(){
  try{
    const raw=localStorage.getItem('fg_ra_v1');if(!raw)return;const d=JSON.parse(raw);
    if(d.ref){document.getElementById('refNumber').value=d.ref;onRefChange();}
    if(d.assessor)document.getElementById('assessorName').value=d.assessor;
    if(d.role)document.getElementById('assessorRole').value=d.role;
    if(d.notes)document.getElementById('assessmentNotes').value=d.notes;
    if(d.sAssessor)document.getElementById('s_assessorName').value=d.sAssessor;
    if(d.sTitle)document.getElementById('s_assessorTitle').value=d.sTitle;
    if(d.sReviewer)document.getElementById('s_reviewerName').value=d.sReviewer;
    if(d.sRevTitle)document.getElementById('s_reviewerTitle').value=d.sRevTitle;
  }catch(e){}
}

/* ── INIT ── */
buildCountrySelect();buildActivitySelect();buildQuestions();buildSuppliers();
state.jurisdiction_score=COUNTRIES.find(c=>c.name==='United Kingdom')?.score||1;
state.activity_score=3;state.onboard='No';state.onboard_score=1;
state.entity_years=2;state.entity_years_score=1;state.rel_years=2;state.rel_years_score=1;

// Set ref & dates
const savedRef=localStorage.getItem('fg_ra_v1');
if(!savedRef){const ref=generateRef();document.getElementById('refNumber').value=ref;onRefChange();}
else{loadLS();}
function fmtDMY(d){return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}
const today=new Date();
document.getElementById('assessmentDate').value=fmtDMY(today);onDateChange();
document.getElementById('s_assessorDate').value=fmtDMY(today);
const nrd=new Date();nrd.setMonth(nrd.getMonth()+12);
document.getElementById('nextReviewDate').value=fmtDMY(nrd);

recalc();
