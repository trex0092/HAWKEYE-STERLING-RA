# GRC ↔ Cybersecurity — One Integrated Model

Different focus, same goal. **Cybersecurity builds the defenses; GRC ensures the
right defenses are built, monitored and continuously improved.** This note is
the honest map of how the two lenses divide the work in this repository — and
where they deliberately meet, because a resilient system integrates both rather
than choosing.

## The two lenses

|  | **GRC** — sets direction, manages risk, ensures compliance, drives value | **Cybersecurity** — protects, detects, responds |
|---|---|---|
| Focus | Governance · Risk · Compliance · Strategy · Value | Protection · Detection · Response · Technology · Threats |
| Asks | Are we managing risk effectively? Are we compliant? Do controls deliver measurable value? | Are systems protected? Can we detect and respond quickly? Are data and assets secure? |
| Fails how | Compliant on paper, unverified in practice | Strong tooling, no way to *prove* or prioritise it |

## What GRC does here

- **Defines policies and governance frameworks** — [AI policy](ai-policy.md),
  [acceptable-use policy](ai-acceptable-use-policy.md), the
  [ISO/IEC 42001 SoA](iso-42001-soa-2026.md) and the
  [framework crosswalks](ai-frameworks-crosswalk-2026.md).
- **Assesses and manages risks across the organization** — the
  [AI risk register](../aims/ai-risk-register.md) (R-01…R-20, inherent →
  residual on a 5×5), the [DPIA](dpia-2026.md), the
  [gap analysis](ai-governance-gap-analysis-2026.md).
- **Ensures compliance with laws, regulations and standards** — the Regulatory
  Watch + FATF Watchdog pipelines, the quarterly methodology review, the
  [EU AI Act](eu-ai-act-assessment-2026.md) and
  [UAE AI Charter](uae-ai-charter-mapping-2026.md) assessments.
- **Monitors performance and reports to stakeholders** — the daily AI Governance
  Report and weekly summary, the README control badges, the
  [board minute template](board-minute-template-2026-07.md) and the
  [management review](../aims/management-review.md).
- **Aligns security and risk with business objectives** — treatments and target
  dates in the [open-actions register](open-actions-register.md) and
  [CAPA log](../aims/corrective-actions.md), prioritised by residual score.

## What cybersecurity does here

- **Protects systems, networks and data** — pure-`'self'` CSP with enforced
  Trusted Types and full isolation headers (`netlify.toml`), zero runtime
  dependencies, egress-blocked Actions jobs, secret masking and a no-egress
  default for customer data.
- **Prevents, detects and responds to threats** — CodeQL, Semgrep, gitleaks,
  osv-scanner, dependency review + Dependabot, DAST (ZAP), container CVE scans,
  and a standing prompt-injection red-team in CI.
- **Manages security technologies and tools** — workflow lint (actionlint +
  zizmor at zero findings), OpenSSF Scorecard, pinned actions, and the
  [security tooling reference](../security/tooling-reference.md) that says
  honestly what is in and out of scope.
- **Investigates incidents and mitigates attacks** — the
  [AI incident runbook](ai-incident-runbook.md) and
  [postmortem template](incident-postmortem-template.md), Anomaly Watch
  escalation, and the [code-scanning triage log](../security/code-scanning-triage-2026-07.md).
- **Ensures confidentiality, integrity and availability** — tamper-evident
  activity log, atomic writes and off-device backups, weekly site-health render
  check, and Sigstore build-provenance attestation on releases.

## The integration loop (the point of this note)

Each security control exists because a governance artifact demands it, and each
governance artifact is only credible because a control enforces it:

| GRC states the risk | Cybersecurity enforces | GRC proves it stays enforced |
|---|---|---|
| R-07 secret leakage | gitleaks + Semgrep secret rules, `_mask` | freshness check + daily governance report (STALE flag) |
| R-02 prompt injection | `detect_injection` + CI red-team per build | weekly Advisor guardrail eval, filed to Asana on regression |
| R-19 unauthorized AI access | key gate, kill switch, `APP_SHARED_TOKEN`, RBAC | [hardening checklist](github-repository-hardening.md) rows attested with evidence |
| R-16 regulatory drift | (not a technical control) | Regulatory Watch + quarterly review, auto-filed |

Findings from either side land in the same place — the CAPA log and the
management review — and [internal audit](../aims/internal-audit.md) walks both
directions: controls without a governing risk row, and risk rows whose controls
stopped running.

**Can an organization be secure without a mature GRC framework?** It can deploy
strong tooling — but it cannot *know* it is secure, prioritise what to fix next,
or show an examiner why its posture is sufficient. Assurance is a governance
artifact. In this repository neither layer ships without the other: the badges
are the visible seam.
