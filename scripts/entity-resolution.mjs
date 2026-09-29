/* Structured identity corroboration for sanctions / PEP / adverse-media screening.
   Native implementation, no external dataset or dependency. This layer is
   evidence/triage only: it never suppresses a sanctions hit. */

export function normText(v) {
  return String(v == null ? '' : v)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normId(v) {
  return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normDate(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  const dmy = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s);
  if (dmy) return dmy[3] + '-' + dmy[2].padStart(2, '0') + '-' + dmy[1].padStart(2, '0');
  const y = /\b(?:19|20)\d{2}\b/.exec(s);
  return y ? y[0] : normText(s);
}

export function tokens(v) {
  return new Set(normText(v).split(' ').filter(Boolean));
}

function overlap(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return false;
  for (const t of A) if (B.has(t)) return true;
  return false;
}

function same(a, b, normalizer = normText) {
  const A = normalizer(a), B = normalizer(b);
  return !!A && !!B && A === B;
}

export function corroborateIdentity(subject = {}, candidate = {}, { nameScore = null } = {}) {
  const evidence = [];
  const conflicts = [];
  let points = 0;

  if (Number.isFinite(nameScore)) {
    if (nameScore >= 95) { points += 35; evidence.push('name near-exact'); }
    else if (nameScore >= 85) { points += 25; evidence.push('name strong'); }
    else if (nameScore >= 75) { points += 15; evidence.push('name plausible'); }
  }

  const sid = subject.idNumber || subject.passport || subject.registrationNumber;
  const cid = candidate.idNumber || candidate.passport || candidate.registrationNumber;
  if (sid && cid) {
    if (same(sid, cid, normId)) { points += 40; evidence.push('identifier exact'); }
    else conflicts.push('identifier mismatch');
  }

  if (subject.dob && candidate.dob) {
    if (same(subject.dob, candidate.dob, normDate)) { points += 30; evidence.push('date of birth exact'); }
    else {
      const sy = normDate(subject.dob).slice(0, 4), cy = normDate(candidate.dob).slice(0, 4);
      if (sy && cy && sy === cy) { points += 10; evidence.push('birth year corroborated'); }
      else conflicts.push('date of birth mismatch');
    }
  }

  const sj = subject.nationality || subject.jurisdiction || subject.country;
  const cj = candidate.nationality || candidate.jurisdiction || candidate.country;
  if (sj && cj) {
    if (same(sj, cj) || overlap(sj, cj)) { points += 15; evidence.push('country/nationality corroborated'); }
    else conflicts.push('country/nationality differs');
  }

  if (subject.entityType && candidate.entityType) {
    if (normText(subject.entityType) === normText(candidate.entityType)) {
      points += 5;
      evidence.push('entity type corroborated');
    } else conflicts.push('entity type differs');
  }

  let level = 'weak';
  if (points >= 65) level = 'strong';
  else if (points >= 40) level = 'moderate';
  else if (points >= 20) level = 'limited';

  return { points, level, evidence, conflicts };
}

export function corroborateArticleIdentity(subject = {}, article = {}) {
  const text = [article.title, article.snippet, article.source].filter(Boolean).join(' ');
  const j = subject.nationality || subject.jurisdiction || subject.country || '';
  const country = j && overlap(j, text);
  return {
    level: country ? 'corroborated' : 'name-only',
    evidence: country ? ['CDD country/nationality mentioned in article evidence'] : [],
  };
}

export function identityLabel(result) {
  if (!result) return '';
  const bits = [];
  if (result.level) bits.push(result.level);
  if (result.evidence && result.evidence.length) bits.push(result.evidence.join('; '));
  if (result.conflicts && result.conflicts.length) bits.push('conflicts: ' + result.conflicts.join('; '));
  return bits.join(' | ');
}
