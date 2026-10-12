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

  // Only complete calendar dates or an explicitly supplied birth year are
  // corroborating evidence. Invalid dates and years embedded in arbitrary
  // text must not earn a partial/near-exact DOB match.
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(s);
  const dmy = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s);
  if (!iso && !dmy) return /^(?:18|19|20)\d{2}$/.test(s) ? s : '';

  const year = Number(iso ? iso[1] : dmy[3]);
  const month = Number(iso ? iso[2] : dmy[2]);
  const day = Number(iso ? iso[3] : dmy[1]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (year < 1800 || !Number.isFinite(timestamp) || timestamp > Date.now()
      || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day) return '';
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}


export function tokens(v) {
  return new Set(normText(v).split(' ').filter(Boolean));
}

function countryMention(jurisdiction, text) {
  const country = normText(jurisdiction);
  if (!country) return false;
  // Two-letter codes such as US, IN and NO are ordinary English words when
  // lowercased. Require an explicit uppercase code in article evidence.
  if (/^[a-z]{2}$/.test(country)) {
    return new RegExp('\\b' + country.toUpperCase() + '\\b').test(String(text));
  }
  // Entire country name as a token-bounded phrase, never a shared word such
  // as "United" (US vs UAE) or "Republic" (different countries).
  return (' ' + normText(text) + ' ').includes(' ' + country + ' ');
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
    const subjectDob = normDate(subject.dob);
    const candidateDob = normDate(candidate.dob);
    if (subjectDob && candidateDob) {
      if (subjectDob.length === 10 && candidateDob.length === 10) {
        if (subjectDob === candidateDob) { points += 30; evidence.push('date of birth exact'); }
        else conflicts.push('date of birth mismatch');
      } else if (subjectDob.slice(0, 4) === candidateDob.slice(0, 4)) {
        // Partial year-only evidence can never be scored as an exact DOB.
        points += 10;
        evidence.push('birth year corroborated');
      } else conflicts.push('date of birth mismatch');
    }
  }


  const sj = subject.nationality || subject.jurisdiction || subject.country;
  const cj = candidate.nationality || candidate.jurisdiction || candidate.country;
  if (sj && cj) {
    if (same(sj, cj)) { points += 15; evidence.push('country/nationality corroborated'); }
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
  const country = j && countryMention(j, text);
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
