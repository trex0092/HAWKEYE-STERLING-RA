/* Screening intelligence helpers, implemented natively for HAWKEYE.

   Design references (architecture/ideas only, no copied code or third-party data):
   1 OpenSanctions  -> provenance completeness
   2 yente          -> query-by-example screening profile
   3 nomenklatura   -> canonical entity fingerprint / alias clustering
   4 Splink         -> field-level evidence weighting
   5 Marble         -> case priority + SLA
   6 FinCrimeRadar  -> cross-domain fusion
   7 kyc-analyst    -> analyst verification checklist
   8 adverse-media-screening -> article evidence quality
   9 sieve-aml      -> source/ingest diagnostics
  10 FollowTheMoney -> typed entity projection
  11 Aleph          -> subject-hit-source relationship graph
  12 Vannor         -> local-watchlist adapter

   These helpers are decision-support only. They never suppress an existing hit. */

import { createHash } from 'node:crypto';

const clean = (v) => String(v == null ? '' : v).normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const arr = (v) => Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);

export function provenanceCompleteness(hit = {}) {
  const p = hit.provenance || {};
  const present = {
    sourceId: !!p.sourceId,
    sourceUrl: !!(p.sourceUrl || hit.evidenceUrl),
    matchedName: !!hit.hitName,
    score: Number.isFinite(Number(hit.score)),
  };
  const count = Object.values(present).filter(Boolean).length;
  return { score: Math.round(count / 4 * 100), present, complete: count === 4 };
}

export function queryByExample(subject = {}) {
  return {
    schema: subject.entityType === 'individual' ? 'Person' : 'Organization',
    properties: Object.fromEntries(Object.entries({
      name: subject.name,
      birthDate: subject.dob,
      nationality: subject.nationality || subject.jurisdiction,
      country: subject.country || subject.jurisdiction,
      passportNumber: subject.passport,
      registrationNumber: subject.registrationNumber,
    }).filter(([,v]) => v != null && String(v).trim() !== '')),
  };
}

export function canonicalFingerprint(subject = {}, aliases = []) {
  const names = [subject.name, ...arr(subject.aliases), ...arr(aliases)].map(clean).filter(Boolean).sort();
  const ids = [subject.passport, subject.registrationNumber, subject.idNumber].map(clean).filter(Boolean).sort();
  const basis = JSON.stringify({
    names: [...new Set(names)],
    ids: [...new Set(ids)],
    dob: clean(subject.dob),
    country: clean(subject.nationality || subject.jurisdiction || subject.country),
    type: clean(subject.entityType || 'organisation'),
  });
  return createHash('sha256').update(basis).digest('hex').slice(0, 24);
}

export function aliasCluster(subject = {}, hits = []) {
  const names = [subject.name, ...arr(subject.aliases), ...hits.map(h => h && h.hitName)]
    .map(clean).filter(Boolean);
  return [...new Set(names)].sort();
}

export function evidenceWeightedConfidence(subject = {}, hits = []) {
  let best = 0;
  const contributions = [];
  for (const h of hits) {
    if (!h) continue;
    const name = Math.max(0, Math.min(100, Number(h.score) || 0)) * 0.45;
    const ident = Math.max(0, Math.min(100, Number(h.identity && h.identity.points) || 0)) * 0.35;
    const prov = provenanceCompleteness(h).score * 0.10;
    const independent = h.secondOpinion && h.secondOpinion.status === 'corroborated' ? 10 : 0;
    const total = Math.min(100, Math.round(name + ident + prov + independent));
    if (total >= best) {
      best = total;
      contributions.splice(0, contributions.length,
        { signal: 'name similarity', points: Math.round(name) },
        { signal: 'identity corroboration', points: Math.round(ident) },
        { signal: 'provenance completeness', points: Math.round(prov) },
        { signal: 'independent corroboration', points: independent });
    }
  }
  return {
    score: best,
    band: best >= 80 ? 'high' : best >= 55 ? 'medium' : best >= 25 ? 'low' : 'insufficient',
    contributions,
    note: 'decision-support confidence; never used to suppress a screening hit',
  };
}

export function domainFusion(hits = []) {
  const domains = { sanctions: 0, pep: 0, adverseMedia: 0, other: 0 };
  for (const h of hits) {
    const label = String(h && h.list || '').toLowerCase();
    if (/sanction|ofac|ofsi|eu |un |terror|sema|dfat|seco|dgt/.test(label)) domains.sanctions++;
    else if (/pep|politically exposed|wikidata/.test(label)) domains.pep++;
    else if (/adverse|media|news/.test(label)) domains.adverseMedia++;
    else domains.other++;
  }
  const active = Object.entries(domains).filter(([,n]) => n > 0).map(([k]) => k);
  return { domains, active, crossDomain: active.length >= 2, domainCount: active.length };
}

export function casePriority(subject = {}, hits = []) {
  const fusion = domainFusion(hits);
  const confidence = evidenceWeightedConfidence(subject, hits).score;
  const sanctions = fusion.domains.sanctions > 0;
  let priority = 'normal', slaHours = 120;
  if (sanctions || confidence >= 80 || fusion.domainCount >= 3) { priority = 'critical'; slaHours = 4; }
  else if (confidence >= 55 || fusion.domainCount >= 2) { priority = 'high'; slaHours = 24; }
  else if (hits.length) { priority = 'medium'; slaHours = 72; }
  return { priority, slaHours, reason: sanctions ? 'sanctions signal present' : fusion.domainCount + ' active screening domain(s)' };
}

export function analystChecklist(subject = {}, hits = []) {
  const checks = [];
  const has = (field) => !!String(subject[field] || '').trim();
  checks.push({ id: 'identity-name', label: 'Verify legal name and aliases against source evidence', required: true, available: has('name') });
  if (subject.entityType === 'individual') {
    checks.push({ id: 'identity-dob', label: 'Compare date of birth', required: true, available: has('dob') });
    checks.push({ id: 'identity-id', label: 'Compare passport / official identifier', required: true, available: has('passport') || has('idNumber') });
    checks.push({ id: 'identity-nationality', label: 'Compare nationality / jurisdiction', required: true, available: has('nationality') || has('jurisdiction') });
  } else {
    checks.push({ id: 'entity-reg', label: 'Compare registration number and jurisdiction', required: true, available: has('registrationNumber') || has('jurisdiction') });
  }
  checks.push({ id: 'source-evidence', label: 'Open and retain primary-source evidence where available', required: true,
    available: hits.some(h => h && (h.evidenceUrl || (h.provenance && h.provenance.sourceUrl))) });
  checks.push({ id: 'disposition', label: 'Record MLRO disposition and written rationale', required: true, available: false });
  return { checks, missingEvidence: checks.filter(x => x.required && !x.available).map(x => x.id) };
}

export function articleEvidenceQuality(hit = {}) {
  const isMedia = /adverse|media|news/i.test(String(hit.list || ''));
  if (!isMedia) return null;
  const tier = Number(hit.sourceTier || hit.tier || 3);
  const identity = String(hit.identity && hit.identity.level || '');
  const provenance = provenanceCompleteness(hit).score;
  let score = tier <= 1 ? 35 : tier === 2 ? 25 : 15;
  score += identity === 'corroborated' || identity === 'strong' ? 35 : identity === 'moderate' ? 20 : 5;
  score += Math.round(provenance * 0.30);
  score = Math.min(100, score);
  return { score, band: score >= 75 ? 'strong' : score >= 50 ? 'usable' : 'weak', sourceTier: tier };
}

export function sourceDiagnostics(hits = []) {
  const total = hits.length;
  const provenanceScores = hits.map(provenanceCompleteness);
  const incomplete = provenanceScores.filter(x => !x.complete).length;
  const withEvidenceUrl = hits.filter(h => h && (h.evidenceUrl || (h.provenance && h.provenance.sourceUrl))).length;
  return { totalHits: total, incompleteProvenance: incomplete, evidenceUrlCoverage: total ? Math.round(withEvidenceUrl / total * 100) : 100 };
}

export function typedEntity(subject = {}) {
  const schema = subject.entityType === 'individual' ? 'Person' : 'Organization';
  return {
    schema,
    id: canonicalFingerprint(subject),
    properties: Object.fromEntries(Object.entries({
      name: subject.name,
      nationality: subject.nationality || subject.jurisdiction,
      country: subject.country || subject.jurisdiction,
      birthDate: subject.dob,
      passportNumber: subject.passport,
      registrationNumber: subject.registrationNumber,
    }).filter(([,v]) => v != null && String(v).trim() !== '')),
  };
}

export function relationshipGraph(subject = {}, hits = []) {
  const subjectId = 'subject:' + canonicalFingerprint(subject);
  const nodes = [{ id: subjectId, type: subject.entityType || 'organisation', label: subject.name || '' }];
  const edges = [];
  hits.forEach((h, i) => {
    const hitId = 'hit:' + canonicalFingerprint({ name: h.hitName || h.list || ('hit-' + i), entityType: 'screening-hit' });
    nodes.push({ id: hitId, type: 'screening-hit', label: h.hitName || h.list || '' });
    edges.push({ from: subjectId, to: hitId, type: 'SCREENING_MATCH', domain: domainFusion([h]).active[0] || 'other' });
    const src = h.provenance && (h.provenance.sourceId || h.provenance.sourceUrl);
    if (src) {
      const sourceId = 'source:' + createHash('sha1').update(String(src)).digest('hex').slice(0, 12);
      nodes.push({ id: sourceId, type: 'source', label: String(src) });
      edges.push({ from: hitId, to: sourceId, type: 'SUPPORTED_BY' });
    }
  });
  return { nodes, edges };
}

export function localWatchlistAdapter(entries = []) {
  return entries.filter(Boolean).map((e, i) => {
    if (typeof e === 'string') return { id: 'local-' + i, name: e, aliases: [], source: 'local-watchlist' };
    return {
      id: String(e.id || 'local-' + i),
      name: String(e.name || ''),
      aliases: arr(e.aliases).map(String),
      source: String(e.source || 'local-watchlist'),
      reason: String(e.reason || ''),
    };
  }).filter(e => e.name);
}

export function buildDecisionSupport(subject = {}, hits = []) {
  const mediaQuality = hits.map(articleEvidenceQuality).filter(Boolean);
  return {
    fingerprint: canonicalFingerprint(subject, aliasCluster(subject, hits)),
    queryByExample: queryByExample(subject),
    aliases: aliasCluster(subject, hits),
    matchConfidence: evidenceWeightedConfidence(subject, hits),
    domainFusion: domainFusion(hits),
    casePriority: casePriority(subject, hits),
    analystChecklist: analystChecklist(subject, hits),
    articleEvidence: mediaQuality,
    sourceDiagnostics: sourceDiagnostics(hits),
    entity: typedEntity(subject),
    graph: relationshipGraph(subject, hits),
  };
}
