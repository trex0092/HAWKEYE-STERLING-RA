/* Approved Asana destinations. Never infer a project/section from its list order.
   A missing or renamed destination is an error, not permission to create a new
   section or to silently file screening results under document follow-ups. */
export const MONITORING_PROJECT = '1216203370612914';
export const CUSTOMER_PROJECT = '1214107620220121';
export const EMPLOYEE_PROJECT = '1216239131596624';
export const PAYMENTS_PROJECT = '1219097497649688'; // Payments Register — payment-screening INPUT (read-only), never a results destination
export const SECTIONS = Object.freeze({
  documents: Object.freeze({ gid: '1218451243658328', name: 'Follow Ups' }),
  sanctions: Object.freeze({ gid: '1218451960830318', name: 'Screening Sanctions Update' }),
  regulatory: Object.freeze({ gid: '1218451992088222', name: 'Regulatory Changes' }),
  media: Object.freeze({ gid: '1218979441933783', name: 'Screening Adverse Media & PEP\u2019s Update' })
});

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
