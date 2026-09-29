# Screening open-source adoption register

Updated: 2026-09-29

This register records external repositories reviewed while improving HAWKEYE screening. It distinguishes architectural influence from code/data import. No third-party sanctions or PEP dataset is imported by this change set.

| Repository | Observed licence metadata | HAWKEYE use | Adoption status |
| --- | --- | --- | --- |
| opensanctions/opensanctions | MIT code repository | Source normalization, provenance, alias/entity modelling patterns | Architecture only; no OpenSanctions production dataset imported |
| opensanctions/yente | MIT | Bulk/entity matching and query-by-example benchmark pattern | Existing shadow benchmark retained; not promoted to primary matcher |
| opensanctions/nomenklatura | MIT | Entity resolution and canonical identity concepts | Native structured corroboration layer added |
| moj-analytical-services/splink | MIT | Multi-attribute probabilistic linkage concepts | Native weighted corroboration added; no Splink runtime dependency |
| checkmarble/marble | NOASSERTION in GitHub metadata | Case/audit lifecycle concepts | Reference only |
| FinCrimeRadar/fincrimeradar | No licence metadata exposed by GitHub | Sanctions/PEP/adverse-media architecture comparison | Reference only; no code/data imported |
| vyayasan/kyc-analyst | MIT | Human-in-the-loop checkpoints and deterministic evidence | Existing MLRO/four-eyes model retained |
| plutopulp/adverse-media-screening | No licence metadata exposed by GitHub | Article/entity/evidence separation | Native adverse-media identity evidence added; no code imported |
| intuon-technologies/AML | Apache-2.0 | On-prem screening/case architecture | Reference only |
| AbgarSim/sieve-aml | MIT | Small ingest-normalize-index-match pipeline | Reference only |
| alephdata/aleph | MIT | Investigative provenance and entity evidence | Hit provenance/evidence URLs added |
| alephdata/followthemoney | MIT | Entity property modelling | Structured identity fields carried through screening |

## Implemented from the review

1. Structured identity corroboration now uses available CDD attributes in addition to name similarity: nationality/jurisdiction, DOB, passport/registration identifiers, and entity type.
2. The layer is recall-monotone: contradictory identity evidence is recorded for analyst review but never suppresses an existing sanctions hit.
3. PEP matches now carry structured corroboration and their Wikidata entity reference.
4. Adverse-media matches now carry identity-evidence level plus source and evidence URL.
5. Sanctions hits now carry configured source provenance where available.
6. CDD principal parsing preserves nationality, DOB and passport fields for screening.
7. Offline regression tests and CI coverage protect the new behavior.
8. The existing yente benchmark remains shadow-only until measured results justify a governed matcher change.

## Explicit non-adoptions

- No OpenSanctions production dataset is imported by this work. Software repository licence and data licence are treated as separate questions.
- Repositories without clear licence metadata are reference-only.
- No third-party matcher replaces HAWKEYE's live matcher without benchmark evidence and model-validation/change-control approval.
- No adverse-media LLM is added to the live decision path; deterministic evidence remains the primary control.
