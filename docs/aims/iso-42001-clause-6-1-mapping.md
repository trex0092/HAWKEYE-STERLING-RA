# ISO/IEC 42001 Clause 6.1 — Mapping Index

**Which artefact answers which clause, and which control treats which risk.**

**Owner:** MLRO · Compliance Engineering
**Review:** annually, and whenever a risk, an Annex A control status or an
impact artefact changes.
**Enforcement:** [`test/clause-mapping.test.mjs`](../../test/clause-mapping.test.mjs) (CI, every pull request)

Clause 6.1 has three sub-clauses that this estate satisfied in substance and had
never separated on paper: **`6.1.2` and `6.1.4` appeared nowhere in `docs/`
before 2026-07-29.** That mattered for one specific reason — 6.1.2 and 6.1.4 ask
different questions about the same failures, and an assessment answering one is
routinely offered as though it answered both.

---

## 1. The three sub-clauses and the artefact that answers each

| Clause | The question it asks | Subject of the harm | Canonical artefact |
|---|---|---|---|
| **6.1.2** AI risk assessment | What could go wrong, how likely, how bad, what is left after controls? | **The organisation** — licence, regulatory exposure, reputation, cost | [AI Risk Register](ai-risk-register.md) (R-01…R-20) |
| **6.1.3** AI risk treatment | Which Annex A controls apply, which do not, and why? | The control set | [Statement of Applicability](statement-of-applicability.md) · [ISO 42001 SoA 2026](../governance/iso-42001-soa-2026.md) |
| **6.1.4** AI system impact assessment | What are the consequences **for individuals and for groups of individuals**, including unfair or discriminatory outcomes? | **People** — customers, UBOs, staff, the public | [Stakeholder Impact Assessment](../governance/stakeholder-impact-assessment-2026.md) (canonical) · [AI Impact Assessment](ai-impact-assessment.md) (system view) |

### Why 6.1.2 cannot stand in for 6.1.4

They share failure modes and almost nothing else. Take the two most common
screening errors:

| | 6.1.2 — risk to the firm | 6.1.4 — impact on the person |
|---|---|---|
| **False negative** (R-03) | Severe. A missed designation is a regulatory breach and a licence risk | Slight. The screened person is not harmed by not being flagged |
| **False positive** (R-04) | Minor. Analyst time, some friction | **Severe.** De-risking, refused service, a record they cannot see or contest |

The two readings point in **opposite directions**, so a control set tuned only on
the 6.1.2 column would be tuned the wrong way for the people it acts on. This is
the whole reason the standard separates them, and the reason a thorough risk
register is not evidence of a 6.1.4 assessment.

### The fourth artefact

[`dpia-2026.md`](../governance/dpia-2026.md) is the **PDPL/GDPR** data-protection
impact assessment. It is not an ISO 42001 artefact; it answers a data-protection
question (is the processing lawful, minimised, safeguarded?) that overlaps 6.1.4
without covering it — a lawful, minimised process can still produce
discriminatory outcomes.

---

## 2. Risk → Annex A control (6.1.2 → 6.1.3)

Before this table, **no register row cited an Annex A control and neither SoA
cited a risk ID**, so "which control treats R-13?" had no answer anywhere in the
estate. Both directions are now recorded, and CI fails if a risk in the register
is missing from this table or if the table cites a risk that no longer exists.

| Risk | What it is | Annex A controls that treat it | Also 6.1.4? |
|---|---|---|---|
| R-01 | Hallucination | A.6.2.2 (system requirements) · A.6.2.4 (verification & validation) · A.9.2 (responsible use) | Yes — a fabricated fact in a report harms the subject of the report |
| R-02 | Prompt injection | A.6.2.4 · A.6.2.8 (operation & monitoring) | Indirect |
| R-03 | False negative | A.6.2.4 · A.6.2.8 · A.7.2–A.7.6 (data for AI systems) | Minimal — see §1 |
| R-04 | False positive | A.5.4 (impacts on individuals) · A.6.2.4 · A.9.2 | **Yes — primary.** The most damaging thing the system can do to a person |
| R-05 | Bias / under-matching non-Latin names | **A.5.4** · A.7.2–A.7.6 | **Yes — primary.** The discriminatory-outcome case |
| R-06 | Data egress / privacy | A.7.2–A.7.6 · A.10.2–A.10.4 (third parties) | Yes |
| R-07 | Secret leakage | A.4.4 (tooling resources) · A.10.2–A.10.4 | Yes — exposure of screening data affects the people in it |
| R-08 | Silent control failure | A.6.2.8 · A.8.3 (reporting of concerns) | Indirect |
| R-09 | Source unavailability / silent shrink | A.4.3 (data resources) · A.6.2.8 | Indirect |
| R-10 | Over-reliance / automation bias | **A.9.2** · A.9.3 (objectives for responsible use) | **Yes.** Human oversight is what stands between an AI signal and a person |
| R-11 | Model / provider drift | A.4.2 (resource documentation) · A.6.2.6 (deployment) · A.10.2–A.10.4 | Indirect |
| R-12 | Job timeout / capacity | A.4.4 · A.6.2.8 | Indirect |
| R-13 | Transaction-layer blind spot | A.6.2.2 · A.9.4 (intended use documented) | Indirect |
| R-14 | Silent degradation unactioned | A.6.2.8 · A.8.3 | Indirect |
| R-15 | Vendor / dependency failure | **A.10.2–A.10.4** · A.4.4 | Indirect |
| R-16 | Regulatory non-compliance | A.2.3 (alignment with org policies) · A.9.3 | Yes — a drifted methodology treats people by an unapproved rule |
| R-17 | Key-person dependency | A.3.2 (roles & responsibilities) · A.4.4 | Indirect |
| R-18 | Lack of explainability | **A.8.2 (information to interested parties)** · A.9.4 | **Yes — primary.** An unexplainable adverse outcome is one that cannot be contested |
| R-19 | Unauthorized AI access | A.4.4 · A.10.2–A.10.4 | Yes — unauthorised access to screening data is a harm to its subjects |
| R-20 | AI incident response gap | **A.8.3** · A.6.2.8 | Yes — a slow response extends whatever harm is underway |

**Reading the last column.** *Primary* means the risk's dominant consequence is
to a person rather than to the firm, so its treatment must be judged against the
[Stakeholder Impact Assessment](../governance/stakeholder-impact-assessment-2026.md)
and not only against the register's residual score. Four risks are primary:
**R-04, R-05, R-10, R-18**.

## 3. Annex A control → risks it treats (6.1.3 → 6.1.2)

The same relation read the other way, which is the direction an auditor works
in: *"you say A.5.4 is applicable — what does it treat, and where is the
evidence?"*

| Annex A control | Treats | Status |
|---|---|---|
| A.2.2 AI policy | (framework-level) | ✅ [`ai-policy.md`](../governance/ai-policy.md) ratified 2026-07-02 |
| A.2.3 Alignment with org policies | R-16 | ✅ |
| A.3.2 AI roles & responsibilities | R-17 | ✅ |
| A.4.2 Resource documentation | R-11 | ✅ |
| A.4.3 Data resources | R-09 | ✅ |
| A.4.4 Tooling resources | R-07, R-12, R-15, R-17, R-19 | ✅ |
| A.5.2 AI system impact assessment | (process-level) | ✅ [`ai-impact-assessment.md`](ai-impact-assessment.md) · [`dpia-2026.md`](../governance/dpia-2026.md) |
| A.5.4 Assessing impacts on individuals | R-04, R-05 | 🟡 SIA ratified 2026-07-02 and cross-script parity is a hard CI gate; the **bias-review cycle** is what remains |
| A.6.2.2 AI system requirements | R-01, R-13 | ✅ |
| A.6.2.4 Verification & validation | R-01, R-02, R-03, R-04 | ✅ |
| A.6.2.6 AI system deployment | R-11 | ✅ |
| A.6.2.8 Operation & monitoring | R-02, R-03, R-08, R-09, R-12, R-14, R-20 | ✅ |
| A.7.2–A.7.6 Data for AI systems | R-03, R-05, R-06 | ✅ |
| A.8.2 Information to interested parties | R-18 | ✅ |
| A.8.3 Reporting of concerns | R-08, R-14, R-20 | ✅ |
| A.9.2 Responsible use of AI systems | R-01, R-04, R-10 | 🟡 AUP in force; acknowledgement records are open-actions item 7 |
| A.9.3 Objectives for responsible use | R-10, R-16 | ✅ |
| A.9.4 Intended use documented | R-13, R-18 | ✅ |
| A.10.2–A.10.4 Third parties & customers | R-06, R-07, R-11, R-15, R-19 | ✅ |

**Excluded as not applicable:** controls that assume model *training or
fine-tuning* by this firm. An external model is consumed read-only; there is no
training data, no model-development lifecycle and no vector store on this side.
Recorded identically in both statements of applicability.

## 4. The two statements of applicability

There are two, at different scopes, and until 2026-07-29 they contradicted each
other on the same subject:

| | [`statement-of-applicability.md`](statement-of-applicability.md) | [`iso-42001-soa-2026.md`](../governance/iso-42001-soa-2026.md) |
|---|---|---|
| Scope | The **whole AIMS** — screening engine, app, agents and Advisor | **The LLM Advisor only** (Layer 6) |
| Granularity | Annex A *areas* plus this estate's own security/monitoring/AML control families | Individual Annex A *controls* |
| Vocabulary | Implemented / Partial / Planned / N/A | ✅ implemented · 🟡 partial · 🔴 open · N-A |

**What was reconciled.** The AIMS statement carried one row, *"AI impact
assessment (individuals/society) — Implemented"*, covering what the 2026
statement splits into **A.5.2** (the assessment exists — ✅) and **A.5.4**
(impacts on individuals assessed and the bias cycle run — 🟡). One row asserting
`Implemented` across both read as a claim the other statement contradicted. The
AIMS statement now carries the two rows separately at the two statuses, and both
cite the ratified Stakeholder Impact Assessment, which **neither had cited at
all** despite it being the strongest evidence either could offer.

Three further defects, all in `iso-42001-soa-2026.md`: A.2.2 used a 🟢 outside
its own four-value legend; its open-items paragraph said the AI policy's
ratification was *pending* while its own A.2.2 row recorded it as ratified
2026-07-02 — a file contradicting itself within twenty-five lines; and the AIMS
statement used `Implemented (inactive)` for FATF R.16, a fifth status outside
its declared vocabulary. All three are corrected.

---

**Related:** [`ai-risk-register.md`](ai-risk-register.md) ·
[`statement-of-applicability.md`](statement-of-applicability.md) ·
[`ai-impact-assessment.md`](ai-impact-assessment.md) ·
[`../governance/stakeholder-impact-assessment-2026.md`](../governance/stakeholder-impact-assessment-2026.md) ·
[`iso42001-mandatory-documents-index.md`](iso42001-mandatory-documents-index.md)
