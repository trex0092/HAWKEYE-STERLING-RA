# Sanctions & Targeted Financial Sanctions (TFS) Policy

**Owner:** MLRO (accountable) · Compliance Officer (operational)
**Approver:** Board of Directors
**Status:** DRAFT — for Board approval (open-actions item 18)
**Version:** 0.1 · **Review cadence:** annually, and on any change to the designation lists, the screening estate or the reporting channel.

**Regulatory basis:** Cabinet Decision No. 74 of 2020 (TFS) · Federal
Decree-Law No. 10 of 2025 · Cabinet Resolution No. 134 of 2025 · MoE Circular
No. 3 of 2025 (importance of sanctions and terrorist list screening).

---

## 1. Position

The firm does not deal, directly or indirectly, with any person or entity
designated under an applicable sanctions regime. This is a **zero-tolerance**
position: it is not risk-weighted, cannot be commercially overridden, and does
not depend on transaction size.

A screening run that cannot load a core designation list reads **DEGRADED** and
is never treated as a clear result. Absence of a hit is only meaningful when
the lists actually loaded.

## 2. Lists screened

| List | When it applies |
|---|---|
| **UN Security Council Consolidated List** | Always — mandatory |
| **UAE Local Terrorist List (EOCN)** | Always — mandatory |
| **OFAC SDN** | Where a USD or US-person nexus exists |
| **EU Consolidated List** | Where a EUR or EU-person nexus exists |
| **UK OFSI Consolidated List** | Where a UK nexus exists |
| Other jurisdictional lists | Per the counterparty's jurisdiction |
| **Internal firm watchlist** | Always — supplementary to, never a substitute for, official lists |

The UAE local list is maintained under the SOP at
[`../aims/eocn-list-update-sop.md`](../aims/eocn-list-update-sop.md). Mirror
sources are used for resilience and cross-checking only; a mirror never becomes
the screening source of record.

## 3. Screening frequency

| Trigger | Requirement |
|---|---|
| New customer onboarding | Before the relationship is established |
| Any transaction ≥ AED 55,000 | Before processing |
| TFS list update published | Full customer base rescreened **within 24 hours** |
| Suspicion-driven / ad hoc | Immediately |
| Ongoing | Daily automated screening of the customer base |

## 4. Outcomes and deadlines

| Result | Action | Report | Deadline |
|---|---|---|---|
| **Confirmed match** | Freeze without delay; suspend all dealings; no tipping-off | **FFR** (and CNMR) via goAML | 5 business days |
| **Partial name match** — cannot confirm or exclude | Suspend pending verification; escalate to MLRO; document the analysis | **PNMR** via goAML | 5 business days |
| **False positive** | Document the discriminating analysis; retain the evidence | Internal file note | Retain 5 years |

Operational steps, the identifier-verification method and the event log are in
the [`TFS name-match procedure`](../aims/tfs-name-match-procedure.md). Assets are
released only on a written basis from the competent authority — never on the
firm's own conclusion that a match was wrong.

**The STR question is separate.** A sanctions match is assessed for suspicion in
parallel; a TFS filing never replaces an STR, and an STR never replaces a TFS
filing.

## 5. Circumvention indicators (DPMS-specific)

Escalate and investigate where:

- payment is routed through an unexplained non-sanctioned intermediary;
- a gold shipment destination changes after contract execution;
- delivery is requested to a free trade zone adjacent to a sanctioned
  jurisdiction;
- a shell company with obscured beneficial ownership transacts in gold;
- multiple related entities are used to break a single transaction into parts;
- a counterparty resists identification of the ultimate consignee.

## 6. Screening quality

Matching is fuzzy by design and is calibrated, not guessed. The screening estate
carries CI-enforced accuracy floors, transliteration and phonetic handling for
non-Latin names, and a benchmark corpus; thresholds are one-way (they may be
tightened, never quietly loosened). Evidence:
[`../governance/screening-accuracy-benchmark.md`](../governance/screening-accuracy-benchmark.md)
and the sanctions-screening gap self-assessment at
[`../governance/sanctions-screening-gap-checklist-2026.md`](../governance/sanctions-screening-gap-checklist-2026.md).

## 7. Records

Screening evidence is retained for at least five years: what was screened, when,
against which list versions, the result, and — for every cleared hit — the
reasoning that cleared it.

## 8. Approval

| Field | Value |
|---|---|
| Approved by (Board) | ☐ |
| Date of approval | ☐ |
| Next review due | ☐ (12 months from approval) |
