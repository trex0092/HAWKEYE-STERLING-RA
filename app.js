/*
  Performance patch: avoid rebuilding huge nested HTML strings for the risk-data
  and batch tables. Large `innerHTML` blocks force the browser to reparse and
  reflow a lot of DOM on every keystroke. Creating nodes directly keeps the
  update path cheaper and avoids the churn that made the risk-data panel slow on
  larger lists.
*/
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

  const fragment = document.createDocumentFragment();
  let shown = 0;
  for(const b of list){
    const o = rdOv(rdTab, b.name);
    if(rdShowOvOnly && !o) continue;
    if(q && b.name.toLowerCase().indexOf(q)===-1) continue;
    shown++;
    const eff = o ? o.score : b.score;
    const effCfa = o ? !!o.cfa : !!b.cfa;

    const row = document.createElement('div');
    row.className = 'rd-row' + (o ? ' rd-ov' : '');
    row.setAttribute('data-kind', rdTab);
    row.setAttribute('data-name', b.name);

    const nameWrap = document.createElement('span');
    nameWrap.className = 'rd-name';
    if(o){
      const ovMark = document.createElement('span');
      ovMark.className = 'ov-mark';
      ovMark.textContent = '✱';
      nameWrap.appendChild(ovMark);
      nameWrap.appendChild(document.createTextNode(' '));
    }
    nameWrap.appendChild(document.createTextNode(b.name));
    row.appendChild(nameWrap);

    const base = document.createElement('span');
    base.className = 'rd-base';
    base.title = 'Baseline';
    base.textContent = 'base ' + b.score + (rdTab==='countries' && b.cfa ? ' · CFA' : '');
    row.appendChild(base);

    const select = document.createElement('select');
    select.className = 'rd-score';
    for(let sc=def.min; sc<=3; sc++){
      const opt = document.createElement('option');
      opt.value = String(sc);
      opt.textContent = String(sc);
      if(sc===eff) opt.selected = true;
      select.appendChild(opt);
    }
    row.appendChild(select);

    if(rdTab==='countries'){
      const cfaWrap = document.createElement('label');
      cfaWrap.className = 'rd-cfa';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'rd-cfa-box';
      box.checked = effCfa;
      cfaWrap.appendChild(box);
      cfaWrap.appendChild(document.createTextNode('CFA'));
      row.appendChild(cfaWrap);
    }

    const reason = document.createElement('input');
    reason.className = 'rd-reason';
    reason.placeholder = 'Reason (required)';
    reason.value = o ? (o.reason || '') : '';
    row.appendChild(reason);

    const when = document.createElement('span');
    when.className = 'rd-at';
    when.textContent = o ? (fmtDate(o.at) || o.at || '') : '';
    row.appendChild(when);

    const clear = document.createElement('button');
    clear.className = 'rd-clear' + (o ? '' : ' invisible');
    clear.title = 'Clear override — restore baseline';
    clear.setAttribute('aria-label', 'Clear override for ' + b.name);
    clear.textContent = '✕';
    row.appendChild(clear);

    fragment.appendChild(row);
  }

  rows.innerHTML = '';
  if(!shown){
    const empty = document.createElement('div');
    empty.className = 'rd-empty';
    empty.textContent = 'No matches' + (rdShowOvOnly ? ' — no overrides on this tab' : '') + '.';
    rows.appendChild(empty);
  } else {
    rows.appendChild(fragment);
  }

  const c = $('rdCountLbl');
  if(c) c.textContent = rdCount() + ' override' + (rdCount()===1?'':'s');
  const m = $('rdMeta');
  if(m) m.textContent = riskData.updatedAt ? 'Sheet updated ' + (fmtDate(riskData.updatedAt) || riskData.updatedAt) : '';
}

function renderBatchResults(results){
  const box = $('batchRows');
  if(!box) return;
  const items = results || [];
  if(!items.length){
    box.innerHTML = '<div class="rd-empty">No rows scored — add a header row and at least one entity.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  const head = document.createElement('div');
  head.className = 'batch-row batch-head';
  [
    ['batch-name', 'Entity'],
    ['batch-jur', 'Jurisdiction'],
    ['', 'Outcome'],
    ['batch-note', 'Notes / escalations']
  ].forEach(([cls, label]) => {
    const span = document.createElement('span');
    if(cls) span.className = cls;
    span.textContent = label;
    head.appendChild(span);
  });
  fragment.appendChild(head);

  items.forEach(r => {
    const row = document.createElement('div');
    row.className = 'batch-row';

    const name = document.createElement('span');
    name.className = 'batch-name';
    name.textContent = r.name || '—';
    row.appendChild(name);

    const jur = document.createElement('span');
    jur.className = 'batch-jur';
    jur.textContent = r.jurisdiction || '—';
    row.appendChild(jur);

    const outcome = document.createElement('span');
    outcome.className = 'reg-chip ' + batchOutcomeClass(r.prohibited ? 'PROHIBITED' : r.outcome);
    outcome.textContent = r.prohibited ? 'PROHIBITED' : (r.outcome + ' · ' + r.total);
    row.appendChild(outcome);

    const note = document.createElement('span');
    note.className = 'batch-note';
    const noteText = (r.escalations || []).concat(r.notes || []).join('; ');
    note.textContent = noteText;
    row.appendChild(note);

    fragment.appendChild(row);
  });

  box.innerHTML = '';
  box.appendChild(fragment);
}

function regRender(){
  const rows = $('regRows');
  if(!rows) return;
  const items = regAll();
  const q = (($('regSearch') && $('regSearch').value) || '').toLowerCase();
  const fv = (($('regReviewFilter') && $('regReviewFilter').value) || 'all');
  const refs = Object.keys(items).sort((x,y)=>String(items[y].savedAt||'').localeCompare(String(items[x].savedAt||'')));
  regView = [];
  const today = todayISO(), soon = addDays(today, 30);
  const fragment = document.createDocumentFragment();

  refs.forEach(ref => {
    const it = items[ref] || {}, sm = it.summary || {};
    if(q && (ref+' '+(sm.entity||'')).toLowerCase().indexOf(q)===-1) return;
    const rs = reviewStatus(sm, today, soon);
    if(fv==='due' && !(rs==='overdue' || rs==='soon')) return;
    if(fv==='overdue' && rs!=='overdue') return;
    if(fv==='soon' && rs!=='soon') return;
    const i = regView.push(ref) - 1;
    const band = {CDD:'reg-cdd', SDD:'reg-sdd', EDD:'reg-edd', PROHIBITED:'reg-proh'}[sm.outcome] || 'reg-st-draft';
    const result = sm.outcome==='PROHIBITED' ? 'PROHIBITED' : (sm.outcome||'?') + ' · ' + (isNaN(parseInt(sm.total)) ? '?' : sm.total);
    let review = '', revCls = '';
    if(rs==='prohibited'){ review = 'no review — prohibited'; }
    else if(rs==='overdue'){ review = 'REVIEW OVERDUE — ' + fmtDate(sm.nextReview); revCls = ' reg-over'; }
    else if(rs==='soon'){ review = 'review ' + fmtDate(sm.nextReview); revCls = ' reg-soon'; }
    else if(rs==='scheduled'){ review = 'review ' + fmtDate(sm.nextReview); }

    const row = document.createElement('div');
    row.className = 'reg-row' + (state.meta.ref===ref ? ' reg-cur' : '');

    const refEl = document.createElement('span');
    refEl.className = 'reg-ref';
    refEl.textContent = ref + (state.meta.ref===ref ? ' ✱' : '');
    row.appendChild(refEl);

    const nameEl = document.createElement('span');
    nameEl.className = 'reg-name';
    nameEl.textContent = sm.entity || '';
    row.appendChild(nameEl);

    const chip1 = document.createElement('span');
    chip1.className = 'reg-chip ' + band;
    chip1.textContent = result;
    row.appendChild(chip1);

    const chip2 = document.createElement('span');
    chip2.className = 'reg-chip ' + (sm.complete ? 'reg-st-done' : 'reg-st-draft');
    chip2.textContent = sm.complete ? 'COMPLETE' : 'DRAFT';
    row.appendChild(chip2);

    const as = asanaStatus(ref, sm.complete);
    if(as){
      const chip3 = document.createElement('span');
      chip3.className = 'reg-chip ' + as.cls;
      chip3.title = as.title;
      chip3.textContent = as.txt;
      row.appendChild(chip3);
    }

    const reviewEl = document.createElement('span');
    reviewEl.className = 'reg-review' + revCls;
    reviewEl.textContent = review;
    row.appendChild(reviewEl);

    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-blue btn-mini';
    openBtn.dataset.act = 'regOpen';
    openBtn.dataset.a1 = String(i);
    openBtn.setAttribute('aria-label', 'Open ' + ref);
    openBtn.textContent = 'Open';
    row.appendChild(openBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-red btn-mini';
    delBtn.dataset.act = 'regDelete';
    delBtn.dataset.a1 = String(i);
    delBtn.setAttribute('aria-label', 'Remove ' + ref + ' from register');
    delBtn.textContent = 'Delete';
    row.appendChild(delBtn);

    fragment.appendChild(row);
  });

  rows.innerHTML = '';
  if(!fragment.childNodes.length){
    const empty = document.createElement('div');
    empty.className = 'rd-empty';
    empty.textContent = refs.length ? 'No matches.' : 'Nothing filed yet — an assessment files itself once the entity has a legal name.';
    rows.appendChild(empty);
  } else {
    rows.appendChild(fragment);
  }

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

function batchCsvCell(v){
  v = String(v==null?'':v);
  /* A leading = + - @ tab or CR executes as a formula when the export is opened
     in Excel/Sheets (CSV injection) — neutralised with a literal apostrophe.
     The app's own numeric cells (Score) are non-negative, so they never match. */
  if(/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
}
