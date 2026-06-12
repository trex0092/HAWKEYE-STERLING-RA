// Hawkeye Sterling — Risk Report: fills the report from the form's autosaved state.
(function () {
  var QUESTIONS = [
    { id: 'aml', text: 'Does the legal entity have an adequate and effective AML/CFT control environment (where applicable)?' },
    { id: 'sanctions_person', text: 'Are any beneficial owners, controllers, directors, or senior management subject to sanctions?' },
    { id: 'criminal', text: 'Is the entity subject to any criminal proceedings or ongoing legal investigations?' },
    { id: 'adverse', text: 'Are any beneficial owners, controllers, directors, or senior management subject to adverse media or negative reputational findings?' },
    { id: 'sanctions_entity', text: 'Is the legal entity itself subject to any national or international sanctions?' },
    { id: 'sof', text: 'Are there any concerns regarding the source of funds and/or source of wealth of the beneficial owners or the legal entity (where applicable)?' },
    { id: 'high_risk_ind', text: 'Is the entity involved in any high-risk industries (arms, gaming, casinos)?' },
    { id: 'tf', text: 'Are any beneficial owner, controllers, managers connected to terrorist financing or designated terrorist organizations?' },
    { id: 'pf', text: 'Are any beneficial owner, controllers, managers connected to Proliferation Financing or the trade of materials or technology related to weapons of mass destruction?' },
    { id: 'pep', text: 'Are any beneficial owners, controllers, or senior management Politically Exposed Persons (PEPs)?' },
    { id: 'gov', text: 'Is the legal entity owned or controlled by a government, state authority, or public sector body?' }
  ];
  var RATING = ['No Risk', 'Low', 'Medium', 'High'];

  var d = {};
  try { d = JSON.parse(localStorage.getItem('fg_ra_v2') || '{}'); } catch (e) {}

  function txt(id, val) { var el = document.getElementById(id); if (el) el.textContent = (val && String(val).trim()) ? val : '—'; }
  function chip(score) {
    var s = parseInt(score, 10); if (isNaN(s)) return '';
    return '<span class="chip c' + s + '">' + s + ' · ' + (RATING[s] || '') + '</span>';
  }
  function setChip(id, score) { var el = document.getElementById(id); if (el) el.innerHTML = chip(score); }

  txt('rRef', d.ref); txt('rDate', d.assessDate); txt('rNext', d.nextReview);
  txt('rAssessor', d.assessor); txt('rRole', d.role);
  txt('rEntity', d.entityName);
  txt('rJur', d.jurisdiction); setChip('rJurS', d.jurisdictionScore);
  txt('rAct', d.activity); setChip('rActS', d.activityScore);
  txt('rOnb', d.onboard === 'Yes' ? 'Remote / Non-F2F' : 'In-Person'); setChip('rOnbS', d.onboardScore);
  txt('rEY', (d.entityYears || '—') + ' years in operation'); setChip('rEYS', d.entityYearsScore);
  txt('rRY', (d.relYears || '—') + ' years with entity'); setChip('rRYS', d.relYearsScore);

  // Score + verdict
  var total = parseInt(d.totalScore, 10);
  txt('rScore', isNaN(total) ? '—' : String(total));
  var verdict = d.verdict || '';
  var vEl = document.getElementById('rVerdict');
  if (vEl) {
    vEl.textContent = verdict || '—';
    var cls = 'v-cdd', on = 'thL';
    if (!isNaN(total)) {
      if (total >= 23) { cls = 'v-edd'; on = 'thH'; }
      else if (total >= 20) { cls = 'v-sdd'; on = 'thM'; }
    }
    vEl.classList.add(cls);
    var th = document.getElementById(on); if (th) th.classList.add('on');
  }

  // Questions
  var qBody = document.getElementById('rQuestions');
  if (qBody) {
    qBody.innerHTML = QUESTIONS.map(function (q, i) {
      var ans = d['q_' + q.id] || '—';
      var sc = d['q_' + q.id + '_score'];
      return '<tr><td class="k">' + String(i + 1).padStart(2, '0') + '</td><td class="q">' + q.text +
        '</td><td class="a">' + ans + '</td><td class="s">' + chip(sc) + '</td></tr>';
    }).join('');
  }

  // Suppliers
  var sBody = document.getElementById('rSuppliers');
  if (sBody) {
    var rows = '';
    for (var i = 0; i < 3; i++) {
      var rv = d['r' + i]; if (rv && rv !== 'N/A') rows += '<tr><td class="k">Recycled — Supplier ' + (i + 1) + '</td><td class="v">' + rv + '</td><td class="s">' + chip(d['r' + i + '_score']) + '</td></tr>';
    }
    for (var j = 0; j < 3; j++) {
      var mv = d['m' + j]; if (mv && mv !== 'N/A') rows += '<tr><td class="k">Mined — Supplier ' + (j + 1) + '</td><td class="v">' + mv + '</td><td class="s">' + chip(d['m' + j + '_score']) + '</td></tr>';
    }
    sBody.innerHTML = rows || '<tr><td class="k">Material sources</td><td class="v">None declared</td><td class="s"></td></tr>';
  }

  // Notes
  var nEl = document.getElementById('rNotes');
  if (nEl) {
    if (d.notes && d.notes.trim()) { nEl.textContent = d.notes; }
    else { nEl.innerHTML = '<span class="notes-empty">No additional notes recorded.</span>'; }
  }

  // Sign-off
  txt('sName1', d.sAssessor); txt('sTitle1', d.sTitle); txt('sDate1', d.sAssessorDate);
  txt('sName2', d.sReviewer); txt('sTitle2', d.sRevTitle); txt('sDate2', d.sReviewerDate);

  var f = document.getElementById('rFoot');
  if (f && d.ref) f.textContent = 'CONFIDENTIAL — Hawkeye Sterling LLC — AML/CFT Entity Risk Assessment — Ref: ' + d.ref + ' — DPMS Template';
})();
