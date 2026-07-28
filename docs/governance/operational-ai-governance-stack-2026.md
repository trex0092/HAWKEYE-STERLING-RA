# Operational AI Governance Stack — Five-Level Scorecard (2026)

**Subject:** Hawkeye Sterling suite (RA scoring engine, Advisor, operations console) **and** the
Asana automation layer (GitHub Actions watchers + assessment delivery).
**Assessed against:** the five-level *Operational AI Governance Stack* (visibility → operational
monitoring → governance controls → governance evidence → continuous operational governance).
**Date:** 2026-07-28 · **Prepared by:** Compliance engineering · **Owner:** MLRO

**Status key:** ✅ strong · 🟡 partial / analogue · 🔴 weak (applicable, open) · N-A not applicable.

> **Companion docs:** the summary mapping lives in the
> [frameworks crosswalk §C](ai-frameworks-crosswalk-2026.md); the Level-4 evidence types are
> indexed artefact-by-artefact in the [assurance coverage matrix](assurance-coverage-matrix.md)
> §1.10; the six-*layer* practitioner view (a different slicing of the same territory) is scored in
> [`agentic-ai-governance-6layers-2026.md`](agentic-ai-governance-6layers-2026.md); the
> seven-stage operating loop in
> [`operational-ai-governance-lifecycle.md`](operational-ai-governance-lifecycle.md).
> What is and isn't AI here is defined once, in the 6-layer doc, and is not repeated.

---

## Operating principle, and where this system stands in it

The stack's causal chain: **visibility enables monitoring; monitoring enables control; control
produces evidence; evidence enables continuous governance.** Its key distinction — monitoring shows
*what happened*; governance evidence proves *why, who authorised it, whether a human intervened,
and that this is independently verifiable*.

Levels 1–2 are where AI-agent-governance *platforms* (CloudFuze-class discovery/monitoring tooling)
position themselves. That tooling solves a **scale** problem — hundreds of platform-built agents
sprawling across business units. This estate deliberately does not have that problem: the AI
surfaces are few, fully enumerated, and gated by the register (no AI surface deploys unregistered),
so Levels 1–2 are satisfied by the register + runtime guards rather than by discovery tooling.

## Scorecard

| # | Level | Status | One-line basis |
|---|-------|--------|----------------|
| 1 | Visibility | ✅ | Register + CI shadow-AI scan; fully-enumerated estate |
| 2 | Operational monitoring | ✅ | Runtime guards + live evals + loud failure paths (conversation monitoring N-A by design) |
| 3 | Governance controls | ✅ | AUP gate, kill switch, named ownership, lifecycle incl. register-review enforcement |
| 4 | Governance evidence | ✅ | All six evidence types satisfied and indexed (matrix §1.10) |
| 5 | Continuous operational governance | ✅ | Daily card + GovernanceScore, KPI catalog, CAPA loop, readiness self-assessments |

## Level 1 — Visibility
*"Governance cannot begin without knowing what exists."*

| Tile | Status | Evidence |
|---|---|---|
| AI agent discovery | ✅ | Small, fully-enumerated codebase; CI shadow-AI scan: every model-API caller must be a registered surface or an allowlisted eval harness (`test/ai-assets.test.js`) |
| Asset inventory | ✅ | [`data/ai-assets.json`](../../data/ai-assets.json) + [`ai-asset-register.md`](ai-asset-register.md) + [`../aims/ai-system-inventory.md`](../aims/ai-system-inventory.md) |
| Shadow-AI detection | ✅ | Register `shadow_ai_note` + onboarding gate + the CI scan above — a new surface fails CI until registered |
| AI asset catalog | ✅ | Register rows carry classification, autonomy, risk tier, owner, controls, status — schema-guarded in CI |

**Verdict:** ✅. Discovery *tooling* is N-A at this scale (see the deliberate non-controls); the
register gate is the control, and CI enforces it.

## Level 2 — Operational monitoring
*"Governance is increasingly a runtime discipline."*

| Tile | Status | Evidence |
|---|---|---|
| AI activity monitoring | ✅ | Runtime guards in `brain-soul.js` (`piiFlagged` / `structureFlagged` / `budgetFlagged`); Advisor audit line on every exchange; daily `function-health` probe |
| Permission analysis | ✅ | The Advisor holds **no tool permissions at all** (advisory chat only; server-held key); automation permissions are least-privilege per workflow, lint-enforced (actionlint + zizmor) with egress-blocked runners — see [`github-repository-hardening.md`](github-repository-hardening.md) |
| Conversation monitoring | N-A | Deliberate non-control — exchanges are ephemeral by design (data-minimisation; retention would create a PDPL liability with no proportionate benefit). See the non-controls section |
| Knowledge-source analysis | ✅ | Sources pinned and watched: [`data/sanctions-sources.json`](../../data/sanctions-sources.json), 22 regulatory sources under regulatory-watch (incl. the EU AI Act page); staleness caught daily (`freshness-check`); Advisor egress is data-minimised |
| Risk alerts | ✅ | Every failure path alerts loudly — Asana card, red run, or GitHub-issue fallback; *silence is never success* ([coverage matrix §2](assurance-coverage-matrix.md)) |

**Verdict:** ✅ for everything the estate actually runs; the one absent tile is absent on purpose,
with the rationale written down.

## Level 3 — Governance controls
*"Policy enforcement, ownership, risk controls, lifecycle, approvals."*

| Tile | Status | Evidence |
|---|---|---|
| Policy enforcement | ✅ | AUP acknowledgment gate **enforced in-app** (`hsra.aup.ack.v1`, [`ai-acceptable-use-policy.md`](ai-acceptable-use-policy.md)); tipping-off and PII guards enforced at runtime, not on paper |
| Ownership | ✅ | MLRO accountable / Compliance Engineering operational — per register row and per document header |
| Risk controls | ✅ | [`../aims/ai-risk-register.md`](../aims/ai-risk-register.md) R-01…R-20 with inherent/residual scoring; hard outcomes (PROHIBITED / mandatory-EDD floors) cannot be overridden downward; kill switch (`ADVISOR_ENABLED`) |
| Lifecycle management | ✅ | [`../aims/decommissioning.md`](../aims/decommissioning.md); retention auto-purge ([`data-retention.md`](data-retention.md)); register review currency now **enforced daily** by the governance report (REVIEW OVERDUE past the 100-day window — closed 2026-07-28) |
| Approval workflows | ✅ | CODEOWNERS-gated change control; protected `release` environment gate; MLRO four-eyes alerts; quarterly sign-offs ([`model-validation-2026.md`](model-validation-2026.md)) |

**Verdict:** ✅. The abandoned-asset failure mode the stack warns about (agents outliving their
projects with live permissions) is closed twice: assets can't exist unregistered, and the register
itself can now only rot loudly.

## Level 4 — Governance evidence
*"Monitoring tells us what happened. Evidence demonstrates why, who authorised it, and that it can
be independently verified."*

All six evidence types are satisfied by artefacts that predate this assessment; the
[coverage matrix §1.10](assurance-coverage-matrix.md) indexes each type → artefact → automated
proof → where an examiner finds it.

| Tile | Status | Artefact (see matrix §1.10 for proof + location) |
|---|---|---|
| Governance decision ledger | ✅ | [`open-actions-register.md`](open-actions-register.md) + minuted decisions + [ADR-001](adr-001-deterministic-vs-learned.md) |
| Runtime evidence | ✅ | Tamper-evident hash-chained activity log; workflow run logs; daily governance card |
| Human override records | ✅ | One-way analyst override with mandatory justification, written to the chained log |
| Authorization chain | ✅ | MLRO sign-off + dual attestation; CODEOWNERS; ratification signatures ([`ai-policy.md`](ai-policy.md) §9) |
| Independent audit evidence | ✅ | Tokenised exports verifiable off-app; Sigstore attestations + SBOM; SARIF artefacts |
| Decision provenance | ✅ | Contributing factors behind every score; versioned risk data; Advisor line "decision support, not a decision" |

**Verdict:** ✅. This is the stack's claimed novel layer, and it is the layer this system was
*built around*: the hash-chained log and the override ratchet exist because AML examiners ask
exactly the "prove who authorised it" question.

## Level 5 — Continuous operational governance
*"An operational management capability, not an annual audit exercise."*

| Tile | Status | Evidence |
|---|---|---|
| Continuous assurance | ✅ | CI gate on every push; daily/weekly scheduled controls with STALE fail-safe; [coverage matrix](assurance-coverage-matrix.md) maps every claimed control to its proof |
| Governance metrics (GovernanceScore) | ✅ | Composite 0–100 in the daily governance card's title and body, with Δ vs the previous report (`scripts/governance-report.mjs`, added 2026-07-28); KPI catalog in matrix §3 |
| Executive reporting | ✅ | [Executive brief](../executive/executive-brief.md) + [KPI dashboard](../executive/kpi-dashboard.md); weekly summary card; daily governance + compliance briefs |
| Continuous improvement | ✅ | CAPA loop ([`../aims/corrective-actions.md`](../aims/corrective-actions.md)); [open-actions register](open-actions-register.md); postmortem template; quarterly [management review](../aims/management-review.md) feeding stage 1 of the [operating loop](operational-ai-governance-lifecycle.md) |
| Regulatory readiness | ✅ | NIST AI RMF / ISO 42001 / UAE AI Charter self-assessments; [readiness review](enterprise-readiness-review-2026.md); examiner-first design of the coverage matrix; [internal audit programme](../aims/internal-audit.md) tests the map itself |

**Verdict:** ✅.

---

## Deliberately **not** implemented — and why

- **Conversation monitoring (L2 tile).** Advisor exchanges are ephemeral by design. Retaining and
  monitoring them would invert the data-minimisation posture ([DPIA](dpia-2026.md),
  [PDPL assessment](../aims/pdpl-data-processing-assessment.md)) and create a personal-data
  processing liability with no proportionate benefit for a single-operator, human-in-the-loop tool.
  The governance need it serves elsewhere — knowing the AI behaved — is met by the runtime guards,
  the audit line, and the weekly live eval against the real model.
- **Discovery / permission-analysis tooling (the platform tiles of L1–L2).** CloudFuze-class
  tooling exists to find and watch *unknown* agents at enterprise scale. This estate has no unknown
  agents by construction: the register gate + CI shadow-AI scan make an unregistered surface a
  build failure, not a discovery problem. Buying a discovery layer here would be governance
  theatre.
- **Re-trigger for both decisions:** adoption of platform-built agents (Copilot Studio, Vertex AI,
  or similar), any agent gaining tool/action permissions, or a second operator. Any of these
  reopens this document — register first, then re-score.

## Overall verdict

**Aligned across all five levels**, including full coverage of the stack's distinguishing Level-4
evidence types. The two absent tiles are deliberate, documented non-controls with named re-trigger
conditions — absence with a rationale, not a gap. Remaining exposure is the same as the 6-layer
assessment: evidence *maturity* (history accrues with each cycle), not missing controls.

**Re-review** whenever an AI surface is added or changed (update the register first), when the
Advisor's models change, if a backend or a second operator is introduced, or on any re-trigger
above.
