#!/usr/bin/env python3
"""
HAWKEYE STERLING — PAYMENT SCREENING  (payment_screen.py)
==========================================================
Screens the PARTIES of a payment, not the customer's behaviour: originator,
beneficiary, ultimate parties, the banks in the chain (ordering, intermediary,
correspondent, account-with) and the free-text payment reference. It answers
"is anyone involved in this payment a sanctioned or prohibited party?" — the
counterpart of txn_monitor.py, which answers "is the activity unusual?".

What it does, per payment:
  • every NAMED party → the production sanctions matcher (screen.screen_name,
    the same recall-monotone matcher as the daily screen — nothing re-implemented);
  • every party COUNTRY (stated, or derived from a BIC's country code) → the
    maintained FATF jurisdiction list (data/jurisdiction-risk.json);
  • the payment reference / remittance text → multi-word designated names
    appearing inside it (a vessel or company named in ":70: INVOICE …");
  • FATF R.16 completeness — originator AND beneficiary names must be present.

Inputs: a SWIFT MT103 message, an ISO 20022 pacs.008 message, or a transaction
feed record (data/transaction-feed.schema.json) carrying `payment_message` or
`parties`. Parsing is stdlib-only; pacs.008 goes through the caller-supplied
`xml_parser` — in production screen.safe_xml_fromstring (DTD/entity declarations
refused, size capped).

DEPENDENCIES ARE INJECTED, NEVER IMPORTED: this module does not import screen.py
(screen.py imports THIS module, so importing back would be a cycle). The caller
passes the production `matcher` (screen.screen_name), `normalizer`
(screen.normalize) and `xml_parser` (screen.safe_xml_fromstring). A missing one
raises ValueError — screening never silently falls back to a weaker matcher.

DEGRADE LOUDLY: a payment is never reported clear on unverified state. If a core
sanctions list did not load, "no match" is PROVISIONAL and says which list; a
party that could not be name-screened (a bank given only by BIC) is listed as
such; a payment missing originator/beneficiary names is INCOMPLETE.

INERT IN PRODUCTION until a transaction feed is configured (TXN_FEED_PATH, see
txn_monitor.py). It never invents payments; it is tested on synthetic fixtures.
Every outcome is decision-support: a potential match opens the TFS Name-Match
Procedure (POL-07, docs/aims/tfs-name-match-procedure.md) and the MLRO decides.
"""
import re

# ISO 3166-1 alpha-2 codes for every jurisdiction in data/jurisdiction-risk.json,
# keyed to the exact spelling used there. A payment carries country CODES
# (pacs.008 <Ctry>, a BIC's 5th-6th characters); the maintained list carries
# NAMES. test/engine_test.py fails if a listed jurisdiction has no code here, so
# a plenary update cannot silently drop a jurisdiction from payment screening.
ISO2_TO_JURISDICTION = {
    "AO": "angola", "BO": "bolivia", "BA": "bosnia-herzegovina",
    "VG": "british virgin islands", "BG": "bulgaria", "CM": "cameroon",
    "CI": "cote d'ivoire", "CD": "the democratic republic of congo", "HT": "haiti",
    "IQ": "iraq", "KE": "kenya", "KW": "kuwait",
    "LA": "lao people's democratic republic", "LB": "lebanon", "MC": "monaco",
    "NP": "nepal", "PG": "papua new guinea", "SS": "south sudan", "SY": "syria",
    "VE": "venezuela", "VN": "vietnam", "YE": "yemen",
    "IR": "islamic republic of iran", "KP": "north korea", "MM": "myanmar",
}

# Party roles. ORIGINATOR / BENEFICIARY are the R.16 mandatory pair.
ORIGINATOR, BENEFICIARY = "originator", "beneficiary"
ROLE_LABELS = {
    "originator": "Originator (ordering customer)",
    "ultimate_originator": "Ultimate originator",
    "beneficiary": "Beneficiary",
    "ultimate_beneficiary": "Ultimate beneficiary",
    "ordering_institution": "Ordering institution",
    "senders_correspondent": "Sender's correspondent",
    "receivers_correspondent": "Receiver's correspondent",
    "intermediary": "Intermediary institution",
    "account_with_institution": "Beneficiary's bank (account-with institution)",
    "beneficial_owner": "Beneficial owner",
    "other": "Other party",
}

# MT103 tag → role. The option letter (A = BIC, D/K/F/no letter = name and
# address) only changes how the party is read, not who it is.
_MT103_ROLES = {
    "50": "originator", "52": "ordering_institution", "53": "senders_correspondent",
    "54": "receivers_correspondent", "56": "intermediary",
    "57": "account_with_institution", "59": "beneficiary",
}
_BIC_RE = re.compile(r"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$")
# A designated name embedded in free text only counts when it is long and
# multi-word: single tokens ("GOLD", "STAR") inside an invoice line are noise.
REMITTANCE_MIN_TOKENS = 2
REMITTANCE_MIN_CHARS = 10
MAX_PAYMENT_TEXT = 200_000


def _clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def bic_country(bic):
    """The ISO country code inside a BIC (characters 5-6), or ''."""
    b = _clean(bic).upper()
    return b[4:6] if _BIC_RE.match(b) else ""


def _party(role, name="", bic="", country="", source=""):
    bic = _clean(bic).upper()
    country = _clean(country).upper()[:2] or bic_country(bic)
    return {"role": role, "name": _clean(name), "bic": bic, "country": country,
            "source": source}


# ── SWIFT MT103 ───────────────────────────────────────────────────────────────
_MT_FIELD_RE = re.compile(r"(?m)^:(\d{2})([A-Z]?):")


def _mt_fields(text):
    """Split block 4 of an MT message into [(tag, option, value)] in order."""
    body = str(text or "")
    if len(body) > MAX_PAYMENT_TEXT:
        raise ValueError("payment message too large")
    m = re.search(r"\{4:\s*(.*?)-\}", body, re.S)
    if m:
        body = m.group(1)
    body = body.replace("\r\n", "\n").replace("\r", "\n")
    marks = list(_MT_FIELD_RE.finditer(body))
    out = []
    for i, mk in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(body)
        out.append((mk.group(1), mk.group(2), body[mk.end():end].strip("\n")))
    return out


def _mt_party(role, option, value):
    lines = [ln.strip() for ln in value.split("\n") if ln.strip()]
    account_free = [ln for ln in lines if not ln.startswith("/")]
    if option == "A":                       # [/account] + BIC
        bic = account_free[0] if account_free else ""
        return _party(role, bic=bic, source=f":{_tag(role)}A:")
    if option == "F":                       # structured: 1/name 2/address 3/CC/town
        names = [ln[2:] for ln in lines if ln.startswith("1/")]
        ctry = next((ln[2:4] for ln in lines if ln.startswith("3/")), "")
        return _party(role, name=" ".join(names), country=ctry, source=f":{_tag(role)}F:")
    # K / D / no letter: [/account] then name, then address lines.
    return _party(role, name=account_free[0] if account_free else "",
                  source=f":{_tag(role)}{option}:")


def _tag(role):
    return next((t for t, r in _MT103_ROLES.items() if r == role), "")


def parse_mt103(text):
    """Parse a SWIFT MT103 into the normalised payment shape. Unknown fields are
    ignored; nothing is invented — an absent party is simply absent."""
    pay = {"format": "MT103", "reference": "", "date": "", "currency": "",
           "amount": None, "parties": [], "remittance": []}
    for tag, opt, val in _mt_fields(text):
        if tag == "20":
            pay["reference"] = _clean(val)
        elif tag == "32" and opt == "A":
            m = re.match(r"\s*(\d{6})([A-Z]{3})([\d,\.]+)", val)
            if m:
                d = m.group(1)
                pay["date"] = f"20{d[0:2]}-{d[2:4]}-{d[4:6]}"
                pay["currency"] = m.group(2)
                try:
                    pay["amount"] = float(m.group(3).replace(",", "."))
                except ValueError:
                    pay["amount"] = None
        elif tag in _MT103_ROLES:
            pay["parties"].append(_mt_party(_MT103_ROLES[tag], opt, val))
        elif tag in ("70", "72"):
            pay["remittance"].append(_clean(val.replace("\n", " ")))
    return pay


# ── ISO 20022 pacs.008 ────────────────────────────────────────────────────────
def _local(tag):
    return str(tag).split("}")[-1]


def _child(el, *path):
    cur = el
    for name in path:
        if cur is None:
            return None
        cur = next((c for c in cur if _local(c.tag) == name), None)
    return cur


def _text(el, *path):
    node = _child(el, *path)
    return _clean(node.text) if node is not None and node.text else ""


def _pacs_party(tx, role, elname):
    p = _child(tx, elname)
    if p is None:
        return None
    return _party(role, name=_text(p, "Nm"), country=_text(p, "PstlAdr", "Ctry")
                  or _text(p, "CtryOfRes"), source=f"<{elname}>")


def _pacs_agent(tx, role, elname):
    a = _child(tx, elname, "FinInstnId")
    if a is None:
        return None
    return _party(role, name=_text(a, "Nm"), bic=_text(a, "BICFI") or _text(a, "BIC"),
                  country=_text(a, "PstlAdr", "Ctry"), source=f"<{elname}>")


def parse_pacs008(xml_text, xml_parser=None):
    """Parse an ISO 20022 pacs.008 (FI-to-FI customer credit transfer) into a
    list of normalised payments, one per <CdtTrfTxInf>. Namespace-agnostic.
    `xml_parser` must refuse DTD/entity declarations (screen.safe_xml_fromstring)."""
    if xml_parser is None:
        raise ValueError("no hardened XML parser supplied (pass screen.safe_xml_fromstring)")
    if len(str(xml_text or "")) > MAX_PAYMENT_TEXT:
        raise ValueError("payment message too large")
    root = xml_parser(xml_text)
    txs = [el for el in root.iter() if _local(el.tag) == "CdtTrfTxInf"]
    grp = next((el for el in root.iter() if _local(el.tag) == "GrpHdr"), None)
    grp_date = _text(grp, "IntrBkSttlmDt") if grp is not None else ""
    out = []
    for tx in txs:
        amt = _child(tx, "IntrBkSttlmAmt")
        try:
            amount = float(amt.text) if amt is not None and amt.text else None
        except ValueError:
            amount = None
        parties = [
            _pacs_party(tx, "originator", "Dbtr"),
            _pacs_party(tx, "ultimate_originator", "UltmtDbtr"),
            _pacs_agent(tx, "ordering_institution", "DbtrAgt"),
            _pacs_agent(tx, "intermediary", "IntrmyAgt1"),
            _pacs_agent(tx, "intermediary", "IntrmyAgt2"),
            _pacs_agent(tx, "intermediary", "IntrmyAgt3"),
            _pacs_agent(tx, "account_with_institution", "CdtrAgt"),
            _pacs_party(tx, "beneficiary", "Cdtr"),
            _pacs_party(tx, "ultimate_beneficiary", "UltmtCdtr"),
        ]
        rmt = [_clean(el.text) for el in tx.iter()
               if _local(el.tag) == "Ustrd" and el.text and el.text.strip()]
        out.append({
            "format": "pacs.008",
            "reference": _text(tx, "PmtId", "EndToEndId") or _text(tx, "PmtId", "TxId"),
            "date": _text(tx, "IntrBkSttlmDt") or grp_date,
            "currency": (amt.get("Ccy") if amt is not None else "") or "",
            "amount": amount,
            "parties": [p for p in parties if p is not None],
            "remittance": rmt,
        })
    return out


def parse_payment_message(text, xml_parser=None):
    """Detect the message type and return a list of normalised payments."""
    s = str(text or "").lstrip()
    if s.startswith("<"):
        return parse_pacs008(s, xml_parser)
    return [parse_mt103(s)]


def payment_from_feed(txn, xml_parser=None):
    """Normalised payments for ONE transaction-feed record. Uses, in order:
    `payment_message` (raw MT103 / pacs.008), an explicit `parties` array, or the
    legacy single `counterparty` (+ the customer as the other side). Returns []
    when the record names no party at all."""
    if not isinstance(txn, dict):
        return []
    if txn.get("payment_message"):
        pays = parse_payment_message(txn["payment_message"], xml_parser)
        for p in pays:
            p["reference"] = p.get("reference") or _clean(txn.get("transaction_id"))
            p["permalink"] = _clean(txn.get("permalink"))
            p["customer"] = _clean(txn.get("customer"))
        return pays
    parties = []
    for p in txn.get("parties") or []:
        if isinstance(p, dict) and p.get("role") in ROLE_LABELS:
            party = _party(p["role"], p.get("name", ""), p.get("bic", ""),
                           p.get("country", ""), source="feed.parties")
            if p.get("country_name"):
                party["country_name"] = _clean(p["country_name"])
            parties.append(party)
    if not parties and (txn.get("counterparty") or txn.get("customer")):
        inbound = str(txn.get("direction", "")).lower() == "in"
        cust = _party(BENEFICIARY if inbound else ORIGINATOR, txn.get("customer", ""),
                      source="feed.customer")
        cpty = _party(ORIGINATOR if inbound else BENEFICIARY, txn.get("counterparty", ""),
                      source="feed.counterparty")
        # The legacy feed records the counterparty country as a NAME.
        cpty["country_name"] = _clean(txn.get("counterparty_country"))
        parties = [cust, cpty]
    if not parties:
        return []
    rem = txn.get("remittance_info")
    return [{"format": "feed", "reference": _clean(txn.get("transaction_id")),
             "date": _clean(txn.get("date")), "currency": _clean(txn.get("currency")),
             "amount": txn.get("amount"), "parties": parties,
             "remittance": [_clean(rem)] if rem else [],
             "permalink": _clean(txn.get("permalink")), "customer": _clean(txn.get("customer"))}]


# ── ASANA "PAYMENTS REGISTER" ────────────────────────────────────────────────
# One Asana task per payment. The task NAME is the payment reference; the task
# DESCRIPTION is either a pasted SWIFT MT103 / ISO 20022 pacs.008 message, or
# this template (one "Field: value" per line, unknown lines ignored):
#
#   Date: 2026-10-01                 Direction: in | out
#   Amount: 250000                   Currency: AED
#   Method: wire | cash | gold       Customer: <our customer>
#   Originator: <name>               Originator country: AE
#   Beneficiary: <name>              Beneficiary country: HK
#   Ultimate originator: <name>      Ultimate beneficiary: <name>
#   Ordering bank: <name or BIC>     Intermediary bank: <name or BIC>
#   Beneficiary bank: <name or BIC>  Beneficial owner: <name>
#   Reference: INVOICE 12345 GOODS PAYMENT
#   Expected monthly volume: 500000  (the customer's declared KYC profile, AED)
#
# A "... country" line takes an ISO code (AE) or a name; a "... bank" line
# holding a BIC is read as a BIC (its country comes from the code).
REGISTER_TEMPLATE_FIELDS = {
    "originator": "originator", "ordering customer": "originator",
    "ultimate originator": "ultimate_originator",
    "beneficiary": "beneficiary", "ultimate beneficiary": "ultimate_beneficiary",
    "ordering bank": "ordering_institution", "ordering institution": "ordering_institution",
    "intermediary bank": "intermediary", "intermediary": "intermediary",
    "correspondent bank": "intermediary",
    "beneficiary bank": "account_with_institution",
    "account with institution": "account_with_institution",
    "beneficial owner": "beneficial_owner",
}
# "Key: value", where the key may carry a bracketed hint that is ignored
# ("Weight (grams): 1000" is the key "weight").
_REG_LINE_RE = re.compile(r"^\s*([A-Za-z][A-Za-z ]{1,40}?)\s*(?:\([^)]{0,60}\))?\s*:\s*(.*?)\s*$")


def _num(v):
    try:
        return float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def _yes_no(v):
    v = str(v or "").strip().lower()
    if v in ("yes", "y", "true"):
        return True
    if v in ("no", "n", "false"):
        return False
    return None


def _first_num(v):
    m = re.search(r"\d[\d,]*(?:\.\d+)?", str(v or ""))
    return _num(m.group(0)) if m else None


# Optional template lines that feed the monitoring rules (txn_monitor). A line
# is used only when its value is an explicit yes/no or number; anything else is
# ignored, never guessed. "Red flags:" takes codes from data/str-red-flags.json.
REGISTER_MONITORING_FIELDS = (
    "Type (buy | sell | refund)", "Weight (grams)", "Purpose",
    "Unit price", "Market price",
    "Third party payment (yes/no)", "Third party relationship (related | unrelated)",
    "Corporate paid from personal account (yes/no)", "Source of funds verified (yes/no)",
    "Payment completed (yes/no)", "Delivery confirmed (yes/no)",
    "Invoice mismatch (yes/no)", "Route mismatch (yes/no)",
    "Funding account", "Refund account", "Refund reason documented (yes/no)",
    "Red flags (codes, e.g. ML-11, TF-07)",
)


def _register_monitoring_fields(fields):
    out = {}
    typ = str(fields.get("type") or fields.get("transaction type") or "").strip().lower()
    if typ:
        out["transaction_type"] = typ
    for key, dest in (("weight", "weight_g"), ("weight grams", "weight_g"),
                      ("unit price", "unit_price"), ("market price", "market_unit_price")):
        n = _first_num(fields.get(key))
        if n is not None:
            out[dest] = n
    if fields.get("purpose"):
        out["purpose"] = fields["purpose"]
    for key, dest in (("third party payment", "third_party_payment"),
                      ("corporate paid from personal account", "personal_account_for_corporate"),
                      ("source of funds verified", "source_of_funds_verified"),
                      ("payment completed", "payment_completed"),
                      ("delivery confirmed", "delivery_confirmed"),
                      ("invoice mismatch", "invoice_mismatch"),
                      ("route mismatch", "route_mismatch"),
                      ("refund reason documented", "refund_reason_documented")):
        b = _yes_no(fields.get(key))
        if b is not None:
            out[dest] = b
    if "delivery_confirmed" in out:
        out["goods_transaction"] = True   # a delivery line means a goods trade
    for key, dest in (("third party relationship", "third_party_relationship"),
                      ("funding account", "funding_account"),
                      ("refund account", "refund_account")):
        if fields.get(key):
            out[dest] = str(fields[key]).strip().lower() if dest == "third_party_relationship" \
                else str(fields[key]).strip()
    codes = re.findall(r"\b(?:(?:STR|SAR)-)?[A-Z]{2}-\d{1,3}\b", str(fields.get("red flags") or ""),
                       re.IGNORECASE)
    if codes:
        out["red_flags"] = [c.upper() for c in codes]
    return out


def parse_register_entry(name, notes):
    """Turn ONE Payments Register task (name + description) into a transaction-
    feed record. Returns None when the description is neither a payment message
    nor a filled template (nothing to screen — the caller counts it)."""
    text = str(notes or "")
    if len(text) > MAX_PAYMENT_TEXT:
        raise ValueError("payment register entry too large")
    stripped = text.lstrip()
    if stripped.startswith("<") or re.search(r"(?m)^:20:", text):
        return {"transaction_id": _clean(name), "payment_message": stripped}
    fields, parties, countries = {}, {}, {}
    for line in text.splitlines():
        m = _REG_LINE_RE.match(line)
        if not m:
            continue
        key, val = m.group(1).strip().lower(), _clean(m.group(2))
        if not val:
            continue
        if key.endswith(" country"):
            countries[key[:-len(" country")]] = val
        elif key in REGISTER_TEMPLATE_FIELDS:
            parties.setdefault(REGISTER_TEMPLATE_FIELDS[key], []).append((key, val))
        else:
            fields[key] = val
    if not parties:
        # An ACTIVITY record: no payment, but red flags observed on a customer
        # (SAR register — behaviour, documents, ownership, sourcing …). It goes
        # through the monitoring rules and the report, never payment screening.
        extra = _register_monitoring_fields(fields)
        if extra.get("red_flags") and fields.get("customer"):
            return {"transaction_id": _clean(name), "activity_only": True,
                    "customer": fields["customer"], "date": fields.get("date", ""), **extra}
        return None
    out_parties = []
    for role, entries in parties.items():
        for key, val in entries:
            ctry = countries.get(key, "")
            party = {"role": role}
            if _BIC_RE.match(val.upper()):
                party["bic"] = val.upper()
            else:
                party["name"] = val
            if len(ctry) == 2 and ctry.isalpha():
                party["country"] = ctry.upper()
            elif ctry:
                party["country_name"] = ctry
            out_parties.append(party)
    rec = {"transaction_id": _clean(name), "parties": out_parties,
           "date": fields.get("date", ""), "currency": fields.get("currency", "").upper(),
           "direction": fields.get("direction", "").lower(),
           "method": fields.get("method", "").lower(),
           "customer": fields.get("customer", ""),
           "remittance_info": fields.get("reference", "")}
    amount = _num(fields.get("amount"))
    if amount is not None:
        rec["amount"] = amount
    emv = _num(fields.get("expected monthly volume"))
    if emv:
        rec["expected_monthly_volume"] = emv
    rec.update(_register_monitoring_fields(fields))
    # Mirror the main parties into the legacy fields the monitoring rules read.
    other = "originator" if rec["direction"] == "in" else "beneficiary"
    cp = next((p for p in out_parties if p["role"] == other and p.get("name")), None)
    if cp:
        rec["counterparty"] = cp["name"]
        rec["counterparty_country"] = (ISO2_TO_JURISDICTION.get(cp.get("country", ""), "")
                                       or cp.get("country_name") or cp.get("country", ""))
    return rec


# ── SCREENING ─────────────────────────────────────────────────────────────────
def _jurisdiction_tier(party, table):
    if not table:
        return None, ""
    name = party.get("country_name") or ISO2_TO_JURISDICTION.get(party.get("country", ""), "")
    key = _clean(name).lower()
    return table.get(key), (name or party.get("country", ""))


def _remittance_hits(texts, all_lists, normalizer):
    hits = []
    padded = [" " + normalizer(t) + " " for t in texts if t]
    if not padded:
        return hits
    for list_name, entries in all_lists.items():
        for en, orig in entries:
            if len(en) < REMITTANCE_MIN_CHARS or len(en.split()) < REMITTANCE_MIN_TOKENS:
                continue
            needle = " " + en + " "
            if any(needle in p for p in padded):
                hits.append({"list": list_name, "matched_entry": orig, "score": 100,
                             "where": "payment reference / remittance text"})
    return hits


def screen_payment(payment, all_lists, *, jurisdiction_table=None, lists_degraded=(),
                   matcher=None, normalizer=None):
    """Screen ONE normalised payment. Returns
    {reference, outcome, severity, parties:[...], remittance_hits, findings:[...],
     r16_missing:[...], provisional}.

    outcome ∈ STOP — POTENTIAL SANCTIONS MATCH | REVIEW — HIGH-RISK JURISDICTION |
              REVIEW — INCOMPLETE (R.16) | NO MATCH | NO MATCH — PROVISIONAL
    """
    if matcher is None or normalizer is None:
        raise ValueError("matcher and normalizer are required (screen.screen_name, screen.normalize)")
    findings, parties_out = [], []
    max_tier = None
    for p in payment.get("parties", []):
        rec = dict(p)
        rec["label"] = ROLE_LABELS.get(p["role"], p["role"])
        if p.get("name") and len(normalizer(p["name"])) >= 4:
            rec["hits"] = matcher(p["name"], all_lists) or []
            rec["name_screened"] = True
        else:
            rec["hits"] = []
            rec["name_screened"] = False
            rec["note"] = ("BIC only — name not supplied, so not name-screened; country checked"
                           if p.get("bic") else "no screenable name supplied")
        tier, where = _jurisdiction_tier(p, jurisdiction_table)
        rec["jurisdiction_tier"] = tier
        rec["jurisdiction"] = where
        if tier == "high" or (tier == "grey" and max_tier is None):
            max_tier = tier
        for h in rec["hits"]:
            findings.append(f"{rec['label']} \"{p['name']}\" → {h.get('list')}: "
                            f"\"{h.get('matched_entry')}\" {h.get('score')}%")
        if tier:
            findings.append(f"{rec['label']} in {where} — FATF "
                            + ("call-for-action" if tier == "high" else "increased-monitoring")
                            + " jurisdiction")
        parties_out.append(rec)
    rem_hits = _remittance_hits(payment.get("remittance", []), all_lists, normalizer)
    for h in rem_hits:
        findings.append(f"Payment reference names \"{h['matched_entry']}\" ({h['list']})")

    named = {p["role"] for p in payment.get("parties", []) if p.get("name")}
    r16_missing = [ROLE_LABELS[r] for r in (ORIGINATOR, BENEFICIARY) if r not in named]

    any_hit = rem_hits or any(r["hits"] for r in parties_out)
    if any_hit:
        outcome, severity = "STOP — POTENTIAL SANCTIONS MATCH", "CRITICAL"
    elif max_tier == "high":
        outcome, severity = "REVIEW — HIGH-RISK JURISDICTION", "HIGH"
    elif r16_missing:
        outcome, severity = "REVIEW — INCOMPLETE (R.16)", "HIGH"
    elif max_tier == "grey":
        outcome, severity = "REVIEW — HIGH-RISK JURISDICTION", "MEDIUM"
    elif lists_degraded:
        outcome, severity = "NO MATCH — PROVISIONAL", "MEDIUM"
    else:
        outcome, severity = "NO MATCH", "LOW"
    return {"reference": payment.get("reference", ""), "format": payment.get("format", ""),
            "date": payment.get("date", ""), "amount": payment.get("amount"),
            "currency": payment.get("currency", ""), "outcome": outcome,
            "permalink": payment.get("permalink", ""), "customer": payment.get("customer", ""),
            "severity": severity, "parties": parties_out, "remittance_hits": rem_hits,
            "findings": findings, "r16_missing": r16_missing,
            "provisional": bool(lists_degraded) and not any_hit,
            "lists_degraded": list(lists_degraded)}


def screen_feed(transactions, all_lists, *, jurisdiction_table=None, lists_degraded=(),
                matcher=None, normalizer=None, xml_parser=None):
    """Screen every payment in a transaction feed. A record that cannot be parsed
    is COUNTED (never dropped silently). Returns {n_payments, results, errors}."""
    results, errors = [], []
    for i, t in enumerate(transactions or []):
        try:
            pays = payment_from_feed(t, xml_parser)
        except Exception as e:   # a malformed message is disclosed, not skipped
            errors.append(f"record {i}: {type(e).__name__}: {str(e)[:120]}")
            continue
        for p in pays:
            results.append(screen_payment(p, all_lists, jurisdiction_table=jurisdiction_table,
                                          lists_degraded=lists_degraded, matcher=matcher,
                                          normalizer=normalizer))
    rank = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    results.sort(key=lambda r: rank.get(r["severity"], 0), reverse=True)
    return {"n_payments": len(results), "results": results, "errors": errors}


def report_lines(feed_result, configured):
    """Lines for the daily report. Honest about an absent feed and about every
    payment that is not a plain NO MATCH."""
    if not configured:
        return ["Payment screening (parties): engine ready & tested, INACTIVE — no payment "
                "source connected (Asana Payments Register section: ASANA_PAYMENTS_SECTION_GID; or a file feed: "
                "TXN_FEED_PATH). No payment is screened until one is configured."]
    res = feed_result or {"n_payments": 0, "results": [], "errors": []}
    flagged = [r for r in res["results"] if r["outcome"] != "NO MATCH"]
    lines = [f"Payment screening (parties): ACTIVE — {res['n_payments']} payment(s) screened → "
             f"{len(flagged)} need attention."]
    if res["errors"]:
        lines.append(f"   ⚠ {len(res['errors'])} feed record(s) could not be parsed and were NOT "
                     "screened: " + "; ".join(res["errors"][:3]))
    for r in flagged:
        ref = r["reference"] or "(no reference)"
        amt = f"{r['amount']:,.2f} {r['currency']}".strip() if isinstance(r["amount"], (int, float)) else ""
        lines.append(f"   [{r['severity']}] {r['outcome']} — payment {ref} {r['date']} {amt}".rstrip())
        if r.get("permalink"):
            lines.append(f"      Record: {r['permalink']}")
        for f in r["findings"]:
            lines.append(f"      • {f}")
        if r["r16_missing"]:
            lines.append("      • R.16: missing " + " and ".join(r["r16_missing"]) + " name")
        for p in r["parties"]:
            if not p["name_screened"]:
                lines.append(f"      • {p['label']}: {p['note']}")
        if r["provisional"]:
            lines.append("      • core list(s) not loaded: " + ", ".join(r["lists_degraded"])
                         + " — 'no match' is provisional")
        if r["severity"] == "CRITICAL":
            lines.append("      → POL-07: hold the payment, verify identifiers, then PNMR "
                         "(potential) or freeze + CNMR + FFR (confirmed) in goAML. MLRO decides.")
    return lines


# ── DAILY TRANSACTION MONITORING REPORT (Asana "Transaction Monitoring") ──────
# One task per day, filed in the SAME section the payments are entered in, so
# the MLRO sees the results next to the payments. The register reader skips
# every task whose name starts with TM_REPORT_PREFIX: a report is never read
# back as a payment, and never counted as an unreadable payment either.
TM_REPORT_PREFIX = "Transaction Monitoring Daily Report — "


def is_tm_report_task(name):
    return str(name or "").startswith(TM_REPORT_PREFIX)


_SEV_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
_DPMSR_RULES = {"THRESHOLD", "LINKED_THRESHOLD"}
_NOT_SUSPICION_RULES = _DPMSR_RULES | {"CDD_TRIGGER"}   # obligations, not suspicion
TM_CASES_SHOWN = 25          # customers detailed in §④; the rest are counted
MULTIPLE_INDICATORS_MIN = 3  # distinct indicators on one customer → heightened scrutiny


def _amount_label(r):
    a = r.get("amount")
    return f"{a:,.2f} {r.get('currency', '')}".strip() if isinstance(a, (int, float)) else ""


def _customer_cases(flagged, alerts):
    """Group every finding by customer: {customer: {...}}, worst first."""
    cases = {}

    def case(name):
        return cases.setdefault(name or "(customer not stated)", {
            "severity": "LOW", "findings": [], "indicators": set(), "refs": set(),
            "dpmsr": False, "tfs": False, "edd": False, "str_sar": False, "cdd": False})
    for r in flagged:
        c = case(r.get("customer"))
        ref = r["reference"] or "(no reference)"
        c["findings"].append(f"[{r['severity']}] {r['outcome']} — payment {ref} {r['date']} "
                             + _amount_label(r))
        c["indicators"].add(r["outcome"].split(" — ")[0] + ":" + r["outcome"])
        c["tfs"] |= r["outcome"].startswith("STOP")
        c["edd"] |= r["outcome"].startswith("REVIEW")
        if r.get("permalink"):
            c["refs"].add(r["permalink"])
        if _SEV_RANK.get(r["severity"], 0) > _SEV_RANK[c["severity"]]:
            c["severity"] = r["severity"]
    for a in alerts:
        c = case(a.get("customer"))
        c["findings"].append(f"[{a['severity']}] {a['rule']} — {a['date']}: {a['detail']}")
        c["indicators"].add(a["rule"] + ":" + (a["detail"].split(" ")[0] if a["rule"] == "RED_FLAG" else ""))
        c["dpmsr"] |= a["rule"] in _DPMSR_RULES
        c["cdd"] |= a["rule"] == "CDD_TRIGGER"
        c["tfs"] |= a["rule"] == "RED_FLAG" and a["severity"] == "CRITICAL"
        c["str_sar"] |= (a["rule"] not in _NOT_SUSPICION_RULES
                         and _SEV_RANK.get(a["severity"], 0) >= _SEV_RANK["MEDIUM"])
        if a.get("permalink"):
            c["refs"].add(a["permalink"])
        if _SEV_RANK.get(a["severity"], 0) > _SEV_RANK[c["severity"]]:
            c["severity"] = a["severity"]
    for c in cases.values():
        c["str_sar"] |= c["tfs"] or c["edd"]
    return dict(sorted(cases.items(), key=lambda kv: (-_SEV_RANK[kv[1]["severity"]],
                                                       -len(kv[1]["indicators"]), kv[0])))


def build_tm_daily_report(date_label, feed_result, tm_alerts, *, register_read,
                          unreadable=0, degraded="", rule_errors=None, activities=0,
                          flag_refs=None):
    """(task name, task notes) for the daily Transaction Monitoring report.

    feed_result — screen_feed() output for the section's payments (None when
    screening did not run); tm_alerts — txn_monitor.evaluate(...)["alerts"]
    for the open payments and activity records; register_read / activities —
    open payment / activity-only tasks read; unreadable — tasks with nothing
    usable; degraded — non-empty when the run could not read or screen the
    section (then NOTHING is cleared and the title says so); rule_errors —
    {rule: count} of rules that crashed (title DEGRADED); flag_refs — optional
    rule -> [red-flag codes] lookup, so each alert cites the register entries
    it evidences. Every decision field is left blank for the MLRO."""
    res = feed_result or {"n_payments": 0, "results": [], "errors": []}
    stop = [r for r in res["results"] if r["outcome"].startswith("STOP")]
    review = [r for r in res["results"] if r["outcome"].startswith("REVIEW")]
    prov = [r for r in res["results"] if r["outcome"] == "NO MATCH — PROVISIONAL"]
    clear = [r for r in res["results"] if r["outcome"] == "NO MATCH"]
    alerts = list(tm_alerts or [])
    rule_errors = dict(rule_errors or {})
    flagged = stop + review + prov
    cases = _customer_cases(flagged, alerts)
    dpmsr = [a for a in alerts if a["rule"] in _DPMSR_RULES]
    tfs_flags = [a for a in alerts if a["rule"] == "RED_FLAG" and a["severity"] == "CRITICAL"]
    tallies = f"STOP {len(stop)} · Review {len(review)} · Rule alerts {len(alerts)} · Customers {len(cases)}"
    if degraded or rule_errors:
        status = "DEGRADED — "
    elif flagged or alerts or unreadable or res["errors"]:
        status = "ACTION REQUIRED — "
    else:
        status = "No open findings — "
    name = f"{TM_REPORT_PREFIX}{status}{tallies} — {date_label}"

    bar = "━" * 60
    L = ["TRANSACTION MONITORING — DAILY REPORT",
         "CONFIDENTIAL — AML/CFT/CPF. Need-to-know only. Do not tip off (Article 25, "
         + "Federal Decree-Law No. 10 of 2025).",
         f"Date: {date_label}",
         "Scope: open tasks in the \"Transaction Monitoring\" section — payments and activity "
         + "records. Completed tasks are out of scope.",
         "Basis: Federal Decree-Law No. 10 of 2025 · Cabinet Resolution No. 134 of 2025 · "
         + "Cabinet Decision No. 74 of 2020 (TFS) · FATF R.10 / R.16 / R.20 · POL-07 TFS name-match "
         + "procedure · POL-19 STR / DPMSR filing procedure.",
         "Controls run: payment-party sanctions screening (lists as loaded for today's run) · "
         + "typology rules · STR and SAR red flags recorded by staff.",
         "Thresholds: DPMSR AED 55,000 (cash or international wire, single or same-day linked) · "
         + "CDD AED 15,000. Typology rule parameters are defaults pending MLRO confirmation.", ""]
    if degraded:
        L += ["⚠ DEGRADED — " + degraded,
              "No payment is cleared by this run. Re-run the daily screening or review the "
              + "payments manually.", ""]
    if rule_errors:
        L += [f"⚠ {sum(rule_errors.values())} monitoring rule error(s) "
              + f"[{', '.join(sorted(rule_errors))}] — those typologies were NOT checked this run.", ""]

    L += [bar, "SUMMARY", bar,
          f"Payments read: {register_read} · activity records: {activities}"
          + (f" · ⚠ {unreadable} task(s) with nothing usable — fill the template, paste the "
             + "MT103 / pacs.008, or add 'Customer:' and 'Red flags:'" if unreadable else ""),
          f"Payment screening: {len(stop)} STOP · {len(review)} REVIEW · "
          + f"{len(prov)} provisional · {len(clear)} no match",
          f"Monitoring: {len(alerts)} alert(s) across {len(cases)} customer(s)",
          f"Reporting obligations identified: DPMSR {len(dpmsr)} · possible TFS events "
          + f"{len(stop) + len(tfs_flags)} · customers for STR/SAR assessment "
          + f"{sum(1 for c in cases.values() if c['str_sar'])}"]
    if res["errors"]:
        L.append(f"⚠ {len(res['errors'])} payment(s) could not be parsed and were NOT screened.")
    L.append("")

    L += [bar, "①  PAYMENT SCREENING  (parties & payment reference vs sanctions lists · FATF R.16)", bar]
    if not flagged:
        L.append("   No payment needs attention." if res["n_payments"] else "   No payment to screen today.")
    for r in flagged:
        ref = r["reference"] or "(no reference)"
        L.append(f"   [{r['severity']}] {r['outcome']} — payment {ref} · {r.get('customer') or '?'} · "
                 + f"{r['date']} {_amount_label(r)}".rstrip())
        if r.get("permalink"):
            L.append(f"      Record: {r['permalink']}")
        L += [f"      • {f}" for f in r["findings"]]
        if r["r16_missing"]:
            L.append("      • R.16: missing " + " and ".join(r["r16_missing"]) + " name")
        L += [f"      • {p['label']}: {p['note']}" for p in r["parties"] if not p["name_screened"]]
        if r["provisional"]:
            L.append("      • core list(s) not loaded: " + ", ".join(r["lists_degraded"])
                     + " — 'no match' is provisional")
    L.append("")

    L += [bar, "②  MONITORING ALERTS  (typology rules + STR / SAR red flags recorded on the tasks)", bar]
    if not alerts:
        L.append("   No rule alert.")
    for a in alerts[:50]:
        L.append(f"   [{a['severity']}] {a['rule']} — {a['customer']} {a['date']}: {a['detail']}")
        if a.get("permalink"):
            L.append(f"      Record: {a['permalink']}")
        refs = flag_refs(a["rule"]) if (flag_refs and a["rule"] != "RED_FLAG") else []
        if refs:
            L.append("      Red-flag register: " + ", ".join(refs[:6])
                     + (f" +{len(refs) - 6} more" if len(refs) > 6 else ""))
    if len(alerts) > 50:
        L.append(f"   … +{len(alerts) - 50} more alert(s)")
    L.append("")

    L += [bar, "③  REPORTING OBLIGATIONS  (decided by the MLRO; nothing here is filed automatically)", bar]
    if not (dpmsr or stop or tfs_flags or cases):
        L.append("   None identified today.")
    if dpmsr:
        L.append(f"   DPMSR — {len(dpmsr)} transaction(s)/series at or above AED 55,000 (cash or "
                 + "international wire). File in goAML regardless of suspicion (POL-19 §3); where "
                 + "also suspicious, file an STR as well.")
    if stop or tfs_flags:
        L.append(f"   TFS — {len(stop)} potential sanctions match(es) and {len(tfs_flags)} TF/PF/"
                 + "sanctions red flag(s): hold, verify identifiers; PNMR (potential) or freeze + "
                 + "CNMR + FFR (confirmed) in goAML within the POL-07 deadline; release only on an "
                 + "EOCN/FIU written basis.")
    n_assess = sum(1 for c in cases.values() if c["str_sar"])
    if n_assess:
        L.append(f"   STR / SAR — {n_assess} customer(s) to assess (see ④). No monetary threshold and "
                 + "no need to prove the predicate offence; file without delay once suspicion is "
                 + "formed. A no-action decision is documented with its reasons (POL-19 §2).")
    L.append("")

    L += [bar, "④  CASES BY CUSTOMER  (one case record per customer — complete it in this task's "
          + "comments or on the linked tasks)", bar]
    if not cases:
        L.append("   No customer case today.")
    for n, (cust, c) in enumerate(cases.items()):
        if n >= TM_CASES_SHOWN:
            L.append(f"   … +{len(cases) - TM_CASES_SHOWN} more customer case(s) — see ① and ②")
            break
        obligations = [x for x, on in (("TFS (POL-07)", c["tfs"]), ("DPMSR", c["dpmsr"]),
                                       ("STR/SAR assessment", c["str_sar"]),
                                       ("EDD / R.16 information", c["edd"]),
                                       ("CDD on file", c["cdd"])) if on]
        L += [f"   ▸ CASE {n + 1} — {cust} — highest severity {c['severity']} · "
              + f"{len(c['findings'])} finding(s) · {len(c['indicators'])} distinct indicator(s)",
              "      Obligations: " + (", ".join(obligations) or "review only")]
        if len(c["indicators"]) >= MULTIPLE_INDICATORS_MIN:
            L.append("      ⚠ MULTIPLE INDICATORS — heightened scrutiny; clearance is not assumed "
                     + "while information is missing or unresolved.")
        L += [f"      • {f}" for f in c["findings"][:8]]
        if len(c["findings"]) > 8:
            L.append(f"      • … +{len(c['findings']) - 8} more")
        L += [f"      Record: {u}" for u in sorted(c["refs"])[:5]]
        L += ["      Case record:",
              f"        A  Case ref ______ · detected {date_label} · source: daily TM run",
              "        B  KYC / CDD / EDD · UBO · source of funds · source of wealth evidence: ______ "
              + "· explanation received: ______ · outstanding: ______",
              "        C  Payment & bank records · invoices · shipping & customs · assay / chain of "
              + "custody · CAHRA exposure: ______",
              "        D  Screening — sanctions ______ · PEP ______ · adverse media ______ · "
              + "geography ______ · PF ______",
              "        E  Findings · inconsistencies · assessment against the known profile: ______",
              "        F  [ ] CDD/EDD requested   [ ] transaction hold / restriction   follow-up "
              + "monitoring: ______",
              "        G  [ ] escalated to Compliance Officer   MLRO decision: [ ] STR  [ ] SAR  "
              + "[ ] DPMSR  [ ] PNMR  [ ] freeze + CNMR + FFR  [ ] no action — reasons: ______   "
              + "goAML ref: ______",
              "        H  Evidence location ______ · retain until (filing + 5 years) ______ · "
              + "closed ______ · reviewer ______", ""]

    L += [bar, "⑤  OPERATING NOTES", bar,
          "   • A red flag is an indicator requiring review, not evidence that an offence occurred. "
          + "Multiple or repeated indicators, false information, attempts to avoid controls, opaque "
          + "ownership or unusual routing receive heightened scrutiny.",
          "   • For each finding: record the facts, keep the evidence, compare against the profile, "
          + "decide on CDD/EDD, resolve discrepancies, escalate to the Compliance Officer, and "
          + "document the decision and its rationale.",
          "   • The MLRO is the sole decision-maker on external reporting. A red flag does not by "
          + "itself require an STR/SAR; an undocumented no-action decision is a control failure.",
          "   • Record red flags on a payment or activity task with a line such as "
          + "'Red flags: STR-ML-11, SAR-CB-03'. When a matter is closed, complete its task.",
          "   • Reports, evidence packs and decisions are retained for at least five years.", "",
          "Do not tip off. UAE Cabinet Decision No. 74 of 2020 and Article 25 of Federal Decree-Law "
          + "No. 10 of 2025 apply."]
    return name, "\n".join(L)
