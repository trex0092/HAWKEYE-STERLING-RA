# ISO/IEC 27001:2022 Annex A — Statement of Applicability (DRAFT, 2026)

**Status:** ⚠️ **DRAFT, not approved.** Prepared 2026-10-08 by the maintainer
to close gap G-1 in [`ai-rulebooks-crosswalk-2026.md`](ai-rulebooks-crosswalk-2026.md) §8.
Every "Applicable" decision below is a **proposal**. Under ISO/IEC 27001
clause 6.1.3 the organisation decides applicability, and approval of this SoA
belongs to the MLRO and the Board under [`GOVERNANCE.md`](../../GOVERNANCE.md).
No approval, sign-off or date of one is recorded or implied here.

**What this is not.** Hawkeye Sterling LLC holds **no ISO/IEC 27001
certification** and claims none. ISO/IEC 27001 is voluntary for this firm (see
the crosswalk §1). This is a benchmark: it shows, control by control, what the
repository already evidences and where it does not.

**Scope proposed for this SoA:** the digital estate in this repository: the
static web app, the Python screening engine, the MCP server, the Netlify
functions, the CI/CD pipeline, and the data they hold. Firm premises, staff HR
processes and staff endpoints are in the organisation's ISMS but leave **no
evidence in this repository**. Their rows say so (❓) instead of assuming a
control exists.

**Source of the control list.** The 93 control numbers and titles (37
organisational, 8 people, 14 physical, 34 technological) were taken from two
independent published lists that agree:
[ISMS.online](https://www.isms.online/iso-27001/annex-a-2022/) and
[High Table](https://hightable.io/iso-27001-annex-a-controls-reference-guide/).
Neither is ISO's own text. Check the titles against a purchased copy of
ISO/IEC 27001:2022 before this document is used for certification.

**Status legend**

| Mark | Meaning |
|---|---|
| ✅ | Implemented, with evidence in this repository |
| 🟡 | Partly implemented: drafted but not approved, default-off, or with a stated limitation |
| ❓ | Not evidenced in this repository (a firm process that may exist elsewhere, or a real gap) |
| ⬆️ | Inherited from a hosting or SaaS provider; the provider's assurance reports are **not** held here |
| ⛔ | Proposed exclusion, with a justification for the MLRO to accept or reject |

Most firm policies cited below are **DRAFT, awaiting Board approval**
([open action 18](open-actions-register.md)). Wherever a control rests on one of
them, the row is 🟡, never ✅.

## 5 · Organisational controls (37)

| # | Control | Proposed | Evidence in this repository | Status |
|---|---|---|---|---|
| 5.1 | Policies for information security | Applicable | [`../policies/information-security-policy.md`](../policies/information-security-policy.md) (DRAFT, POL-27 in [`policy-register.md`](policy-register.md)) | 🟡 |
| 5.2 | Information security roles and responsibilities | Applicable | [`operating-model.md`](operating-model.md); [`ai-control-ownership-matrix.md`](ai-control-ownership-matrix.md); [`../../MAINTAINERS.md`](../../MAINTAINERS.md) | ✅ |
| 5.3 | Segregation of duties | Applicable | One maintainer: the sole code owner is also the author, and own PRs merge through a **logged admin bypass** ([`github-repository-hardening.md`](github-repository-hardening.md)). Documented limitation until a second maintainer joins | 🟡 |
| 5.4 | Management responsibilities | Applicable | Board and MLRO authority in [`../../GOVERNANCE.md`](../../GOVERNANCE.md); [`../aims/management-review.md`](../aims/management-review.md). Policy approval pending (open action 18) | 🟡 |
| 5.5 | Contact with authorities | Applicable | Notification duties to the MLRO and the UAE Data Office in [`ai-incident-runbook.md`](ai-incident-runbook.md); AML authority paths in [`../aims/tfs-name-match-procedure.md`](../aims/tfs-name-match-procedure.md) and [`../aims/eocn-list-update-sop.md`](../aims/eocn-list-update-sop.md) | ✅ |
| 5.6 | Contact with special interest groups | Applicable | No membership of security or industry groups is evidenced | ❓ |
| 5.7 | Threat intelligence | Applicable | Vulnerability-advisory feeds only: Dependabot, `osv-scanner.yml`, `dependency-review.yml`. No threat-intelligence process | 🟡 |
| 5.8 | Information security in project management | Applicable | [`ai-use-case-intake.md`](ai-use-case-intake.md) gate; PR template; required CI checks | ✅ |
| 5.9 | Inventory of information and other associated assets | Applicable | AI, tool and vendor inventories: [`ai-asset-register.md`](ai-asset-register.md), [`tool-connector-register.md`](tool-connector-register.md), [`../aims/third-party-register.md`](../aims/third-party-register.md). No inventory of endpoints or non-AI information assets | 🟡 |
| 5.10 | Acceptable use of information and other associated assets | Applicable | [`ai-acceptable-use-policy.md`](ai-acceptable-use-policy.md) covers AI use only | 🟡 |
| 5.11 | Return of assets | Applicable | HR offboarding process; not evidenced here | ❓ |
| 5.12 | Classification of information | Applicable | **No information classification scheme exists in the repository** | ❓ |
| 5.13 | Labelling of information | Applicable | Output labels exist (`[AI]` marking; DRAFT stamps on `str_dossier.py` / `tfs_dossier.py`) but follow no classification scheme (5.12) | 🟡 |
| 5.14 | Information transfer | Applicable | HTTPS with HSTS (`netlify.toml`); egress-blocked CI jobs; data-minimised LLM egress; `netlify/functions/_data-boundary.js` | ✅ |
| 5.15 | Access control | Applicable | Least-privilege statement in the InfoSec policy (DRAFT); token gate in `netlify/functions/_auth.js`; per-action tool allow-list | 🟡 |
| 5.16 | Identity management | Applicable | Verified OIDC identity (`netlify/functions/_identity.js`, `test/identity.test.js`) is built but **default off** until an IdP exists ([open action 20](open-actions-register.md)) | 🟡 |
| 5.17 | Authentication information | Applicable | Secrets held only as platform secrets; gitleaks on every change (`gitleaks.yml`, `.gitleaks.toml`) | ✅ |
| 5.18 | Access rights | Applicable | Role mapping awaits MLRO approval (open action 20) | 🟡 |
| 5.19 | Information security in supplier relationships | Applicable | [`../policies/outsourcing-third-party-policy.md`](../policies/outsourcing-third-party-policy.md) (DRAFT); [`../aims/third-party-register.md`](../aims/third-party-register.md) | 🟡 |
| 5.20 | Addressing information security within supplier agreements | Applicable | [`../aims/anthropic-dpa-execution-pack.md`](../aims/anthropic-dpa-execution-pack.md); the DPA line of the go-live checklist is still unticked ([`../aims/ai-impact-assessment.md`](../aims/ai-impact-assessment.md) §8) | 🟡 |
| 5.21 | Managing information security in the ICT supply chain | Applicable | Zero runtime dependencies ([ADR-002](adr-002-zero-runtime-dependencies.md)); hash-locked `ci/requirements.txt`; pinned actions; `attestation-verify.yml`; `scorecard.yml` | ✅ |
| 5.22 | Monitoring, review and change management of supplier services | Applicable | `function-health.yml`, `netlify-probe.yml`, `site-health.yml`; [`ai-vendor-assurance.md`](ai-vendor-assurance.md) | ✅ |
| 5.23 | Information security for use of cloud services | Applicable | Cloud providers listed in the third-party register; repository hardening as configuration (`.github/settings.yml`). No cloud-service policy | 🟡 |
| 5.24 | Information security incident management planning and preparation | Applicable | [`ai-incident-runbook.md`](ai-incident-runbook.md); [`../../SECURITY.md`](../../SECURITY.md) | ✅ |
| 5.25 | Assessment and decision on information security events | Applicable | Triage steps and clocks in the incident runbook; `anomaly-watch.yml` | ✅ |
| 5.26 | Response to information security incidents | Applicable | Incident runbook; Advisor kill switch; [`../security/deploy-rollback-runbook.md`](../security/deploy-rollback-runbook.md) | ✅ |
| 5.27 | Learning from information security incidents | Applicable | [`incident-postmortem-template.md`](incident-postmortem-template.md); CAPA log [`../aims/corrective-actions.md`](../aims/corrective-actions.md) | ✅ |
| 5.28 | Collection of evidence | Applicable | Hash-chained activity log (`app.js`); evidence-retention rules in `SECURITY.md`; tamper-evident receipt chain (`scripts/evidence-receipts.mjs`) built but offline only (open action 23 stays open) | 🟡 |
| 5.29 | Information security during disruption | Applicable | [`../aims/bcp.md`](../aims/bcp.md) manual fallback. First second-operator drill outstanding ([open action 44](open-actions-register.md); [`../aims/bcp-exercise-record.md`](../aims/bcp-exercise-record.md)) | 🟡 |
| 5.30 | ICT readiness for business continuity | Applicable | [`backup-recovery.md`](backup-recovery.md) restore procedures; drill outstanding as 5.29 | 🟡 |
| 5.31 | Legal, statutory, regulatory and contractual requirements | Applicable | [`obligation-register.md`](obligation-register.md); `test/legal-citations.test.mjs`; [`../regulatory-watch.md`](../regulatory-watch.md) | ✅ |
| 5.32 | Intellectual property rights | Applicable | [`../../LICENSE`](../../LICENSE); [`../../CITATION.cff`](../../CITATION.cff). No register of third-party licences (fonts, data sources) | 🟡 |
| 5.33 | Protection of records | Applicable | [`../policies/record-keeping-retention-policy.md`](../policies/record-keeping-retention-policy.md) (DRAFT); 10-year retention; `scripts/retain-state.mjs` | 🟡 |
| 5.34 | Privacy and protection of PII | Applicable | [`../policies/data-privacy-policy.md`](../policies/data-privacy-policy.md) (DRAFT); [`dpia-2026.md`](dpia-2026.md); identifier masking (`ai.py` `redact_identifiers`). Cross-border transfer basis still unticked (ai-impact-assessment §8) | 🟡 |
| 5.35 | Independent review of information security | Applicable | [`../aims/internal-audit.md`](../aims/internal-audit.md) is internal. No independent (external) information-security review is evidenced | ❓ |
| 5.36 | Compliance with policies, rules and standards for information security | Applicable | Repository invariants enforced by CI ([`../../CLAUDE.md`](../../CLAUDE.md)); daily `governance-report.yml` | ✅ |
| 5.37 | Documented operating procedures | Applicable | [`../app-setup-runbook.md`](../app-setup-runbook.md); deploy-rollback and EOCN runbooks | ✅ |

## 6 · People controls (8)

Applicable to everyone who operates the estate. Except where noted, these are
HR processes whose evidence belongs in HR records, **not** in this repository
(which must hold no personal HR data).

| # | Control | Proposed | Evidence in this repository | Status |
|---|---|---|---|---|
| 6.1 | Screening | Applicable | Not evidenced here (HR) | ❓ |
| 6.2 | Terms and conditions of employment | Applicable | Not evidenced here (HR) | ❓ |
| 6.3 | Information security awareness, education and training | Applicable | [`../policies/training-awareness-policy.md`](../policies/training-awareness-policy.md) (DRAFT); [`../aims/competency-records.md`](../aims/competency-records.md) | 🟡 |
| 6.4 | Disciplinary process | Applicable | Not evidenced here (HR) | ❓ |
| 6.5 | Responsibilities after termination or change of employment | Applicable | Asana token rotation on personnel change is listed as a firm duty ([`assurance-coverage-matrix.md`](assurance-coverage-matrix.md)). No access-revocation record | ❓ |
| 6.6 | Confidentiality or non-disclosure agreements | Applicable | Not evidenced here (HR / legal) | ❓ |
| 6.7 | Remote working | Applicable | **No remote-working policy exists in the repository** | ❓ |
| 6.8 | Information security event reporting | Applicable | External reporting via [`../../SECURITY.md`](../../SECURITY.md); [`../policies/whistleblowing-policy.md`](../policies/whistleblowing-policy.md) (DRAFT). No staff event-reporting channel evidenced | 🟡 |

## 7 · Physical controls (14)

The estate has no organisation-run data centre. Hosting-side physical controls
are **inherited** from Netlify, GitHub and the AI provider. That inheritance is
asserted, not verified here, because their assurance reports are not held in
this repository. Office premises and staff devices are outside this
repository's evidence.

| # | Control | Proposed | Evidence | Status |
|---|---|---|---|---|
| 7.1 | Physical security perimeter | Applicable | Hosting: inherited. Premises: not evidenced | ⬆️ / ❓ |
| 7.2 | Physical entry | Applicable | Hosting: inherited. Premises: not evidenced | ⬆️ / ❓ |
| 7.3 | Securing offices, rooms and facilities | Applicable | Premises: not evidenced | ❓ |
| 7.4 | Physical security monitoring | Applicable | Hosting: inherited. Premises: not evidenced | ⬆️ / ❓ |
| 7.5 | Protecting against physical and environmental threats | Applicable | Hosting: inherited | ⬆️ |
| 7.6 | Working in secure areas | Applicable | Premises: not evidenced | ❓ |
| 7.7 | Clear desk and clear screen | Applicable | Not evidenced | ❓ |
| 7.8 | Equipment siting and protection | Applicable | Hosting: inherited | ⬆️ |
| 7.9 | Security of assets off-premises | Applicable | Staff devices: not evidenced | ❓ |
| 7.10 | Storage media | Applicable | No removable-media handling evidenced | ❓ |
| 7.11 | Supporting utilities | Applicable | Hosting: inherited | ⬆️ |
| 7.12 | Cabling security | Applicable | Hosting: inherited | ⬆️ |
| 7.13 | Equipment maintenance | Applicable | Hosting: inherited | ⬆️ |
| 7.14 | Secure disposal or re-use of equipment | Applicable | Hosting: inherited. Staff devices: not evidenced | ⬆️ / ❓ |

## 8 · Technological controls (34)

| # | Control | Proposed | Evidence in this repository | Status |
|---|---|---|---|---|
| 8.1 | User endpoint devices | Applicable | No endpoint management evidenced | ❓ |
| 8.2 | Privileged access rights | Applicable | Protected `release` environment; branch protection as code (`.github/settings.yml`). Single admin with a logged bypass (see 5.3) | 🟡 |
| 8.3 | Information access restriction | Applicable | Confidential function paths gated by `_auth.js`; per-user identity default-off (5.16) | 🟡 |
| 8.4 | Access to source code | Applicable | Write access restricted by [`../../.github/CODEOWNERS`](../../.github/CODEOWNERS) and branch protection | ✅ |
| 8.5 | Secure authentication | Applicable | RS256 OIDC verification against a pinned JWKS (`_identity.js`), default-off; shared bearer token meanwhile (open action 20) | 🟡 |
| 8.6 | Capacity management | Applicable | Per-instance rate limiting (`_ratelimit.js`); shared quota adapter (`_shared-quota.js`) built but default-off (open action 22) | 🟡 |
| 8.7 | Protection against malware | Applicable | Code and container scanning (CodeQL, Semgrep, `container-scan.yml`). No endpoint anti-malware evidenced (8.1) | 🟡 |
| 8.8 | Management of technical vulnerabilities | Applicable | Dependabot, `osv-scanner.yml`, `dependency-review.yml`, `codeql.yml`, `fortify.yml`, `bandit.yml`; [`../security/code-scanning-triage-2026-07.md`](../security/code-scanning-triage-2026-07.md) | ✅ |
| 8.9 | Configuration management | Applicable | Configuration as code (`netlify.toml`, `.github/settings.yml`); `workflow-lint.yml` | ✅ |
| 8.10 | Information deletion | Applicable | Stale-draft purge in `app.js`; [`data-retention.md`](data-retention.md); [`../aims/decommissioning.md`](../aims/decommissioning.md) | ✅ |
| 8.11 | Data masking | Applicable | `ai.py` `redact_identifiers` masks identifiers before LLM prompts; the Advisor guard's *redact* mode is opt-in (default *audit*) | 🟡 |
| 8.12 | Data leakage prevention | Applicable | gitleaks; egress-blocked CI jobs; Advisor pre-egress guard defaults to *audit*, not *block* (crosswalk gap G-4) | 🟡 |
| 8.13 | Information backup | Applicable | [`backup-recovery.md`](backup-recovery.md); `netlify/functions/risk-backup.js`; `scripts/retain-state.mjs`. Durable evidence store still open (open action 23) | 🟡 |
| 8.14 | Redundancy of information processing facilities | Applicable | Hosting redundancy inherited; retry and backstop firings for scheduled screening | ⬆️ |
| 8.15 | Logging | Applicable | Hash-chained activity log; MCP audit trail without argument values; structured function-error logging | ✅ |
| 8.16 | Monitoring activities | Applicable | `anomaly-watch.yml`, `function-health.yml`, `site-health.yml`, `delivery-watchdog.yml`, `governance-report.yml` | ✅ |
| 8.17 | Clock synchronisation | Applicable | Platform clocks (GitHub Actions, Netlify) | ⬆️ |
| 8.18 | Use of privileged utility programs | ⛔ Proposed exclusion | Serverless estate: no organisation-managed hosts on which utility programs run. CI runners are ephemeral. Re-open if a managed host enters scope | ⛔ |
| 8.19 | Installation of software on operational systems | Applicable | Production changes only through CI deploy workflows (`netlify-production-deploy.yml`); no runtime dependencies to install | ✅ |
| 8.20 | Networks security | Applicable | No organisation-managed network. CI egress is blocked by harden-runner; site security headers are set in `netlify.toml` | 🟡 |
| 8.21 | Security of network services | Applicable | TLS with HSTS and isolation headers (`netlify.toml`) | ✅ |
| 8.22 | Segregation of networks | ⛔ Proposed exclusion | No organisation-managed network to segregate; environment separation is covered under 8.31 | ⛔ |
| 8.23 | Web filtering | ⛔ Proposed exclusion (estate) | No managed network or endpoints in this scope. Staff browsing is a firm-endpoint matter (8.1) | ⛔ |
| 8.24 | Use of cryptography | Applicable | AES-GCM at rest (`app.js`); TLS in transit; Sigstore release attestation; HMAC receipt chain | ✅ |
| 8.25 | Secure development life cycle | Applicable | [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md); CI gates; ADRs | ✅ |
| 8.26 | Application security requirements | Applicable | Pure-`'self'` CSP ([ADR-003](adr-003-pure-self-csp.md), `test/csp.test.mjs`) | ✅ |
| 8.27 | Secure system architecture and engineering principles | Applicable | [`../architecture.md`](../architecture.md) (including STRIDE); ADR set | ✅ |
| 8.28 | Secure coding | Applicable | Semgrep bans (`.semgrep/hawkeye.yml`); ESLint; ruff; Bandit | ✅ |
| 8.29 | Security testing in development and acceptance | Applicable | `dast-zap.yml`; prompt-injection red team in CI (`test/redteam_injection.py`); the full test suite | ✅ |
| 8.30 | Outsourced development | Applicable | AI-assisted changes arrive as PRs through the same CI gates. No independent human review while the single-maintainer bypass applies (5.3) | 🟡 |
| 8.31 | Separation of development, test and production environments | Applicable | Netlify deploy previews per PR versus production; protected `release` environment | ✅ |
| 8.32 | Change management | Applicable | PRs with required status checks on a protected branch; admin bypass logged (5.3) | 🟡 |
| 8.33 | Test information | Applicable | Synthetic fixtures only; no real customer or transaction data may be committed (`txn_feed.py` header) | ✅ |
| 8.34 | Protection of information systems during audit testing | Applicable | ZAP *baseline* (passive) scan of the live site. No written agreement procedure for active or audit testing | 🟡 |

## Summary (as drafted)

One status per control, counted from the tables above. A split row
(⬆️ / ❓) is counted under ❓, because part of that control is unevidenced.

| Status | Controls |
|---|---|
| ✅ Implemented with evidence | 30 |
| 🟡 Partial | 33 |
| ❓ Not evidenced here | 20 |
| ⬆️ Inherited only | 7 |
| ⛔ Proposed exclusion | 3 |
| **Total** | **93** (37 organisational · 8 people · 14 physical · 34 technological) |

These are this draft's own tally, not an audit result. Recount from the tables
before quoting a figure, since any edit to a row changes them.

## Proposed next steps (for the MLRO, none adopted here)

1. Decide scope and each applicability proposal, especially the three ⛔ rows.
2. Board approval of the draft policies (open action 18) moves most 🟡 rows that rest on them.
3. Close the real gaps first: an information classification scheme (5.12), a
   remote-working policy (6.7), an endpoint baseline (8.1), and an independent
   review (5.35).
4. Obtain and file the hosting providers' assurance reports so ⬆️ rows rest on
   evidence, not assertion.
