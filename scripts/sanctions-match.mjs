export function screenName(name, index, threshold = 85, phonetic = '1') {
  const rawName = String(name == null ? '' : name).trim();
  const norm = normalizeName(name);
  const empty = { name, topScore: 0, band: 'low', recommendation: 'clear', hitCount: 0, lists: [] };
  if (!rawName || !index || !index.entries.length) return empty;

  const exactMap = index.exact;
  const tokenMap = index.token;
  const entries = index.entries;
  const phonMap = index.phon;
  const phonProfiles = index.phonProfiles;
  const variantTokenCache = new Map();
  const getVariantTokens = (v) => {
    let toks = variantTokenCache.get(v);
    if (!toks) {
      toks = sigTokens(v);
      variantTokenCache.set(v, toks);
    }
    return toks;
  };

  const byNorm = new Map();   // matched designated norm -> { list, hitName, score, mechanism, confidence }
  const addHit = (list, hitName, score, key, meta = {}) => {
    const prev = byNorm.get(key);
    if (!prev || score > prev.score) {
      const h = { list, hitName, score: Math.round(score),
        mechanism: meta.mechanism || 'fuzzy',
        confidence: meta.confidence || 'WEAK' };
      if (meta.phoneticShape) { h.phonetic = true; h.phoneticShape = meta.phoneticShape; }
      byNorm.set(key, h);
    }
  };
  const phonMode = phonetic === '0' || phonetic === 'shadow' ? phonetic : '1';
  const phoneticShadow = [];   // shadow-mode would-be hits (never real hits)

  /* Transliteration-aware recall (screen.py parity): also screen the subject's
     spelling variants (Mohammed/Muhammad, bin/ibn …). Usually just the base;
     a handful only when a name carries a known particle, so cost stays bounded. */
  const variants = nameVariants(norm);
  const subjectTokenSet = new Set();

  /* exact designated-name match → 100 (a variant equal to a designated name IS
     that designation under an equivalent spelling) */
  let exactAny = false;
  for (const v of variants) {
    for (const t of getVariantTokens(v)) subjectTokenSet.add(t);
    const ex = exactMap.get(v);
    if (ex) {
      exactAny = true;
      for (const h of ex) addHit(h.list, h.hitName, 100, h.hitName + '|' + h.list,
        { mechanism: 'exact', confidence: 'STRONG' });
    }
  }

  /* A name that folds to nothing, or to no significant token (all tokens
     short/stopword/numeric — e.g. "Yu Li", or a symbols-only record), has no
     candidate path: returning "clear" would be a silent sanctions false
     negative. Route it to MANUAL REVIEW instead (screen.py _unscreenable /
     _manual_review_hit parity). An exact designated-name match still wins. */
  const toks = screenableTokens(norm);
  if (!exactAny && (!norm || !toks.length)) {
    return {
      name, topScore: 0, band: 'medium', recommendation: 'review', hitCount: 1,
      lists: [{ list: MANUAL_REVIEW_LIST, score: 0,
        hitName: 'name not auto-screenable (no distinctive name tokens after normalization) — screen this subject manually against all lists' }]
    };
  }

  /* fuzzy over candidates that share a significant token with ANY variant */
  const candIdx = new Set();
  for (const v of variants) {
    const vToks = getVariantTokens(v);
    const rare = [];
    for (const t of vToks) {
      const bucket = tokenMap.get(t);
      if (!bucket) continue;
      if (bucket.length <= COMMON_TOKEN_CAP) rare.push(t);
    }
    const picked = rare.length ? rare : vToks;
    for (const t of picked) {
      const bucket = tokenMap.get(t);
      if (!bucket) continue;
      for (const i of bucket) candIdx.add(i);
    }
  }
  /* Fuzzy-blocking fallback — ONLY for a BASE token with NO exact bucket at
     all (an out-of-group typo: "vladimyr", "putyn"): the no-typo hot path
     never probes, and variant-generated spellings are deliberately excluded —
     probing a swapped spelling that is simply absent from the corpus would
     re-import the very common-token buckets the rare-preference above skipped
     (measured +25% on the no-typo path) without adding recall the base
     spelling's own bucket does not already provide. Admitted near-tokens
     contribute their buckets; over-cap (very common) buckets are held back
     and used only when the subject otherwise has NO candidates at all — the
     same "rarer evidence first, common only as a last resort" rule the exact
     path applies. Candidates then score through the normal path, so this is
     recall-monotone: it can only ADD candidates, never lower a score. */
  const fuzzyCommon = new Set();
  for (const t of new Set(toks)) {
    if (tokenMap.has(t)) continue;
    for (const u of fuzzyTokenMatches(t, index)) {
      const bucket = tokenMap.get(u) || [];
      if (bucket.length <= COMMON_TOKEN_CAP) for (const i of bucket) candIdx.add(i);
      else fuzzyCommon.add(u);
    }
  }
  if (!candIdx.size) {
    for (const u of fuzzyCommon) for (const i of (tokenMap.get(u) || [])) candIdx.add(i);
  }
  /* Phonetic candidates: entries sharing ≥2 of a variant's distinct phonetic
     keys (or all of them for a low-key-count variant). Unioned in BEFORE
     scoring so the phonetic branch below sees every entry it could flag —
     without this the trigram blocking's lev≤1/InDel≥88 verification would
     leave the branch silently unreachable (the exact defect class the
     blocking-equivalence tests exist to catch). */
  const subjProfiles = phonMode !== '0'
    ? [...variants].map(phoneticProfile).filter(Boolean) : [];
  if (subjProfiles.length && phonMap) {
    for (const prof of subjProfiles) {
      const keys = new Set(prof.map(p => p[0]));
      const need = Math.min(2, keys.size);
      const counts = new Map();
      for (const k of keys) {
        const bucket = phonMap.get(k);
        if (!bucket) continue;
        for (const i of bucket) counts.set(i, (counts.get(i) || 0) + 1);
      }
      for (const [i, c] of counts) if (c >= need) candIdx.add(i);
    }
  }
  /* Deterministic variant order + (score, core, full) tie-break — screen.py
     parity: on a score tie between transliteration variants the recorded core
     (and therefore which gates fire) must not depend on iteration order. */
  const sortedVariants = [...variants].sort();
  let best = exactAny ? 100 : 0;
  for (const i of candIdx) {
    const e = entries[i];
    /* Best (score, core, full) across variants; subset/tset accumulate. The
       token-set ratio is probed only while below the fuzzy bar AND only when it
       could decide a gate (a subset was found, or the cores are near-exact) —
       the ANDed gates can only ADD hits (screen.py parity). */
    let sc = 0, coreBest = 0, fullBest = 0, subset = false, tset = 0;
    for (const v of sortedVariants) {
      const m = matchScore(v, e.norm);
      if (m.score > sc
          || (m.score === sc && (m.core > coreBest || (m.core === coreBest && m.full > fullBest)))) {
        sc = m.score; coreBest = m.core; fullBest = m.full;
      }
      if (sc < threshold && tset < TOKENSET_THRESHOLD) {
        if (!subset && isTokenSubset(v, e.norm)) subset = true;
        if (subset || m.core >= SHORT_ENTRY_THRESHOLD) {
          const r = tokenSetRatio(v, e.norm);
          if (r > tset) tset = r;
        }
      }
    }
    if (sc > best) best = sc;
    const key = e.hitName + '|' + e.list;
    /* Short designated names (HAMAS, IRISL, ANO …): fuzzy-matching a <6-char
       string invites false positives, so require a NEAR-EXACT match on either
       the decisive score or the distinctive core (the customer named after the
       designation + boilerplate), recorded at the conservative decisive score
       (screen.py short-entry gate parity). */
    if (e.norm.length < 6) {
      if (sc >= SHORT_ENTRY_THRESHOLD || coreBest >= SHORT_ENTRY_THRESHOLD) {
        addHit(e.list, e.hitName, sc, key,
          { mechanism: 'short-entry', confidence: confidenceTier(coreBest) });
      }
      continue;
    }
    if (sc >= threshold) {
      addHit(e.list, e.hitName, sc, key,
        { mechanism: 'fuzzy', confidence: confidenceTier(coreBest) });
    }
    /* NEAR-EXACT CORE (screen.py third-gate parity): the distinctive cores are
       near-identical and only boilerplate differs — the strongest identity
       signal short of string equality ("Al Qaeda General Trading" vs AL QAEDA),
       recorded at the conservative decisive score. */
    else if (coreBest >= SHORT_ENTRY_THRESHOLD && tset >= TOKENSET_THRESHOLD) {
      addHit(e.list, e.hitName, sc, key,
        { mechanism: 'near-exact-core', confidence: confidenceTier(coreBest) });
    }
    /* Additive recall gate: a true token SUBSET (patronymic chain / extra
       middle names) with a high token-set score flags too — recorded at the
       conservative similarity score so it reads as a POSSIBLE match for MLRO
       disambiguation, never confirmed (mirrors screen.py's ANDed gate). */
    else if (subset && tset >= TOKENSET_THRESHOLD) {
      addHit(e.list, e.hitName, sc, key,
        { mechanism: 'subset', confidence: confidenceTier(coreBest) });
    }
    /* Phonetic-only branch (screen.py parity): strictly additive — an elif
       that can never replace, lower or suppress a fuzzy or subset hit.
       Recorded at the conservative similarity score, tier WEAK. */
    else if (subjProfiles.length) {
      const eProf = phonProfiles ? phonProfiles[i] : phoneticProfile(e.norm);
      if (eProf) {
        let pm = null;
        for (const prof of subjProfiles) {
          pm = phoneticPairMatch(prof, eProf);
          if (pm) break;
        }
        if (pm) {
          if (phonMode === 'shadow') {
            phoneticShadow.push({ list: e.list, hitName: e.hitName, score: Math.round(sc), shape: pm });
          } else {
            addHit(e.list, e.hitName, sc, key,
              { mechanism: 'phonetic', confidence: 'WEAK (phonetic-only)', phoneticShape: pm });
          }
        }
      }
    }
  }

  const lists = [...byNorm.values()].sort((a, b) => b.score - a.score).slice(0, 12);
  /* A subject carrying letters OUTSIDE the Latin A-Z fold (Arabic/Cyrillic/CJK
     script — normalizeName keeps them, but the published lists are indexed in
     Latin, so those tokens can never bucket-match anything) must not silently
     clear at 0: mirror screen.py's _unscreenable and route it to MANUAL
     REVIEW. Only when NOTHING hit — an exact match against a curated
     same-script entry, a Latin-residue fuzzy hit or a subset hit still wins
     (this branch is strictly recall-monotone). */
  if (!lists.length && lostScriptLetters(rawName)) {
    return {
      name, topScore: 0, band: 'medium', recommendation: 'review', hitCount: 1,
      lists: [{ list: MANUAL_REVIEW_LIST, score: 0,
        hitName: 'name not auto-screenable (non-Latin script — its letters cannot be matched against the Latin-published lists) — screen this subject manually against all lists' }]
    };
  }
  if (!lists.length) {
    const out = { name, topScore: Math.round(best), band: 'low', recommendation: 'clear', hitCount: 0, lists: [] };
    if (phoneticShadow.length) out.phoneticShadow = phoneticShadow;
    return out;
  }
  const topScore = lists[0].score;
  /* Mechanism-aware banding. Subset and phonetic-only are RECALL gates that
     fire at low real similarity ("Ahmed Hassan" inside every longer chain
     sharing those two given names, "Karim Aziz" ~ "Kareem Azeez …") — real
     leads for disambiguation, not designation matches. When they are ALL a
     subject has, the row reads review/medium so the MLRO queue is not flooded
     with critical/high alerts for weak evidence. Nothing is suppressed: the
     hits, scores and mechanisms are all recorded, the row still counts as a
     material match downstream, and any exact/fuzzy/short-entry/near-exact-core
     hit keeps the full sanctions-match severity. */
  const weakOnly = lists.every(h => h.mechanism === 'subset' || h.mechanism === 'phonetic');
  if (weakOnly) {
    const out = { name, topScore, band: 'medium', recommendation: 'review', hitCount: lists.length, lists };
    if (phoneticShadow.length) out.phoneticShadow = phoneticShadow;
    return out;
  }
  const band = topScore >= 98 ? 'critical' : 'high';
  const out = { name, topScore, band, recommendation: 'sanctions-match', hitCount: lists.length, lists };
  if (phoneticShadow.length) out.phoneticShadow = phoneticShadow;
  return out;
}

/* Screen a batch of subjects → raw engine-shaped rows (one per subject), keyed
   by subject.name so the existing normaliser maps them back to jurisdiction/gid. */
export function screenSubjects(subjects, index, threshold = 85) {
  return (subjects || []).map(s => screenName(s.name, index, threshold));
}
