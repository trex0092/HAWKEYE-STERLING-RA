---
name: screening-evidence-review
description: Verify Hawkeye Sterling worldwide sanctions, PEP and adverse-media screening against live GitHub Actions, screen-state assurance, and Asana source/project evidence. Use for failed screening, a request for 100% coverage, missing subjects, source-provider outages, or operational readiness claims.
---

# Screening Evidence Review

## Required inputs

- Exact target repository commit and GitHub Actions run ID; do not infer the commit from a workflow name.
- Latest persisted `screen-state/data/screening-assurance.json`, evidence timestamp, and run provenance.
- The source populations for review: Asana projects `1214107620220121` and `1216239131596624`. **Verify their actual contents, project membership, inclusion filters, pagination, inactive/completed-task handling and authorized purpose before asserting population completeness.** Do not assume these two project IDs are destinations.
- Asana compliance case/evidence destination: `1216203370612914`, subject to authorized section and task verification.

## Procedure

1. Read `.github/workflows/sanctions-screen.yml`, `.github/workflows/screening-assurance.yml`, `scripts/sanctions-screen.mjs` and `scripts/screening-assurance.mjs` at the exact commit.
2. Confirm the full-book scan finished. Compare the expected subject population (including the two Asana source projects) to deduplicated included subjects. Report excluded, unavailable, missing or unresolved records separately. Never silently shrink the denominator.
3. Read the **published** assurance record and its run provenance. Require actual sanctions-list floors, PEP harvest consumption, news-backbone responses, zero skipped/uncovered subjects, valid timestamps and fully reconciled source counts.
4. Distinguish a green CI test, a successful screening command and a green **independent Screening Assurance** check. One does not imply another.
5. Verify Asana case/evidence task IDs and attachments via remote read-back, project/section membership, and publication receipts. Reports can succeed while the underlying screening is degraded.
6. If any source coverage is absent, keep screening **DEGRADED/NOT OPERATIONAL**. Deliver the incomplete evidence to MLRO review and retain the exception. Never manufacture fallback coverage or convert an API timeout into a clean result.

## Deliverable

Report: repository SHA; screening run and evidence timestamp; expected vs screened vs uncovered counts; sanctions/PEP/media results; source outages and retry attempts; Asana evidence task links/receipts; failed checks; outstanding human actions. Use **PASS**, **FAIL**, or **NOT VERIFIED** per domain. A 100% claim requires live independent evidence, not a test simulation.

## Safety

Do not disclose names, IDs of screened individuals, sanctions hits, secrets or case notes in public CI logs. Do not alter Netlify. Do not change MLRO-owned dispositions, complete compliance tasks, suppress warnings, or weaken fail-closed sanctions gates.
