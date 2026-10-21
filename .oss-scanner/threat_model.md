# HAWKEYE STERLING security-audit scope

This is an audit environment for an AML/CFT decision-support application,
not a production deployment or a regulatory certification. Follow SECURITY.md
for severity, private reporting and owner review. Preserve the repository's
proprietary license. This preparation does not represent accepted enrollment.

## Assets and trust boundaries

Protect screening population completeness, entity/principal identity mappings,
source provenance, alert continuity, confidential records, server-side secrets,
and the distinction between machine findings and human adjudication.
Treat Asana task fields and pagination, provider payloads, RSS/JSON/XML/CSV
sources, document fields, browser requests, and model-generated text as untrusted.
Test only this repository's code using synthetic identities and mocked sources.
No production Asana access, state-branch checkout, credentials or real customer,
employee, beneficial-owner or case data may be supplied to this environment.

## Prioritized investigations

1. Silent population truncation, repeated cursors, identity collisions, omitted
   owners/principals and incorrect organization/person classification.
2. XML/entity expansion, malformed payloads, unsafe URLs, injection, path
   traversal and unbounded resource consumption in screening source parsers.
3. Timeouts, rate limits, invalid HTTP 200 payloads or partial sources being
   converted to clean negatives, or standing matches being silently cleared.
4. PEP identity loss across multilingual labels, aliases, redirects, sitelinks
   and explicit name claims. Missing identities must remain explicit exceptions.
5. Fabricated, stale, inconsistent or commit-mismatched assurance evidence;
   under-floor sanctions data; per-subject provider receipt/accounting errors.
6. Unauthorized state changes, confidential data disclosure and tampering in
   delivery, persistence, authentication and authorization code.
7. Prompt injection that could bypass deterministic gates or human case review.

## Code and tests

Begin with scripts/sanctions-screen.mjs, scripts/sanctions-match.mjs,
scripts/adverse-media.mjs, scripts/pep-worldwide.mjs,
scripts/screening-assurance.mjs, scripts/screening-cases.mjs,
scripts/screening-delivery.mjs, screen.py and kyc.py.
The source and dependencies are at /src. The Dockerfile preinstalls Python,
Node dependencies and Playwright browsers. Its named regression suites must
pass without network access. Additional tests can be run from /src.

## Reporting and boundaries

Reports require the audited commit, affected file/lines, a minimal synthetic
reproducer, expected versus actual behavior, impact and a proposed regression
and patch. A finding is not verified merely because a model generated it.
Report a demonstrated false-clear or mandatory-control bypass as a candidate
critical finding under SECURITY.md; final severity remains the owner's decision.
Keep vulnerability reports private through the contact in SECURITY.md.

Do not attack providers, bypass their access limits, change source approvals,
weaken thresholds, modify licensing or make MLRO case decisions. Do not alter
production publishing settings. A successful build or security scan cannot
attest live sanctions/news/PEP source availability, population completeness,
sourceQuality, evidence freshness, commit alignment or Combined Screening
Assurance. Those require their own runtime evidence and independent checks.
