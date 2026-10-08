# Screening open-source adoption register

Updated: 2026-09-29

This register records external repositories reviewed while improving HAWKEYE screening. It distinguishes architectural influence from code/data import. No third-party sanctions or PEP production dataset is imported by this change set.

## Implemented capabilities mapped to external repositories

| # | Repository | Observed licence metadata | Capability implemented natively in HAWKEYE | Live integration |
|---:|---|---|---|---|
| 1 | opensanctions/opensanctions | MIT code repository | Per-hit provenance completeness, source IDs and evidence URLs | `scripts/screening-intelligence.mjs::provenanceCompleteness`; persisted on sanctions/PEP/media hits |
| 2 | opensanctions/yente | MIT | Query-by-example structured screening profile | `queryByExample`; attached to every flagged subject's decision-support record |
| 3 | opensanctions/nomenklatura | MIT | Canonical entity fingerprint and alias clustering | `canonicalFingerprint` + `aliasCluster`; persisted to state/case evidence |
| 4 | moj-analytical-services/splink | MIT | Explainable field-level evidence weighting | `evidenceWeightedConfidence`; name + identity + provenance + independent corroboration |
| 5 | checkmarble/marble | NOASSERTION in GitHub metadata | Deterministic case priority and review SLA | `casePriority`; rendered on Asana case cards and daily digest |
| 6 | FinCrimeRadar/fincrimeradar | No licence metadata exposed by GitHub | Sanctions/PEP/adverse-media cross-domain fusion | `domainFusion`; rendered in Asana evidence |
| 7 | vyayasan/kyc-analyst | MIT | Human-verification checklist with explicit missing evidence | `analystChecklist`; missing evidence shown on case cards |
| 8 | plutopulp/adverse-media-screening | No licence metadata exposed by GitHub | Article evidence quality scoring using source tier + identity + provenance | `articleEvidenceQuality`; stored in decision-support evidence |
| 9 | AbgarSim/sieve-aml | MIT | Screening-source/ingest diagnostics and provenance coverage metric | `sourceDiagnostics`; case evidence reports incomplete provenance |
| 10 | alephdata/followthemoney | MIT | Typed entity projection for Person/Organization screening subjects | `typedEntity`; persisted in decision-support record |
| 11 | alephdata/aleph | MIT | Subject → hit → source relationship graph | `relationshipGraph`; persisted for investigative traceability |
| 12 | intuon-technologies/AML | Apache-2.0 | Normalized local-watchlist adapter | `localWatchlistAdapter`; shared internal entity shape for firm-owned watchlists |

All 12 capabilities are implemented without adding a runtime dependency. The main integration points are:

- `scripts/screening-intelligence.mjs` — native implementation of the adopted patterns.
- `scripts/sanctions-screen.mjs` — attaches decision-support evidence to live flagged subjects, state, and results artifacts.
- `scripts/screening-cases.mjs` — renders case priority, SLA, confidence factors, cross-domain evidence, provenance coverage, missing evidence, and subject fingerprint into Asana case cards and the daily screening digest.
- `test/screening-intelligence.test.mjs` — offline regression coverage for every adopted capability.
- `.github/workflows/ci.yml` — executes the intelligence regression suite on every CI run.

## Earlier screening improvements retained

1. Structured identity corroboration uses available CDD attributes in addition to name similarity: nationality/jurisdiction, DOB, passport/registration identifiers, and entity type.
2. Contradictory identity evidence is retained for analyst review and never suppresses an existing sanctions hit.
3. PEP matches carry structured corroboration and Wikidata entity references.
4. Adverse-media matches carry identity-evidence level, source and evidence URL.
5. Sanctions hits carry configured source provenance where available.
6. CDD principal parsing preserves nationality, DOB and passport fields for screening.
7. The yente comparison remains shadow/benchmark-only; it is not the operative matcher.
8. opensanctions/rigour (MIT) is benchmark-only too: `.github/workflows/arabic-name-bench.yml` measures its cross-script name symbols on UN Latin/Arabic gold pairs. It is installed only in that CI job (its dependency python-stdnum is LGPL-2.1, used unmodified as a library) and is never imported by the engine.
9. moov-io/watchman (Apache-2.0) is a second shadow benchmark engine beside yente: `.github/workflows/watchman-bench.yml` scores it on the repo's own fixtures with no government list loaded. It is not the operative matcher.

## Licensing and supply-chain boundary

- No OpenSanctions production dataset is imported by this work. Software repository licence and data licence are treated as separate questions.
- Repositories without clear licence metadata are idea/reference sources only. No source code is copied from them.
- No third-party matcher replaces HAWKEYE's live matcher without benchmark evidence and model-validation/change-control approval.
- No new runtime package is added. The implementation remains dependency-free at runtime.
- No adverse-media LLM is added to the operative screening decision path. Deterministic evidence remains authoritative.
