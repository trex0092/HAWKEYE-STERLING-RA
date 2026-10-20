#!/usr/bin/env python3
"""
HAWKEYE STERLING — KYC / IDENTITY LAYER  (kyc.py)
Hawkeye Sterling V2 — FATF R.10 (CDD / identity) + R.25 (legal arrangements).
====================================================================
The customer base in Asana stores a STRUCTURED "COMPLIANCE ASSESSMENT" note per
customer. This module parses that note into identity records so the screening
engine can do more than name-only matching:

  • R.10 — Customer Due Diligence: identify each individual (DOB, nationality,
    ID number, share %, role, PEP status) and verify the CDD is COMPLETE
    (ID present, document not expired, proof of address obtained, UBO identified).
    A sanctions/PEP alert is then accompanied by an IDENTITY DOSSIER and a list of
    CDD GAPS the MLRO must close — turning a name hit into an actionable case.

  • R.25 — Legal Arrangements: recognise trust / foundation / partnership roles
    (settlor, trustee, beneficiary, protector, founder, partner) so those parties
    are screened and an arrangement is flagged when any party is a hit. Plain
    companies degrade to a no-op (no arrangement parties → nothing added).

DESIGN RULES (consistent with the rest of the system):
  • DETERMINISTIC & SOURCED. Every field traces to the customer's own KYC note —
    no inference, no model, no fabrication.
  • DEGRADE LOUDLY. A field we cannot parse is reported as a GAP, never silently
    treated as satisfied. "Missing" is a finding, not a pass.
  • PRIVACY. ID numbers are masked when rendered (last 3 chars only); the raw
    value never leaves the record.
No third-party dependencies.
"""
import os, re, json, datetime, sys


def _warn(msg):
    """Surface a degrade on stderr so it lands in the run log. kyc.py is a
    library (no dependency on screen.log); the workflows capture stderr."""
    print(f"[kyc] WARN {msg}", file=sys.stderr, flush=True)


# Geographic PEP screening QA samples requested by the operator. NOT country
# risk tiers and NOT indications that a person is a PEP. Geography cannot
# establish political exposure. The same basic PEP screening obligation applies
# to all nationalities. These three records receive an extra coverage reminder.
_PEP_QA_COUNTRY_ALIASES = {
    "turkey": "Turkey", "turkiye": "Turkey", "turkish": "Turkey",
    "india": "India", "indian": "India",
    "papua new guinea": "Papua New Guinea", "papua new guinean": "Papua New Guinea",
    "png": "Papua New Guinea",
}


def pep_country_qa_advisory(nationality):
    """Optional QA-sample reminder; NOT a PEP match or risk-score input."""
    import unicodedata
    if not isinstance(nationality, str):
        return None
    normalized = unicodedata.normalize("NFKD", nationality.casefold())
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = " ".join(re.sub(r"[^a-z ]", " ", normalized).split())
    jurisdiction = _PEP_QA_COUNTRY_ALIASES.get(normalized)
    if jurisdiction is None:
        return None
    return {
        "code": "PEP_COVERAGE_SPOT_CHECK",
        "jurisdiction": jurisdiction,
        "scope": "operator_selected_quality_assurance",
        "human_review_required": True,
        "is_pep_finding": False,
        "risk_score_adjustment": 0,
        "note": (
            "Recheck PEP/RCA screening coverage and retain independently sourced "
            "review evidence. Nationality alone is not a PEP indicator, and a "
            "negative public-source search is not proof of non-PEP status."
        ),
    }


# ── Legal-arrangement role / entity vocabulary (R.25) ─────────────────────────
# A party holding one of these roles, OR an entity whose name carries one of these
# tokens, is treated as part of a legal arrangement (trust/foundation/partnership)
# rather than a plain company shareholding.
_ARRANGEMENT_ROLE_TOKENS = {
    "settlor", "trustee", "beneficiary", "protector", "grantor", "founder",
    "foundation council", "enforcer", "general partner", "limited partner",
}
_ARRANGEMENT_ENTITY_TOKENS = {
    "trust", "foundation", "stiftung", "fideicomiso", "waqf", "anstalt",
    "fondation", "stichting", "treuhand", "fund ", "private trust company",
}

# ── Maintained jurisdiction-risk list (R.10 risk-based approach) ───────────────
# FATF "grey list" (increased-monitoring) + locally-designated higher-risk
# jurisdictions. MAINTAINED like the EOCN list — it must be refreshed from the
# latest FATF plenary statement. It only NUDGES a deterministic risk score
# (decision-support); it never decides. Missing/empty file ⇒ no jurisdiction bump
# (degrade to neutral, logged by the caller).
JURISDICTION_RISK_PATH = os.environ.get(
    "JURISDICTION_RISK_PATH", "data/jurisdiction-risk.json")

# Common short/variant spellings for entries the maintained list stores under
# the app baseline's FORMAL names ({alias: listed name}, both in _norm form).
# The Country:/Nationality: fields this table nudges are hand-typed in the KYC
# notes, so "Iran" or "Laos" must hit the same entry as "Islamic Republic of
# Iran" — an unmatched spelling silently DROPS a call-for-action risk bump (a
# false negative, against this module's degrade-loudly rule). An alias resolves
# ONLY while its listed name is present, so a jurisdiction FATF de-lists never
# survives through its alias.
_JURISDICTION_ALIASES = {
    "iran": "islamic republic of iran",
    "laos": "lao people's democratic republic",
    "lao pdr": "lao people's democratic republic",
    "ivory coast": "cote d'ivoire",
    "côte d'ivoire": "cote d'ivoire",
    "democratic republic of congo": "the democratic republic of congo",
    "democratic republic of the congo": "the democratic republic of congo",
    "dr congo": "the democratic republic of congo",
    "drc": "the democratic republic of congo",
    "burma": "myanmar",
    "dprk": "north korea",
    "democratic people's republic of korea": "north korea",
    "viet nam": "vietnam",
    "bosnia and herzegovina": "bosnia-herzegovina",
    "syrian arab republic": "syria",
    "virgin islands (uk)": "british virgin islands",
    "bvi": "british virgin islands",
    "bolivarian republic of venezuela": "venezuela",
    "plurinational state of bolivia": "bolivia",
    # ISO 3166 / UN short names, which put the qualifier after the name.
    "iran, islamic republic of": "islamic republic of iran",
    "iran (islamic republic of)": "islamic republic of iran",
    "korea, democratic people's republic of": "north korea",
    "korea (democratic people's republic of)": "north korea",
    "congo, the democratic republic of the": "the democratic republic of congo",
    "congo, democratic republic of the": "the democratic republic of congo",
    "venezuela, bolivarian republic of": "venezuela",
    "venezuela (bolivarian republic of)": "venezuela",
    "bolivia, plurinational state of": "bolivia",
    "bolivia (plurinational state of)": "bolivia",
    "virgin islands, british": "british virgin islands",
}


def load_jurisdiction_risk(path=None):
    """Return {country_lower: 'grey'|'high'} from the maintained file, or {} if
    absent. Never raises. An ABSENT optional file degrades to neutral silently
    (the expected no-op); a PRESENT-but-unreadable/corrupt file is a real loss of
    a risk input and is warned LOUDLY (this module's DEGRADE-LOUDLY rule), so the
    jurisdiction bump never vanishes without a trace. Well-known short/variant
    spellings (_JURISDICTION_ALIASES) resolve to their listed entry's tier."""
    p = path or JURISDICTION_RISK_PATH
    if not os.path.exists(p):
        return {}
    try:
        with open(p) as f:
            d = json.load(f)
        out = {}
        for tier in ("grey", "high"):
            for c in d.get(tier, []) or []:
                out[_norm(c)] = tier
        for alias, target in _JURISDICTION_ALIASES.items():
            if target in out and alias not in out:
                out[alias] = out[target]
        if not out:
            _warn(f"jurisdiction-risk file '{p}' present but yielded 0 entries — "
                  "jurisdiction risk bump is disabled this run")
        return out
    except Exception as e:
        _warn(f"jurisdiction-risk file '{p}' unreadable ({type(e).__name__}: {e}) — "
              "jurisdiction risk bump is disabled this run")
        return {}


def _norm(s):
    return re.sub(r"\s+", " ", str(s or "")).strip().lower()


def mask_id(raw):
    """Render an ID number as presence + last 3 chars only (privacy / PDPL)."""
    s = re.sub(r"\s+", "", str(raw or ""))
    if not s or s.upper() in ("NA", "N/A", "PENDING", "-", "—", "–"):
        return ""
    return ("•" * max(0, len(s) - 3)) + s[-3:] if len(s) > 3 else "•••"


# ── Field parsing ─────────────────────────────────────────────────────────────
_KV = lambda label: re.compile(
    rf"^\s*{label}\s*[:\-]\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)

_DOB_FORMATS = ("%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%Y-%m-%d", "%d/%m/%Y")


def parse_date(s):
    s = _clean(s)
    if not s or s.upper() in ("NA", "N/A", "PENDING", "-"):
        return None
    for fmt in _DOB_FORMATS:
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except Exception:
            continue
    return None


def _clean(s):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s


def _present(s):
    """True iff a field is meaningfully filled (not blank / NA / Pending)."""
    return bool(_clean(s)) and _clean(s).upper() not in ("NA", "N/A", "PENDING", "-", "—", "–")


# Individual block header, e.g. "Individual 1 — Shareholder & Director".
# The dash class must cover the en-dash (–) too, not only the em-dash/hyphen:
# word processors auto-convert " - " to " – ", and mask_id already treats the
# en-dash as an expected data marker — a header the splitter can't parse drops
# that party's whole KYC block silently.
_INDIV_HDR = re.compile(
    r"Individual\s+\d+\s*[—–\-:]\s*(.+)", re.IGNORECASE)

# Field labels inside an individual block.
_FIELDS = {
    "name":        re.compile(r"Name\s*[:\-][ \t]*(.+)", re.IGNORECASE),
    "nationality": re.compile(r"Nationality\s*[:\-][ \t]*(.+)", re.IGNORECASE),
    "shares":      re.compile(r"Shares?\s*%?\s*[:\-][ \t]*(.+)", re.IGNORECASE),
    "id_number":   re.compile(r"Passport\s*/?\s*ID\s*[:\-][ \t]*(.+)", re.IGNORECASE),
    "passport_expiry": re.compile(r"Passport\s*Expiry\s*[:\-][ \t]*(.+)", re.IGNORECASE),
    "dob":         re.compile(r"Date\s*of\s*Birth\s*[:\-][ \t]*(.+)", re.IGNORECASE),
    "gender":      re.compile(r"Gender\s*[:\-][ \t]*(.+)", re.IGNORECASE),
    "emirates_id": re.compile(r"Emirates\s*ID\s*[:\-][ \t]*(.+)", re.IGNORECASE),
    "eid_expiry":  re.compile(r"EID\s*Expiry\s*[:\-][ \t]*(.+)", re.IGNORECASE),
    "proof_of_address": re.compile(r"Proof\s*of\s*Address\s*[:\-][ \t]*(.+)", re.IGNORECASE),
    "pep_status":  re.compile(r"PEP\s*Status\s*[:\-][ \t]*(.+)", re.IGNORECASE),
}

_SHARE_NUM = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def _share_pct(s):
    m = _SHARE_NUM.search(str(s or ""))
    return float(m.group(1)) if m else None


def is_arrangement_role(role):
    r = _norm(role)
    return any(tok in r for tok in _ARRANGEMENT_ROLE_TOKENS)


def is_arrangement_entity(name):
    n = _norm(name)
    return any(tok in n for tok in _ARRANGEMENT_ENTITY_TOKENS)


def _split_individual_blocks(notes):
    """Yield (role, block_text) for each 'Individual N — ROLE' block in the
    IDENTIFICATIONS section."""
    # Limit to SECTION 4 if present, else scan the whole note.
    sec = notes
    m = re.search(r"SECTION\s*4\b.*?(?=SECTION\s*5\b|$)", notes, re.IGNORECASE | re.DOTALL)
    if m:
        sec = m.group(0)
    parts = re.split(r"(Individual\s+\d+\s*[—–\-:][^\n]*)", sec)
    # parts: [pre, hdr1, body1, hdr2, body2, ...]
    for i in range(1, len(parts) - 1, 2):
        hdr = parts[i]
        body = parts[i + 1]
        rm = _INDIV_HDR.search(hdr)
        role = _clean(rm.group(1)) if rm else ""
        yield role, hdr + "\n" + body


def parse_individual(role, block):
    rec = {"role": role}
    for key, rx in _FIELDS.items():
        m = rx.search(block)
        rec[key] = _clean(m.group(1)) if m else ""
    rec["name"] = rec.get("name", "").strip()
    rec["share_pct"] = _share_pct(rec.get("shares", ""))
    rec["arrangement_role"] = is_arrangement_role(role)
    return rec


def cdd_gaps(rec, today=None):
    """R.10 verification gaps for one identified person. Returns a list of
    human-readable gaps the MLRO must close. 'Missing' is always a finding."""
    today = today or datetime.date.today()
    gaps = []
    if not _present(rec.get("id_number")):
        gaps.append("no identification document (passport/ID) on file")
    if not _present(rec.get("nationality")):
        gaps.append("nationality not recorded")
    if not _present(rec.get("dob")):
        gaps.append("date of birth not recorded")
    if not _present(rec.get("proof_of_address")):
        gaps.append("proof of address not obtained")
    if _present(rec.get("id_number")) and not _present(rec.get("passport_expiry")):
        gaps.append("passport/ID expiry date not recorded")
    # Expiry checks. A PRESENT but unparseable expiry is a GAP, never silently
    # treated as valid (module contract: "a field we cannot parse is a GAP").
    for fld, label in (("passport_expiry", "passport/ID"), ("eid_expiry", "Emirates ID")):
        raw = rec.get(fld)
        d = parse_date(raw)
        # <= : a document expiring TODAY is no longer acceptable evidence — the
        # relationship outlives the check, so flag it for renewal now.
        if d and d <= today:
            gaps.append(f"{label} document expired ({raw})")
        elif _present(raw) and d is None:
            gaps.append(f"{label} expiry date unreadable ({raw}) — verify manually")
    return gaps


def parse_customer(notes, today=None):
    """Parse the structured KYC note into:
      {country, reg_no, reg_date, screened, entity_pep, license_expiry,
       is_arrangement, arrangement_type,
       individuals:[{name, role, nationality, dob, id_number, share_pct,
                     pep_status, arrangement_role, cdd_gaps:[...]}, ...]}
    Tolerant of missing sections — anything absent is simply empty/flagged."""
    notes = notes or ""
    out = {
        "country": "", "reg_no": "", "reg_date": "", "screened": "",
        "license_expiry": "", "entity_pep": "", "individuals": [],
        "is_arrangement": False, "arrangement_type": "",
    }
    for key, label in (("country", "Country"), ("reg_no", r"Reg\.?\s*No\.?"),
                       ("reg_date", r"Reg\.?\s*Date"), ("screened", "Screened"),
                       ("license_expiry", "License Expiry"),
                       ("entity_pep", "Entity PEP Status")):
        m = _KV(label).search(notes)
        if m:
            out[key] = _clean(m.group(1))
    inds = []
    for role, block in _split_individual_blocks(notes):
        rec = parse_individual(role, block)
        named = len(rec.get("name", "")) >= 3
        # A block with no usable name is dropped only when it records nothing
        # at all (an unfilled template slot). "Name: NA" on a 60% UBO used to
        # vanish with its gaps, and the note then read as complete CDD.
        if not named and not any(_present(rec.get(k)) for k in _FIELDS if k != "name"):
            continue
        rec["cdd_gaps"] = cdd_gaps(rec, today)
        if not named:
            rec["unidentified"] = True
            rec["cdd_gaps"].insert(0, "party name not recorded — party is unidentified")
        inds.append(rec)
    out["individuals"] = inds
    # R.25 — is this customer a legal arrangement?
    arr_roles = [r["role"] for r in inds if r.get("arrangement_role")]
    if arr_roles:
        out["is_arrangement"] = True
        out["arrangement_type"] = "trust/legal arrangement (party roles: "
        out["arrangement_type"] += ", ".join(sorted(set(arr_roles))) + ")"
    return out


def jurisdiction_risk_for(country, nationalities, table=None):
    """Return (tier, reason) where tier in {'high','grey',None}. Uses the
    maintained jurisdiction list; empty table ⇒ (None, '')."""
    table = load_jurisdiction_risk() if table is None else table
    if not table:
        return None, ""
    candidates = [country] + list(nationalities or [])
    worst, who = None, ""
    rank = {"high": 2, "grey": 1, None: 0}
    for c in candidates:
        t = table.get(_norm(c))
        if rank.get(t, 0) > rank.get(worst, 0):
            worst, who = t, c
    if worst:
        return worst, f"{who} on FATF/locally-designated {'higher-risk' if worst=='high' else 'increased-monitoring (grey)'} list"
    return None, ""


# ── Public-source country indicators (context only, never scored) ─────────────
# US INCSR major money-laundering jurisdictions, US TIP Tier 2 Watch List /
# Tier 3, and the EU tax non-cooperative list (Annex I). Each value is sourced
# in the file. They are shown next to a hit's jurisdiction so the analyst sees
# them; they do NOT feed compute_risk_rating — the FATF list above stays the
# only jurisdiction scoring input. Absent file ⇒ no context; present-but-broken
# file ⇒ warned loudly.
COUNTRY_INDICATORS_PATH = os.environ.get(
    "COUNTRY_INDICATORS_PATH", "data/country-indicators.json")

# TIP tiers shown as context; Tier 1 / Tier 2 are kept in the file only.
_TIP_SHOWN = ("Tier 2 Watch List", "Tier 3")


def load_country_indicators(path=None):
    """Return {country_norm: [label, ...]} from the sourced indicator file, or {}
    if absent. Never raises. Both the source's spelling and the app baseline
    name are indexed, plus the _JURISDICTION_ALIASES short forms."""
    p = path or COUNTRY_INDICATORS_PATH
    if not os.path.exists(p):
        return {}
    try:
        with open(p, encoding="utf-8") as f:
            ind = (json.load(f).get("indicators") or {})
        out = {}

        def add(entry, label):
            for nm in {entry.get("published", ""), entry.get("app", "")}:
                k = _norm(nm)
                if k and label not in out.setdefault(k, []):
                    out[k].append(label)

        inc = ind.get("incsr_major_ml") or {}
        for e in inc.get("jurisdictions", []) or []:
            add(e, f"US INCSR major money-laundering jurisdiction ({inc.get('edition', '').split(' Volume')[0] or 'INCSR'})")
        tip = ind.get("tip_tier") or {}
        for tier in _TIP_SHOWN:
            for e in (tip.get("tiers") or {}).get(tier, []) or []:
                add(e, f"US {tip.get('edition', 'TIP Report')}: {tier}")
        eu = ind.get("eu_tax_noncooperative") or {}
        for e in eu.get("jurisdictions", []) or []:
            add(e, f"EU tax non-cooperative list, Annex I ({eu.get('published', '')})")
        for alias, target in _JURISDICTION_ALIASES.items():
            if target in out and alias not in out:
                out[alias] = list(out[target])
        if not out:
            _warn(f"country-indicators file '{p}' present but yielded 0 entries — "
                  "country context is missing this run")
        return out
    except Exception as e:
        _warn(f"country-indicators file '{p}' unreadable ({type(e).__name__}: {e}) — "
              "country context is missing this run")
        return {}


def country_indicators_for(country, nationalities, table=None):
    """Return ['<country>: <label>', ...] for the customer country and any
    nationality; [] when none apply. Context only — never a score input."""
    table = load_country_indicators() if table is None else table
    out = []
    for c in [country] + list(nationalities or []):
        for label in table.get(_norm(c), []):
            line = f"{c}: {label}"
            if line not in out:
                out.append(line)
    return out


# ── Suggested country score (DRAFT, pending MLRO approval, never scored) ──────
# Generated by scripts/country-score.mjs from the FATF lists and the sourced
# indicators above. Shown beside the app's current country score so the MLRO
# can compare; compute_risk_rating never reads it. Absent file ⇒ nothing shown;
# present-but-broken file ⇒ warned loudly.
SUGGESTED_COUNTRY_SCORE_PATH = os.environ.get(
    "SUGGESTED_COUNTRY_SCORE_PATH", "data/country-score-suggested.json")


def load_suggested_country_scores(path=None, indicators_path=None):
    """Return {country_norm: row} from the generated suggestion file, or {} if
    absent. Never raises. Rows are keyed by the app baseline name, the
    _JURISDICTION_ALIASES short forms, and the publishers' own spellings from
    the indicator file (e.g. 'Türkiye')."""
    p = path or SUGGESTED_COUNTRY_SCORE_PATH
    if not os.path.exists(p):
        return {}
    try:
        with open(p, encoding="utf-8") as f:
            rows = json.load(f).get("countries") or []
        out = {_norm(r["country"]): r for r in rows if r.get("country")}
        ip = indicators_path or COUNTRY_INDICATORS_PATH
        if os.path.exists(ip):
            try:
                with open(ip, encoding="utf-8") as f:
                    ind = json.load(f).get("indicators") or {}
                for spec in ind.values():
                    entries = list(spec.get("jurisdictions") or [])
                    for tier in (spec.get("tiers") or {}).values():
                        entries.extend(tier or [])
                    for e in entries:
                        pub, app = _norm(e.get("published")), _norm(e.get("app"))
                        if pub and app in out and pub not in out:
                            out[pub] = out[app]
            except Exception as e:  # spellings are a convenience; the rows still load
                _warn(f"country-indicators file '{ip}' unreadable ({type(e).__name__}: {e}) — "
                      "suggested country scores load without publisher spellings")
        for alias, target in _JURISDICTION_ALIASES.items():
            if target in out and alias not in out:
                out[alias] = out[target]
        if not out:
            _warn(f"suggested-country-score file '{p}' present but yielded 0 rows — "
                  "suggested country scores are missing this run")
        return out
    except Exception as e:
        _warn(f"suggested-country-score file '{p}' unreadable ({type(e).__name__}: {e}) — "
              "suggested country scores are missing this run")
        return {}


def suggested_country_score_for(country, nationalities, table=None):
    """Return ['<country>: suggested N vs current M (...)', ...] for the
    customer country and any nationality that has a suggestion. Display only —
    never a score input."""
    table = load_suggested_country_scores() if table is None else table
    out, seen = [], set()
    for c in [country] + list(nationalities or []):
        r = table.get(_norm(c))
        if not r or r.get("suggested") is None or r["country"] in seen:
            continue
        seen.add(r["country"])
        why = "; ".join(r.get("factors") or [])
        out.append(f"{c}: suggested {r['suggested']} vs current {r['current']} ({why})")
    return out


def identity_dossier(individual):
    """One-line, privacy-safe identity summary for the report (R.10 evidence)."""
    rec = individual
    bits = []
    if _present(rec.get("nationality")):
        bits.append(f"nat {rec['nationality']}")
    if _present(rec.get("dob")):
        bits.append(f"DOB {rec['dob']}")
    if rec.get("share_pct") is not None:
        bits.append(f"{rec['share_pct']:.0f}% holding")
    mid = mask_id(rec.get("id_number"))
    if mid:
        bits.append(f"ID {mid}")
    if rec.get("role"):
        bits.append(rec["role"])
    return " · ".join(bits)
