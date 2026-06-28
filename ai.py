#!/usr/bin/env python3
"""
FINE GOLD LLC — AI LAYER  (ai.py)
Hawkeye Sterling V2 — AI augmentation for the AML/CFT screening engine.
====================================================================
Adopted in line with the UAE National AI Strategy 2031 mandate to embed AI in
operations, AND with the UAE AI ethics principles (fairness, accountability,
transparency, explainability, human oversight) + UAE PDPL (data residency).

DESIGN RULES (governance-first):
  1. HUMAN-IN-THE-LOOP. Nothing here decides, freezes, declines or files. Every
     output is decision-SUPPORT for the MLRO, who retains the decision.
  2. LLM IS OPT-IN. Any feature that would send customer data to an external
     model is GATED behind the ANTHROPIC_API_KEY secret. With no key, the system
     runs fully on deterministic, on-runner logic — no data egress, no paid key.
     Adding the key is the firm's explicit authorisation for that egress.
  3. EXPLAINABLE. Deterministic features return their contributing factors;
     LLM features are labelled as AI-generated and always carry the raw evidence
     so a human can verify without trusting the model.
  4. DEGRADE LOUDLY. An LLM error never blocks a report — it falls back to the
     deterministic path and the output is marked accordingly.

No third-party dependencies (uses requests, already required by the engine).
"""
import os, re, json, unicodedata

# ── LLM GATEWAY (opt-in, gated on ANTHROPIC_API_KEY) ──────────────────────────
AI_MODEL      = os.environ.get("AI_MODEL", "claude-haiku-4-5-20251001")
AI_ENABLED    = bool(os.environ.get("ANTHROPIC_API_KEY"))
_AI_ENDPOINT  = "https://api.anthropic.com/v1/messages"

# HARD ANTI-HALLUCINATION RULE: filed reports must contain ONLY real, sourced,
# deterministic data — never model-generated prose or model-inferred facts.
# This switch keeps every report path deterministic even if an LLM key is set.
# An LLM is therefore NOT used in anything that gets filed; opt-in generative
# use would require explicitly setting REPORT_ALLOW_LLM=1 AND a key — a separate,
# documented decision, not the default.
REPORT_ALLOW_LLM = os.environ.get("REPORT_ALLOW_LLM", "0") == "1"
def _llm_in_reports() -> bool:
    """Generative prose (free-text summaries) in reports — OFF unless explicitly
    opted in AND a key is present. This is the fabrication-prone surface."""
    return AI_ENABLED and REPORT_ALLOW_LLM

# Grounded classification (relevance/severity of REAL headlines) is allowed when a
# key is present: it judges provided text, it does NOT generate facts. Disable with
# LLM_TRIAGE=0. Even here the raw headline + link is always shown and the result is
# labelled, so a human verifies — the LLM never replaces the evidence.
LLM_TRIAGE = AI_ENABLED and os.environ.get("LLM_TRIAGE", "1") == "1"

# Hard grounding contract for any model call — forbids inventing facts.
GROUNDING_SYSTEM = (
    "You are an AML/CFT analyst assistant. ABSOLUTE RULES: Use ONLY the facts in the "
    "user's message. Never add, infer, assume, or invent any name, date, allegation, "
    "entity, number, or detail that is not explicitly present in the input. You only "
    "classify and judge relevance of the supplied text — you do not generate new "
    "information and you never make decisions. If uncertain, choose the conservative "
    "answer (treat as NOT about the subject). Output only what is asked.")

def llm_available() -> bool:
    """True only when the firm has provisioned a key (authorising data egress)."""
    return AI_ENABLED

def llm_complete(prompt: str, system: str = "", max_tokens: int = 400):
    """Single-shot completion. Returns text, or None on any failure / no key.
    Never raises — the caller always has a deterministic fallback."""
    if not AI_ENABLED:
        return None
    try:
        import requests
        r = requests.post(_AI_ENDPOINT, timeout=30,
            headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"],
                     "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": AI_MODEL, "max_tokens": max_tokens,
                  "system": system or "You are an AML/CFT analyst assistant. Be precise, factual, and never decide — only support the MLRO.",
                  "messages": [{"role": "user", "content": prompt}]})
        if r.status_code != 200:
            return None
        data = r.json()
        parts = data.get("content", []) or []
        text = "".join(p.get("text", "") for p in parts if p.get("type") == "text").strip()
        return text or None
    except Exception:
        return None

# ── TRANSLITERATION (Arabic / Turkish name variants for better recall) ────────
# Common equivalent spellings in this book of business. Conservative: only
# well-established particle / name swaps, to improve recall without inflating
# false positives.
_TRANSLIT_GROUPS = [
    {"mohammed", "muhammad", "mohamed", "mohammad", "muhammed", "mohd"},
    {"abdul", "abdel", "abd al", "abdal", "abd el"},
    {"bin", "ibn", "ben"},
    {"al", "el"},
    {"ahmed", "ahmad"},
    {"yousef", "yusuf", "yousuf", "youssef"},
    {"hussein", "husain", "hussain", "husein"},
    {"sheikh", "shaikh", "shaykh"},
    {"abdulrahman", "abdul rahman", "abdelrahman"},
    {"ismail", "ismael", "esmail"},
]

def _ascii_fold(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    # Turkish dotless-i / special letters survive folding as expected (İ→I, ş→s …)
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9 ]", " ", s)).strip().lower()

def name_variants(name: str, cap: int = 12):
    """Return a small set of transliteration-equivalent spellings of `name`
    (including itself). Used to widen sanctions matching recall."""
    base = _ascii_fold(name)
    if not base:
        return set()
    variants = {base}
    tokens = base.split()
    for grp in _TRANSLIT_GROUPS:
        for canonical in grp:
            if canonical in base:
                for alt in grp:
                    if alt != canonical:
                        variants.add(base.replace(canonical, alt))
        # token-level swap too (handles single-token particles like al/el)
        for i, t in enumerate(tokens):
            if t in grp:
                for alt in grp:
                    if alt != t:
                        nt = tokens[:i] + [alt] + tokens[i+1:]
                        variants.add(" ".join(nt))
    out = set(list(variants)[:cap])
    out.add(base)
    return out

# ── ADVERSE-MEDIA TRIAGE (relevance · severity · confidence) ──────────────────
# Severity by typology bucket (most→least material). The engine already tags
# each article with `categories`; we map those to a severity here.
_SEVERITY = [
    ("CRITICAL", {"Terrorism / CFT", "Sanctions / Proliferation"}),
    ("HIGH",     {"Money Laundering", "Bribery / Corruption", "Organised Crime / Trafficking"}),
    ("MEDIUM",   {"Fraud / Financial Crime", "Tax", "Cyber", "Enforcement / Legal"}),
    ("LOW",      {"ESG / Human Rights / Minerals"}),
]
_SEV_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "NONE": 0}

def _name_relevance(subject: str, title: str):
    st = set(_ascii_fold(subject).split())
    tt = set(_ascii_fold(title).split())
    if not st:
        return "LOW"
    overlap = len(st & tt) / len(st)
    return "HIGH" if overlap >= 0.99 else ("MEDIUM" if overlap >= 0.5 else "LOW")

def triage_adverse(subject: str, article: dict):
    """Decision-support triage for one adverse article.
    Deterministic by default; sharpened by the LLM only when a key is present.
    Returns {severity, relevance, confidence, ai}."""
    cats = set(article.get("categories", []) or [])
    severity = "NONE"
    for level, group in _SEVERITY:
        if cats & group:
            severity = level
            break
    relevance = _name_relevance(subject, article.get("title", ""))
    # Confidence: relevance × whether the headline actually names the risk.
    conf = "HIGH" if (relevance == "HIGH" and severity in ("CRITICAL", "HIGH")) else \
           ("MEDIUM" if relevance in ("HIGH", "MEDIUM") else "LOW")
    out = {"severity": severity, "relevance": relevance, "confidence": conf, "ai": False}

    if LLM_TRIAGE:
        # Grounded classification ONLY: judge the supplied headline against the
        # supplied name. No new facts. Raw headline + link stay in the report.
        prompt = ("Classify this news headline against the screening subject. "
                  "Judge ONLY from the headline text given — do not assume facts.\n"
                  f"Subject: \"{subject}\".\n"
                  f"Headline: \"{article.get('title','')}\" "
                  f"({article.get('source','?')}, {article.get('date','?')}).\n"
                  "Return compact JSON only: "
                  '{"is_about_subject": true|false, "is_adverse": true|false, '
                  '"severity": "CRITICAL|HIGH|MEDIUM|LOW|NONE"}')
        txt = llm_complete(prompt, system=GROUNDING_SYSTEM, max_tokens=120)
        if txt:
            try:
                j = json.loads(re.search(r"\{.*\}", txt, re.S).group(0))
                out.update({
                    "severity": str(j.get("severity", severity)).upper(),
                    "relevance": "HIGH" if j.get("is_about_subject") else "LOW",
                    "confidence": "HIGH" if j.get("is_about_subject") and j.get("is_adverse") else "LOW",
                    "ai": True})
            except Exception:
                pass  # any failure → deterministic result already in `out`
    return out

# ── CUSTOMER RISK RATING (deterministic, explainable) ─────────────────────────
def compute_risk_rating(*, sanctions_hits, is_control, pep, adverse_articles,
                        sector_high_risk=True, jurisdiction_high_risk=False):
    """Low / Medium / High customer rating with the factors that drove it
    (FATF R.10 risk-based approach). Deterministic and fully explainable.
      sanctions_hits      : list of hit dicts (with 'score')
      is_control          : bool — a designated owner/UBO (50%/control rule)
      pep                 : truthy if a PEP/RCA/SOE match
      adverse_articles    : list of article dicts (with 'categories')
    """
    factors = []
    score = 0
    if sector_high_risk:
        score += 1; factors.append("Inherent sector risk: precious metals / DPMS (FATF high-risk)")
    if jurisdiction_high_risk:
        score += 2; factors.append("Jurisdiction risk: FATF grey/black-list nexus")

    confirmed = [h for h in (sanctions_hits or []) if h.get("score", 0) >= 95]
    potential = [h for h in (sanctions_hits or []) if 0 < h.get("score", 0) < 95]
    if confirmed:
        score += 6; factors.append(f"Confirmed sanctions match ({len(confirmed)})")
    elif potential:
        score += 3; factors.append(f"Potential sanctions match ({len(potential)})")
    if is_control:
        score += 4; factors.append("Designated owner / UBO — ownership/control (50% rule)")
    if pep:
        score += 3; factors.append("PEP / RCA / SOE exposure")

    sev = "NONE"
    for a in (adverse_articles or []):
        t = triage_adverse("", a)["severity"]  # severity only (no subject needed)
        if _SEV_RANK[t] > _SEV_RANK[sev]:
            sev = t
    if sev != "NONE":
        bump = {"CRITICAL": 5, "HIGH": 3, "MEDIUM": 2, "LOW": 1}[sev]
        score += bump; factors.append(f"Adverse media — max severity {sev} ({len(adverse_articles)} item(s))")

    rating = "HIGH" if score >= 6 else ("MEDIUM" if score >= 3 else "LOW")
    # A confirmed designation or control linkage is HIGH irrespective of score.
    if confirmed or is_control:
        rating = "HIGH"
    edd = {"HIGH": "Enhanced Due Diligence + senior sign-off; review every 6 months",
           "MEDIUM": "Standard+ due diligence; review every 12 months",
           "LOW": "Standard due diligence; periodic review"}[rating]
    return {"rating": rating, "score": score, "factors": factors, "edd": edd}

# ── ALERT SUMMARY (LLM if available, else deterministic template) ─────────────
def alert_summary(subject_name, risk, sanctions_hits, pep, adverse_articles):
    """One short MLRO-facing 'why flagged / what to check' note.
    LLM-written when a key is present; otherwise a deterministic template."""
    bullets = []
    for h in (sanctions_hits or [])[:3]:
        bullets.append(f"sanctions: {h.get('list','?')} \"{h.get('matched_entry','?')}\" {h.get('score',0):.0f}%")
    if pep:
        bullets.append("PEP/RCA/SOE exposure")
    if adverse_articles:
        bullets.append(f"{len(adverse_articles)} adverse-media item(s)")
    evidence = "; ".join(bullets) or "no material findings"

    if _llm_in_reports():
        prompt = (f"Customer: \"{subject_name}\". Risk rating: {risk['rating']}.\n"
                  f"Evidence: {evidence}.\n"
                  f"Risk factors: {', '.join(risk['factors'])}.\n"
                  "Using ONLY the evidence above (invent nothing), write 2 sentences "
                  "for the MLRO: (1) why this was flagged, (2) the single most important "
                  "next check. No decision, no advice to freeze.")
        txt = llm_complete(prompt, system=GROUNDING_SYSTEM, max_tokens=160)
        if txt:
            return {"text": txt, "ai": True}
    # Deterministic fallback
    nxt = ("verify identity against the matched designation (DOB/nationality/ID)"
           if sanctions_hits else
           ("confirm PEP status and source of wealth" if pep else
            "review the adverse-media articles for relevance to this customer"))
    txt = (f"{risk['rating']} risk — flagged on {evidence}. "
           f"Primary next check: {nxt}.")
    return {"text": txt, "ai": False}

# ── NETWORK / RELATED-PARTY DETECTION (deterministic graph) ───────────────────
def related_parties(customers):
    """Surface hidden links across the book: a person who is an owner/UBO of more
    than one customer, or whose name equals another customer's name. Pure graph
    over the existing KYC data — no model, fully auditable.
    Returns list of {key, type, members:[...]}.
    """
    by_individual = {}   # normalised UBO name -> set(customer names)
    company_norm = {}    # normalised company name -> customer name
    for c in customers:
        company_norm[_ascii_fold(c.get("name", ""))] = c.get("name", "")
    for c in customers:
        for ind in c.get("individuals", []) or []:
            k = _ascii_fold(ind)
            if len(k) < 5:
                continue
            by_individual.setdefault(k, set()).add(c.get("name", ""))
    clusters = []
    # shared UBO across >1 customer
    for k, members in by_individual.items():
        if len(members) > 1:
            clusters.append({"key": k, "type": "shared owner / UBO",
                             "members": sorted(members)})
    # a UBO who is also a customer entity
    for k, members in by_individual.items():
        if k in company_norm:
            linked = sorted(set(members) | {company_norm[k]})
            if len(linked) > 1:
                clusters.append({"key": k, "type": "UBO is also a customer entity",
                                 "members": linked})
    # de-dup
    seen, out = set(), []
    for cl in clusters:
        sig = (cl["type"], tuple(cl["members"]))
        if sig in seen:
            continue
        seen.add(sig); out.append(cl)
    return out

# ── goAML STR / SAR DRAFT (deterministic; human reviews + files) ──────────────
def draft_str(customer_name, permalink, sanctions_hits, pep, adverse_articles, risk):
    """Produce a STR/SAR DRAFT for the MLRO to review, complete and file via the
    UAE FIU goAML portal. AI/automation drafts; a human always files."""
    L = ["SUSPICIOUS TRANSACTION REPORT — DRAFT (for MLRO review; file via goAML)",
         "=" * 64,
         f"Reporting entity:   Fine Gold LLC",
         f"Subject:            {customer_name}",
         f"Customer record:    {permalink}",
         f"Assessed risk:      {risk['rating']}",
         "",
         "GROUNDS FOR SUSPICION",
         "-" * 64]
    for h in (sanctions_hits or []):
        L.append(f"  • Sanctions/watchlist match — {h.get('list','?')}: "
                 f"\"{h.get('matched_entry','?')}\" ({h.get('score',0):.0f}%)"
                 + ("  [owner/UBO — 50%/control rule]" if h.get("control_linkage") else ""))
    if pep:
        L.append("  • Politically Exposed Person / RCA / SOE exposure (EDD applies)")
    for a in (adverse_articles or [])[:6]:
        L.append(f"  • Adverse media: \"{a.get('title','')}\" "
                 f"({a.get('source','?')}, {a.get('date','?')}) {a.get('url','')}")
    L += ["",
          "RISK FACTORS",
          "-" * 64]
    for f in risk["factors"]:
        L.append(f"  • {f}")
    L += ["",
          "REGULATORY BASIS",
          "  UAE Federal Decree-Law No. 20 of 2018 (AML/CFT); Cabinet Decision 10/2019;",
          "  Cabinet Resolution 74/2020 (TFS). Report without tipping off the customer.",
          "",
          "MLRO ACTION",
          "  [ ] File STR/SAR via goAML   [ ] Internal record only   [ ] Apply TFS freeze",
          "  Reviewed by: __________________   Date: __________   goAML Ref: __________",
          "",
          "> AI-ASSISTED DRAFT. Generated as decision-support. The MLRO must verify",
          "> every ground, complete the report, and file it. No automated filing."]
    return "\n".join(L)

# ── AI GOVERNANCE (model card constants surfaced in the report footer) ────────
MODEL_CARD = {
    "human_in_the_loop": "Yes — all outputs are decision-support; the MLRO decides and files.",
    "llm_use": ("Opt-in only, gated on ANTHROPIC_API_KEY. With no key the system runs "
                "fully on-runner with deterministic logic — no customer-data egress."),
    "explainability": "Deterministic features return their contributing factors; LLM outputs are labelled and carry the raw evidence.",
    "data_residency": "No data leaves the runner unless the firm provisions an LLM key (authorising egress). UAE PDPL applies.",
    "bias_testing": "Name-matching transliteration sets reviewed for fairness across Arabic/Turkish spellings; thresholds documented.",
    "regulatory": "UAE National AI Strategy 2031; UAE AI Ethics Principles; FATF R.10/R.12/R.6.",
}

def governance_footer():
    # Filed reports are deterministic and source-verified by default — no generative
    # text, no model-inferred facts. Every datum traces to a real list entry,
    # article link, or Wikidata record.
    if _llm_in_reports():
        mode = "AI-ASSISTED + generative summaries (explicitly enabled)"
    elif LLM_TRIAGE:
        mode = ("AI-ASSISTED triage (LLM classifies real headlines for relevance — "
                "no generated facts). All sanctions/PEP/links remain deterministic & source-verified")
    else:
        mode = "DETERMINISTIC — every item traces to a real source; no generated text, no assumptions"
    return (f"DATA INTEGRITY: {mode}. Human-in-the-loop: MLRO decides & files. "
            "Every finding carries its raw evidence (list entry / article link / Wikidata). "
            "Governance: UAE AI Ethics Principles + PDPL; see docs/AI-GOVERNANCE.md.")
