#!/usr/bin/env python3
"""STR/SAR draft dossier assembler (goAML-aligned field map). DRAFT ONLY.

Assembles a complete draft dossier for a suspicious-transaction or
suspicious-activity report from a case JSON, mapped to the field groups the
UAE FIU's goAML portal asks for, so the MLRO starts from a filled document
instead of a blank form. This tool NEVER files anything: it is offline and
deterministic, produces a document stamped DRAFT, and the MLRO must verify
every ground, complete the report and submit it through goAML themselves.

It complements ai.draft_str (the short narrative auto-attached to HIGH-risk
case subtasks): the same grounds narrative is embedded unchanged, wrapped in
the full field map (reporting entity, subject particulars, transactions,
indicators, attachments, sign-off).

Case JSON shape (validate_case lists what is missing):
  {
    "customer":     {"name": str, "permalink": str, "record_ref": str?},
    "risk":         {"rating": "LOW|MEDIUM|HIGH", "factors": [str, ...]},
    "hits":         [screen.py hit dicts: list, matched_entry, score,
                     confidence?, control_linkage?, match_context?, ...],
    "pep":          bool?,
    "adverse_articles": [{title, source, date, url}, ...]?,
    "subject":      {"dob": str?, "nationality": str?, "id_type": str?,
                     "id_number": str?, "address": str?}?,
    "transactions": [{"date": str, "type": str, "amount": str,
                      "currency": str, "counterparty": str?, "notes": str?}]?,
    "indicators":   [str, ...]?,
    "prepared_by":  str?
  }

Usage:
  python3 str_dossier.py case.json            # dossier to stdout
  python3 str_dossier.py case.json -o out.md  # dossier to a file
  python3 str_dossier.py --example            # dossier from the built-in
                                              # synthetic example case
"""
import json
import sys
import datetime

import ai

REQUIRED_TOP = ["customer", "risk", "hits"]

# Synthetic, obviously fictional example (doubles as living documentation of
# the case shape; --example renders it).
EXAMPLE_CASE = {
    "customer": {"name": "EXAMPLE TRADING FZE", "permalink": "https://app.asana.com/0/0/0",
                 "record_ref": "CUST-EXAMPLE-001"},
    "risk": {"rating": "HIGH", "factors": ["sanctions name match on beneficial owner",
                                           "high-risk counterparty jurisdiction"]},
    "hits": [{"subject_type": "INDIVIDUAL", "subject_name": "EXAMPLE PERSON",
              "control_linkage": True, "list": "UN Consolidated",
              "matched_entry": "EXAMPLE PERSON", "score": 97, "confidence": "STRONG",
              "match_context": "list DOB: 1962-08-08; list nationality: Exampleland"}],
    "pep": False,
    "adverse_articles": [],
    "subject": {"dob": "1962-08-08", "nationality": "Exampleland",
                "id_type": "passport", "id_number": "X0000000", "address": "unknown"},
    "transactions": [{"date": "2026-07-01", "type": "cash purchase, gold bullion",
                      "amount": "60000", "currency": "AED",
                      "counterparty": "EXAMPLE PERSON", "notes": "single transaction"}],
    "indicators": ["cash at or above the DPMS CDD threshold",
                   "possible designated-party involvement (TFS)"],
    "prepared_by": "compliance automation (draft only)",
}


def validate_case(case):
    """List of human-readable problems; empty when the case is buildable."""
    errors = []
    if not isinstance(case, dict):
        return ["case must be a JSON object"]
    for k in REQUIRED_TOP:
        if k not in case:
            errors.append(f"missing required field: {k}")
    cust = case.get("customer")
    if isinstance(cust, dict):
        if not (cust.get("name") or "").strip():
            errors.append("customer.name is required")
    elif "customer" in case:
        errors.append("customer must be an object")
    risk = case.get("risk")
    if isinstance(risk, dict):
        if risk.get("rating") not in ("LOW", "MEDIUM", "HIGH"):
            errors.append("risk.rating must be LOW, MEDIUM or HIGH")
        if not isinstance(risk.get("factors"), list):
            errors.append("risk.factors must be a list")
    elif "risk" in case:
        errors.append("risk must be an object")
    if "hits" in case and not isinstance(case.get("hits"), list):
        errors.append("hits must be a list")
    for i, t in enumerate(case.get("transactions") or []):
        for f in ("date", "type", "amount", "currency"):
            if not (str(t.get(f, "")).strip()):
                errors.append(f"transactions[{i}].{f} is required")
    return errors


def _kv(label, value):
    return f"  {label:<28} {value}"


def build_dossier(case, today=None):
    """Markdown draft dossier from a valid case. Raises ValueError on an
    invalid case (callers get the same list validate_case returns)."""
    errors = validate_case(case)
    if errors:
        raise ValueError("invalid case: " + "; ".join(errors))
    today = today or datetime.date.today().isoformat()
    cust = case["customer"]
    subj = case.get("subject") or {}
    L = []
    A = L.append
    A("# STR/SAR DRAFT DOSSIER - NOT A FILING")
    A("")
    A("> DRAFT for MLRO review. This document maps the case to goAML-aligned")
    A("> field groups so the report can be completed quickly. It has NOT been")
    A("> validated against the goAML schema and is NOT a submission file: the")
    A("> MLRO must verify every ground, complete the report in the FIU's goAML")
    A("> portal, and file it there. No automated filing exists in this system.")
    A("> Do not tip off the customer (UAE FDL 10/2025; CR 74/2020 for TFS).")
    A("")
    A("## 1. Report header (goAML: Report)")
    A(_kv("Report type:", "STR (suspicious transaction) / SAR - MLRO to confirm"))
    A(_kv("Draft prepared:", today))
    A(_kv("Prepared by:", case.get("prepared_by") or "compliance analyst (draft)"))
    A(_kv("Internal case ref:", cust.get("record_ref") or cust.get("permalink") or "n/a"))
    A(_kv("goAML reference:", "__________ (assigned at filing)"))
    A("")
    A("## 2. Reporting entity (goAML: Reporting person / entity)")
    A(_kv("Entity:", "as registered with the FIU (goAML org profile)"))
    A(_kv("Sector:", "DPMS (dealers in precious metals and stones)"))
    A(_kv("MLRO:", "__________ (completes and files)"))
    A("")
    A("## 3. Subject of the report (goAML: Involved parties)")
    A(_kv("Customer:", cust["name"]))
    A(_kv("Customer record:", cust.get("permalink") or "n/a"))
    A(_kv("Subject DOB:", subj.get("dob") or "unknown - complete from CDD record"))
    A(_kv("Subject nationality:", subj.get("nationality") or "unknown - complete from CDD record"))
    A(_kv("Identification:", (subj.get("id_type") or "id") + ": " + (subj.get("id_number") or "__________")))
    A(_kv("Address:", subj.get("address") or "complete from CDD record"))
    A("")
    A("## 4. Transactions / activity (goAML: Transaction(s))")
    txns = case.get("transactions") or []
    if txns:
        A("  | Date | Type | Amount | Currency | Counterparty | Notes |")
        A("  | --- | --- | --- | --- | --- | --- |")
        for t in txns:
            A("  | " + " | ".join([str(t.get("date", "")), str(t.get("type", "")),
                                   str(t.get("amount", "")), str(t.get("currency", "")),
                                   str(t.get("counterparty", "") or ""),
                                   str(t.get("notes", "") or "")]) + " |")
    else:
        A("  No transaction rows supplied: activity-based report (SAR) or MLRO")
        A("  to attach the transaction extract from the customer file.")
    A("")
    A("## 5. Grounds for suspicion (goAML: Reason / narrative)")
    A("")
    A("```")
    A(ai.draft_str(cust["name"], cust.get("permalink", ""), case.get("hits") or [],
                   bool(case.get("pep")), case.get("adverse_articles") or [],
                   case["risk"]))
    A("```")
    A("")
    A("## 6. Indicators (goAML: Report indicators)")
    for ind in case.get("indicators") or []:
        A(f"  - {ind}")
    if not case.get("indicators"):
        A("  - MLRO to select the applicable FIU indicator codes at filing.")
    A("")
    A("## 7. Attachments checklist")
    A("  - [ ] CDD record extract (identity, UBO structure)")
    A("  - [ ] Screening evidence (alert card, list entry, scores)")
    A("  - [ ] Transaction extract / invoices")
    A("  - [ ] Prior related reports (if any)")
    A("")
    A("## 8. MLRO sign-off")
    A("  Reviewed by: __________________   Date: __________")
    A("  Decision: [ ] file via goAML   [ ] internal record only   [ ] TFS freeze applied")
    A("  Filed goAML ref: __________   Filing date: __________")
    A("")
    A("Retention: 10 years minimum from the date of the report or transaction")
    A("(UAE FDL 10/2025 record-keeping duties as implemented by CR 134/2025).")
    return "\n".join(L)


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if argv[0] == "--example":
        print(build_dossier(EXAMPLE_CASE))
        return 0
    path = argv[0]
    out = None
    if "-o" in argv:
        i = argv.index("-o")
        if i + 1 >= len(argv):
            print("error: -o needs a path", file=sys.stderr)
            return 2
        out = argv[i + 1]
    try:
        with open(path, encoding="utf-8") as f:
            case = json.load(f)
    except Exception as e:
        print(f"error: cannot read case JSON: {e}", file=sys.stderr)
        return 2
    errors = validate_case(case)
    if errors:
        print("error: invalid case:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    doc = build_dossier(case)
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(doc + "\n")
        print(f"draft dossier written to {out} - DRAFT ONLY, MLRO files via goAML")
    else:
        print(doc)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
