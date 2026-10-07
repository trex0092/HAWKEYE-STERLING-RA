# Business Continuity & Resilience Plan (AIMS A.6)

**Owner:** MLRO (accountable) · system maintainer (operational)
**Approver:** MLRO · Registered as POL-32 in the [policy register](../governance/policy-register.md)
**Review cadence:** annually, and after any incident.

How the screening control keeps operating (or fails safely) under disruption.

## Resilience already built in
- **Degrade loudly:** a run that cannot screen never reports "all clear" — it shows
  the degraded module and/or opens a GitHub issue / Asana alert.
- **Freshness check (daily):** fails loudly + Asana alert if a mandatory-daily
  control has no successful run today.
- **Transport resilience:** Asana calls retry on 429/5xx (Retry-After); list parsers
  tolerate malformed rows; per-locale adverse fetch failures are skipped, not fatal.
- **Source redundancy:** 5 core sanctions lists + supplementary; LLM has a
  deterministic fallback on any error.
- **State:** delta-state committed to git (recoverable history).

## Scenarios & responses
| Scenario | Impact | Response | RTO |
|---|---|---|---|
| GitHub Actions outage | Daily run does not fire | Freshness-check flags it (when service returns) / manual dispatch on recovery | Same day |
| Asana outage | Report/cases cannot post | Engine retries; on persistent failure opens a GitHub issue; re-post on recovery | Same day |
| A sanctions source down | Reduced coverage | Per-list degrade flag; core-list failure ⇒ module DEGRADED (shown); manual review | Same day |
| LLM/Anthropic outage | Triage falls back | Deterministic triage used; report still posts | None (auto) |
| Bad deploy | Run fails | CI gates; revert commit; re-run | < 1 day |
| Runner timeout | No report | Parallelized sweep (minutes); 350-min cap; degrade-loudly | Same day |

## Backups & recovery
- Code + config + docs: git (GitHub). Delta-state: git history.
- Customer data: Asana (vendor-managed backups).
- Recovery: re-clone repo, ensure secrets present, dispatch the workflow.

## Manual fallback
If automation is unavailable, the MLRO performs screening via the source portals
(OFAC/UN/EU/UK/EOCN, goAML) and records it manually until service is restored —
the obligation is daily and must not lapse.

## Exercise record and current gap
The annual control-testing calendar requires a BCP/vendor-exit exercise. Risk
`R-17` also requires a second trained operator to demonstrate that the service
can be recovered and operated without the primary administrator.

No completed exercise record is present as of 2026-10-07. Open action 44 requires
a dated drill that identifies the second operator, records recovery and operating
steps performed, captures observed RTO, routes any findings into CAPA/open
actions, and records the next annual exercise date. A planned exercise is not
treated as operating evidence.
