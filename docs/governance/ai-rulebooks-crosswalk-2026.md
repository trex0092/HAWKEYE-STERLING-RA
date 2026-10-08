# AI Rulebooks, Standards & Security Taxonomies — Applicability Crosswalk (2026)

Extends the existing framework set to the rulebooks that were **not yet
assessed anywhere in this repository**: ISO/IEC 27001, ISO/IEC 23894 / 42005 /
22989, OSFI Guideline E-23, California SB 53, EU AI Act Arts. 68–69, the OWASP
LLM and Agentic Top 10 lists, the EU cyber-resilience acts (NIS2, DORA, CRA),
the non-EU AI laws, and the UNESCO / G7 Hiroshima principles. Each one gets an
**applicability determination first** (does it bind this system, and why), then
a mapping to controls that already exist, then the gaps, stated plainly.

Companion documents (not repeated here):
[`ai-frameworks-crosswalk-2026.md`](ai-frameworks-crosswalk-2026.md) (Turing
FAST/SUM, operational stack) ·
[`nist-ai-rmf-mapping-2026.md`](nist-ai-rmf-mapping-2026.md) ·
[`iso-42001-soa-2026.md`](iso-42001-soa-2026.md) ·
[`eu-ai-act-assessment-2026.md`](eu-ai-act-assessment-2026.md) ·
[`uae-ai-data-laws-2026.md`](uae-ai-data-laws-2026.md).

**Owner:** MLRO · Compliance Engineering · **Prepared:** 2026-10-08 by the
maintainer, for MLRO ratification (no MLRO sign-off is recorded or implied by
this document) · **Cadence:** annual, or when a §1 trigger fires.

> **Scope.** As in the companion crosswalks: the AI surfaces are the LLM Advisor
> (`netlify/functions/brain-soul.js`), the opt-in LLM triage paths in `ai.py`
> (default off, `LLM_TRIAGE=0`), and the MCP server (`mcp_server.py` /
> `mcp_tools.py`) with its bounded coordinator (`agent_orchestrator.py`). The
> deterministic risk and screening engines are governed as AML/CFT controls,
> not as AI systems ([ADR-001](adr-001-deterministic-vs-learned.md)). The binding
> obligations remain UAE FDL 10/2025, Cabinet Resolution 134/2025, the PDPL and
> FATF standards; everything below is assessed **voluntarily** unless §1 says
> otherwise.

## 1. Applicability determinations

| Rulebook | Type | Binds this system? | Basis for the determination | Re-trigger |
|---|---|---|---|---|
| ISO/IEC 27001:2022 | Certifiable ISMS standard | **No** — voluntary; no certification is held or claimed | Not mandated for a UAE DPMS by FDL 10/2025 | A customer, bank or regulator requires ISO 27001 certification |
| ISO/IEC 23894:2023 | AI risk-management guidance | No — guidance | Used with ISO 31000; complements ISO/IEC 42001 | — |
| ISO/IEC 42005:2025 | AI system impact-assessment guidance | No — guidance | Applies to organisations developing, providing or using AI | — |
| ISO/IEC 22989:2022 | AI concepts & terminology | No — vocabulary | Reference vocabulary for the other standards | — |
| OSFI Guideline E-23 (final 11 Sep 2025; effective 1 May 2027) | Canadian prudential model-risk guideline | **No** | Applies to Canadian federally regulated financial institutions; Hawkeye Sterling LLC is a UAE dealer | Any Canadian FRFI relationship that flows E-23 duties down by contract |
| California SB 53 — Transparency in Frontier AI Act (signed 29 Sep 2025; core duties from 1 Jan 2026) | US state statute | **No** | Applies to *frontier developers* that train foundation models above 10²⁶ operations (heaviest duties: >US$500 m revenue). This system trains no model; it consumes a vendor model via API | The firm trains or fine-tunes a foundation model at that compute scale (not foreseeable) |
| EU AI Act Arts. 68–69 (Regulation (EU) 2024/1689) | Union governance provisions | **No** — addressed to the Commission and Member States, not to providers or deployers | Art. 68 sets up the scientific panel; Art. 69 lets Member States call on its experts for enforcement | Covered by the EU AI Act triggers in [`eu-ai-act-assessment-2026.md`](eu-ai-act-assessment-2026.md) §7 |
| OWASP Top 10 for LLM Applications (2025) | Security taxonomy | No — voluntary | Threat checklist for LLM applications | — |
| OWASP Top 10 for Agentic Applications (2026, ASI01–ASI10) | Security taxonomy | No — voluntary | Extends the LLM list to agents and tool use | — |
| NIS2 — Directive (EU) 2022/2555 | EU cybersecurity directive | **No** | Applies to essential/important entities in the EU; no EU establishment | EU establishment or EU-regulated customer flow-down |
| DORA — Regulation (EU) 2022/2554 (applies from 17 Jan 2025) | EU financial-sector ICT resilience | **No** | Applies to EU financial entities and their critical ICT third parties | Same as NIS2 |
| Cyber Resilience Act — Regulation (EU) 2024/2847 (main application 11 Dec 2027) | EU product cybersecurity | **No** | Applies to products with digital elements placed on the EU market; the app is not sold in the EU | Distributing the software as a product in the EU |
| South Korea AI Basic Act (in force 22 Jan 2026) · Japan AI Promotion Act (passed 28 May 2025) · China Interim Measures for Generative AI Services (2023) | National AI laws | **No** | No product, users or market in those jurisdictions | Offering the system to users in those jurisdictions |
| Council of Europe Framework Convention on AI (CETS No. 225; opened for signature 5 Sep 2024) | Treaty binding on states | **No** — binds ratifying states, not this firm directly | The UAE is not a Council of Europe member. *Entry-into-force status was not confirmed from an official source while this document was written; check the CoE Treaty Office before citing it.* | — |
| GDPR · CCPA · Brazil LGPD · India DPDP Act 2023 | Data-protection laws | **No** on current facts | No EU/California/Brazil/India data subjects are processed as a target market; UAE PDPL governs (see [`dpia-2026.md`](dpia-2026.md)) | A customer or UBO who is a data subject protected by one of these laws, which needs a per-case DPO view |
| UNESCO Recommendation on the Ethics of AI (23 Nov 2021) · G7 Hiroshima Process Code of Conduct (30 Oct 2023) | Non-binding principles | No | The Hiroshima Code addresses organisations **developing** advanced AI; this firm is a deployer | — |

**Conclusion.** None of these rulebooks binds the system today. The value is the
benchmark: §§2–7 show which of their expectations the existing controls already
meet, and §8 lists the gaps a reviewer would raise.

## 2. Security and data access — ISO/IEC 27001:2022 (benchmark)

*The question this answers: who can access it?* Mapped by Annex A theme (the
2022 edition groups its controls as organisational, people, physical and
technological).

| Expectation | Existing control (evidence) | Status |
|---|---|---|
| Access control | Opt-in server-verified OIDC with role mapping (`netlify/functions/_identity.js`, `test/identity.test.js`); shared-token gate; MCP coordinator role gate (`agent_orchestrator.py` `APPROVED_ROLES`) | 🟡 OIDC defaults **off** until an IdP and MLRO-approved role mapping exist |
| Information security / secure development | Pure-`'self'` CSP + Trusted Types (`netlify.toml`, `test/csp.test.mjs`); CodeQL, Semgrep, gitleaks, osv-scanner, ZAP DAST ([`../security/tooling-reference.md`](../security/tooling-reference.md)); [repository hardening](github-repository-hardening.md) | ✅ |
| Data protection | AES-GCM encryption of the at-rest store (`app.js`); pre-egress identifier guard for the Advisor (`netlify/functions/_data-boundary.js`); retention ([`data-retention.md`](data-retention.md)) | 🟡 the egress guard defaults to *audit*, not *block* |
| Logging & integrity | SHA-256 hash-chained activity log (`app.js`); MCP audit trail that never records argument values (`test/mcp_tools_test.py`) | ✅ |
| Supplier relationships | [`../aims/third-party-register.md`](../aims/third-party-register.md); [`ai-vendor-assurance.md`](ai-vendor-assurance.md) | ✅ |
| Backup & continuity | [`backup-recovery.md`](backup-recovery.md); [`../aims/bcp.md`](../aims/bcp.md) | 🟡 first second-operator drill outstanding (open action 44) |
| Physical controls | Inherited from the hosting providers (Netlify, GitHub); no premises-hosted infrastructure | Inherited |
| ISMS clauses 4–10 (scope, risk treatment, Statement of Applicability, internal audit, management review) | Partly met **through the AIMS**: [`../aims/internal-audit.md`](../aims/internal-audit.md), [`../aims/management-review.md`](../aims/management-review.md) | 🟡 a **draft** Annex A Statement of Applicability now exists: [`iso-27001-soa-draft-2026.md`](iso-27001-soa-draft-2026.md) (not approved; §8 gap G-1) |

## 3. AI management, risk and impact — ISO/IEC 23894 · 42005 · 22989

| Standard | Closest existing artefact | Status |
|---|---|---|
| ISO/IEC 23894 (AI risk management, ISO 31000 process) | [`../aims/ai-risk-register.md`](../aims/ai-risk-register.md) (R-01…R-20) · [`../aims/iso-42001-clause-6-1-mapping.md`](../aims/iso-42001-clause-6-1-mapping.md) · [`risk-appetite-statement-2026.md`](risk-appetite-statement-2026.md) | ✅ the process (identify → analyse → evaluate → treat → monitor) is run; the register is not labelled against 23894 clauses |
| ISO/IEC 42005 (AI system impact assessment) | [`../aims/ai-impact-assessment.md`](../aims/ai-impact-assessment.md) (individuals, group-level and discriminatory outcomes, rights) · [`stakeholder-impact-assessment-2026.md`](stakeholder-impact-assessment-2026.md) | 🟡 lifecycle-trigger index added: [`../aims/ai-impact-assessment.md`](../aims/ai-impact-assessment.md) §9 (§8 gap G-2) |
| ISO/IEC 22989 (terminology) | [`risk-glossary.md`](risk-glossary.md) §§1–9 business-risk terms; §10 AI terms | 🟡 AI-terms section added: [`risk-glossary.md`](risk-glossary.md) §10, in the repository's own wording (§8 gap G-3) |

## 4. Model risk and validation — OSFI E-23 (benchmark)

*The question this answers: how is model risk controlled?* E-23 covers all
models whatever the technique, AI/ML included, so it is a useful benchmark for
the deterministic engines as well as the AI surfaces.

| E-23 expectation | Existing control (evidence) | Status |
|---|---|---|
| Enterprise model inventory | [`../models/README.md`](../models/README.md) model cards; [`ai-asset-register.md`](ai-asset-register.md); `data/ai-assets.json` (shadow-AI scan in `test/ai-assets.test.js`) | ✅ |
| Risk-based model rating | Decision-impact tiers in [`../aims/ai-system-inventory.md`](../aims/ai-system-inventory.md) | ✅ |
| Lifecycle governance (design → retirement) | [`model-risk-management-2026.md`](model-risk-management-2026.md); [`../aims/decommissioning.md`](../aims/decommissioning.md); [`prompt-lifecycle-register.md`](prompt-lifecycle-register.md) | ✅ |
| Independent validation | [`model-validation-2026.md`](model-validation-2026.md); [`backtesting-protocol-2026.md`](backtesting-protocol-2026.md) | 🟡 validation is maintainer-performed; independence relies on MLRO review (see §5 escalation) |
| Ongoing monitoring | [`../aims/population-stability-monitoring.md`](../aims/population-stability-monitoring.md); [`champion-challenger-thresholds.md`](champion-challenger-thresholds.md); recall-monotone benchmark floors (`test/fixtures/screening-benchmark/floors.json`) | ✅ |
| Explainability | [`explainability-statement-2026.md`](explainability-statement-2026.md); contributing factors shown behind every deterministic output | ✅ |

## 5. Expertise escalation — EU AI Act Arts. 68–69 as a design lesson

Arts. 68–69 bind no operator (§1). The governance lesson in them is still
sound and applies here: **knowing when in-house expertise is insufficient is
itself a control**. Hawkeye Sterling is a small team. The table records, per
specialist domain, what exists in-house and what should trigger bringing in an
outside expert. It is a **proposal for MLRO adoption**, not an adopted policy.

| Domain | In-house capability (evidence) | Proposed escalation trigger |
|---|---|---|
| Model evaluation | Golden tests, weekly Advisor eval (`scripts/advisor-eval.mjs`), [validation pack](model-validation-2026.md) | Any change from deterministic to learned scoring (ADR-001 reversal) |
| Algorithmic bias | Cross-script recall-parity eval (`scripts/advisor-bias-eval.mjs`, `test/bias_eval.py`); [`advisor-bias-review-2026.md`](advisor-bias-review-2026.md) | A parity breach that the maintainer cannot root-cause within one review cycle |
| Adversarial testing | Prompt-injection red team in CI (`test/redteam_injection.py`); [`../aims/red-team-procedure.md`](../aims/red-team-procedure.md) | Enabling write-capable or autonomous agent tools; any confirmed injection bypass |
| Explainability / legal | [`explainability-statement-2026.md`](explainability-statement-2026.md) | A regulator or court asking for reasons for an individual outcome |
| Legal citations | `test/legal-citations.test.mjs` | Article-level mapping of Cabinet Resolution 134/2025 (needs counsel, already noted in that test) |

## 6. AI security and agent controls — OWASP LLM Top 10 (2025) & Agentic Top 10 (2026)

MITRE ATLAS is already referenced in [`../cybersecurity-skills.md`](../cybersecurity-skills.md).

| Risk | Existing control (evidence) |
|---|---|
| LLM01 Prompt Injection · ASI01 Agent Goal Hijack | `detect_injection` (`ai.py`) + injection-resistance rules in the system prompt (`brain-soul.js`); `test/redteam_injection.py` |
| LLM02 Sensitive Information Disclosure | Data-minimised egress; `_data-boundary.js` pre-egress identifier guard; MCP audit never stores argument values |
| LLM03 Supply Chain · ASI04 Agentic Supply Chain | Zero runtime dependencies (ADR-002); hash-locked `ci/requirements.txt`; pinned actions; Sigstore attestation; [`tool-connector-register.md`](tool-connector-register.md) |
| LLM04 Data & Model Poisoning · ASI06 Memory & Context Poisoning | No training or fine-tuning; Advisor sessions are ephemeral (no persistent agent memory, a deliberate non-control documented in the companion crosswalk §C) |
| LLM05 Improper Output Handling · ASI05 Unexpected Code Execution | Pure-`'self'` CSP + Trusted Types; Semgrep bans `eval` / `new Function` / `document.write`; no model output is executed |
| LLM06 Excessive Agency · ASI02 Tool Misuse · ASI03 Identity & Privilege Abuse | MCP tools are deterministic and decision-support only; `agent_orchestrator.py` enforces a five-tool read-only allowlist, ≤8 steps, ≤2 replans, a verified MLRO/Admin role and human approval before any dispatch (tests in `test/mcp_tools_test.py`); `McpAgent` can never be issued a secret (`agents.py` credential broker) |
| LLM07 System Prompt Leakage | The system prompt holds policy, not secrets; keys live in environment settings only (gitleaks) |
| LLM08 Vector & Embedding Weaknesses | N/A — no vector store or RAG index |
| LLM09 Misinformation · ASI09 Human-Agent Trust Exploitation | Cited answers, `[AI]` labelling, human decision on every output; citation-accuracy metric ([`citation-accuracy-metric.md`](citation-accuracy-metric.md)); Advisor output validation (`netlify/functions/_answer-validator.js`, `ADVISOR_OUTPUT_POLICY`: default *audit*, opt-in *withhold*; it cannot establish that a generated claim is true) |
| LLM10 Unbounded Consumption · ASI08 Cascading Failures | Rate limiting (`netlify/functions/_ratelimit.js`); budget guard; refusal circuit breaker; degrade-loudly failure paths |
| ASI07 Insecure Inter-Agent Communication | N/A — no agent-to-agent messaging; the coordinator is local and in-process |
| ASI10 Rogue Agents | Explicit Advisor kill switch (`brain-soul.js`, [`ai-incident-runbook.md`](ai-incident-runbook.md)); no autonomous agent exists |

## 7. Transaction-monitoring workflow — reference model vs this system

The standard financial-institution workflow (onboarding → risk rating → data
collection → validation → monitoring engine → alert → L1 → L2/L3 → case → STR →
compliance review → regulatory reporting → tuning → continuous monitoring)
mapped to what exists. **The automated engine is not live.** The firm has no
connected transaction feed, so `txn_monitor.py` is inert ([open action 6](open-actions-register.md)), and the MLRO-adopted
[manual compensating control](../aims/transaction-feed-compensating-control.md)
covers the gap in the meantime.

| Reference step | This system | Status |
|---|---|---|
| 1 · Onboarding: KYC/CDD, sanctions & PEP screening | `kyc.py`; `screen.py` daily screening; payment screening (`payment_screen.py`) | ✅ |
| 2 · Customer risk assessment (Low/Medium/High) | Deterministic Entity Risk Assessment (`app.js`); `hawkeye_compute_risk_rating` MCP tool | ✅ |
| 3 · Transaction data collection | Operator-supplied private export via `TXN_FEED_PATH`; no bank/ERP connector | ❌ not wired (open action 6) |
| 4 · Data validation & ETL | `txn_feed.py` fail-closed validation with a completeness manifest; `data/transaction-feed.schema.json` | ✅ built; idle until a feed exists |
| 5 · Monitoring engine (rules + scenarios) | `txn_monitor.py` deterministic DPMS rules (threshold, structuring, velocity, pass-through, pricing deviation, circular flow and others). **No AI/ML models, by design** ([ADR-001](adr-001-deterministic-vs-learned.md)) | 🟡 inert until fed |
| Alert generation & prioritisation | Severity-tagged alerts from `txn_monitor.evaluate`, reported through the daily run (`screen.py`) to Asana | 🟡 inert until fed |
| L1 triage → L2/L3 investigation | Not tiered. A delegate prepares and the MLRO decides ([operating model](operating-model.md) delegation matrix) | By design for the firm's size |
| Case management & audit trail | Asana case tasks; hash-chained activity log | ✅ |
| SAR/STR filing | `str_dossier.py` / `tfs_dossier.py` assemble **draft** goAML-aligned dossiers. The MLRO files in goAML; the system never files | ✅ draft only |
| Compliance review · regulatory reporting | MLRO review; [obligation register](obligation-register.md) | ✅ |
| Model tuning & continuous monitoring | Thresholds are configurable and documented in `txn_monitor.py`; tuning evidence needs live alert history | ❌ no alert history yet |

## 8. Gaps and proposed follow-ups

Proposals for the maintainer and MLRO. None of them is entered in the
[open-actions register](open-actions-register.md) by this document. Entering
any of them there is a separate, one-state-change-per-PR act.

| ID | Gap | Proposed action | Owner (proposed) |
|---|---|---|---|
| G-1 | No ISO/IEC 27001 Annex A Statement of Applicability | **Drafted 2026-10-08:** [`iso-27001-soa-draft-2026.md`](iso-27001-soa-draft-2026.md) (all 93 controls; applicability proposals await the MLRO) | Maintainer drafts; MLRO approves |
| G-2 | AI impact assessment not structured to ISO/IEC 42005 | **Done 2026-10-08:** [`../aims/ai-impact-assessment.md`](../aims/ai-impact-assessment.md) §9 indexes the existing triggers by lifecycle stage | Maintainer |
| G-3 | No AI-terminology alignment (ISO/IEC 22989) | **Done 2026-10-08:** [`risk-glossary.md`](risk-glossary.md) §10 (15 terms) | Maintainer |
| G-4 | OIDC and the Advisor egress guard's *block* mode are both default-off | OIDC is already tracked as [open action 20](open-actions-register.md). No register item was found for switching the egress guard from *audit* to *block*; propose one | MLRO (role mapping, egress mode decision) |
| G-5 | §5 escalation matrix is a proposal | MLRO adopts it, amends it or rejects it | MLRO |
| G-6 | Vendor frontier-risk evidence | Where the model provider is an SB 53 *large frontier developer*, record its published frontier AI framework as vendor-assurance evidence in [`ai-vendor-assurance.md`](ai-vendor-assurance.md) | Maintainer |
| G-7 | `agent_orchestrator.py` has no production adapter, and its approval flag is a plain boolean | `netlify/functions/_human-review.js` now gives a signed review-evidence preflight, but by its own header it is not a replay-preventing authorization gateway. Before any production wiring: persist a non-replayable MLRO approval bound to `proposal_digest(plan)` (the orchestrator's docstring requires this) | Maintainer |

## Sources

Primary or official sources where available. Secondary sources are marked.

- ISO/IEC 42005:2025 — ISO catalogue, <https://www.iso.org/standard/44545.html> (Edition 1, 2025-05).
- ISO/IEC 23894:2023 — IEC webstore, <https://webstore.iec.ch/publication/82914>; ANSI summary (secondary), <https://blog.ansi.org/ansi/iso-iec-23894-2023-ai-risk-management/>.
- ISO/IEC 22989:2022 — Standards Council of Canada record, <https://scc-ccn.ca/standardsdb/standards/2049939>.
- OSFI Guideline E-23 — OSFI news release, <https://www.osfi-bsif.gc.ca/en/news/osfi-issues-its-final-guideline-enterprise-wide-model-risk-management>; backgrounder, <https://www.osfi-bsif.gc.ca/en/news/backgrounder-guideline-e-23-model-risk-management>.
- California SB 53 — Future of Privacy Forum analysis (secondary), <https://fpf.org/blog/californias-sb-53-the-first-frontier-ai-law-explained/>; White & Case alert (secondary), <https://www.whitecase.com/insight-alert/california-enacts-landmark-ai-transparency-law-transparency-frontier-artificial>. Thresholds should be checked against the enacted bill text before anyone relies on them.
- EU AI Act Art. 69 — European Commission AI Act Service Desk, <https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-69>.
- OWASP Top 10 for Agentic Applications (2026) — OWASP GenAI Security Project, announced 9 Dec 2025; category list cross-checked against Giskard (secondary), <https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026>.
- OWASP Top 10 for LLM Applications 2025 — OWASP GenAI Security Project; category list cross-checked against HCL AppScan documentation (secondary), <https://help.hcl-software.com/appscan/Enterprise/10.10.0/topics/r_owasp_top_10_for_llm.html>.
- NIS2 transposition — European Commission, <https://digital-strategy.ec.europa.eu/en/news/commission-calls-19-member-states-fully-transpose-nis2-directive>.
- DORA application date — Czech National Bank, <https://www.cnb.cz/en/cnb-news/news/DORA-regulation-comes-into-effect>.
- Cyber Resilience Act timeline — Prighter (secondary), <https://prighter.com/resources/regulations/cyber-resilience-act>.
- South Korea AI Basic Act — Cooley (secondary), <https://www.cooley.com/news/insight/2026/2026-01-27-south-koreas-ai-basic-act-overview-and-key-takeaways>.
- Japan AI Promotion Act — Future of Privacy Forum (secondary), <https://fpf.org/blog/understanding-japans-ai-promotion-act/>.
- Council of Europe Framework Convention (CETS 225) — Council of Europe, <https://www.coe.int/en/web/portal/-/council-of-europe-opens-first-ever-global-treaty-on-ai-for-signature>.
- G7 Hiroshima Process Code of Conduct — European Commission, <https://digital-strategy.ec.europa.eu/en/library/hiroshima-process-international-code-conduct-advanced-ai-systems>.
- UNESCO Recommendation on the Ethics of AI — adoption reported by JURIST (secondary), <https://www.jurist.org/news/2021/11/un-countries-adopt-first-global-agreement-on-ai-ethics/>.
- Prompting material: practitioner infographics supplied by the operator on 2026-10-08 ("The 6 Rulebooks of AI Governance"; "AI Governance Frameworks"; an EU AI Act Article 69 commentary; a transaction-monitoring workflow; a vendor evidence-by-design graphic). They were used to choose scope only. Every fact above is taken from the sources listed, not from the infographics, and no vendor product is endorsed.
