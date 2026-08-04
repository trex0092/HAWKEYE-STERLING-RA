# Documentation Map

~190 documents in 12 packs plus 9 standalone references. Each pack's own
README (where one exists) is the authoritative index for that pack; this page
is the way in. Repo-level governance lives at the root:
[`../GOVERNANCE.md`](../GOVERNANCE.md) (decision rights),
[`../MAINTAINERS.md`](../MAINTAINERS.md) (roster + succession),
[`../CLAUDE.md`](../CLAUDE.md) (enforced invariants).

## Packs

| Pack | What lives there |
|---|---|
| [`governance/`](governance/README.md) | The largest pack: AI policy, framework crosswalks (ISO 42001 · NIST AI RMF · EU AI Act · UAE AI Charter), risk appetite + KRIs, model risk management, validation & backtesting, ADRs, registers ([open-actions](governance/open-actions-register.md), obligations, assets), readiness review, incident runbook, GitHub hardening |
| [`aims/`](aims/README.md) | ISO/IEC 42001 AIMS pack: impact assessment, [AI risk register](aims/ai-risk-register.md), system inventory, SoA, internal audit, management review, [BCP](aims/bcp.md), bias/fairness testing, red-team log, data-quality plan |
| [`policies/`](policies/README.md) | AML/CFT/CPF policy pack: customer acceptance/CDD, sanctions & TFS, STR/DPMSR filing, transaction monitoring, record-keeping, responsible sourcing, training, independent audit |
| [`models/`](models/README.md) | Per-feature model cards: risk-scoring engine, sanctions name matcher, adverse-media classifier, PEP identifier, advisor LLM, AI triage |
| [`security/`](security/code-scanning-triage-2026-07.md) | Runbooks and security references: code-scanning triage, [history-scrub runbook](security/history-scrub-runbook.md), [deploy-rollback runbook](security/deploy-rollback-runbook.md), Supabase RLS template |
| [`architecture/`](architecture/README.md) | [Diagram set](architecture/diagrams.md): system context, trust boundaries, swimlanes, decision flow |
| [`executive/`](executive/executive-brief.md) | Executive brief, business value/ROI, regulatory readiness, [roadmap](executive/roadmap.md), KPI dashboard, cross-division use-case map |
| [`user-guides/`](user-guides/analyst-guide.md) | Analyst, administrator and reviewer/MLRO guides + the alert-investigation decision tree |
| [`api/`](api/functions.md) | Netlify functions reference (the serverless surface) |
| [`research/`](research/README.md) | Regulatory research: UAE AML legal framework, regulators directory, dated update digests (`research/auto/` is generated) |
| [`demo/`](demo/demo-script.md) | Demo script, sample data, walkthrough scenarios |
| [`screenshots/`](screenshots/) | README captures of the three screens |

## Standalone references

| Document | What it is |
|---|---|
| [`AI-GOVERNANCE.md`](AI-GOVERNANCE.md) | Master model card + control mapping |
| [`architecture.md`](architecture.md) | System architecture incl. the STRIDE threat model |
| [`mcp-server.md`](mcp-server.md) | MCP server reference: tools, resources, prompts, safety, client config |
| [`app-setup-runbook.md`](app-setup-runbook.md) | Stand up a second operator environment from zero |
| [`regulatory-watch.md`](regulatory-watch.md) | The regulatory-watch sources and how the watcher works |
| [`asana-integration-audit.md`](asana-integration-audit.md) | The Asana integration, audited end to end |
| [`i18n-ar-legal-review.md`](i18n-ar-legal-review.md) | The Arabic legal-text decision (long-form prose stays English) |
| [`fraud-f3-mapping.md`](fraud-f3-mapping.md) | Fraud typology mapping |
| [`cybersecurity-skills.md`](cybersecurity-skills.md) | The Claude Code cybersecurity-skills plugin registration |

Data provenance (what each file under `data/` is, who writes it, what stale
means) is documented in [`../data/README.md`](../data/README.md).
