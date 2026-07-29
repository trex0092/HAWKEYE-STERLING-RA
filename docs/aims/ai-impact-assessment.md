# AI Impact Assessment (AIMS A.5.2 · ISO/IEC 42001 6.1.4)

Assessment of the impact of the AI **system** on individuals, rights and society,
including data protection (UAE PDPL).

**Owner:** MLRO / DPO
**Approver:** MLRO
**Version:** 1.1 · **Date:** 2026-07-29 (v1.0 undated — see the revision note below)
**Review:** annually and on any change to the AI system, its scope or its data flows.

> **Which impact artefact is which.** Four documents cover impact and they are
> not interchangeable; the division of labour is set out in the
> [clause 6.1 mapping index](iso-42001-clause-6-1-mapping.md).
>
> | Artefact | Asks | Clause |
> |---|---|---|
> | **This document** | What does *the system* do to people, and is that necessary and proportionate? | A.5.2 · 6.1.4 (system view) |
> | [Stakeholder Impact Assessment](../governance/stakeholder-impact-assessment-2026.md) | Who is affected, **including as a group**, and how could an AI error harm them? | **6.1.4 (canonical)** · A.5.4 |
> | [DPIA 2026](../governance/dpia-2026.md) | Is the *personal-data processing* lawful, minimised and safeguarded? | UAE PDPL / GDPR |
> | [AI Risk Register](ai-risk-register.md) | What could go wrong **for the organisation**? | **6.1.2** |
>
> The last row is the separation ISO/IEC 42001 draws and this estate did not:
> **6.1.2 is risk *to the organisation*; 6.1.4 is impact *on people*.** A risk
> assessment that scores reputational and regulatory exposure does not answer
> 6.1.4, however thorough it is, because the subject of the harm is different.

> **Revision note (v1.1, 2026-07-29).** v1.0 carried no date, no version and no
> named approver, which meant nothing recorded when it was written, what had
> changed since, or who stood behind it — an assessment an auditor cannot place
> in time. The assessed content of v1.0 is unchanged; v1.1 adds the header, the
> scope boundary above, and §5a (group-level and discriminatory outcomes, which
> §5 as written did not reach). The §8 sign-off boxes remain **unticked** — they
> gate LLM enablement and are a human act.

## 1. Processing description
The system screens customers and their beneficial owners against sanctions lists,
adverse media, and PEP sources to support AML/CFT obligations. AI is used for:
risk rating (deterministic), adverse-media triage (optionally LLM, grounded), and
draft summaries/STRs (human-reviewed).

## 2. Personal data processed
- **Subjects:** customers (legal entities) and natural-person owners/directors/UBOs.
- **Data:** names, roles, nationality where recorded, and public adverse-media /
  Wikidata references matched to them.
- **Source:** Asana Customer Database (firm-owned). **Special categories:** none
  intentionally; adverse-media text may incidentally reference allegations.

## 3. Necessity & proportionality
Screening is a **legal obligation** (UAE FDL 26/2021; Cabinet 74/2020; FATF R.6/10/12).
Only data necessary for matching is used. The LLM (when enabled) receives **only a
subject name + a single public headline** — never the full customer record.

## 4. Data flows & residency
- Default: **all processing on the GitHub Actions runner; no customer data egress.**
- With `ANTHROPIC_API_KEY`: name+headline sent to Anthropic for classification.
- Public lookups (Google News, Wikidata) receive the subject name only.
- See `third-party-register.md` for processors and safeguards.

## 5. Risks to individuals & mitigations
| Risk to individual | Mitigation |
|---|---|
| Wrongful flag / reputational impact | Human-in-the-loop; decision-support only; raw evidence shown; no automated decision |
| Mis-identification (same-name) | Confidence tiers; relevance triage; MLRO verification before any action |
| Bias against non-Latin names | Transliteration recall; uniform thresholds; fairness review implemented (`bias-fairness-testing.md`; cross-script recall-parity test in CI, R-05) |
| Excessive data exposure | Minimal payload to LLM; no-egress default; masking; 10-yr controlled retention |
| Tipping-off | "Do not tip off" controls; STR drafted for MLRO, never auto-filed |

## 5a. Group-level and discriminatory outcomes

§5 assesses harm **to an individual**, one row per failure mode. ISO/IEC 42001
6.1.4 also requires impacts on **groups of individuals**, and the harm that
matters most there is not any single wrong answer — it is a wrong answer that
lands **unevenly**. A false-positive rate of 4% is a nuisance; a false-positive
rate of 4% that is 1% for one population and 9% for another is discrimination,
and no per-individual row can see it, because every individual row looks
identical either way.

| Group-level outcome | How it would arise here | What detects it | What it feeds |
|---|---|---|---|
| **Differential recall by script** — non-Latin names screened less effectively than Latin ones | Transliteration and normalisation are lossier for Arabic, Turkish, Cyrillic and CJK forms, so a true match is likelier to be missed | Cross-script recall-parity test, CI-enforced: ≥90% recall per group and ≤10% gap between groups (`test/bias_eval.py`; R-05) | Hard CI gate — the build fails, it is not a report someone reads |
| **Differential false-positive burden by name morphology** — common or short names in some populations generating more friction | Fuzzy matching over a short or high-frequency name produces more candidates; the burden falls on whoever holds such a name | Core-token FP suppression; confidence tiers; FP rate monitored per [`bias-fairness-testing.md`](bias-fairness-testing.md) | Quarterly review; a divergence is a CAPA |
| **Differential treatment by nationality or jurisdiction** | Jurisdiction risk is an input to the score by design (FATF R.10), so the line between *risk-based* and *discriminatory* is a governance judgement, not a technical one | Nationality/gender divergence tests; `data/jurisdiction-risk.json` is a maintained, sourced list, not an ad-hoc one | Management review; the list's provenance is auditable |
| **Unscreenable-name exclusion** — a name the engine cannot process being treated as clear | Lost-script or all-short-token names produce no screenable tokens | Routed to **MANUAL REVIEW**, never to a silent clear; pinned by a dedicated test and a cross-engine parity guard | Human review of every such case |
| **Compounding across the group** — an error that is individually minor recurring for the same population every time | A systematic normalisation weakness repeats deterministically; the same person is affected on every screening run | Recall-parity history accrues per cycle; sustained anomalies auto-escalate | Bias-evidence maturity is tracked as a residual risk in the SIA |

**Availability of the assessment to those affected.** A screened customer or UBO
is not a party to this document and will not read it. What is available to them
is the [transparency notice](interested-parties-information.md) and the
[explainability statement](../governance/explainability-statement-2026.md),
which state in plain language that AI assists the assessment, that a human
decides, and that a human review can be requested. This assessment itself is
available on request to a supervisor, an auditor and a data subject exercising
PDPL rights, subject to the tipping-off prohibition (FDL 10/2025, Art. 25) —
**which is a genuine limit on transparency, not an omission**: disclosing that a
person was screened, or the outcome, can itself be an offence. Where the two
duties conflict, the tipping-off prohibition governs and the reason is recorded
here rather than left as silence.

The group-level view is developed per stakeholder in the
[Stakeholder Impact Assessment](../governance/stakeholder-impact-assessment-2026.md),
which is the canonical 6.1.4 artefact.

## 6. Rights
Data-subject rights are handled under the firm's PDPL procedures; AML records are
exempt from certain erasure/access rights where retention is legally mandated
(10-year retention).

## 7. Conclusion
Residual risk **acceptable** with the controls above, provided: (a) the LLM key is
only provisioned alongside a signed DPA + this DPIA, and (b) human review remains
mandatory before any freeze/decline/report. Re-assess on any change to data sent to
third parties.

## 8. Go-live sign-off (LLM enablement)
LLM triage egress is **gated OFF** (`LLM_TRIAGE=0`) until this sign-off is completed.
Complete every ☐ before setting the `LLM_TRIAGE` repo variable to `1`. This is the
condition in §7(a) made operational; it ties the executed DPA to enablement.

| Check | Status |
|---|---|
| Anthropic DPA executed — ref + date | _☐ (record in `anthropic-dpa-execution-pack.md` Schedule C)_ |
| UAE PDPL cross-border transfer basis confirmed by counsel | _☐_ |
| Processing region / zero-retention / no-training confirmed with Anthropic | _☐_ |
| Data minimisation verified (name + one headline only; `REPORT_ALLOW_LLM=0`) | _☐_ |
| DPIA reviewed and residual risk **accepted** | _☐_ |
| **Authorised sign-off** — MLRO / DPO (name · date) | _☐_ |
| `LLM_TRIAGE` set to `1` (go-live date) | _☐_ |

> Reverting: setting `LLM_TRIAGE` back to `0` (or unsetting the key) stops egress
> immediately and returns the engine to the fully deterministic state.
