# Documentation Map

The way in to everything under `docs/`. Each pack's own README (where one
exists) is the authoritative index for that pack; this page tells you which
pack to open. Repo-level governance lives at the root:
[`../GOVERNANCE.md`](../GOVERNANCE.md) (decision rights),
[`../MAINTAINERS.md`](../MAINTAINERS.md) (roster + succession),
[`../CLAUDE.md`](../CLAUDE.md) (enforced invariants).

This page carries no document counts, because hand counts drift. The live
figures are `docsTotal` and `docsCurated` in
[`../data/board-figures.json`](../data/board-figures.json), recomputed by CI on
every change. CI also checks that every folder and every top-level document
under `docs/` is linked from this page (see [Keeping this map true](#keeping-this-map-true)).

## Start here

| If you are | Read first | Then |
|---|---|---|
| An analyst working alerts | [Analyst guide](user-guides/analyst-guide.md) | [Alert-investigation decision tree](user-guides/alert-investigation-decision-tree.md) · [walkthrough scenarios](demo/scenarios.md) |
| The reviewer / MLRO | [Reviewer/MLRO guide](user-guides/reviewer-mlro-guide.md) | [STR/DPMSR filing procedure](policies/str-dpmsr-filing-procedure.md) · [open-actions register](governance/open-actions-register.md) · [AI incident runbook](governance/ai-incident-runbook.md) |
| An administrator or second operator | [Administrator guide](user-guides/administrator-guide.md) | [App setup runbook](app-setup-runbook.md) · [operating model](governance/operating-model.md) · [When something breaks](#when-something-breaks) |
| A Board member or executive | [Executive brief](executive/executive-brief.md) | [KPI dashboard](executive/kpi-dashboard.md) · [risk appetite statement](governance/risk-appetite-statement-2026.md) · [roadmap](executive/roadmap.md) |
| An auditor or examiner | [Regulatory readiness pack](executive/regulatory-readiness.md) | [Assurance coverage matrix](governance/assurance-coverage-matrix.md) · [ISO 42001 mandatory-documents index](aims/iso42001-mandatory-documents-index.md) · [policy pack](policies/README.md) |
| A model validator | [Model cards](models/README.md) | [Risk-scoring validation pack](governance/model-validation-2026.md) · [backtesting protocol](governance/backtesting-protocol-2026.md) · [screening accuracy benchmark](governance/screening-accuracy-benchmark.md) |
| An engineer or AI agent | [`../CLAUDE.md`](../CLAUDE.md) | [System architecture](architecture.md) · [ADRs, listed in the governance index](governance/README.md) · [functions reference](api/functions.md) · [MCP server reference](mcp-server.md) |

## When something breaks

| Situation | Go to |
|---|---|
| An AI component (Advisor, reg-draft) misbehaves or needs the kill switch | [AI incident runbook](governance/ai-incident-runbook.md) |
| A merge to `main` has not reached the live site | [Netlify production recovery](runbooks/netlify-production-recovery.md) |
| Production is serving something wrong and must be rolled back | [Deploy rollback runbook](security/deploy-rollback-runbook.md) |
| Stored data or an export needs restoring or verifying | [Backup, recovery & export integrity](governance/backup-recovery.md) |
| The screening control is disrupted | [Business continuity & resilience plan](aims/bcp.md) |
| Sensitive data must be removed from git history | [History-scrub runbook](security/history-scrub-runbook.md) |
| You need to write up an incident afterwards | [Incident postmortem template](governance/incident-postmortem-template.md) |

## Packs

| Pack | Own index | What lives there |
|---|---|---|
| [`governance/`](governance/README.md) | yes | The largest pack: AI policy, framework crosswalks (ISO 42001 · NIST AI RMF · EU AI Act · UAE AI Charter), risk appetite + KRIs, model risk management, validation & backtesting, ADRs, registers ([open-actions](governance/open-actions-register.md), [obligations](governance/obligation-register.md), [assets](governance/ai-asset-register.md), [policies](governance/policy-register.md)), [readiness review](governance/enterprise-readiness-review-2026.md), incident runbook, GitHub hardening |
| [`aims/`](aims/README.md) | yes | ISO/IEC 42001 AIMS pack: impact assessment, [AI risk register](aims/ai-risk-register.md), system inventory, SoA, internal audit, management review, [BCP](aims/bcp.md), bias/fairness testing, red-team log, data-quality plan, [mandatory-documents index](aims/iso42001-mandatory-documents-index.md) |
| [`policies/`](policies/README.md) | yes | AML/CFT/CPF policy pack: customer acceptance/CDD, sanctions & TFS, proliferation financing, STR/DPMSR filing, transaction monitoring, record-keeping, responsible sourcing, training, independent audit, data privacy, information security, outsourcing, whistleblowing |
| [`models/`](models/README.md) | yes | Per-feature model cards: risk-scoring engine, sanctions name matcher, adverse-media classifier, PEP identifier, advisor LLM, AI triage |
| [`architecture/`](architecture/README.md) | yes | [Diagram set](architecture/diagrams.md): system context, trust boundaries, swimlanes, decision flow. Also the [sharded-screening design](architecture/sharded-screening-design.md) (design only, not built) |
| [`research/`](research/README.md) | yes | Regulatory research: UAE AML legal framework, regulators directory, dated update digests, open-source candidate reviews. `research/auto/` holds the Regulatory Watch pipeline's machine-drafted notes |
| [`security/`](security/code-scanning-triage-2026-07.md) | no | Code-scanning triage, [history-scrub runbook](security/history-scrub-runbook.md), [deploy-rollback runbook](security/deploy-rollback-runbook.md), [security tooling reference](security/tooling-reference.md), [Supabase RLS template](security/supabase-rls-policies.sql) |
| [`runbooks/`](runbooks/netlify-production-recovery.md) | no | Operational runbooks: Netlify production deploy recovery |
| [`executive/`](executive/executive-brief.md) | no | Executive brief, business value/ROI, regulatory readiness, [roadmap](executive/roadmap.md), KPI dashboard, cross-division use-case map, presentation plan (`.docx`) and its [diagram sources](executive/diagrams/) |
| [`user-guides/`](user-guides/analyst-guide.md) | no | Analyst, administrator and reviewer/MLRO guides + the alert-investigation decision tree |
| [`api/`](api/functions.md) | no | Netlify functions reference (the serverless surface) |
| [`demo/`](demo/demo-script.md) | no | Demo script, sample data, walkthrough scenarios |
| [`generated/`](generated/country-coverage-gaps.md) | no | Machine-written reports. Currently the 195-country coverage-gap report, written by `scripts/country-coverage-report.mjs`. Do not hand-edit |
| [`screenshots/`](screenshots/) | no | README captures of the three screens |

## Standalone references

| Document | What it is |
|---|---|
| [`AI-GOVERNANCE.md`](AI-GOVERNANCE.md) | Master model card + control mapping |
| [`architecture.md`](architecture.md) | System architecture incl. the STRIDE threat model |
| [`mcp-server.md`](mcp-server.md) | MCP server reference: tools, resources, prompts, safety, client config |
| [`composio-integration.md`](composio-integration.md) | Optional governed Composio orchestration: sessions, connected apps, tools, triggers, webhook verification, MCP metadata and kill switches |
| [`app-setup-runbook.md`](app-setup-runbook.md) | Stand up a second operator environment from zero |
| [`regulatory-watch.md`](regulatory-watch.md) | The regulatory-watch sources and how the watcher works |
| [`asana-integration-audit.md`](asana-integration-audit.md) | The Asana integration, audited end to end |
| [`free-integration-audit-20261027.md`](free-integration-audit-20261027.md) | Manual-only connectivity diagnostics for three public sources (Google News RSS, GDELT, Wikidata) and how each maps to an existing control |
| [`workflow-consolidation-and-lfs-followups.md`](workflow-consolidation-and-lfs-followups.md) | `.github/workflows/` sprawl analysis + a Git LFS migration runbook |
| [`i18n-ar-legal-review.md`](i18n-ar-legal-review.md) | The Arabic legal-text decision (long-form prose stays English) |
| [`fraud-f3-mapping.md`](fraud-f3-mapping.md) | Fraud typology mapping |
| [`cybersecurity-skills.md`](cybersecurity-skills.md) | The Claude Code cybersecurity-skills plugin registration |

Data provenance (what each file under `data/` is, who writes it, what stale
means) is documented in [`../data/README.md`](../data/README.md).

## Keeping this map true

- **Every folder and top-level document is listed here, and CI enforces it.**
  `test/doc-links.test.mjs` fails if a `docs/` subfolder or a `docs/*.md` file
  is not linked from this page, and if any relative link in the estate points
  at a file that does not exist. A new pack or standalone document needs a row
  above in the same PR.
- **Adding or removing any `docs/**/*.md` changes the board figures.** Run
  `node scripts/board-figures.mjs --write` and update the newest "Verified at
  HEAD" line in
  [`governance/enterprise-readiness-review-2026.md`](governance/enterprise-readiness-review-2026.md)
  §18, as [`../CLAUDE.md`](../CLAUDE.md) requires.
- **Do not hand-edit generated content:** `generated/` and `research/auto/`.
- **After touching a document that cites legislation,** run
  `node test/legal-citations.test.mjs`; repealed instruments must not be cited
  as operative law.
- **Sign-offs, approvals and dates that belong to a named role** are that
  role's to write ([`../GOVERNANCE.md`](../GOVERNANCE.md)).
