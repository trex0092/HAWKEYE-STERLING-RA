#!/usr/bin/env python3
"""Cross-list reconciliation: EXPERIMENTAL, shadow-only, standard library only.

Loads every committed national list in data/ into an in-memory SQLite database
and answers three questions with plain SQL:

  1. Does each list hold as many entries as it declares? (a file that says 387
     names and holds 380 has lost entries, and the screen would never say so)
  2. Which names appear in more than one list? (two sources naming the same
     party is corroboration; the same party under two spellings is a duplicate
     the matcher should not count twice)
  3. Which names repeat inside one list under different reference numbers?

It is the question DuckDB would answer (candidate note row 27), answered with the
SQLite that ships with Python, so no dependency is added. Names are compared
after folding case, accents and punctuation and sorting the words, so "AL-ALI,
Hamid" and "Hamid Al-Ali" meet. A match here is a lead, never a finding. Nothing
is downloaded and screening, cases and Asana are unchanged.

Exit code 1 when a list file is missing, unreadable, or holds a different number
of entries than it declares (degrade loudly); overlaps alone never fail the run.

Usage: python3 scripts/cross-list-reconcile.py [data_dir]
"""
import json
import os
import re
import sqlite3
import sys
import unicodedata

# list label -> (file, how to read one entry: returns (ref, [names]))
def _entry_obj(e):
    if isinstance(e, str):
        return "", [e]
    if not isinstance(e, dict):
        return "", []
    ref = e.get("ref") or e.get("refNo") or ""
    names = [e.get("name") or ""] + list(e.get("aliases") or [])
    return ref, [n for n in names if n]

LISTS = {
    "Bahrain National Terrorism List": ("bh-gazette-curated-list.json", _entry_obj),
    "Cote d'Ivoire CENTIF list": ("ci-centif-curated-list.json", _entry_obj),
    "Morocco CNASNU list": ("ma-cnasnu-curated-list.json", _entry_obj),
    "Mauritius NSSEC list": ("mu-nssec-curated-list.json", _entry_obj),
    "Australia DFAT list": ("dfat-curated-list.json", _entry_obj),
    "UAE Local Terrorist List": ("eocn-local-terrorist-list.json", _entry_obj),
}


def fold(name):
    """Case, accents and punctuation folded away and the words sorted, so word
    order does not hide a match. Names in any script are kept (not forced to
    ASCII): an Arabic name folds to itself, never to nothing."""
    s = unicodedata.normalize("NFKD", str(name or ""))
    s = "".join(c for c in s if not unicodedata.combining(c)).casefold()
    s = re.sub(r"[^\w\s]", " ", s)
    return " ".join(sorted(s.split()))


def load(data_dir):
    """Returns (rows, status). rows: (list, ref, name, folded, is_alias).
    status: one dict per list with declared and loaded entry counts and a problem."""
    rows, status = [], []
    for label, (fname, reader) in LISTS.items():
        path = os.path.join(data_dir, fname)
        st = {"list": label, "file": fname, "declared": None, "loaded": 0, "problem": ""}
        try:
            with open(path, encoding="utf-8") as f:
                doc = json.load(f)
        except (OSError, ValueError) as e:
            st["problem"] = f"cannot read ({type(e).__name__})"
            status.append(st)
            continue
        entries = doc.get("entries")
        if not isinstance(entries, list):
            st["problem"] = "no entries array"
            status.append(st)
            continue
        st["declared"] = doc.get("count")
        st["loaded"] = len(entries)
        for e in entries:
            ref, names = reader(e)
            for i, n in enumerate(names):
                k = fold(n)
                if k:
                    rows.append((label, ref, n, k, 0 if i == 0 else 1))
        if st["declared"] is not None and st["declared"] != st["loaded"]:
            st["problem"] = f"declares {st['declared']} entries but holds {st['loaded']}"
        status.append(st)
    return rows, status


def reconcile(rows):
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE names (list TEXT, ref TEXT, name TEXT, folded TEXT, is_alias INTEGER)")
    db.executemany("INSERT INTO names VALUES (?,?,?,?,?)", rows)
    across = db.execute(
        "SELECT folded, COUNT(DISTINCT list) AS lists, GROUP_CONCAT(DISTINCT list) "
        "FROM names GROUP BY folded HAVING COUNT(DISTINCT list) > 1 ORDER BY lists DESC, folded").fetchall()
    within = db.execute(
        "SELECT list, folded, COUNT(DISTINCT ref) AS refs FROM names WHERE ref <> '' "
        "GROUP BY list, folded HAVING COUNT(DISTINCT ref) > 1 ORDER BY list, folded").fetchall()
    per_list = db.execute(
        "SELECT list, COUNT(*), COUNT(DISTINCT folded) FROM names GROUP BY list ORDER BY list").fetchall()
    db.close()
    return {"across": across, "within": within, "per_list": per_list}


def render(status, result):
    L = ["# Cross-list reconciliation (experimental, shadow-only)", "",
         "The committed national lists are loaded into an in-memory SQLite database and compared. "
         "A match is a lead for the MLRO, never a finding. Nothing is downloaded and screening is unchanged.", "",
         "## Entries declared and entries held", "",
         "| List | Declared | Held | Result |", "|---|---|---|---|"]
    for st in status:
        decl = "not stated" if st["declared"] is None else st["declared"]
        L.append(f"| {st['list']} | {decl} | {st['loaded']} | {st['problem'] or 'agrees'} |")
    L += ["", "## Names and spellings per list", "", "| List | Names and aliases | Distinct after folding |", "|---|---|---|"]
    for name, total, distinct in result["per_list"]:
        L.append(f"| {name} | {total} | {distinct} |")
    L += ["", f"## Names found in more than one list: {len(result['across'])}", ""]
    for folded, n, lists in result["across"][:50]:
        L.append(f"- {folded} ({n} lists: {lists})")
    if not result["across"]:
        L.append("None.")
    L += ["", f"## Names repeated inside one list under different references: {len(result['within'])}", ""]
    for lst, folded, refs in result["within"][:50]:
        L.append(f"- {lst}: {folded} ({refs} references)")
    if not result["within"]:
        L.append("None.")
    L.append("")
    return "\n".join(L)


def main(argv):
    data_dir = argv[1] if len(argv) > 1 else "data"
    rows, status = load(data_dir)
    md = render(status, reconcile(rows))
    with open("cross-list-reconcile-report.md", "w", encoding="utf-8") as f:
        f.write(md)
    print(md)
    bad = [s for s in status if s["problem"]]
    for s in bad:
        print(f"::error::{s['list']}: {s['problem']}", file=sys.stderr)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
