# TFS Name-Match Procedure — Freeze Without Delay, PNMR/CNMR/FFR

**Owner:** MLRO (sole decision-maker on match confirmation, freeze and filing) ·
Compliance Engineering (alerting/tooling support).
**Legal basis:** Cabinet Decision No. 74 of 2020 (TFS implementation: freeze
without delay + reporting), Federal Decree-Law No. 10 of 2025 (AML/CFT
framework), EOCN guidance; filings via the FIU's goAML portal.
**Applies to:** every **sanctions-list hit** raised by the daily screen, the
onboarding screen, or a manual check — i.e. a possible match against the UAE
Local Terrorist List, the UNSC Consolidated List, or any other screened
designation list. *Adverse-media/PEP alerts and internal-watchlist hits are NOT
TFS events — they follow the ordinary
[alert decision tree](../user-guides/alert-investigation-decision-tree.md).*
**Review:** annually, on any EOCN guidance change, and after every use.

> **Why this document exists.** The alert decision tree previously ended at
> "file STR/SAR" — but a sanctions name match carries **different, stricter
> duties**: suspend/freeze **without delay**, then file a **PNMR** (potential
> match) or **CNMR + FFR** (confirmed match) in goAML — *in addition to, not
> instead of,* any STR the facts justify. This gap was identified in the
> 2026-07 sanctions-screening checklist self-assessment
> ([gap D3](../governance/sanctions-screening-gap-checklist-2026.md)).

---

## 1. The three filings (know which one you are making)

| Filing | When | What it does |
|---|---|---|
| **PNMR** — Potential Name Match Report | The match is **possible but not confirmed** after identifier comparison | Reports the potential match via goAML; the relationship/transaction stays **suspended** pending feedback |
| **CNMR** — Confirmed Name Match Report | Identifiers **confirm** the party is the designated person/entity | Reports the confirmed match via goAML |
| **FFR** — Funds Freeze Report | Filed with/after a confirmed match where **funds, assets or goods are frozen** | Evidences the freeze implemented without delay |

An STR/SAR is a **separate** decision on suspicion of ML/TF (per the
[reviewer/MLRO guide](../user-guides/reviewer-mlro-guide.md)); a TFS match often
also justifies one, but the PNMR/CNMR duty stands on its own.

## 2. Procedure

1. **STOP the dealing — immediately, before anything else.** No onboarding
   completion, no trade, no delivery, no payment in or out involving the
   subject while the match is open. For a DPMS this includes physical goods:
   do not release metal/stones. This suspension is not discretionary and does
   not wait for verification.
2. **Verify the match (same day).** Compare **all available identifiers** —
   full name and script variants, DOB, nationality, ID/passport numbers,
   addresses — between the customer file and the designation entry (the case
   card carries the list, matched name and score; the designation's full
   record is on the issuing list's official source). Only three outcomes:
   - **False positive** — identifiers exclude the subject. Clear the case with
     the documented rationale (ordinary case lifecycle); lift the suspension.
   - **Potential match** — cannot be excluded or confirmed. → step 3.
   - **Confirmed match** — identifiers confirm. → step 4.
3. **Potential match → PNMR.** File the PNMR in goAML **without delay** (same
   business day). Keep the relationship and any funds/goods **suspended**
   pending EOCN/FIU feedback. Do not proceed with any transaction.
4. **Confirmed match → freeze + CNMR + FFR.** Implement the freeze **without
   delay**: all funds, assets and goods of (or controlled by) the designated
   party, applying the 50%/control rule for owned entities. File the **CNMR**,
   and the **FFR** evidencing what was frozen, in goAML without delay. Comply
   with any EOCN direction that follows.
5. **Tipping-off discipline (both branches).** Do **not** tell the subject a
   match is being verified or that a PNMR/CNMR has been filed. Use neutral
   operational language for the suspension ("processing"). Same Art. 25
   discipline as STRs; the Advisor refuses to draft tip-off text by charter.
6. **STR assessment (parallel, not instead).** Assess whether the facts also
   ground an STR/SAR — a designated party attempting business usually does.
   MLRO decision per the standing procedure.
7. **Evidence — every step, at the time it happens.** On the screening case
   card and the tamper-evident activity log: identifiers compared and the
   conclusion; suspension/freeze time; filing type, time and goAML reference
   number; EOCN/FIU feedback and directions. Add a row to the §4 log.
8. **Release only on written basis.** Unfreeze/resume **only** on EOCN/FIU
   confirmation of false positive, delisting (watch the daily list screen and
   [`eocn-list-update-sop.md`](eocn-list-update-sop.md) §1 triggers), or an
   EOCN direction — never on internal judgement alone. Record the basis in §4.

**Timing standard throughout: "without delay" — same business day, hours not
days.** Confirm the current EOCN guidance's exact windows when filing; the
goAML portal presents the current form set. If goAML is unreachable, document
the attempt and contact the FIU/EOCN through the published alternate channels —
the freeze/suspension never waits on portal availability.

## 3. Roles

| Step | Who |
|---|---|
| Suspension on alert | Whoever sees it first — analyst or MLRO; suspension is automatic policy, not a judgement call |
| Identifier verification + evidence pack | Analyst prepares; MLRO reviews (four-eyes) |
| Match confirmation, freeze decision, PNMR/CNMR/FFR filing, any release | **MLRO only** (dual attestation; segregation of duties per the [operating model](../governance/operating-model.md)) |
| Tooling, case cards, list currency | Compliance Engineering (this repo's screening estate) |

## 4. TFS event log

| Date | Case / subject ref | Outcome (FP / PNMR / CNMR+FFR) | Suspension→filing time | goAML ref | EOCN feedback | Release basis (if any) | MLRO sign-off |
|---|---|---|---|---|---|---|---|
| *(no TFS events to date — the daily screen has raised no confirmed designation match; this row is the standing evidence that the log is maintained)* | | | | | | | |

## 5. Related controls

- Alert generation + case lifecycle: daily/onboarding screens
  (`screen.py`, `scripts/sanctions-screen.mjs`) → Screening Cases sections.
- Decision routing: [alert decision tree](../user-guides/alert-investigation-decision-tree.md)
  (TFS branch routes list hits here **before** the STR question).
- List currency: [`eocn-list-update-sop.md`](eocn-list-update-sop.md) (24h
  update trigger; 7-day review gate; mirror cross-check).
- Incident overlay: [`ai-incident-runbook.md`](../governance/ai-incident-runbook.md)
  routes designated-party touchpoints to this procedure.
- Competency: PNMR/CNMR/FFR filing in
  [`competency-records.md`](competency-records.md); annual refresh in the
  compliance calendar.
