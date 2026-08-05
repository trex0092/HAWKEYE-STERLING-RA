#!/usr/bin/env python3
"""Per-subject screening report generator (audit-ready, sign-off fields blank).

Renders ONE subject's current screening position — identity, every hit with
its evidence labels (mechanism, confidence, carried-forward, cleared-FP
annotation), the independent second opinion when recorded, and the case
lifecycle reference — as a single audit-ready markdown document with MLRO +
four-eyes sign-off FIELDS. The fields are always blank: a sign-off is a named
human's act (GOVERNANCE.md), and this generator records evidence, never
decisions.

Reads the JS screening engine's committed state:
  data/sanctions-screen-state.json    (subject records incl. hits/secondOpinion)
  data/screening-cases-state.json     (case gid / lifecycle, optional)
On the runner and in local use these are the plaintext working copies (the
screen-state branch carries them encrypted; scripts/state-crypto.mjs decrypt
restores them). A missing or unreadable state file is reported loudly — the
report never renders a subject as "clear" from absent data.

Usage:
  python3 subject_report.py "SUBJECT NAME"          # match by name (case-insensitive)
  python3 subject_report.py --key "<subject key>"   # exact state key
  python3 subject_report.py "NAME" -o report.md
"""
import json
import sys
import datetime

SCREEN_STATE_PATH = "data/sanctions-screen-state.json"
CASES_STATE_PATH = "data/screening-cases-state.json"


def load_state(path):
    """(data, error) — never raises; the caller renders the error loudly."""
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f), None
    except FileNotFoundError:
        return None, f"{path} not found (decrypt the screen-state overlay first?)"
    except Exception as e:  # unreadable/corrupt — degrade loudly, never as 'clear'
        return None, f"{path} unreadable: {e}"


def find_subject(screen_state, name=None, key=None):
    """(key, record) or (None, None). Name matching is case-insensitive exact,
    then unique-substring; ambiguity returns None (the CLI lists candidates)."""
    subjects = (screen_state or {}).get("subjects") or {}
    if key is not None:
        rec = subjects.get(key)
        return (key, rec) if rec else (None, None)
    want = (name or "").strip().lower()
    if not want:
        return None, None
    exact = [(k, r) for k, r in subjects.items() if str(r.get("name", "")).lower() == want]
    if len(exact) == 1:
        return exact[0]
    subs = [(k, r) for k, r in subjects.items() if want in str(r.get("name", "")).lower()]
    if len(subs) == 1 and not exact:
        return subs[0]
    return None, None


def candidates(screen_state, name):
    want = (name or "").strip().lower()
    subjects = (screen_state or {}).get("subjects") or {}
    return sorted(str(r.get("name", "")) for r in subjects.values()
                  if want and want in str(r.get("name", "")).lower())


def _kv(label, value):
    return f"  {label:<24} {value}"


def build_subject_report(key, rec, case_entry=None, screen_updated=None, today=None):
    """Markdown per-subject screening report. Pure; raises on a missing record
    so an absent subject can never render as a clean report."""
    if not isinstance(rec, dict) or not rec:
        raise ValueError("no state record for subject — cannot report on absent data")
    today = today or datetime.date.today().isoformat()
    L = []
    A = L.append
    A(f"# SCREENING REPORT — {rec.get('name', '(unnamed subject)')}")
    A("")
    A("> Evidence record generated from the committed screening state. It")
    A("> documents what the engines found — it decides nothing, and the")
    A("> sign-off fields below belong to named humans (four-eyes).")
    A("")
    A("## Subject")
    A(_kv("Name:", rec.get("name", "")))
    A(_kv("State key:", key))
    if rec.get("jurisdiction"):
        A(_kv("Jurisdiction:", rec["jurisdiction"]))
    if rec.get("role") or rec.get("parent"):
        A(_kv("Role:", " ".join(x for x in (rec.get("role"),
              f"of {rec.get('parent')}" if rec.get("parent") else "") if x)))
    if rec.get("gid"):
        A(_kv("Customer record gid:", rec["gid"]))
    A("")
    A("## Screening position")
    A(_kv("Report generated:", today))
    A(_kv("State as of:", screen_updated or "unknown"))
    A(_kv("Recommendation:", rec.get("recommendation", "?")))
    A(_kv("Band / top score:", f"{rec.get('band', '?')} / {rec.get('topScore', '?')}"))
    A(_kv("First flagged:", rec.get("firstSeen", "?")))
    A(_kv("Last seen flagged:", rec.get("lastSeen", "?")))
    if rec.get("whitelistedOnly"):
        A(_kv("Registry status:", "every hit is an analyst-cleared FP pair (report-only row)"))
    A("")
    A("## Hits and evidence")
    hits = [h for h in (rec.get("hits") or []) if isinstance(h, dict) and h.get("list")]
    if hits:
        for h in hits:
            parts = [h["list"]]
            if h.get("hitName"):
                parts.append(f'"{h["hitName"]}"')
            if h.get("score") is not None:
                parts.append(f"score {h['score']}")
            if h.get("confidence"):
                parts.append(str(h["confidence"]))
            if h.get("mechanism"):
                parts.append(f"via {h['mechanism']}")
            if h.get("carriedForward"):
                parts.append("carried forward (not re-verified this run)")
            if h.get("whitelisted"):
                cleared = "CLEARED FP" + (f" {h['clearedAt']}" if h.get("clearedAt") else "")
                if h.get("clearedVia"):
                    cleared += f" ({h['clearedVia']})"
                parts.append(cleared)
            A("  - " + " · ".join(parts))
    else:
        for name in rec.get("lists") or []:
            A(f"  - {name}")
        if not rec.get("lists"):
            A("  - none recorded in state (see the daily run log before reading this as clear)")
    so = rec.get("secondOpinion")
    if isinstance(so, dict) and so.get("provider"):
        A("")
        A("## Independent second opinion")
        status = so.get("status", "?")
        line = f"{so.get('provider')}: {status}"
        if status == "corroborated":
            line += f" — {so.get('matchCount', '?')} match(es)"
            if so.get("topScore") is not None:
                line += f", top score {so['topScore']}"
        elif status == "unavailable":
            line += f" ({so.get('error', 'lookup failed')}) — a lost signal, not a clear"
        if so.get("checkedAt"):
            line += f" · checked {so['checkedAt']}"
        A("  " + line)
    A("")
    A("## Case lifecycle")
    if isinstance(case_entry, dict) and case_entry.get("taskGid"):
        A(_kv("Case task gid:", case_entry["taskGid"]))
        A(_kv("Opened:", case_entry.get("createdAt", "?")))
        if case_entry.get("escalated"):
            A(_kv("Status:", f"ESCALATED {case_entry.get('escalatedAt', '')} (auto-clear disabled)"))
        elif case_entry.get("cleared"):
            A(_kv("Status:", f"cleared {case_entry.get('clearedAt', '')}"
                  + (f" — {case_entry['clearedBy']}" if case_entry.get("clearedBy") else "")))
        else:
            A(_kv("Status:", "open"))
        d = case_entry.get("disposition")
        if isinstance(d, dict):
            A(_kv("Disposition:", f"{d.get('kind', '?')} on {d.get('at', '?')} (case {d.get('caseGid', '?')})"))
    else:
        A("  no case recorded for this subject")
    A("")
    A("## Sign-off (named humans only — blank by design)")
    A("  Screened / prepared by: __________________   Date: __________")
    A("  Reviewed by (four-eyes): __________________   Date: __________")
    A("  MLRO decision: [ ] clear   [ ] monitor   [ ] escalate / TFS path   [ ] file report")
    A("  Notes: ______________________________________________________")
    A("")
    A("Retention: 10 years minimum (UAE FDL 10/2025 record-keeping duties as")
    A("implemented by CR 134/2025).")
    return "\n".join(L)


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    key = None
    name = None
    if argv[0] == "--key":
        if len(argv) < 2:
            print("error: --key needs a value", file=sys.stderr)
            return 2
        key = argv[1]
        rest = argv[2:]
    else:
        name = argv[0]
        rest = argv[1:]
    out = None
    if "-o" in rest:
        i = rest.index("-o")
        if i + 1 >= len(rest):
            print("error: -o needs a path", file=sys.stderr)
            return 2
        out = rest[i + 1]
    screen_state, err = load_state(SCREEN_STATE_PATH)
    if err:
        print(f"error: {err}", file=sys.stderr)
        return 1
    k, rec = find_subject(screen_state, name=name, key=key)
    if not rec:
        print("error: subject not found" + (" — candidates:" if name else ""), file=sys.stderr)
        for c in candidates(screen_state, name)[:10]:
            print(f"  - {c}", file=sys.stderr)
        return 1
    cases_state, cases_err = load_state(CASES_STATE_PATH)
    if cases_err:
        print(f"note: {cases_err} — case lifecycle omitted", file=sys.stderr)
    case_entry = (cases_state or {}).get(k)
    doc = build_subject_report(k, rec, case_entry, screen_state.get("updated"))
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(doc + "\n")
        print(f"subject report written to {out}")
    else:
        print(doc)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
