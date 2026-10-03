/* Approved Asana destinations. Never infer a project/section from its list order.
   A missing or renamed destination is an error, not permission to create a new
   section or to silently file screening results under document follow-ups. */
export const MONITORING_PROJECT = '1216203370612914';
export const CUSTOMER_PROJECT = '1214107620220121';
export const EMPLOYEE_PROJECT = '1216239131596624';
/* "Transaction Monitoring" section of HAWKEYE STERLING APP (renamed from
   "Payments Register"; same gid): one task per payment, read by the daily run.
   Deliberately NOT in SECTIONS, so requireApprovedSection refuses it to every
   JS notifier. The ONLY card filed there is the engine's own daily Transaction
   Monitoring report (screen.py post_tm_report), which the payment reader skips
   by its title prefix (payment_screen.TM_REPORT_PREFIX). */
export const PAYMENTS_SECTION = '1219097494676108';
export const SECTIONS = Object.freeze({
  documents: Object.freeze({ gid: '1218451243658328', name: 'Follow Ups' }),
  sanctions: Object.freeze({ gid: '1218451960830318', name: 'Screening Sanctions Update' }),
  regulatory: Object.freeze({ gid: '1218451992088222', name: 'Regulatory Changes' }),
  media: Object.freeze({ gid: '1218979441933783', name: 'Screening Adverse Media & PEP\u2019s Update' }),
  /* AI / Advisor governance reports and platform-health alerts (a control that
     cannot verify itself, a site or function down, a workflow that cannot
     recover). Registered 2026-10-03 against the live project, where the
     section exists under this gid. Before that the earlier gids of this
     section (1216782693874840, 1218785568483509) had been deleted, so these
     cards were pinned to "Regulatory Changes" and buried among law changes. */
  governance: Object.freeze({ gid: '1218985347982681', name: 'AI & Platform Governance' })
});

/* Where a platform alert (scripts/asana-alert.mjs) is filed, by its title.
   Document follow-ups, screening findings and law/list changes keep their own
   sections; everything else is platform health. */
export function alertSection(title) {
  const s = String(title || '').toLowerCase();
  if (/passport|emirates id|\beid\b|licen[cs]e|pending document|proof of address/.test(s)) return SECTIONS.documents.gid;
  if (/adverse media|\bpep\b/.test(s)) return SECTIONS.media.gid;
  if (/sanction|screening assurance/.test(s)) return SECTIONS.sanctions.gid;
  if (/\beocn\b|regulat|fatf list|circular/.test(s)) return SECTIONS.regulatory.gid;
  return SECTIONS.governance.gid;
}

function normalizedName(value) {
  return String(value || '').normalize('NFKC').replace(/[\u2018\u2019]/g, "'").trim().toLowerCase();
}

export function approvedSectionByName(name) {
  const normalized = normalizedName(name);
  return Object.values(SECTIONS).find(section => normalizedName(section.name) === normalized) || null;
}

export function approvedSectionByGid(gid) {
  return Object.values(SECTIONS).find(section => section.gid === String(gid || '')) || null;
}

export function requireApprovedSection(project, section) {
  if (String(project) === MONITORING_PROJECT && !approvedSectionByGid(section)) {
    throw new Error('Asana routing: an explicit approved section is required for the monitoring project. Received ' + String(section || '(none)'));
  }
  return section;
}

export async function verifySection(asana, project, section) {
  requireApprovedSection(project, section);
  if (!section) throw new Error('Asana routing: section is missing');
  const response = await asana('/sections/' + encodeURIComponent(section) + '?opt_fields=name,project.gid');
  const actual = response && response.data;
  if (!actual || !actual.project || String(actual.project.gid) !== String(project)) {
    throw new Error('Asana routing: section ' + section + ' does not belong to project ' + project);
  }
  const expected = String(project) === MONITORING_PROJECT ? approvedSectionByGid(section) : null;
  if (expected && normalizedName(actual.name) !== normalizedName(expected.name)) {
    throw new Error('Asana routing: section ' + section + ' was renamed; expected ' + expected.name);
  }
  return section;
}

/* Classification uses the engine's structured list labels, never the subject's
   name or free-form narrative. A mixed investigation retains its sanctions
   priority; each domain's report must still show its own evidence. */
export function findingDomain(list) {
  const name = String(list || '').trim();
  if (!name) throw new Error('Asana routing: a finding has no source list');
  return /^(?:adverse media|pep(?:\s|\()|interpol|fbi)/i.test(name) ? 'media' : 'sanctions';
}

export function subjectDomains(subject = {}) {
  const hits = Array.isArray(subject.hits) ? subject.hits.filter(hit => hit && hit.list) : [];
  const names = hits.length ? hits.map(hit => hit.list) : (Array.isArray(subject.lists) ? subject.lists : []);
  const domains = [...new Set(names.map(findingDomain))];
  if (!domains.length && subject.recommendation === 'sanctions-match') domains.push('sanctions');
  if (!domains.length) throw new Error('Asana routing: cannot classify a case without structured source evidence');
  return domains;
}

export function caseSection(subject) {
  const domains = subjectDomains(subject);
  return SECTIONS[domains.includes('sanctions') ? 'sanctions' : 'media'].gid;
}
