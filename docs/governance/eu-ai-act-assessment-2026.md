# EU AI Act — Applicability & Classification Assessment (2026)

**Owner:** MLRO · Compliance Engineering. **Cadence:** annual + on any model
change, new AI use case, or EU market exposure. **Related:**
[`ai-frameworks-crosswalk-2026.md`](ai-frameworks-crosswalk-2026.md) (orientation
table this assessment deepens) ·
[`../aims/ai-system-inventory.md`](../aims/ai-system-inventory.md) ·
[`ai-asset-register.md`](ai-asset-register.md) ·
[`ai-incident-runbook.md`](ai-incident-runbook.md).

## 1. Why this assessment, and territorial scope

Regulation (EU) 2024/1689 binds providers **placing AI systems on the EU market**
and providers/deployers **whose system's output is used in the EU** (Art. 2).
Hawkeye Sterling LLC operates in the **UAE** for UAE AML/CFT obligations; the system is
not marketed in the EU and its outputs (risk assessments, screening dispositions,
advisor answers) are used by UAE-based staff for UAE regulatory filings.

**Conclusion — territorial:** the EU AI Act does **not currently bind** this
system. It is assessed here **voluntarily** as a best-practice benchmark (the same
stance as [`ai-frameworks-crosswalk-2026.md`](ai-frameworks-crosswalk-2026.md):
binding obligations remain UAE FDL 10/2025, PDPL, and FATF standards) — and so
that the day EU exposure appears (an EU counterparty consuming reports, an EU
establishment), the classification work is already done. §7 lists the triggers
that would flip this conclusion.

## 2. Role analysis (who would be what)

| Actor | AI Act role | Basis |
|---|---|---|
| **Anthropic** | Provider of the **general-purpose AI model** (Chapter V) behind the Advisor | The GPAI obligations (model documentation, copyright policy, systemic-risk duties) sit with Anthropic, relied on via the vendor terms tracked in [`../aims/third-party-register.md`](../aims/third-party-register.md) |
| **Hawkeye Sterling LLC** | **Provider** of the Advisor *system* (it develops the system around the API and puts it into service under its own name, Art. 3(3)) and **deployer** of it (own-use) | Both roles' duties assessed below |
| **Hawkeye Sterling staff** | Users subject to the deployer's oversight and literacy duties | [`../aims/competency-records.md`](../aims/competency-records.md) |

The deterministic risk engine (`app.js` scoring) and the screening engine's
rule-based matching are **not AI systems** under Art. 3(1) — fully deterministic,
no inference from data beyond fixed rules. The AI-system boundary covers the
Advisor (LLM Q&A) and the LLM-gated classification paths in `ai.py` (off by
default pending the Anthropic DPA — `LLM_TRIAGE=0`).

*Digital Omnibus note (2026):* the European AI Office's new **exclusive
competence** covers AI systems built on a GPAI model **by the same provider**.
This architecture is the opposite case — Anthropic provides the model, Hawkeye
Sterling builds the system — so member-state supervision would apply if the Act
ever bound (§1).

## 3. Classification

### 3.1 Prohibited practices (Art. 5) — none present
Swept item-by-item: no subliminal/manipulative techniques, no exploitation of
vulnerabilities, no social scoring, no predictive policing of natural persons, no
untargeted facial scraping, no emotion recognition in workplace/education, no
biometric categorisation, no real-time remote biometric ID — and, per the ninth
practice added by the 2026 Digital Omnibus amendment, no generation or
manipulation of non-consensual intimate imagery or CSAM (the system is text-only
decision support and generates no imagery at all). Entity-level AML risk
assessment matches none of the Art. 5 categories, original or amended.

### 3.2 High-risk (Art. 6 / Annex III) — not high-risk
The closest Annex III categories, checked honestly rather than waved away:

| Annex III category | Applies? | Why not |
|---|---|---|
| 5(b) creditworthiness / credit score of **natural persons** | No | The system scores **entities'** ML/TF risk for the firm's own CDD duty — it is not used to evaluate any natural person's creditworthiness or access to credit |
| 6 law enforcement | No | The firm is a private reporting entity performing statutory CDD, not a law-enforcement authority; outputs feed goAML filings, they do not execute enforcement |
| 8 administration of justice / democratic processes | No | No judicial or electoral function |

A future integration that scored **individuals** for service eligibility would
re-open this analysis (§7).

### 3.3 Transparency-risk (Art. 50) — applies, and is implemented
The Advisor is a system "intended to interact directly with natural persons":
users must be informed they are interacting with AI. **Already enforced in CI**:
the browser smoke in `.github/workflows/ci.yml` asserts the advisor page renders
the disclosure *"You are interacting with an AI system"*, and answers carry `[AI]`
labelling + citations (see the crosswalk's transparency row). A regression that
removed the notice fails the build.

*Digital Omnibus note (2026):* the Art. 50(2) machine-readable-marking obligation
is postponed to 2 December 2026 (legacy systems). Position here: outputs are
internal, human-reviewed decision support labelled `[AI]` — the operative and
CI-asserted control is the Art. 50(1)-style disclosure; machine-readable marking
of content published to third parties does not arise for this use.

## 4. Obligations snapshot (voluntary conformity state)

| Would-be obligation | State | Evidence |
|---|---|---|
| Art. 4 AI literacy | **Provisioned — §5** | [`../aims/competency-records.md`](../aims/competency-records.md) training record |
| Art. 50 transparency | ✅ implemented, CI-asserted | `ci.yml` advisor smoke assertion |
| Human oversight (Art. 14-style) | ✅ human-in-the-loop on every AI surface | Layer 5 of [`agentic-ai-governance-6layers-2026.md`](agentic-ai-governance-6layers-2026.md); completion gate in `index.html` |
| Logging / record-keeping (Art. 12-style) | ✅ | Hash-chained audit log; retention snapshots (`scripts/retain-state.mjs`) |
| Data governance (Art. 10-style) | ✅ | [`dpia-2026.md`](dpia-2026.md); [`data-retention.md`](data-retention.md); [`../aims/data-quality-plan.md`](../aims/data-quality-plan.md) |
| Accuracy/robustness monitoring (Art. 15-style) | ✅ | [`../aims/runtime-monitoring.md`](../aims/runtime-monitoring.md); weekly advisor eval |
| Serious-incident reporting (Art. 73-equivalent) | **Defined — §6** | [`ai-incident-runbook.md`](ai-incident-runbook.md) + §6 timelines |

## 5. AI literacy provision (Art. 4)

Art. 4 (in force 2 Feb 2025) originally required providers and deployers to
*ensure a sufficient level* of AI literacy in staff operating AI systems; the
2026 Digital Omnibus softens this to *supporting the development* of staff AI
literacy. **The firm deliberately keeps the stricter original standard** —
recorded training with annual refresh, below — a control is never weakened
because the legal floor moved down. It applies to **every** risk tier, so it is
adopted here even while the Act itself does not bind. The firm's literacy
baseline, per role:

| Role | Literacy content (minimum) | Refreshed |
|---|---|---|
| All users of AI output | The four AI-awareness essentials in [`competency-records.md`](../aims/competency-records.md) (decision-support only; degraded ≠ cleared; verify evidence, not labels; no tipping-off) **plus**: what an LLM is and is not (probabilistic text, can be confidently wrong), why citations must be opened, and the system's known failure modes (hallucination, prompt injection — with the incident runbook's triggers) | Annually |
| MLRO / reviewer | Above + reading the bias-review and advisor-eval outputs; when to suspend an AI surface ([`ai-incident-runbook.md`](ai-incident-runbook.md)) | Annually |
| System maintainer | Above + the model card ([`../models/advisor-llm.md`](../models/advisor-llm.md)), guardrail architecture (`brain-soul.js`), and eval/red-team suites (`test/advisor-assurance.test.js`, `test/redteam_injection.py`) | On change |

Delivery is recorded in the training table of
[`competency-records.md`](../aims/competency-records.md) (10-year retention); the
annual [internal audit](../aims/internal-audit.md) §4 checks the records exist
and are current.

## 6. Serious-incident handling (Art. 73-equivalent, adopted internally)

Art. 73 would require providers of high-risk systems to report serious incidents
within strict clocks (15 days; 2 days for widespread infringement /
death-or-serious-harm cases; 10 days for death). This system is not high-risk and
not EU-bound, so no Art. 73 duty exists — but the **discipline is adopted** on top
of [`ai-incident-runbook.md`](ai-incident-runbook.md):

| Event class | Internal clock | Route |
|---|---|---|
| AI output contributed to a breach of a legal duty (missed sanction hit, tipping-off, wrongful filing) | Assess ≤ 48 h; escalate to MLRO immediately | Runbook response steps → CAPA ([`../aims/corrective-actions.md`](../aims/corrective-actions.md)) → regulator notification **per UAE law** (goAML/EOCN obligations; PDPL breach duties to the UAE Data Office where personal data is affected) |
| Serious malfunction without legal breach (guardrail bypass, systematic hallucination, drift alarm) | Triage ≤ 5 business days | Runbook → CAPA; suspend the surface if integrity is in doubt (runbook trigger) |
| Any incident that would be Art.-73-reportable had the Act applied | Record the counterfactual in the incident log | Feeds the annual review of this assessment (§7) |

## 7. Re-assessment triggers

Re-run this assessment (before go-live of the change) when any of these occur:
1. **EU exposure** — an EU establishment, EU customers, or outputs consumed in the
   EU (flips §1; Art. 50 duties become binding immediately, and role duties in §2
   activate).
2. **New AI use case** — especially anything scoring or profiling **natural
   persons** (re-opens Annex III 5(b)). *Omnibus note:* would-be high-risk
   obligations now apply from 2 Dec 2027 (Annex III) / 2 Aug 2028 (Annex I) —
   runway if the classification ever flips, not an exemption.
3. **Model/provider change** for the Advisor (new GPAI provider → §2 table).
4. **Activation of `LLM_TRIAGE`** (the gated `ai.py` path enters the AI-system
   boundary in production).
5. **Act evolution** — amendments, Commission guidance or delegated acts
   materially changing Art. 5, Annex III or Art. 50 scope. Watched via the
   dedicated `eu-ai-act` source in `data/reg-sources.json` (added 2026-07-28 —
   the Digital Omnibus itself arrived via manual intake, which exposed that no
   EU AI-regulation source was in the watch list; closed).

## 8. Assessment log

| Date | Assessor | Trigger | Outcome | Next review |
|---|---|---|---|---|
| 2026-07-07 | Compliance Engineering (maintainer), for MLRO ratification | Initial dedicated assessment (deepens the crosswalk row) | Not territorially bound; Art. 50 implemented; Art. 4 literacy provisioned; Art. 73-equivalent clocks adopted | 2027-07 or on any §7 trigger |
| 2026-07-28 | Compliance Engineering (maintainer), for MLRO ratification | §7.5 fired — Digital Omnibus AI amendments adopted (EP 16 Jun · Council 29 Jun · signed 8 Jul 2026; pending OJ publication) | Conclusions unchanged (not bound; not high-risk; Art. 50 disclosure implemented). §§2, 3.1, 3.3, 5, 7 updated; Art. 4 kept at the stricter original standard; `eu-ai-act` watch source added. Sensitive-data-for-bias extension noted — no special-category processing in the bias evals, no impact | 2027-07 or on any §7 trigger |
