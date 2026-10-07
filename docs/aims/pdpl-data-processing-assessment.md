# PDPL Data-Processing Assessment & ROPA (AIMS A.7 / risk R-06)

Formal data-processing assessment for the screening system under the **UAE Personal
Data Protection Law** (Federal Decree-Law No. 45 of 2021, "PDPL") and its
Executive Regulations. This is the Article-level assessment that risk **R-06**
("data egress / privacy") points to. Owner: MLRO acting as data-protection focal
point. Review: annually + on any change to data flows or to LLM provisioning.

> Scope note: AML/CFT screening is itself a legal obligation, so most processing
> rests on **legal-obligation / public-interest** bases, not consent. Tipping-off
> rules mean some data-subject rights (e.g. erasure, certain access) are lawfully
> restricted where they would prejudice an investigation.

## 1. Roles
- **Controller:** Hawkeye Sterling LLC (determines purpose & means of screening).
- **Processors:**
  - Asana (system of record for customer/KYC data and reports);
  - Anthropic (LLM provider) — **only if** an API key is provisioned (opt-in);
  - GitHub (code, run logs, delta/coverage/metrics state).
- **Data subjects:** customers' owners / directors / UBOs / arrangement parties
  (natural persons), and individuals named in adverse-media results.

## 2. Record of Processing Activities (ROPA)
| Processing | Personal data | Purpose | Lawful basis (PDPL) | Recipients | Retention |
|---|---|---|---|---|---|
| Sanctions/PEP name screening | Name, role, share %, nationality, DOB, ID number | Meet AML/CFT TFS obligations | Art. 4 — legal obligation / public interest | On-runner only (lists are public) | 10 years (AML law) |
| Identity corroboration (R.10) | DOB, nationality, ID (masked in output), CDD-document status | Verify identity; disposition of alerts | Art. 4 — legal obligation | On-runner; MLRO via Asana | 10 years |
| Adverse-media triage | Subject **name + headline only** (no full KYC record) | Risk-relevance classification | Art. 4 — legitimate purpose | Anthropic **only if key set**; else on-runner | Findings 10 years; no content retained by monitor |
| Report delivery & cases | Findings + identity dossier | MLRO review / STR decision | Art. 4 — legal obligation | Asana | 10 years |
| Operational metrics | **No PII** — counts, timings, LLM call counts | Observability / drift detection | Art. 4 — legitimate interest | GitHub (git) | Rolling 30 runs |

## 3. Data-egress assessment (the core privacy control)
- **Default = no egress.** With no LLM key, *all* processing runs on the GitHub
  runner against public lists/feeds; no personal data leaves to a third-party model.
- **Opt-in egress.** Provisioning `ANTHROPIC_API_KEY` is the controller's explicit
  authorisation to send **name + headline only** (never the full KYC record, never
  ID numbers, DOB, or documents) to Anthropic for grounded classification.
- **Minimisation in transit.** The triage prompt sends the minimum needed to judge
  relevance; ID numbers are masked (last-3 only) anywhere they are rendered.
- **No content retention by the monitor.** Usage telemetry counts calls; it never
  stores prompts or responses.

## 4. PDPL principles → controls
| PDPL principle | Control |
|---|---|
| Lawfulness, fairness, transparency | Legal-obligation basis; AI-use disclosed in the report governance footer & model card |
| Purpose limitation | Data used only for AML/CFT screening |
| Data minimisation | Adverse-media call sends name+headline only; ID masked; metrics carry no PII |
| Accuracy | Findings carry raw evidence + source links; human verifies; CDD-gap flags surface stale/missing data |
| Storage limitation | 10-year AML retention; metrics rolling window |
| Integrity & confidentiality | Least-privilege agents; credential broker; secrets never logged; gitleaks; TLS |
| Cross-border transfer (Art. 22–23) | Egress only on opt-in; **DPA with Anthropic required before enabling**; adequacy/appropriate-safeguards check recorded in the third-party register |
| Data-subject rights | Honoured subject to AML/tipping-off restrictions; routed via MLRO |

## 5. Cross-border transfer (when the LLM is enabled)
Enabling the key triggers an international transfer of limited personal data. Before
enabling, the controller must: (a) execute a **Data Processing Agreement** with the
provider; (b) record the transfer basis (adequacy or appropriate safeguards) under
PDPL Art. 22–23; (c) log it in `third-party-register.md`. Until then the system runs
no-egress by design.

## 6. Residual risk & actions
- **Unresolved legal/runtime record, updated 2026-10-07:** the third-party register
  preserves a 2026-07-16 owner attestation that the Anthropic DPA was executed and
  `LLM_TRIAGE=1` was enabled. The formal DPA execution block, however, remains
  explicitly DRAFT with the reference, signatory, execution date and processing
  region blank, and the AI impact-assessment go-live checklist is not signed.
  Repository code proves only that triage defaults to `0` and requires explicit
  `LLM_TRIAGE=1`; it does not prove the live repo-variable value. Open actions 36
  and 42 require a verified legal position and verified production configuration.
- Counsel's written PDPL transfer-basis confirmation also remains open under items
  5 and 11.
- `REPORT_ALLOW_LLM` remains `0`: generative report prose is not authorised by
  this assessment.
- Residual risk is **not re-accepted by this documentation edit**. The prior Low
  residual conclusion depends on the go-live safeguards being satisfied and must
  be reconsidered when item 42 is closed.

## Evidence
- Controls in code: `ai._llm_in_reports`, `ai._wrap_untrusted`, `kyc.mask_id`,
  `agents.CredentialBroker`, `monitoring` (no-PII metrics).
- Related: `ai-impact-assessment.md` (DPIA), `third-party-register.md`,
  `ai-risk-register.md` R-06.
