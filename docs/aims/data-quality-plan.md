# Data-Quality Plan (AIMS A.7)

How the firm assures the quality of the data its AI system depends on — the reference lists it
screens against and the customer data it screens. Quality is a control: a stale list or a
malformed record is a screening failure. **Owner:** MLRO / Compliance Engineering.
**Date:** 2026-06-29. Review: annually + on any new data source. Complements
[`../governance/data-retention.md`](../governance/data-retention.md) (retention/lineage) and
[`third-party-register.md`](third-party-register.md) (source provenance).

## 1. Data resources in scope
| Resource | Source | Where | Authoritative for |
|---|---|---|---|
| Sanctions lists (OFAC SDN, UN, UK OFSI, EU FSF, UAE EOCN, +Canada) | Official gov hosts | fetched per run | Sanctions matching |
| Supplementary / curated lists (SECO, DFAT, local) | Curated | `data/*-curated-list.json`, `sanctions-extra.json` | Recall support (never flips core) |
| FATF list state | FATF Watchdog | `data/fatf-state.json` | Jurisdiction grey/black state |
| Jurisdiction-risk table | Synced from FATF state | `data/jurisdiction-risk.json` | R.10 jurisdiction nudge |
| Country baseline & scores | App baseline | `index.html` `COUNTRIES` | Canonical country naming/score |
| Customer / KYC records | Asana Customer Database | Asana (system of record) | Subjects screened |
| AI asset register | Maintained | `data/ai-assets.json` | AI surface inventory |
| Reg-watch state | Reg watchers | `data/reg-watch-state.json`, `screen-delta-state.json` | Change detection |

## 2. Quality dimensions & targets
| Dimension | Target | How assured |
|---|---|---|
| **Accuracy** | Names/scores match the authoritative source | Canonical naming aligned to `COUNTRIES`; jurisdiction file synced to `fatf-state.json`; human verifies findings against primary sources |
| **Completeness** | All required lists present each run; required KYC fields surfaced | Per-list presence check; CDD-gap flags treat "missing" as a finding, never satisfied |
| **Timeliness / freshness** | Lists current; FATF state refreshed each plenary | Daily cadence; freshness-check; FATF Watchdog (Feb/Jun/Oct); `last_reviewed`/`updated` stamps |
| **Consistency** | Naming matches across files so lookups land | Single canonical naming; `jurisdiction-risk.json` keys normalise to customer country/nationality fields |
| **Validity** | Inputs are well-formed | AI asset register schema-checked; transaction feed shape validated (`txn_monitor.load_transactions`) |
| **Provenance / lineage** | Every change traceable | `RISK_DATA_VERSION`; git history; `data/*-state.json` fingerprints |
| **Integrity (no fabrication)** | No invented data | Deterministic reports; LLM grounded-only; empty feed ⇒ no synthetic data |

## 3. Controls in place
- **Fingerprinting:** watcher inputs fingerprinted; markup-only churn ignored; fetch errors
  recorded but never counted as changes (no false alerts).
- **Degrade-loudly:** a missing/shrunk source raises a degrade flag and feeds the QA gate;
  supplementary sources never flip a core result.
- **Coverage-drift monitor:** ≥20% core-list drop → alarm (`monitoring.py`; risk **R-09**).
- **Safety bounds:** the FATF parser refuses implausible lists (`assertPlausible`) rather than
  persist garbage.
- **Schema checks:** AI asset register validated; transaction rows filtered to well-formed objects.

## 4. Periodic checks
| Check | Cadence | Owner |
|---|---|---|
| List freshness & presence | Every run / daily | System (freshness-check) |
| FATF state vs official statement | Each plenary (Feb/Jun/Oct) | MLRO (watchdog assists) |
| `jurisdiction-risk.json` synced to `fatf-state.json` | Each plenary | Compliance Engineering |
| Customer-record completeness (CDD gaps) | Per assessment | MLRO/analyst |
| Reference-data version & lineage review | Annually + on change | Compliance Engineering |

## 5. Issue handling
Data-quality defects are logged via [`stakeholder-feedback.md`](stakeholder-feedback.md) /
GitHub issues and remediated through [`corrective-actions.md`](corrective-actions.md). A defect
that could cause a missed screening is treated as an incident
([`../governance/ai-incident-runbook.md`](../governance/ai-incident-runbook.md)).
