# data/ — provenance and ownership

What each file is, **who writes it**, and what stale means. Three classes:
**curated** (a human maintains it; staleness is gated), **registry** (hand-kept
inventory consumed by CI guards), and **state** (a workflow commits it;
staleness alarms loudly). Live sanctions lists (OFAC SDN + alt, UN, EU, UK
OFSI) are **never checked in** — they are fetched at run time inside GitHub
Actions from the URLs in `sanctions-sources.json`.

## Curated lists (human-maintained, gated)

| File | What / who / stale-means |
|---|---|
| `eocn-local-terrorist-list.json` | UAE EOCN local terrorist list, manually transcribed from the official source. **Gated:** the screen hard-fails when its review age exceeds `EOCN_REVIEW_MAX_AGE_DAYS`, and `eocn-reconcile.yml` cross-checks a mirror twice weekly |
| `dfat-curated-list.json` · `seco-curated-list.json` | Curated AU DFAT / CH SECO entries supplementing the fetched lists |
| `internal-watchlist.json` | The firm's own watchlist, screened alongside the official lists |
| `sanctions-extra.json` | Curated additions that the fetched lists don't carry yet |
| `jurisdiction-risk.json` | Country risk table used by KYC scoring (kyc.py) and the app |
| `phonetic-tables.json` · `translit-groups.json` · `corporate-stopwords.json` | Matcher reference data: phonetics, transliteration groups, corporate-suffix stopwords — recall-relevant, so changes must keep the benchmark floors (`test/fixtures/screening-benchmark/`) |
| `source-credibility.json` | Adverse-media source weighting |

## Registries (hand-kept, CI-parsed)

| File | What |
|---|---|
| `sanctions-sources.json` | The list-source registry (URLs, formats, floors) — its `_README` key is the in-file contract |
| `reg-sources.json` | Regulatory-watch source registry + per-source narratives |
| `obligations.json` | Obligation register: instrument → owner → controls → evidence (guard: `test/obligations.test.mjs`) |
| `policies.json` | Instrument register: owner, status, approval record (guard: `test/policies.test.mjs`; CI checks the *document*, not just the register) |
| `risk-appetite.json` | Appetite positions, ceilings, KRIs (guard: `test/grc-metrics.test.mjs`) |
| `compliance-calendar.json` | Dated compliance duties, filed as lead-time Asana reminders weekly |
| `ai-assets.json` · `prompt-assets.json` · `tool-surfaces.json` | AI-surface, prompt and tool/connector inventories (agentic-governance layers 1–2; guard: `test/ai-assets.test.js`) |

## State (workflow-committed; staleness alarms)

| File | Written by |
|---|---|
| `sanctions-state.json` | `sanctions-watch.yml` (daily): per-source content fingerprints; `updated` moves only when a list actually changes |
| `fatf-state.json` | `fatf-watchdog.yml`: last-seen FATF black/grey lists |
| `reg-watch-state.json` + `reg-watch-snapshots/` | `regulatory-watch.yml`: content fingerprints + dated text snapshots of ~22 regulator sources |
| `sanctions-screen-state.json`(`.enc`) | Screening runs: last-seen matches (no re-alert spam) |
| `screen-delta-state.json`(`.enc`) · `screening-cases-state.json.enc` · `source-coverage-state.json`(`.enc`) · `adverse-media-evidence.json`(`.enc`) · `run-metrics.json`(`.enc`) | The daily screen's delta, case, coverage, evidence and metrics state |
| `tfs-update-log.json` | TFS list-update timeline (detection → rescreen; MLRO completes publication dates) |
| `risk-overrides-backup.json` | Monthly commit of the override-sheet mirror (the one off-device copy of officer work) |
| `grc-metrics.json` · `board-figures.json` | Generated snapshots — regen with `node scripts/grc-metrics.mjs --write` / `node scripts/board-figures.mjs --write`; CI runs both `--check` modes |

**Encryption.** Every `*.json.enc` is AES-256-GCM (scrypt) via
`scripts/state-crypto.mjs`; the plaintext twin is deliberately empty in-tree —
the real state lives only in the encrypted copy.

## retention/ — why the dates have gaps

`scripts/retain-state.mjs` (called by `sanctions-watch.yml`) writes an
immutable copy of `sanctions-state.json` named for the state's **`updated`**
date, plus a SHA-256 entry in the append-only `retention/manifest.json`.
A snapshot appears **only when a list fingerprint actually changed** —
retain-on-change, not retain-daily. A date gap therefore means "no designation
list changed" (the daily watcher still ran and stayed green), not "the control
stopped". A corrupt manifest fails loud rather than resetting — the chain is
tamper-evident, and FDL 10/2025 record-keeping is the reason it exists.
