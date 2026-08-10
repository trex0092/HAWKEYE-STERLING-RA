#!/usr/bin/env python3
"""
Daily sanctions screen — STEP 6: build the report and create the Asana task.

Extracted verbatim from .github/workflows/daily-sanctions-screen.yml, where it
lived as an inline `python3 << PYEOF` heredoc — invisible to py_compile,
unreachable by tests, unlintable. Behaviour is unchanged.

Reads:  /tmp/results.json, plus the step env (ASANA_PAT, ASANA_PROJECT_GID,
        ASANA_SECTION_GID, ASANA_ASSIGNEE_GID, DATE_ISO, DATE_DISPLAY, TIME_GST,
        SCRIPT_VERSION)
"""

import json, os, requests

with open("/tmp/results.json") as f:
    results = json.load(f)

date_iso    = os.environ["DATE_ISO"]
date_disp   = os.environ["DATE_DISPLAY"]
time_gst    = os.environ["TIME_GST"]
ofac_hash   = os.environ.get("OFAC_HASH","N/A")
un_hash     = os.environ.get("UN_HASH","N/A")
eu_hash     = os.environ.get("EU_HASH","N/A")
uk_hash     = os.environ.get("UK_HASH","N/A")
uae_hash    = os.environ.get("UAE_HASH","N/A")
uae_failed  = os.environ.get("UAE_PDF_FAILED","false") == "true"
script_ver  = os.environ["SCRIPT_VERSION"]

total       = results["total"]
entity_count     = results.get("entity_count", total)
individual_count = results.get("individual_count", 0)
confirmed   = results["confirmed"]
potential   = results["potential"]
clear_count = results["clear_count"]
refused     = results.get("refused") or ""
unavailable = results.get("unavailable_lists") or []

# ---- per-list status lines (refusal / outage aware) ----
# The old report hardcoded "SCREENED" for every list, so a run that
# proceeded DEGRADED (source outage) or was REFUSED (floor breach)
# would still read as fully screened - a false audit statement.
def _list_status(label, hashval):
    if refused:
        return ("REFUSED - coverage floor breach, see banner above", "N/A")
    if label in unavailable:
        return ("⚠️  UNAVAILABLE THIS RUN (source outage) - screening proceeded without this list", "N/A")
    return ("SCREENED", hashval)
ofac_status, ofac_hash = _list_status("OFAC SDN", ofac_hash)
un_status,   un_hash   = _list_status("UN Consolidated", un_hash)
eu_status,   eu_hash   = _list_status("EU FSF", eu_hash)
uk_status,   uk_hash   = _list_status("UK OFSI", uk_hash)

# ---- UAE EOCN status line ----
if refused:
    uae_b_status = "REFUSED - coverage floor breach, see banner above"
    uae_b_hash   = "N/A"
elif uae_failed or "UAE EOCN" in unavailable:
    uae_b_status = "⚠️  EOCN LIST UNAVAILABLE — manual check required"
    uae_b_hash   = "N/A"
else:
    uae_b_status = "SCREENED"
    uae_b_hash   = uae_hash

# ---- in-repo EOCN list metadata (entry count + last review) ----
try:
    with open("data/eocn-local-terrorist-list.json", encoding="utf-8") as _f:
        _eocn_meta = json.load(_f)
    eocn_count = _eocn_meta.get("count") or len(_eocn_meta.get("entries", []))
    eocn_last_reviewed = _eocn_meta.get("lastReviewed", "see file")
except Exception:
    eocn_count = "?"
    eocn_last_reviewed = "?"
# Review-age gate flag set by the screening step: mark the report line
# so the MLRO sees the lapsed review where the reconciliation date is.
# UAE_LIST_REVIEW_AGE carries its own unit ("26d" or "unknown") and the
# window comes from the configured EOCN_REVIEW_MAX_AGE_DAYS, so this
# line never renders "unknownd" or a stale hardcoded "7d".
if os.environ.get("UAE_LIST_STALE", "false") == "true":
    _rev_age = os.environ.get("UAE_LIST_REVIEW_AGE", "unknown")
    _rev_max = os.environ.get("UAE_LIST_REVIEW_MAX", "7")
    eocn_last_reviewed = f"{eocn_last_reviewed}  ⚠️ REVIEW OVERDUE (age {_rev_age}, max {_rev_max}d): re-verify against the official EOCN publication"

# ---- confirmed hits section ----
if refused:
    # Never render all-clear wording on a refused run: no results
    # were computed, so "no matches" would be a false statement.
    hits_text = ("SCREENING REFUSED - no match results were computed this run.\n"
                 + refused)
elif not confirmed:
    hits_text = "No confirmed sanctions matches identified in this run.\nAll customers returned clear across all lists screened."
else:
    lines = []
    for i, h in enumerate(confirmed, 1):
        subj = h['customer'] + ("  [INDIVIDUAL — " + (h.get('role') or 'Principal') + " of " + h.get('parent','') + "]" if h.get('kind') == 'individual' else "  [LEGAL ENTITY]")
        lines.append(
            f"⛔ HIT {i}\n"
            f"   Subject:         {subj}\n"
            f"   Customer Record: {h['customer_url']}\n"
            f"   Matched List:    {h['matched_list']}\n"
            f"   Matched Entity:  {h['matched_name']}\n"
            f"   Match Score:     {h['score']}%\n"
            f"   Programme:       {h['programme']}\n"
            f"   Action Required: IMMEDIATE ESCALATION TO MLRO\n"
            f"                    Transaction freeze pending review.\n"
            f"                    Do not tip off customer.\n"
            f"                    Cabinet Resolution No. 74/2020 applies."
        )
    hits_text = "\n\n".join(lines)

# ---- potential matches section ----
if refused:
    potential_text = "SCREENING REFUSED - no match results were computed this run."
elif not potential:
    potential_text = "No potential matches requiring review in this run."
else:
    lines = []
    for i, p in enumerate(potential, 1):
        subj = p['customer'] + ("  [INDIVIDUAL — " + (p.get('role') or 'Principal') + " of " + p.get('parent','') + "]" if p.get('kind') == 'individual' else "  [LEGAL ENTITY]")
        lines.append(
            f"⚠️  POTENTIAL MATCH {i}\n"
            f"   Subject:         {subj}\n"
            f"   Customer Record: {p['customer_url']}\n"
            f"   Matched List:    {p['matched_list']}\n"
            f"   Matched Entity:  {p['matched_name']}\n"
            f"   Match Score:     {p['score']}%\n"
            f"   Reason Flagged:  Name similarity / transliteration variant\n"
            # A scored hit on a name the matcher could not fully screen must not
            # read as a completed screening: the manual duty stays open whatever
            # the score says.
            + (f"   ⚠ NOT FULLY SCREENED: {p['manual_review_reason']}\n"
               if p.get('manual_review') and p.get('matched_list') != 'MANUAL REVIEW' else "")
            + "   MLRO Decision\n"
            "   Required By:     Next business day\n"
            "   Decision:        ☐ False Positive — Clear\n"
            "                    ☐ True Match — Escalate\n"
            "                    ☐ Further Investigation Required"
        )
    potential_text = "\n\n".join(lines)

# ---- integrity banner (refusal / degraded run) ----
if refused:
    banner = ("\n          ⛔ SCREENING REFUSED - COVERAGE FLOOR BREACH\n"
              "          " + refused + "\n"
              "          No screening results below are valid; the workflow run is failed red\n"
              "          after this delivery. Fix the source data and re-run.\n")
elif unavailable:
    banner = ("\n          ⚠️ DEGRADED RUN - SOURCE OUTAGE\n"
              "          These core list(s) could not be obtained and were NOT screened this\n"
              "          run: " + ", ".join(unavailable) + ".\n"
              "          All other lists screened normally. The workflow run is failed red\n"
              "          after this delivery so the outage is escalated, not routine.\n")
else:
    banner = ""

# ---- build full narrative ----
narrative = f"""DAILY SANCTIONS SCREENING — AUTOMATED BATCH RUN
================================================
{banner}
Date:                {date_disp}
Screening Time:      {time_gst} GST (UTC+4)
Triggered By:        Automated — GitHub Actions
                     Workflow: {script_ver}
Prepared By:         Compliance Automation — Hawkeye Sterling V2
Reviewed By:         Compliance Department

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGULATORY BASIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This screening is conducted in accordance with:

— UAE Federal Decree-Law No. 26 of 2021 (AML/CFT Law)
— UAE Cabinet Resolution No. 74 of 2020 (TFS Obligations)
— UAE Federal Decree-Law No. 10 of 2025 (AML/CFT Amendments)
— FATF Recommendation 6 (Targeted Financial Sanctions)
— FATF Recommendation 10 (Customer Due Diligence)
— MoE Due Diligence Regulations — DPMS Sector
— Cabinet Resolution No. 156 of 2025 (CPF Obligations)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LISTS SCREENED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ OFAC SDN — US Treasury / Office of Foreign Assets Control
   Source:    https://ofac.treasury.gov/
   File:      sdn.xml (official government download)
   File Hash: {ofac_hash}
   Status:    {ofac_status}

✅ UN Consolidated List — UN Security Council
   Source:    https://scsanctions.un.org/resources/xml/en/consolidated.xml
   File:      consolidated.xml (official UN download)
   File Hash: {un_hash}
   Status:    {un_status}

✅ EU Financial Sanctions — European Commission
   Source:    https://webgate.ec.europa.eu/fsd/fsf/public/files/
              xmlFullSanctionsList_1_1/content
   File:      export_sanctions_en.xml (official EU download)
   File Hash: {eu_hash}
   Status:    {eu_status}

✅ UK OFSI Consolidated List — HM Treasury
   Source:    https://ofsistorage.blob.core.windows.net/
              publishlive/2022format/ConList.csv
   File:      ConList.csv (official HM Treasury download)
   File Hash: {uk_hash}
   Status:    {uk_status}

✅ Switzerland SECO — Consolidated sanctions ("Gesamtliste")
   Source:    State Secretariat for Economic Affairs (SECO), screened
              DIRECTLY each run via the OpenSanctions ch_seco_sanctions
              mirror (targets.simple.csv) — a CORE list with a coverage
              floor since 2026-07-29. Reference publication:
              https://www.seco.admin.ch/en/searching-for-subjects-sanctions

✅ Australia DFAT — Consolidated List (Regulation 8)
   Source:    Australian Sanctions Office / DFAT, screened DIRECTLY each
              run via the OpenSanctions au_dfat_sanctions mirror
              (targets.simple.csv) — a CORE list with a coverage floor
              since 2026-07-29. DFAT's own .xlsx stays bot-gated, so the
              mirror is the fetchable daily path; reference publication:
              https://www.dfat.gov.au/international-relations/security/sanctions/consolidated-list

✅ UAE EOCN — Local Terrorist List (Executive Office / EOCN)
   Source:    UAE Executive Office for Control & Non-Proliferation
   Reference: data/eocn-local-terrorist-list.json (maintained in-repo —
              EOCN publishes only a bot-protected PDF/Excel, no machine feed)
   Entries:   {eocn_count}
   File Hash: {uae_b_hash}
   Status:    {uae_b_status}

✅ UAE EOCN — Maintenance & Cross-Reference
   Method:    The in-repo EOCN list is screened directly; UN Consolidated
              + OFAC SDN are screened in parallel as an additional
              cross-reference for UAE-relevant designations.
   Mitigation: MLRO to reconcile the in-repo list against the official
               EOCN publication (https://www.uaeiec.gov.ae) periodically.
   Last Reconciled:   {eocn_last_reviewed}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subjects Screened:     {total} — FULL Customer Database
                       ({entity_count} legal entities + {individual_count} principals/UBOs)
Screening Type:        Fuzzy name matching + alias matching
Match Threshold:       85% minimum similarity score
Transliteration:       Arabic / Turkish / Latin variants included
Entity Types:          Legal entities AND their associated individuals
                       (every shareholder, director and UBO recorded
                       in SECTION 4 of the customer assessment is
                       screened in their own right, not just the company)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULTS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Subjects Screened:               {total}  ({entity_count} entities + {individual_count} principals/UBOs)
Confirmed Hits:                        {len(confirmed)}
Potential Matches — Pending Review:    {len(potential)}
Clear — No Match:                      {clear_count}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIRMED HITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{hits_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POTENTIAL MATCHES — PENDING MLRO REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{potential_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHODOLOGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Screening is performed using fuzzy name matching against
government-published sanctions list files downloaded
directly from official sources at time of run. Match
threshold set at 85% to balance sensitivity against
false positive rate. Arabic, Turkish and Latin script
transliteration variants are normalised prior to
matching. Aliases and alternative names recorded in
source lists are included in matching scope.

This screening does not constitute legal advice. All
potential matches and confirmed hits require human
MLRO review and decision before any compliance action
is taken. Automated output is a decision-support tool
only, not a final determination.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIT TRAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Script Version:           {script_ver}

OFAC SDN File Hash:       {ofac_hash}
UN Consolidated Hash:     {un_hash}
EU FSF File Hash:         {eu_hash}
UK OFSI File Hash:        {uk_hash}
UAE EOCN List Hash:       {uae_b_hash}

Customer List Source:     Asana — Customer Database
                          Project GID: 1214107620220121
Subjects at Time of Run:  {total} ({entity_count} entities + {individual_count} principals/UBOs)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MLRO SIGN-OFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MLRO Review Completed:  ☐ Yes   ☐ No
MLRO Name:              ___________________________
Date of Review:         ___________________________
Overall Decision:       ☐ All Clear — No Action
                        ☐ False Positives Cleared
                        ☐ Escalated to Senior Management
                        ☐ STR / SAR Filed
                        ☐ TFS Freeze Applied
STR Reference (if any): ___________________________

> RETENTION NOTICE: This record and all supporting
> files must be retained for a minimum of 10 years
> from the date of screening pursuant to UAE Federal
> Decree-Law No. 26 of 2021, Article 23, and Cabinet
> Resolution No. 74 of 2020."""

# ---- create Asana task ----
pat             = os.environ["ASANA_PAT"]
project_gid     = os.environ["ASANA_PROJECT_GID"]
section_gid     = os.environ["ASANA_SECTION_GID"]
assignee_gid    = os.environ["ASANA_ASSIGNEE_GID"]
headers         = {
    "Authorization": f"Bearer {pat}",
    "Content-Type": "application/json"
}

# Refusal/degraded runs must be unmistakable in the Asana list view,
# not only inside the task body.
if refused:
    task_name = f"⛔ {date_iso} — Daily Sanctions Screening - REFUSED (coverage floor)"
elif unavailable:
    task_name = f"⚠️ {date_iso} — Daily Sanctions Screening - DEGRADED (source outage)"
else:
    task_name = f"🔍 {date_iso} — Daily Sanctions Screening"

# Same-day re-run guard. This workflow is manual-only now, so a re-dispatch is
# ordinary — and three dispatches on 10 Aug 2026 filed three identical DEGRADED
# cards, which is how this gap was found. Every other delivery stream in the
# repo carries a duplicate guard (asana-notify's findRecentDuplicate,
# sanctions-screen's omCardToSkip); this one never did.
#
# Direction-aware, matching omCardToSkip: an existing card for today is only a
# reason to skip when today's run is NOT more severe. A REFUSED or DEGRADED run
# must still post over an earlier clean card, because it says something the
# earlier one did not. Best-effort: if the lookup itself fails we post anyway,
# since losing a screening record is worse than a duplicate.
_SEVERITY = {"🔍": 0, "⚠️": 1, "⛔": 2}
_today_rank = _SEVERITY.get(task_name.split(" ", 1)[0], 0)
try:
    _existing, _offset, _pages = [], None, 0
    while True:
        _u = f"https://app.asana.com/api/1.0/projects/{project_gid}/tasks?opt_fields=name&limit=100"
        if _offset:
            _u += f"&offset={_offset}"
        _lr = requests.get(_u, headers=headers, timeout=30)
        if _lr.status_code != 200:
            raise RuntimeError(f"HTTP {_lr.status_code}")
        _j = _lr.json()
        _existing += [str(t.get("name") or "") for t in (_j.get("data") or [])]
        _offset = (_j.get("next_page") or {}).get("offset")
        _pages += 1
        if not _offset or _pages >= 50:
            break
    _same_day = [n for n in _existing
                 if date_iso in n and "Daily Sanctions Screening" in n]
    _worst = max((_SEVERITY.get(n.split(" ", 1)[0], 0) for n in _same_day), default=-1)
    if _same_day and _worst >= _today_rank:
        print(f"↩️  Already filed for {date_iso} at this severity or higher "
              f"({_same_day[0]}) — skipping the duplicate card. "
              "The screening itself ran and its result is in this log.")
        raise SystemExit(0)
except SystemExit:
    raise
except Exception as _e:
    print(f"⚠️  Duplicate check failed ({_e}) — posting anyway "
          "(a lost screening record is worse than a duplicate card)")

payload = {
    "data": {
        "name": task_name,
        "notes": narrative,
        "due_on": date_iso,
        "assignee": assignee_gid,
        "projects": [project_gid],
        "memberships": [
            {
                "project": project_gid,
                "section": section_gid
            }
        ]
    }
}

r = requests.post(
    "https://app.asana.com/api/1.0/tasks",
    headers=headers,
    json=payload
)

if r.status_code == 400 and "Section must be in project" in r.text:
    # Config drift (section GID not in the target project) must never
    # cost the delivery itself: create the task at project level —
    # it lands untriaged at the top of the project, which is visible,
    # not silent — and shout about the drift so it gets fixed.
    print("⚠️ SECTION CONFIG DRIFT — section "
          f"{section_gid} is not in project {project_gid}; "
          "creating the task without a section. Fix the "
          "ASANA_DELIVERY_SECTION_GID / ASANA_DELIVERY_PROJECT_GID pair.")
    del payload["data"]["memberships"]
    r = requests.post(
        "https://app.asana.com/api/1.0/tasks",
        headers=headers,
        json=payload
    )

if r.status_code == 201:
    task_gid = r.json()["data"]["gid"]
    task_url = r.json()["data"]["permalink_url"]
    print(f"✅ Task created: {task_name}")
    print(f"   GID: {task_gid}")
    print(f"   URL: {task_url}")
else:
    print(f"❌ Task creation failed — HTTP {r.status_code}")
    print(r.text)
    # SystemExit, not exit(): the builtin `exit` is injected by the `site`
    # module and is not guaranteed to exist (python -S, some embedded runtimes),
    # so a delivery failure could itself die with NameError instead of failing
    # cleanly. Matches daily-screen-fetch.py, and is what CodeQL flags here —
    # the alert only became visible once this left the workflow YAML.
    raise SystemExit(1)

# ---- post comment on each confirmed hit customer task ----
for h in confirmed:
    comment = (
        f"⛔ SANCTIONS HIT — {date_disp}\n\n"
        f"This customer was flagged in the daily sanctions screening run.\n\n"
        f"Matched List:   {h['matched_list']}\n"
        f"Matched Entity: {h['matched_name']}\n"
        f"Match Score:    {h['score']}%\n"
        f"Programme:      {h['programme']}\n\n"
        f"Action Required: IMMEDIATE ESCALATION TO MLRO\n"
        f"Screening Record: {task_url}"
    )
    rc = requests.post(
        f"https://app.asana.com/api/1.0/tasks/{h['customer_gid']}/stories",
        headers=headers,
        json={"data": {"text": comment}}
    )
    if rc.status_code == 201:
        print(f"   Comment posted on: {h['customer']}")
    else:
        print(f"   Comment failed on: {h['customer']} — {rc.status_code}")
