#!/usr/bin/env python3
"""
HAWKEYE STERLING — MCP TOOL LAYER  (mcp_tools.py)
====================================================================
Pure, deterministic wrappers that expose the existing screening engine
(screen.py, kyc.py, txn_monitor.py) to a Model Context Protocol (MCP) server
(mcp_server.py). This module holds NO protocol code and imports NO third-party
package — it is the testable business layer; mcp_server.py is the thin stdio
JSON-RPC transport around it.

DESIGN RULES (identical to the rest of the engine — see ai.py):
  1. DECISION-SUPPORT ONLY. Nothing here decides, freezes, declines or files.
     Every result is evidence for a human MLRO, who retains the decision.
  2. DETERMINISTIC & SOURCED. Same input → same output. No model, no network,
     no randomness. The tools wrap the deterministic matchers/monitors only.
  3. VALIDATE AT THE BOUNDARY. MCP arguments are UNTRUSTED (an LLM or its user
     supplies them). Every tool validates types, caps sizes, and raises a
     clear ValueError the server turns into an actionable tool error, rather
     than letting a bad shape crash the engine.
  4. FAIL LOUD, DEGRADE SAFELY. An empty/absent optional list is reported as
     such (never a silent "clear"); a malformed input is rejected with a
     message that says how to fix it.

Every function returns a plain JSON-serialisable dict/list so the server can
hand it back as both human text and MCP structuredContent unchanged.
"""
import os

import screen
import kyc
import txn_monitor
import ai
import str_dossier

# ── input caps (defence in depth on untrusted MCP arguments) ──────────────────
MAX_NAME_LEN = 512
MAX_WATCHLIST = 5000
MAX_TXNS = 5000
MAX_NOTES_LEN = 200_000
MAX_NATIONALITIES = 50


def _req_str(value, field, cap=MAX_NAME_LEN):
    """Coerce a required string argument, rejecting non-strings and over-caps."""
    if not isinstance(value, str):
        raise ValueError(f"'{field}' must be a string, got {type(value).__name__}")
    s = value.strip()
    if not s:
        raise ValueError(f"'{field}' must not be empty")
    if len(value) > cap:
        raise ValueError(f"'{field}' exceeds the {cap}-character limit")
    return s


# ── TOOL: normalize_name ──────────────────────────────────────────────────────
def normalize_name(name):
    """Canonicalise a name exactly as the screening engine does before matching:
    upper-case, transliterate non-Latin script, strip diacritics/punctuation,
    collapse whitespace. Returns the normalised form and its phonetic tokens
    (the romanisation-robust keys used for fuzzy recall)."""
    s = _req_str(name, "name")
    norm = screen.normalize(s)
    return {
        "input": s,
        "normalized": norm,
        "phonetic_tokens": screen.phonetic_tokens(norm),
        "screenable": len(norm) >= 4,  # the engine skips names shorter than 4 chars
    }


def _hit_view(h):
    """Project an engine hit dict to the stable, documented MCP shape."""
    return {
        "list": h.get("list", ""),
        "matched_entry": h.get("matched_entry", ""),
        "score": h.get("score"),
        "confidence": h.get("confidence", ""),
        "match_context": h.get("match_context", ""),
    }


# ── TOOL: screen_name ─────────────────────────────────────────────────────────
def screen_name(name, watchlist, list_name="watchlist"):
    """Screen a subject name against a CALLER-SUPPLIED watchlist of names using
    the production fuzzy matcher (transliteration-aware, corporate-boilerplate
    suppressed, phonetic recall). Deterministic and fully offline. Returns the
    matches with score/confidence/context, or an explicit CLEARED result.

    watchlist: list of plain-string names to screen against.
    """
    subject = _req_str(name, "name")
    if not isinstance(watchlist, list):
        raise ValueError("'watchlist' must be an array of names")
    if len(watchlist) > MAX_WATCHLIST:
        raise ValueError(f"'watchlist' exceeds the {MAX_WATCHLIST}-entry limit")
    lname = _req_str(list_name, "list_name", cap=120)

    entries = []
    for i, raw in enumerate(watchlist):
        if not isinstance(raw, str):
            raise ValueError(f"watchlist[{i}] must be a string, got {type(raw).__name__}")
        norm = screen.normalize(raw)
        if norm:
            entries.append((norm, raw))

    hits = screen.screen_name(subject, {lname: entries})
    return {
        "subject": subject,
        "normalized": screen.normalize(subject),
        "screened_against": lname,
        "entries_screened": len(entries),
        "hit_count": len(hits),
        "cleared": len(hits) == 0,
        "hits": [_hit_view(h) for h in hits],
        "disposition_note": (
            "CLEARED against the supplied list — this is not a clear against official "
            "sanctions/PEP sources, which must be screened separately."
            if not hits else
            "POSSIBLE MATCH(ES) — decision-support only; an MLRO must adjudicate each hit."
        ),
    }


# ── TOOL: screen_internal_watchlist ───────────────────────────────────────────
def screen_internal_watchlist(name, path=None):
    """Screen a subject against the firm's committed internal watchlist
    (data/internal-watchlist.json — declined customers, known fraud
    counterparties, exited relationships). An EMPTY internal list is a valid
    'no internal designations' state and is reported as such, never as a
    degraded/failed screen."""
    subject = _req_str(name, "name")
    names, status, _meta = screen.parse_internal_watchlist(path)
    entries = [(screen.normalize(x), x) for x in names if screen.normalize(x)]
    hits = screen.screen_name(subject, {"Internal Watchlist": entries}) if entries else []
    return {
        "subject": subject,
        "list_status": status,
        "entries_screened": len(entries),
        "hit_count": len(hits),
        "cleared": len(hits) == 0,
        "hits": [_hit_view(h) for h in hits],
    }


# ── TOOL: monitor_transactions ────────────────────────────────────────────────
def monitor_transactions(transactions, jurisdiction_table=None):
    """Run the FATF R.16 transaction-monitoring rule-set over ONE customer's
    transactions: cash-threshold (AED 55,000 DPMSR), structuring/smurfing,
    velocity spikes, round-amount cash, high-risk counterparty geography, and
    the CDD trigger (AED 15,000). Returns every alert with its rule, severity
    and evidence. A rule that errors is COUNTED (never a silent all-clear).

    transactions: list of {customer, date 'YYYY-MM-DD', amount, direction
    'in'|'out', method, counterparty?, counterparty_country?}.
    """
    if not isinstance(transactions, list):
        raise ValueError("'transactions' must be an array of transaction objects")
    if len(transactions) > MAX_TXNS:
        raise ValueError(f"'transactions' exceeds the {MAX_TXNS}-item limit")
    for i, t in enumerate(transactions):
        if not isinstance(t, dict):
            raise ValueError(f"transactions[{i}] must be an object, got {type(t).__name__}")
    rule_errors = {}
    alerts = txn_monitor.evaluate_customer(transactions, jurisdiction_table, rule_errors)
    sev_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    alerts_sorted = sorted(alerts, key=lambda a: sev_rank.get(a.get("severity"), 9))
    return {
        "transaction_count": len(transactions),
        "alert_count": len(alerts_sorted),
        "alerts": alerts_sorted,
        "rules_errored": rule_errors,  # {} means every rule ran cleanly
        "clean": len(alerts_sorted) == 0 and not rule_errors,
    }


# ── TOOL: analyze_kyc_note ────────────────────────────────────────────────────
def analyze_kyc_note(notes, today=None):
    """Parse a structured KYC note (FATF R.10 CDD / R.25 legal arrangements) into
    identity records and, for each identified person, the CDD gaps an MLRO must
    close (missing ID, nationality, DOB, proof of address; expired or unreadable
    document dates). ID numbers are privacy-masked (last 3 chars). Detects
    trust/foundation/partnership arrangements from party roles."""
    _req_str(notes, "notes", cap=MAX_NOTES_LEN)
    parsed = kyc.parse_customer(notes, today)
    total_gaps = sum(len(p.get("cdd_gaps", [])) for p in parsed.get("individuals", []))
    return {
        "country": parsed.get("country", ""),
        "reg_no": parsed.get("reg_no", ""),
        "entity_pep": parsed.get("entity_pep", ""),
        "is_arrangement": parsed.get("is_arrangement", False),
        "arrangement_type": parsed.get("arrangement_type", ""),
        "individual_count": len(parsed.get("individuals", [])),
        "total_cdd_gaps": total_gaps,
        "cdd_complete": total_gaps == 0 and bool(parsed.get("individuals")),
        "individuals": [
            {
                "name": p.get("name", ""),
                "role": p.get("role", ""),
                "nationality": p.get("nationality", ""),
                "share_pct": p.get("share_pct"),
                "pep_status": p.get("pep_status", ""),
                "id_masked": kyc.mask_id(p.get("id_number")),
                "arrangement_role": p.get("arrangement_role", False),
                "cdd_gaps": p.get("cdd_gaps", []),
                "identity_dossier": kyc.identity_dossier(p),
            }
            for p in parsed.get("individuals", [])
        ],
    }


# ── TOOL: jurisdiction_risk ───────────────────────────────────────────────────
def jurisdiction_risk(country="", nationalities=None):
    """Return the FATF / locally-designated risk tier ('high' = call-for-action,
    'grey' = increased-monitoring, or null) for a customer's country and/or the
    nationalities of its principals, from the maintained jurisdiction list.
    Well-known short spellings (Iran, DRC, DPRK, Burma …) resolve to their
    listed entry. Reports the worst tier across all supplied jurisdictions."""
    if country is not None and not isinstance(country, str):
        raise ValueError("'country' must be a string")
    nats = nationalities or []
    if not isinstance(nats, list):
        raise ValueError("'nationalities' must be an array of strings")
    if len(nats) > MAX_NATIONALITIES:
        raise ValueError(f"'nationalities' exceeds the {MAX_NATIONALITIES}-item limit")
    for i, x in enumerate(nats):
        if not isinstance(x, str):
            raise ValueError(f"nationalities[{i}] must be a string")
    if not (country or "").strip() and not nats:
        raise ValueError("supply at least one of 'country' or 'nationalities'")
    table = kyc.load_jurisdiction_risk()
    tier, reason = kyc.jurisdiction_risk_for(country or "", nats, table)
    return {
        "country": country or "",
        "nationalities": nats,
        "tier": tier,  # 'high' | 'grey' | None
        "reason": reason,
        "list_available": bool(table),
        "note": (
            "jurisdiction-risk reference list is empty/absent — no tier could be assigned "
            "(this is a degraded input, not a low-risk finding)."
            if not table else
            "decision-support only; a tier NUDGES a risk score, it does not decide onboarding."
        ),
    }


# ── TOOL: name_variants ───────────────────────────────────────────────────────
def name_variants(name):
    """Return the transliteration-equivalent spellings the matcher screens under
    (Mohammed/Muhammad, Abdul/Abdel, bin/ibn …), including the name itself. Makes
    screening recall transparent: it shows WHY a fuzzy hit fired, or which
    spellings a subject was actually checked against."""
    s = _req_str(name, "name")
    # ai.name_variants returns a set — sort to a deterministic, JSON-serialisable list.
    variants = sorted(ai.name_variants(s))
    return {"input": s, "variants": variants, "count": len(variants)}


# ── TOOL: adverse_media_scan ──────────────────────────────────────────────────
def adverse_media_scan(headline):
    """Deterministically scan one news headline/snippet for the adverse-media
    keyword taxonomy (fraud, laundering, sanctions, corruption, terrorism …).
    No model, no network — pure keyword matching, so it never invents an
    allegation. Returns the matched keywords; an MLRO reads the article to
    confirm relevance."""
    s = _req_str(headline, "headline", cap=10_000)
    keywords = screen.match_adverse_keywords(s)
    return {
        "headline": s,
        "keywords": keywords,
        "keyword_count": len(keywords),
        "flagged": bool(keywords),
        "note": "keyword signal only — decision-support; an MLRO confirms the article is about the subject "
                "and genuinely adverse before any action.",
    }


# ── TOOL: assemble_str_dossier ────────────────────────────────────────────────
def assemble_str_dossier(case):
    """Assemble a DRAFT goAML-aligned suspicious-transaction-report dossier from a
    case object. DRAFT ONLY: it never files anything — the MLRO verifies every
    ground and submits through goAML. Rejects an incomplete case with the exact
    missing fields so the caller can complete it.

    case: {customer:{name,...}, risk:{rating,factors}, hits:[...], subject?,
    transactions?, indicators?, adverse_articles?, pep?, prepared_by?}.
    """
    if not isinstance(case, dict):
        raise ValueError("'case' must be an object")
    errors = str_dossier.validate_case(case)
    if errors:
        raise ValueError("case is incomplete: " + "; ".join(errors))
    dossier = str_dossier.build_dossier(case)
    return {
        "draft": True,
        "customer": (case.get("customer") or {}).get("name", ""),
        "risk_rating": (case.get("risk") or {}).get("rating", ""),
        "dossier_markdown": dossier,
        "note": "DRAFT ONLY — not filed. The MLRO must verify every ground and submit through goAML.",
    }


# ── registry: the single source of truth the server builds its tool list from ──
# name -> (callable, human description, JSON-Schema inputSchema).
TOOLS = {
    "hawkeye_normalize_name": (
        normalize_name,
        normalize_name.__doc__,
        {
            "type": "object",
            "properties": {"name": {"type": "string", "description": "The name to canonicalise."}},
            "required": ["name"],
            "additionalProperties": False,
        },
    ),
    "hawkeye_screen_name": (
        screen_name,
        screen_name.__doc__,
        {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Subject name to screen."},
                "watchlist": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Names to screen the subject against.",
                },
                "list_name": {"type": "string", "description": "Label for the supplied list (optional)."},
            },
            "required": ["name", "watchlist"],
            "additionalProperties": False,
        },
    ),
    "hawkeye_screen_internal_watchlist": (
        screen_internal_watchlist,
        screen_internal_watchlist.__doc__,
        {
            "type": "object",
            "properties": {"name": {"type": "string", "description": "Subject name to screen."}},
            "required": ["name"],
            "additionalProperties": False,
        },
    ),
    "hawkeye_monitor_transactions": (
        monitor_transactions,
        monitor_transactions.__doc__,
        {
            "type": "object",
            "properties": {
                "transactions": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "One customer's transactions.",
                }
            },
            "required": ["transactions"],
            "additionalProperties": False,
        },
    ),
    "hawkeye_analyze_kyc_note": (
        analyze_kyc_note,
        analyze_kyc_note.__doc__,
        {
            "type": "object",
            "properties": {"notes": {"type": "string", "description": "The structured KYC note text."}},
            "required": ["notes"],
            "additionalProperties": False,
        },
    ),
    "hawkeye_jurisdiction_risk": (
        jurisdiction_risk,
        jurisdiction_risk.__doc__,
        {
            "type": "object",
            "properties": {
                "country": {"type": "string", "description": "Customer country of incorporation/operation."},
                "nationalities": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Nationalities of principals/UBOs (optional).",
                },
            },
            "additionalProperties": False,
        },
    ),
    "hawkeye_name_variants": (
        name_variants,
        name_variants.__doc__,
        {
            "type": "object",
            "properties": {"name": {"type": "string", "description": "The name to expand into spelling variants."}},
            "required": ["name"],
            "additionalProperties": False,
        },
    ),
    "hawkeye_adverse_media_scan": (
        adverse_media_scan,
        adverse_media_scan.__doc__,
        {
            "type": "object",
            "properties": {"headline": {"type": "string", "description": "The news headline/snippet to scan."}},
            "required": ["headline"],
            "additionalProperties": False,
        },
    ),
    "hawkeye_assemble_str_dossier": (
        assemble_str_dossier,
        assemble_str_dossier.__doc__,
        {
            "type": "object",
            "properties": {"case": {"type": "object", "description": "The case object (customer, risk, hits, …)."}},
            "required": ["case"],
            "additionalProperties": False,
        },
    ),
}


def call_tool(name, arguments):
    """Dispatch a validated tool call. Raises KeyError for an unknown tool and
    ValueError for a bad argument shape; the server maps both to tool errors."""
    if name not in TOOLS:
        raise KeyError(name)
    fn = TOOLS[name][0]
    args = arguments if isinstance(arguments, dict) else {}
    return fn(**args)


# ── read-only reference resources (name -> (uri, mimeType, loader)) ───────────
def _read_json_file(rel):
    root = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(root, rel), encoding="utf-8") as f:
        return f.read()


RESOURCES = {
    "hawkeye://reference/jurisdiction-risk": (
        "FATF / locally-designated higher-risk jurisdiction reference list",
        "application/json",
        lambda: _read_json_file("data/jurisdiction-risk.json"),
    ),
    "hawkeye://reference/internal-watchlist": (
        "Firm-internal watchlist (declined/known-bad counterparties)",
        "application/json",
        lambda: _read_json_file("data/internal-watchlist.json"),
    ),
}
