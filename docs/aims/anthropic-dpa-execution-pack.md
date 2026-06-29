# Anthropic DPA — Execution Pack (UAE PDPL)

> **Status: DRAFT — prepared for the firm's legal/compliance function to review,
> complete and execute.** This pack does **not** itself constitute an executed
> agreement and is **not legal advice**. The operative legal instrument is
> **Anthropic's own Data Processing Addendum (DPA)**; this document supplies the
> firm-specific processing schedule, the UAE PDPL cross-border transfer-basis
> assessment, and a signature page to record execution. Empty signature/reference
> fields are **not** satisfied until completed by an authorised signatory.
>
> Owner: MLRO / DPO · Prepared 2026-06-29 · Related: `third-party-register.md`,
> `ai-impact-assessment.md` (DPIA), `pdpl-data-processing-assessment.md`.

## 0. How to execute (checklist)
1. Obtain **Anthropic's current DPA** (Anthropic Commercial Terms / Data Processing
   Addendum) for the firm's API plan.
2. Have counsel review it together with **Schedule A** (processing particulars) and
   **Schedule B** (PDPL transfer basis) below; adjust any field that does not match
   the contracted plan.
3. Confirm with Anthropic: **processing region**, **zero-retention / no-training on
   submitted data**, and the **sub-processor list**.
4. An **authorised signatory** of Hawkeye Sterling LLC signs **Schedule C**, and
   Anthropic counter-executes its DPA.
5. Record the **reference number and execution date** in Schedule C **and** in the
   "Anthropic DPA & cross-border transfer record" block of `third-party-register.md`.
6. Only then set the GitHub repo variable **`LLM_TRIAGE=1`** to re-enable grounded
   triage. Leave `REPORT_ALLOW_LLM` unset (generative report prose stays off).

---

## Schedule A — Particulars of processing (Annex)

| Item | Detail |
|---|---|
| **Controller** | Hawkeye Sterling LLC — Dealer in Precious Metals & Stones (DPMS), United Arab Emirates |
| **Processor** | Anthropic, PBC (United States) |
| **Subject matter** | Grounded relevance/severity classification of pre-existing public adverse-media headlines, to support the firm's AML/CFT screening (decision-support only) |
| **Duration** | Term of the firm's commercial agreement with Anthropic; processing ceases on termination or on disabling the API key |
| **Nature of processing** | Transient API inference: the Processor classifies provided text and returns a label. No storage of a customer record by the Processor; no model training on submitted data (to be confirmed at signing) |
| **Purpose** | Triage of real adverse-media hits (relevance + severity) during sanctions/adverse-media/PEP screening. The model classifies; it never decides — every output is labelled and human-reviewed by the MLRO |
| **Categories of data subjects** | Natural persons connected to screened customers: beneficial owners, directors, and other principals whose names are screened. (Customer legal entities are not personal data.) |
| **Categories of personal data** | **Minimised:** a subject's **name** + **one public adverse-media headline**. **No full customer record, no ID numbers, no DOB, no contact data, no financial data** are sent |
| **Special categories** | None intentionally collected. Adverse-media headline text may *incidentally* reference allegations (e.g. criminal accusation). No deliberate special-category processing |
| **Frequency** | Per screening run (scheduled daily + on onboarding), only for headlines that surface during a run |
| **Data minimisation control** | Enforced in code: the payload is constructed as name + single headline only (`ai.py`); the full record never leaves the runner |
| **Sub-processors** | Anthropic's infrastructure sub-processors per Anthropic's published list — **obtain and attach** |
| **Processing location** | United States (Anthropic API) — **confirm contracted region at signing** |
| **Retention at Processor** | Per Anthropic terms; firm retains no LLM content; **confirm zero-retention / no-training** |
| **Security (firm side)** | API key held as an encrypted GitHub Actions secret (never in the browser); least-privilege; egress-audited runners (`harden-runner`); the triage egress is gated by `LLM_TRIAGE` and is **OFF until this DPA is executed** |
| **Controller instructions** | The Processor processes only on the Controller's documented instructions as set out in this Schedule; no generative prose is admitted into filed reports (`REPORT_ALLOW_LLM=0`) |

---

## Schedule B — UAE PDPL cross-border transfer-basis assessment

> **For confirmation by counsel.** Federal Decree-Law No. 45 of 2021 (PDPL) and its
> Executive Regulations govern transfers of personal data outside the UAE.

| Item | Position |
|---|---|
| **Transfer** | Personal data (name + headline) transferred from the UAE to the Processor in the United States |
| **Primary basis relied on** | Transfer to a recipient bound by **appropriate contractual safeguards** — i.e. the executed Anthropic DPA incorporating standard data-protection commitments (security, confidentiality, sub-processor control, assistance, deletion) — combined with **data minimisation** (name + one headline only) and the DPIA on file |
| **Alternative / fallback bases to weigh with counsel** | (a) an applicable **adequacy** determination for the destination, if available; (b) the data subject's **explicit consent** to the specific transfer; (c) transfer **necessary for a legal obligation** (AML/CFT screening) — counsel to confirm which PDPL gateway is the firm's primary reliance and document it here |
| **Proportionality** | The transfer is limited to what is necessary for the screening purpose; no full record, no special-category data deliberately; human review remains mandatory before any action |
| **Risk to data subjects** | Low residual: minimal payload, transient processing, no automated decision; assessed in the DPIA (`ai-impact-assessment.md`) |
| **Recorded basis (to complete)** | _☐ State the confirmed PDPL transfer gateway and any conditions, signed off by counsel_ |

---

## Schedule C — Execution record

> Complete on signature. Until every field is completed by an authorised person,
> this agreement is **not executed** and `LLM_TRIAGE` must remain `0`.

| Field | Value |
|---|---|
| Operative agreement | Anthropic Data Processing Addendum (version: _☐_) |
| DPA reference no. | _☐_ |
| Anthropic contracting entity | Anthropic, PBC |
| **Controller signatory (Hawkeye Sterling LLC)** | Name: _☐_  ·  Title: _☐_ |
| Controller signature / date | _☐_ |
| **Processor execution (Anthropic)** | Counter-executed: _☐ (ref/date)_ |
| Confirmed processing region | _☐_ |
| Zero-retention / no-training confirmed | _☐ Y/N_ |
| Sub-processor list attached | _☐ Y/N_ |
| PDPL transfer basis (Schedule B) confirmed by counsel | _☐ Y/N_ |
| Date `LLM_TRIAGE` set to `1` (go-live) | _☐_ |

---

*Prepared by Compliance Engineering for legal/compliance review. Not legal advice;
confirm all open (☐) items with counsel and Anthropic before reliance and before
re-enabling LLM egress.*
