# Competency & Awareness (AIMS 7.2)

Competencies required to operate and oversee the AI system, and how awareness is
maintained. Owner: MLRO. Review: annually.

## Required competencies
| Role | Competency required |
|---|---|
| MLRO / reviewer | AML/CFT law (UAE FDL 26/2021, Cabinet 74/2020); FATF R.6/10/12; reading screening alerts; STR/goAML filing; TFS name-match handling — freeze without delay, PNMR/CNMR/FFR filing ([procedure](tfs-name-match-procedure.md)); sanctions-evasion typologies; four-eyes |
| Compliance analyst | Customer onboarding; UBO identification; adverse-media/PEP interpretation; disposition of alerts |
| System maintainer | The engine's design; how to read the audit trail / QA gate; how the LLM is gated; how to tune thresholds / concurrency |

## AI-awareness essentials (everyone using the output)
- Outputs are **decision-support only** — the human decides and files.
- A "no match" is **not** a clearance when a module is degraded.
- The LLM is used only for **grounded classification**; reports carry the raw
  evidence — verify the source, don't trust the label.
- Do **not** tip off the customer; on any list hit follow the
  [TFS name-match procedure](tfs-name-match-procedure.md).

## Training record (to maintain)
| Date | Person | Topic | Evidence |
|---|---|---|---|
| | | AI-awareness + alert disposition | |
| | | goAML STR filing | |
| | | TFS name-match: freeze without delay; PNMR/CNMR/FFR + sanctions-evasion typologies | |

> Populate this table as training is delivered; retain evidence 10 years.
