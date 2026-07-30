# Sanctions-Screening Gap Checklist — Self-Assessment (2026)

**Assessed against:** *Checklist for Identification of Sanction Screening Gaps to
Ensure Robust AML/CFT, TFS Compliance* (UAE practitioner checklist, amluae.com;
Cabinet Decision No. 74 of 2020 TFS context) — 11 sections, 36 yes/no items.
**Subject:** the screening estate — `screen.py` (daily unified screen + onboarding),
`scripts/sanctions-screen.mjs` / `sanctions-match.mjs` (JS engine + watch), the
case lifecycle, list SOPs and the evidence layer.
**Date:** 2026-07-28 · **Prepared by:** Compliance engineering · **Owner:** MLRO
**Status key:** ✅ yes, evidenced · 🟡 partial / analogue · ❌ no (gap) · N-A not applicable.

> Assessment method: every answer below was verified against code or a document,
> not asserted. Gaps found by this assessment were **closed in the same change**
> (marked *closed 2026-07-28*) or stated openly with the register reference.

## Scorecard

| § | Area | Verdict |
|---|---|---|
| A | System configuration & coverage | ✅ (A4 closed 2026-07-28; A5 stated gap R-13) |
| B | Data quality & input standards | 🟡 honest partial |
| C | Matching logic & alert calibration | ✅ |
| D | Case handling & escalation | ✅ (D3 closed 2026-07-28) |
| E | List management & governance | ✅ |
| F | Testing & quality assurance | ✅ |
| G | Training & oversight | ✅ (G1 closed 2026-07-28 via calendar + competency baseline) |
| H | Tool capabilities & explainability | ✅ |
| I | Performance & operations | ✅ (I1 N-A at batch cadence, stated) |
| J | Change management & release control | ✅ |
| K | Evidence & auditability | ✅ |

## A. System configuration & coverage

| Item | Status | Evidence |
|---|---|---|
| UAE Local Terrorist List + UNSC Consolidated + TFS lists current | ✅ | [`data/eocn-local-terrorist-list.json`](../../data/eocn-local-terrorist-list.json) (7-day review gate, mirror cross-check, coverage floor); UN Consolidated parsed live daily; [`eocn-list-update-sop.md`](../aims/eocn-list-update-sop.md) |
| Latest OFAC / UN / EU / other national lists | ✅ | Core: OFAC SDN+alt, UN, UK OFSI, EU FSF (floors enforced); supplementary: Canada SEMA, France DGT, Swiss SECO ([`data/sanctions-sources.json`](../../data/sanctions-sources.json), [`data/sanctions-extra.json`](../../data/sanctions-extra.json)); daily change watch (`sanctions-watch.yml`) |
| All relevant parties screened (customers, UBOs, controlling persons, counterparties) | ✅ | `screen.py` extracts and screens individuals AND Parent/Shareholder/UBO/Owner lines, incl. natural-person-only owner lines; corporate owners screened under the 50%/control rule |
| Internal blacklists / watchlists integrated | ✅ *closed 2026-07-28* | [`data/internal-watchlist.json`](../../data/internal-watchlist.json) screened by BOTH engines (supplementary tier / `optional` source); empty = valid state, never degrades; SOP §8 |
| Real-time screening at onboarding and transactions | 🟡 | Onboarding: every 6h (`onboarding-screen.yml`) + daily full base. Transactions: **not screened** — the transaction-monitoring engine is inert pending a real feed; stated risk **R-13** with a [compensating control](../aims/transaction-feed-compensating-control.md), not hidden |

## B. Data quality & input standards

| Item | Status | Evidence |
|---|---|---|
| Names/aliases/DOB/nationality standard format, validated, enriched | 🟡 | Enrichment at screen time (aliases, transliteration variants, phonetic fold); entry-side validation is limited — the customer base lives in Asana free text; parsing hardened against typing drift (en-dash separators, inline commas, non-Latin) |
| Parsing & normalisation before screening; truncation/encoding prevented | ✅ | `normalize()` + shared [`data/translit-groups.json`](../../data/translit-groups.json); script-agnostic extraction; cross-script subjects routed **UNSCORABLE → MANUAL REVIEW**, never silent-cleared |
| Daily data-quality sample, defects fixed at source | 🟡 | Parse failures and unscreenable subjects surface loudly in every daily report (manual-review net); no separate daily input-quality metric — accepted at current base size, revisit if the customer base grows |

## C. Matching logic & alert calibration

| Item | Status | Evidence |
|---|---|---|
| Fuzziness, transliteration, tokenization configured | ✅ | Fuzzy matching with token handling; 89-group transliteration source of truth (both engines, fail-loud); phonetic fold; fuzzy blocking (~6x prefilter, bit-identical) |
| Thresholds risk-based and tested | ✅ | CI-enforced accuracy floors ([`floors.json`, ratchet-up-only, MLRO sign-off to lower](screening-accuracy-benchmark.md)); [champion–challenger threshold protocol](champion-challenger-thresholds.md) |
| False positives analysed, tool recalibrated | ✅ | 85 labelled hard negatives in the benchmark; shadow-threshold near-miss evidence on every run; case-clear rationale feeds the quarterly review |

## D. Case handling & escalation

| Item | Status | Evidence |
|---|---|---|
| Alerts worked with notes, disposition, evidence links | ✅ | Case lifecycle (New → Under Review → Escalated → Cleared) with backlog & reopen; [decision tree](../user-guides/alert-investigation-decision-tree.md) documentation checklist; ⏰ AGING comments past SLA |
| Overrides/suppressions documented, independently reviewed, retested | ✅ | Four-eyes on clears; threshold changes only via PR + sign-off; ten silent-clear classes closed and regression-tested (audit #325) |
| PNMR/CNMR pathways to goAML clear, timed, evidenced, linked to freeze | ✅ *closed 2026-07-28* | **Was the material gap**: freeze duty was referenced but no procedure existed and the decision tree ended at STR. Now: [`tfs-name-match-procedure.md`](../aims/tfs-name-match-procedure.md) (suspend without delay → PNMR / CNMR + FFR → release only on written basis, §4 event log) + TFS gate 1a in the decision tree + runbook link fixed |

## E. List management & governance

| Item | Status | Evidence |
|---|---|---|
| Manual update process for curated/third-party lists | ✅ | [`eocn-list-update-sop.md`](../aims/eocn-list-update-sop.md): ≤24h triggers, four-eyes PR, §8 covers the internal watchlist |
| Updates reviewed for completeness/accuracy | ✅ | Mirror cross-check alarm (missing-locally direction) + quarterly two-direction full reconciliation (§4, first completed 2026-07-16) |
| Version control + change log | ✅ | Git history + SOP §7 evidence log + `lastReviewed` metadata + schema CI (`test/data-schema.test.js`) |

## F. Testing & quality assurance

| Item | Status | Evidence |
|---|---|---|
| Sandbox mirroring production data shape | ✅ | CI runs **both real engines** against the labelled benchmark corpus on every push — same parsers, same matchers, frozen baseline |
| Control/near-match/negative tests after material change, archived | ✅ | 121 true-pair + 85 hard-negative + fuzz property tests, every push/PR; results in CI run logs |
| Fixed seed pack measuring precision & recall across releases | ✅ | Exactly the benchmark corpus (`test/fixtures/screening-benchmark/`) + [`screening-accuracy-benchmark.md`](screening-accuracy-benchmark.md) |
| Scheduled regression with acceptance criteria before release | ✅ | Per-backend floors gate CI; floors ratchet up only |

## G. Training & oversight

| Item | Status | Evidence |
|---|---|---|
| Personnel trained on typologies, evasion, evolving norms | ✅ *closed 2026-07-28* | Competency baseline extended (TFS handling + sanctions-evasion typologies row) and an **annual refresh duty** added to [`data/compliance-calendar.json`](../../data/compliance-calendar.json) (`tfs-training-refresh-annual`, also after material system/list changes) |
| Override/escalation guidelines documented & disseminated | ✅ | [Decision tree](../user-guides/alert-investigation-decision-tree.md) + [reviewer/MLRO guide](../user-guides/reviewer-mlro-guide.md) |
| Senior management informed of recurring/critical lapses | ✅ | Daily brief + weekly summary + daily governance card (GovernanceScore) + red-run alerting; "silence is never success" ([coverage matrix §2](assurance-coverage-matrix.md)) |

## H. Tool capabilities & explainability

| Item | Status | Evidence |
|---|---|---|
| Engine explains why a match triggered, readable score | ✅ | Every hit carries the list, the matched designation name and a 0–100 score with band; near-threshold shadow evidence retained |
| Seed-list injection, evidence export, config lock | ✅ | Benchmark fixtures = seed injection; tokenised exports + CI artifacts = evidence; config in git behind CODEOWNERS + protected merges = lock with approvals |
| Multi-script transliteration, configurable language handling | ✅ | Shared translit groups (Arabic/Cyrillic/…), Arabic-locale adverse-media queries, cross-script manual-review routing |

## I. Performance & operations

| Item | Status | Evidence |
|---|---|---|
| Throughput/latency targets for onboarding & payments | N-A (stated) | Batch cadence (daily + 6h onboarding) at current volume; no payment flows exist to screen in-line. Becomes applicable with a transaction feed (R-13) |
| Failures, timeouts, backlogs monitored & investigated | ✅ | Self-healing retry after runner deaths, watchlist liveness, `freshness-check` (mandatory dailies ran), anomaly-watch, loud failure paths |
| Rescreens on material change within SLA, evidenced | ✅ | The **whole base** is rescreened daily — any material change is re-screened ≤24h by construction; delta engine surfaces what changed |

## J. Change management & release control

| Item | Status | Evidence |
|---|---|---|
| EOCN/UNSC updates assessed, impact recorded, mapped to config | ✅ | `sanctions-watch.yml` (daily change detection) + `eocn-reconcile.yml` + SOP §1 triggers (≤24h) + TFS update-timeline log |
| Verify/validate before production; release note + rollback | ✅ | CI gate (floors + full suite) before merge; CHANGELOG + signed releases + SBOM; git revert as rollback |
| User comms & training refreshers per release | ✅ *closed 2026-07-28* | CHANGELOG per change; training-refresh duty now fires after material screening changes (calendar note) |

## K. Evidence & auditability

| Item | Status | Evidence |
|---|---|---|
| Central per-period evidence pack (lists, thresholds, tests, cases) | ✅ | Asana daily/weekly cards + SOP evidence log + floors/baseline files + [eval scorecard](eval-scorecard.md) — all dated, all linked |
| Approvals, exceptions, compensating controls with dates/owners | ✅ | [Open-actions register](open-actions-register.md), CAPA log, [coverage matrix §5 known gaps](assurance-coverage-matrix.md) (stated, not hidden) |
| One-page summary for auditors/supervisors | ✅ | The [assurance coverage matrix](assurance-coverage-matrix.md) is built as exactly this ("an examiner's first question") |

## RACI note

The checklist's RACI model maps to a **single-operator reality** here: the MLRO
holds the A/R for methodology, thresholds, dispositions and filings; Compliance
Engineering is R for tooling; four-eyes and dual attestation substitute for
multi-team segregation ([operating model](operating-model.md)). A multi-column
RACI would fabricate roles that do not exist — the honest control is the
documented preparation-vs-decision split.

## Gaps closed by this assessment (2026-07-28)

| Checklist item | Closure |
|---|---|
| **D3** — no PNMR/CNMR/freeze pathway | [`tfs-name-match-procedure.md`](../aims/tfs-name-match-procedure.md) + decision-tree TFS gate + runbook link + competency row + annual review/tabletop duty |
| **A4** — no internal watchlist | `data/internal-watchlist.json` in both engines (optional, never degrades when empty) + SOP §8 + schema CI + annual review duty |
| **G1/J3** — no typology training cadence | Competency baseline + `tfs-training-refresh-annual` calendar duty (also after material changes) |

**Remaining open (stated):** A5/I1 transaction screening — risk **R-13**, blocked
on a real transaction feed; B1/B3 input-side data quality — accepted at current
base size, revisit on growth. Both tracked in the
[risk register](../aims/ai-risk-register.md) / [coverage matrix §5](assurance-coverage-matrix.md).

**Re-review:** annually, after any real TFS event, or when a transaction feed or
a second operator arrives.
