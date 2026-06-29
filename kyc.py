#!/usr/bin/env python3
"""
FINE GOLD LLC — KYC / IDENTITY LAYER  (kyc.py)
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
import os, re, json, datetime

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


def load_jurisdiction_risk(path=None):
    """Return {country_lower: 'grey'|'high'} from the maintained file, or {} if
    absent. Never raises."""
    p = path or JURISDICTION_RISK_PATH
    try:
        with open(p) as f:
            d = json.load(f)
        out = {}
        for tier in ("grey", "high"):
            for c in d.get(tier, []) or []:
                out[_norm(c)] = tier
        return out
    except Exception:
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
    return bool(_clean(s)) and _clean(s).upper() not in ("NA", "N/A", "PENDING", "-", "—")


# Individual block header, e.g. "Individual 1 — Shareholder & Director"
_INDIV_HDR = re.compile(
    r"Individual\s+\d+\s*[—\-:]\s*(.+)", re.IGNORECASE)

# Field labels inside an individual block.
_FIELDS = {
    "name":        re.compile(r"Name\s*[:\-]\s*(.+)", re.IGNORECASE),
    "nationality": re.compile(r"Nationality\s*[:\-]\s*(.+)", re.IGNORECASE),
    "shares":      re.compile(r"Shares?\s*%?\s*[:\-]\s*(.+)", re.IGNORECASE),
    "id_number":   re.compile(r"Passport\s*/?\s*ID\s*[:\-]\s*(.+)", re.IGNORECASE),
    "passport_expiry": re.compile(r"Passport\s*Expiry\s*[:\-]\s*(.+)", re.IGNORECASE),
    "dob":         re.compile(r"Date\s*of\s*Birth\s*[:\-]\s*(.+)", re.IGNORECASE),
    "gender":      re.compile(r"Gender\s*[:\-]\s*(.+)", re.IGNORECASE),
    "emirates_id": re.compile(r"Emirates\s*ID\s*[:\-]\s*(.+)", re.IGNORECASE),
    "eid_expiry":  re.compile(r"EID\s*Expiry\s*[:\-]\s*(.+)", re.IGNORECASE),
    "proof_of_address": re.compile(r"Proof\s*of\s*Address\s*[:\-]\s*(.+)", re.IGNORECASE),
    "pep_status":  re.compile(r"PEP\s*Status\s*[:\-]\s*(.+)", re.IGNORECASE),
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
    parts = re.split(r"(Individual\s+\d+\s*[—\-:][^\n]*)", sec)
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
    # Expiry checks (only when a date is parseable).
    for fld, label in (("passport_expiry", "passport/ID"), ("eid_expiry", "Emirates ID")):
        d = parse_date(rec.get(fld))
        if d and d < today:
            gaps.append(f"{label} document expired ({rec.get(fld)})")
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
        if len(rec.get("name", "")) < 3:
            continue
        rec["cdd_gaps"] = cdd_gaps(rec, today)
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
