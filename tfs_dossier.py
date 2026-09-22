#!/usr/bin/env python3
"""TFS name-match draft dossier assembler (FFR / PNMR, goAML-aligned). DRAFT ONLY.

Assembles a draft Funds Freeze Report (FFR) or Partial Name Match Report
(PNMR) dossier for a match against a TFS list — the UN Security Council
Consolidated List or the UAE Local Terrorist List — under the UAE targeted
financial sanctions regime (Cabinet Resolution No. 74 of 2020, as applied
under Federal Decree-Law No. 10 of 2025). It is the TFS counterpart of
str_dossier.py and inherits its doctrine wholesale: this tool NEVER files,
NEVER freezes, and NEVER decides. It maps the case onto the field groups the
goAML portal asks for so the MLRO starts from a filled document, verifies
every particular against the customer's identifiers and the CURRENT EOCN
guidance, and acts through goAML themselves — without delay, and without
tipping off (UAE FDL 10/2025; CR 74/2020).

Report-kind recommendation (MLRO confirms against current EOCN guidance):
  match_status "confirmed" — identifiers align with the listed person
      → FFR draft (freeze applies immediately; funds held or nil holdings)
  match_status "partial"   — name similarity, identifiers not yet decisive
      → PNMR draft (suspend dealings pending confirmation)

Case JSON shape (validate_tfs_case lists what is missing):
  {
    "customer":     {"name": str, "permalink": str?, "record_ref": str?},
    "match_status": "confirmed" | "partial",
    "hits":         [{list, matched_entry|hitName, score?, mechanism?,
                      confidence?, listed_ref?}, ...]   # ≥1 on a TFS list
    "subject":      {"dob": str?, "nationality": str?, "id_type": str?,
                     "id_number": str?, "address": str?}?,
    "funds":        {"held": bool, "items": [{"type": str, "ref": str?,
                     "value": str?, "currency": str?}]}?,
    "actions":      [str, ...]?,        # steps already taken (facts only)
    "prepared_by":  str?
  }

Usage:
  python3 tfs_dossier.py case.json            # dossier to stdout
  python3 tfs_dossier.py case.json -o out.md  # dossier to a file
  python3 tfs_dossier.py --example            # synthetic example case
"""
import json
import sys
import datetime

# List names as both engines emit them (screen.py + scripts/sanctions-*.mjs).
TFS_LIST_PREFIXES = (
    "UN Security Council",
    "UN Consolidated",
    "UAE EOCN",
)

EXAMPLE_CASE = {
    "customer": {"name": "EXAMPLE TRADING FZE", "permalink": "https://app.asana.com/0/0/0",
                 "record_ref": "CUST-EXAMPLE-001"},
    "match_status": "partial",
    "hits": [{"list": "UN Security Council — Consolidated list (XML)",
              "matched_entry": "EXAMPLE PERSON", "score": 88,
              "mechanism": "fuzzy", "confidence": "MODERATE",
              "listed_ref": "QDi.000"}],
    "subject": {"dob": "1962-08-08", "nationality": "Exampleland",
                "id_type": "passport", "id_number": "X0000000", "address": "unknown"},
    "funds": {"held": True, "items": [{"type": "trade receivable", "ref": "INV-000",
                                       "value": "60000", "currency": "AED"}]},
    "actions": ["dealings suspended pending confirmation"],
    "prepared_by": "compliance automation (draft only)",
}


def is_tfs_list(list_name):
    return any(str(list_name or "").startswith(p) for p in TFS_LIST_PREFIXES)


def recommend_report_kind(match_status, funds_held):
    """Draft recommendation ONLY — the MLRO confirms the instrument against
    current EOCN guidance before anything is filed or frozen."""
    if match_status == "confirmed":
        return ("FFR", "confirmed match — freeze applies WITHOUT DELAY; report via goAML "
                       + ("covering the funds/assets held" if funds_held
                          else "with nil holdings declared"))
    return ("PNMR", "partial name match — suspend dealings and report via goAML "
                    "pending confirmation against the customer's identifiers")


def validate_tfs_case(case):
    """List of human-readable problems; empty when the case is buildable."""
    errors = []
    if not isinstance(case, dict):
        return ["case must be a JSON object"]
    cust = case.get("customer")
    if not isinstance(cust, dict) or not (cust.get("name") or "").strip():
        errors.append("customer.name is required")
    if case.get("match_status") not in ("confirmed", "partial"):
        errors.append('match_status must be "confirmed" or "partial"')
    hits = case.get("hits")
    if not isinstance(hits, list) or not hits:
        errors.append("hits must be a non-empty list")
    else:
        tfs = [h for h in hits if isinstance(h, dict) and is_tfs_list(h.get("list"))]
        if not tfs:
            errors.append("no hit on a TFS list (UN Consolidated / UAE Local Terrorist "
                          "List) — a non-TFS match takes the ordinary alert path, not "
                          "an FFR/PNMR")
    funds = case.get("funds")
    if funds is not None:
        if not isinstance(funds, dict) or not isinstance(funds.get("held"), bool):
            errors.append("funds must be an object with a boolean 'held'")
        elif funds.get("held") and not (isinstance(funds.get("items"), list) and funds["items"]):
            errors.append("funds.held is true but funds.items is empty — list what is held")
    return errors


def _kv(label, value):
    return f"  {label:<28} {value}"


def build_tfs_dossier(case, today=None):
    """Markdown draft FFR/PNMR dossier from a valid case. Raises ValueError on
    an invalid case (same list validate_tfs_case returns)."""
    errors = validate_tfs_case(case)
    if errors:
        raise ValueError("invalid case: " + "; ".join(errors))
    today = today or datetime.date.today().isoformat()
    cust = case["customer"]
    subj = case.get("subject") or {}
    funds = case.get("funds") or {"held": False, "items": []}
    kind, rationale = recommend_report_kind(case["match_status"], bool(funds.get("held")))
    tfs_hits = [h for h in case["hits"] if is_tfs_list(h.get("list"))]
    L = []
    A = L.append
    A(f"# TFS {kind} DRAFT DOSSIER - NOT A FILING, NOT A FREEZE ORDER")
    A("")
    A("> DRAFT for MLRO review under the UAE TFS regime (CR 74/2020, applied")
    A("> under FDL 10/2025). The report kind below is a RECOMMENDATION — the")
    A("> MLRO confirms the instrument and every particular against the")
    A("> customer's identifiers and the CURRENT EOCN guidance, then acts via")
    A("> goAML WITHOUT DELAY. No automated filing or freezing exists in this")
    A("> system. Do not tip off the customer.")
    A("")
    A("## 1. Report header (goAML: Report)")
    A(_kv("Report type:", f"{kind} — {rationale}"))
    A(_kv("Match status:", case["match_status"].upper()))
    A(_kv("Draft prepared:", today))
    A(_kv("Prepared by:", case.get("prepared_by") or "compliance analyst (draft)"))
    A(_kv("Internal case ref:", cust.get("record_ref") or cust.get("permalink") or "n/a"))
    A(_kv("goAML reference:", "__________ (assigned at filing)"))
    A("")
    A("## 2. Reporting entity (goAML: Reporting person / entity)")
    A(_kv("Entity:", "as registered with the FIU (goAML org profile)"))
    A(_kv("Sector:", "DPMS (dealers in precious metals and stones)"))
    A(_kv("MLRO:", "__________ (confirms, freezes where due, and files)"))
    A("")
    A("## 3. Listed person matched (goAML: Involved parties — listed side)")
    for h in tfs_hits:
        A(_kv("List:", h.get("list", "")))
        A(_kv("Listed name matched:", h.get("matched_entry") or h.get("hitName") or ""))
        A(_kv("List reference no.:", h.get("listed_ref") or "__________ (from the list entry)"))
        score = h.get("score")
        detail = " · ".join(x for x in (
            f"score {score}" if score is not None else "",
            str(h.get("confidence") or ""),
            f"via {h.get('mechanism')}" if h.get("mechanism") else "") if x)
        A(_kv("Match evidence:", detail or "see screening record"))
        A("")
    A("## 4. Customer / subject particulars (goAML: Involved parties — subject side)")
    A(_kv("Customer:", cust["name"]))
    A(_kv("Customer record:", cust.get("permalink") or "n/a"))
    A(_kv("Subject DOB:", subj.get("dob") or "unknown - complete from CDD record"))
    A(_kv("Subject nationality:", subj.get("nationality") or "unknown - complete from CDD record"))
    A(_kv("Identification:", (subj.get("id_type") or "id") + ": " + (subj.get("id_number") or "__________")))
    A(_kv("Address:", subj.get("address") or "complete from CDD record"))
    A("")
    A("## 5. Funds / assets (goAML: Funds — FFR core, PNMR context)")
    if funds.get("held"):
        A("  | Type | Reference | Value | Currency |")
        A("  | --- | --- | --- | --- |")
        cell = lambda v: str(v).replace("|", "\\|")
        for it in funds.get("items") or []:
            A("  | " + " | ".join([cell(it.get("type", "")), cell(it.get("ref", "") or ""),
                                   cell(it.get("value", "") or ""), cell(it.get("currency", "") or "")]) + " |")
    else:
        A("  No funds or assets of the (possibly) listed person identified as held")
        A("  at draft time — declare nil holdings if confirmed; keep monitoring.")
    A("")
    A("## 6. Actions taken so far (facts only — decisions are the MLRO's)")
    for act in case.get("actions") or []:
        A(f"  - {act}")
    if not case.get("actions"):
        A("  - none recorded at draft time")
    A("")
    A("## 7. TFS checklist (CR 74/2020 — MLRO works through every line)")
    A("  - [ ] Match disambiguated against identifiers (DOB / nationality / ID)")
    A("  - [ ] Freeze applied WITHOUT DELAY on confirmation (FFR path)")
    A("  - [ ] Dealings suspended pending confirmation (PNMR path)")
    A("  - [ ] goAML report submitted; EOCN notified per current guidance")
    A("  - [ ] No tipping off — customer not informed of the report")
    A("  - [ ] Ongoing: re-screen on every list update while the relationship exists")
    A("")
    A("## 8. MLRO sign-off")
    A("  Reviewed by: __________________   Date: __________")
    A("  Decision: [ ] FFR filed   [ ] PNMR filed   [ ] no report - grounds dismissed (record why)")
    A("  Freeze applied: [ ] yes  [ ] no/nil   Date/time: __________")
    A("  Filed goAML ref: __________   Filing date: __________")
    A("")
    A("Retention: 10 years minimum (UAE FDL 10/2025 record-keeping duties as")
    A("implemented by CR 134/2025).")
    return "\n".join(L)


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if argv[0] == "--example":
        print(build_tfs_dossier(EXAMPLE_CASE))
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
    errors = validate_tfs_case(case)
    if errors:
        print("error: invalid case:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    doc = build_tfs_dossier(case)
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(doc + "\n")
        print(f"draft dossier written to {out} - DRAFT ONLY, MLRO confirms and files via goAML")
    else:
        print(doc)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
