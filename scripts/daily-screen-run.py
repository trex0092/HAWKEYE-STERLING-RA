#!/usr/bin/env python3
"""
Daily sanctions screen — STEP 5: screen the customer list against the downloaded
designation lists, through the real screen.py matcher.

Extracted verbatim from .github/workflows/daily-sanctions-screen.yml, where it
lived as an inline `python3 << PYEOF` heredoc — invisible to py_compile,
unreachable by tests, unlintable. Behaviour is unchanged.

Reads:  /tmp/customers.json, the downloaded list files (/tmp/ofac_sdn.xml,
        /tmp/un_consolidated.xml, /tmp/eu_sanctions.xml, /tmp/uk_ofsi.csv) and
        the in-repo UAE EOCN list; UAE_PDF_FAILED and GITHUB_ENV from the step
Writes: /tmp/results.json, plus coverage/floor state appended to GITHUB_ENV
"""
import os
import sys

# A heredoc fed to `python3` on stdin runs with sys.path[0] == '' (the working
# directory, i.e. the repo root), so `import screen` resolved. A script file
# instead gets its OWN directory (scripts/) as sys.path[0], so the repo root has
# to be put back for the engine import below to keep working.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json, os
import xml.etree.ElementTree as ET

# The weak inline matcher this step used to carry (token_sort top-3,
# break on first hit, no core/subset/short-entry gates, no
# transliteration variants) is GONE: this fallback now screens through
# the REAL engine matcher (screen.py screen_name — the audited one the
# daily unified run uses), so a manual dispatch of this workflow can
# never clear a name the daily engine would flag.
#
# No Asana credential is set here, by design: this step never calls Asana, and
# screen.py no longer demands a token at import — the check moved to
# asana_request(), the single call path. The placeholder that used to be needed
# here is gone, so a step that parses external downloads holds no credential
# at all (least privilege, same as eocn-reconcile.yml).
import screen as engine

# ---- load customers ----
with open("/tmp/customers.json") as f:
    customers = json.load(f)
print(f"Screening {len(customers)} customers")

# ---- build sanctions name list ----
sanctioned = []   # list of dicts: {name, list, programme}

# OFAC SDN
try:
    tree = ET.parse("/tmp/ofac_sdn.xml")
    root = tree.getroot()
    ns = {"ns": root.tag.split("}")[0].lstrip("{")} if "}" in root.tag else {}
    prefix = f"{{{ns['ns']}}}" if ns else ""
    for entry in root.iter(f"{prefix}sdnEntry"):
        last = entry.find(f"{prefix}lastName")
        first = entry.find(f"{prefix}firstName")
        name_parts = []
        if last is not None and last.text:
            name_parts.append(last.text)
        if first is not None and first.text:
            name_parts.append(first.text)
        full = " ".join(name_parts).strip()
        # Compute programmes per entry BEFORE the name guard: the alias
        # loop below references `programmes`, so a name-less primary entry
        # would otherwise raise NameError (aborting the whole OFAC parse)
        # or, worse, tag an alias with the PREVIOUS entry's programme.
        programmes = []
        for prog in entry.iter(f"{prefix}program"):
            if prog.text:
                programmes.append(prog.text)
        if full:
            sanctioned.append({
                "name": full,
                "list": "OFAC SDN",
                "programme": ", ".join(programmes)
            })
        # aliases
        for aka in entry.iter(f"{prefix}aka"):
            al = aka.find(f"{prefix}lastName")
            af = aka.find(f"{prefix}firstName")
            parts = []
            if al is not None and al.text: parts.append(al.text)
            if af is not None and af.text: parts.append(af.text)
            alias = " ".join(parts).strip()
            if alias:
                sanctioned.append({
                    "name": alias,
                    "list": "OFAC SDN",
                    "programme": ", ".join(programmes)
                })
    print(f"OFAC SDN: {len([s for s in sanctioned if s['list']=='OFAC SDN'])} entries")
except Exception as e:
    print(f"OFAC parse error: {e}")

# UN Consolidated
try:
    tree = ET.parse("/tmp/un_consolidated.xml")
    root = tree.getroot()
    before = len(sanctioned)
    for ind in root.iter("INDIVIDUAL"):
        parts = []
        for tag in ["FIRST_NAME","SECOND_NAME","THIRD_NAME","FOURTH_NAME"]:
            el = ind.find(tag)
            if el is not None and el.text:
                parts.append(el.text)
        name = " ".join(parts).strip()
        if name:
            sanctioned.append({"name": name, "list": "UN Consolidated", "programme": "UN Security Council"})
    for ent in root.iter("ENTITY"):
        el = ent.find("FIRST_NAME")
        if el is not None and el.text:
            sanctioned.append({"name": el.text.strip(), "list": "UN Consolidated", "programme": "UN Security Council"})
    print(f"UN Consolidated: {len(sanctioned)-before} entries")
except Exception as e:
    print(f"UN parse error: {e}")

# EU Sanctions — the official EU export (xmlFullSanctionsList_1_1) is
# namespaced and stores the name in the `wholeName` ATTRIBUTE of each
# <nameAlias> (not as element text), so match tags by local-name and read
# the attribute, falling back to firstName/middleName/lastName. The prior
# element-text parse (root.iter("sanctionEntity") + name_el.text) silently
# returned 0 EU entries on the real feed — a sanctions-coverage gap.
try:
    tree = ET.parse("/tmp/eu_sanctions.xml")
    root = tree.getroot()
    before = len(sanctioned)
    seen_eu = set()
    for subject in root.iter():
        if subject.tag.split("}")[-1] != "sanctionEntity":
            continue
        for alias in subject.iter():
            if alias.tag.split("}")[-1] != "nameAlias":
                continue
            nm = (alias.get("wholeName") or "").strip()
            if not nm:
                nm = " ".join(p for p in (
                    alias.get("firstName"), alias.get("middleName"), alias.get("lastName")
                ) if p).strip()
            if nm and nm.lower() not in seen_eu:
                seen_eu.add(nm.lower())
                sanctioned.append({"name": nm, "list": "EU FSF", "programme": "EU Financial Sanctions"})
    print(f"EU FSF: {len(sanctioned)-before} entries")
except Exception as e:
    print(f"EU parse error: {e}")

# UK OFSI
try:
    import csv
    import re as _re
    before = len(sanctioned)
    # ConList.csv (OFSI 2022format) carries meta rows before the header,
    # so DictReader on row 1 reads garbage keys and yields 0 names (a
    # coverage-floor breach). Mirror scripts/sanctions-match.mjs
    # parseOfsiCsv instead: find the header row by its distinctive
    # cells, then join the "Name N" columns per row ("0" is OFSI's
    # empty-part placeholder).
    with open("/tmp/uk_ofsi.csv", encoding="utf-8-sig", errors="replace") as f:
        _rows = list(csv.reader(f))
    _h = -1
    for _i, _r in enumerate(_rows):
        _cells = [c.strip().lower() for c in _r]
        if "name 6" in _cells or "name 1" in _cells or "group id" in _cells:
            _h = _i
            break
    if _h < 0:
        raise ValueError("ConList.csv header row not found")
    _name_cols = sorted(
        [(idx, int(m.group(1))) for idx, c in enumerate(_rows[_h])
         for m in [_re.match(r"^name\s*(\d+)$", c.strip(), _re.I)] if m],
        key=lambda t: t[1])
    _regime_idx = next((idx for idx, c in enumerate(_rows[_h])
                        if c.strip().lower() == "regime"), None)
    for _r in _rows[_h + 1:]:
        _parts = [(_r[idx] if idx < len(_r) else "").strip() for idx, _n in _name_cols]
        _name = " ".join(p for p in _parts if p and p != "0")
        _name = " ".join(_name.split())
        if _name:
            _prog = (_r[_regime_idx].strip() if _regime_idx is not None
                     and _regime_idx < len(_r) and _r[_regime_idx].strip()
                     else "UK Sanctions")
            sanctioned.append({"name": _name, "list": "UK OFSI", "programme": _prog})
    print(f"UK OFSI: {len(sanctioned)-before} entries")
except Exception as e:
    print(f"UK parse error: {e}")

# UAE EOCN — maintained in-repo machine-readable list (bot-protected at source)
uae_names = []
try:
    with open("data/eocn-local-terrorist-list.json", encoding="utf-8") as f:
        _eocn = json.load(f)
    for entry in _eocn.get("entries", []):
        if isinstance(entry, str):
            cands = [entry]
        elif isinstance(entry, dict):
            cands = [entry.get("name", "")] + list(entry.get("aliases", []) or [])
        else:
            cands = []
        for cand in cands:
            cand = str(cand).strip()
            if len(cand) > 3:
                uae_names.append(cand)
                sanctioned.append({"name": cand, "list": "UAE EOCN", "programme": "UAE Local Terrorist List"})
    print(f"UAE EOCN: {len(uae_names)} names loaded from in-repo list")
    # Review-age gate: the curated list is only as current as its own
    # lastReviewed date. An overdue (or missing) review still screens
    # with the file we have, but flags the run so the report marks it
    # and a post-delivery step fails the job loudly.
    import datetime as _dt_eocn
    _lr = str(_eocn.get("lastReviewed", ""))[:10]
    try:
        _age = (_dt_eocn.date.today() - _dt_eocn.datetime.strptime(_lr, "%Y-%m-%d").date()).days
    except Exception:
        _age = None
    _max_age = int(os.environ.get("EOCN_REVIEW_MAX_AGE_DAYS", "7"))
    if _age is None or _age > _max_age:
        # The age label carries its own unit ("26d" or "unknown") so
        # downstream consumers never render "Noned"/"unknownd".
        _age_label = f"{_age}d" if _age is not None else "unknown"
        print(f"WARNING: EOCN REVIEW OVERDUE - lastReviewed '{_lr or 'missing'}' (age {_age_label}, max {_max_age}d)")
        with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as _ge:
            _ge.write("UAE_LIST_STALE=true\n")
            _ge.write(f"UAE_LIST_REVIEW_AGE={_age_label}\n")
            _ge.write(f"UAE_LIST_REVIEW_MAX={_max_age}\n")
except Exception as e:
    print(f"UAE EOCN load error: {e}")
    os.environ["UAE_PDF_FAILED"] = "true"

# ---- fail-safes: never trust an empty or partially loaded core list ----
# One list at zero names (parse failure) or a fraction of its known
# size (truncated download) is a silent false-negative machine; all
# lists empty would report every customer "clear". Floors here are
# deliberately conservative (well below normal sizes: this
# manual-dispatch path parses different file formats than the main
# engine) so they catch a collapse, never a routine de-listing.
# Kill-switch: LIST_FLOORS_ENFORCE=0.
#
# Two classes, so a source outage cannot silently kill the Asana
# delivery (the old SystemExit here skipped the report step, so a
# breach day produced NO task at all and the UAE_PDF_FAILED handling
# in the report step was unreachable):
#   outage - the source file was never obtained (absent/empty, the
#            download steps remove failed fetches): screen DEGRADED
#            without it, mark it in the report, fail AFTER delivery;
#   breach - the file is present but parsed below floor (corruption/
#            truncation): compute NO results, deliver a REFUSAL
#            notice instead of a report, fail AFTER delivery.
_floors = {"OFAC SDN": 1000, "UN Consolidated": 200, "EU FSF": 500, "UK OFSI": 1000, "UAE EOCN": 100}
_srcfile = {"OFAC SDN": "/tmp/ofac_sdn.xml", "UN Consolidated": "/tmp/un_consolidated.xml",
            "EU FSF": "/tmp/eu_sanctions.xml", "UK OFSI": "/tmp/uk_ofsi.csv",
            "UAE EOCN": "data/eocn-local-terrorist-list.json"}
_by_list = {}
for _s in sanctioned:
    _by_list[_s["list"]] = _by_list.get(_s["list"], 0) + 1
_obtained = {_l: os.path.exists(_p) and os.path.getsize(_p) > 0 for _l, _p in _srcfile.items()}
# The EOCN list is a LOCAL curated file with a documented honest-empty
# DEGRADED state; "obtained" for it means names were actually
# extracted, so an empty/corrupt/absent local file degrades (like the
# engine) instead of refusing the whole run.
_obtained["UAE EOCN"] = _by_list.get("UAE EOCN", 0) > 0
_enforce = os.environ.get("LIST_FLOORS_ENFORCE", "1") == "1"
_short = [_l for _l in _floors if _by_list.get(_l, 0) < _floors[_l]]
_outages = [_l for _l in _short if not _obtained[_l]]
_breaches = [f"{_l} loaded {_by_list.get(_l, 0)} name(s), below its floor of {_floors[_l]}"
             for _l in _short if _obtained[_l]]
_refusal = ""
if not sanctioned:
    # Every list empty: screening would clear every customer (a
    # universal false negative) - refused regardless of class or
    # kill-switch, but still DELIVERED as a refusal notice below.
    _refusal = ("no sanctions entries loaded from ANY list - refusing to screen "
                "(every customer would be reported 'clear'); check the list downloads above")
elif _breaches and _enforce:
    _refusal = ("COVERAGE FLOOR BREACH: " + "; ".join(_breaches)
                + " - refusing to screen or post an all-clear "
                "(possible failed download / bad parse / truncated source)")
with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as _ge:
    if _outages:
        print("WARNING: SOURCE OUTAGE - screening proceeds DEGRADED without: " + ", ".join(_outages))
        _ge.write("LIST_OUTAGES=" + ", ".join(_outages) + "\n")
    if _breaches:
        print(("FATAL: " if _enforce else "WARNING: ")
              + "COVERAGE FLOOR BREACH: " + "; ".join(_breaches))
    if _refusal:
        _ge.write("FLOOR_BREACH_MSG=" + _refusal.replace("\n", " ")[:500] + "\n")
    if _refusal or ((_outages or _breaches) and _enforce):
        _ge.write("FLOOR_GATE=true\n")
if _refusal:
    # Deliver the refusal instead of results: the report step posts a
    # clearly marked refusal task (no all-clear wording), then the
    # floor gate step turns the job red. Results from corrupt data
    # are never computed.
    results_data = {
        "total": len(customers),
        "entity_count": sum(1 for c in customers if c.get("kind") != "individual"),
        "individual_count": sum(1 for c in customers if c.get("kind") == "individual"),
        "confirmed": [], "potential": [], "clear_count": 0,
        "uae_pdf_failed": os.environ.get("UAE_PDF_FAILED", "false"),
        "refused": _refusal,
        "unavailable_lists": _outages,
    }
    with open("/tmp/results.json", "w") as f:
        json.dump(results_data, f, ensure_ascii=False, indent=2)
    print("SCREENING REFUSED - refusal notice written for delivery; the floor gate fails the job after delivery.")
    raise SystemExit(0)

# ---- screen through the engine matcher (parity with the daily run) ----
# Same normalize/variants/core/subset/short-entry gates, same C-side
# prefilter, same thresholds. Every hit the engine finds is recorded;
# "confirmed" only at a genuine exact match (score >= 100 — the
# engine's confirmed-hit gate; fuzzy 95-99 reads POTENTIAL).
all_lists = {}
programme = {}
for s in sanctioned:
    all_lists.setdefault(s["list"], []).append((engine.normalize(s["name"]), s["name"]))
    programme.setdefault((s["list"], s["name"]), s.get("programme", ""))

confirmed_hits = []
potential_matches = []
clear = []

for customer in customers:
    cname = customer["name"]
    row = {
        "customer": cname,
        "customer_gid": customer["gid"],
        "customer_url": customer["url"],
        "kind": customer.get("kind", "entity"),
        "parent": customer.get("parent", ""),
        "role": customer.get("role", ""),
    }
    hits = engine.screen_name(cname, all_lists)
    if hits:
        top = hits[0]   # engine-sorted, best score first
        row.update({
            "matched_name": top["matched_entry"],
            "matched_list": top["list"],
            "programme": programme.get((top["list"], top["matched_entry"]), ""),
            "score": round(top["score"]),
        })
        (confirmed_hits if top["score"] >= 100 else potential_matches).append(row)
    elif engine._unscreenable(cname):
        # Non-Latin-script / too-short names cannot be auto-screened —
        # a silent "clear" would be a false negative (engine parity:
        # surfaced as a reviewable POTENTIAL row, never dropped).
        row.update({
            "matched_name": ("name not auto-screenable (non-Latin script or too short) "
                             "— screen this customer manually against all lists"),
            "matched_list": "MANUAL REVIEW", "programme": "", "score": 0,
        })
        potential_matches.append(row)
    else:
        clear.append(cname)

# ---- save results ----
results_data = {
    "total": len(customers),
    "entity_count": sum(1 for c in customers if c.get("kind") != "individual"),
    "individual_count": sum(1 for c in customers if c.get("kind") == "individual"),
    "confirmed": confirmed_hits,
    "potential": potential_matches,
    "clear_count": len(clear),
    "uae_pdf_failed": os.environ.get("UAE_PDF_FAILED","false"),
    "unavailable_lists": _outages
}
with open("/tmp/results.json","w") as f:
    json.dump(results_data, f, ensure_ascii=False, indent=2)

print("\n=== RESULTS ===")
print(f"Total screened:    {len(customers)}")
print(f"Confirmed hits:    {len(confirmed_hits)}")
print(f"Potential matches: {len(potential_matches)}")
print(f"Clear:             {len(clear)}")
