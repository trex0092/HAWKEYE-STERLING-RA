# Third-Party / Vendor & DPA Register (AIMS A.10)

Processors and external services the AI system relies on, the data shared, the legal
basis/safeguard, and DPA status. Owner: MLRO / DPO. Review: annually + on change.

| Vendor | Service | Data shared | Direction | Safeguard / DPA | Notes |
|---|---|---|---|---|---|
| **Asana** | Customer database (read) + report/case delivery (write) | Customer records, UBOs, screening results | In + Out | Vendor DPA — **confirm on file** | Token is a repo secret; never in browser. System of record. |
| **Anthropic** | LLM grounded triage (optional) | Subject **name + one public headline** only | Out | Vendor DPA + this DPIA — **DPA PENDING signature; egress GATED OFF** until executed | Key now wired, so triage is held off by `vars.LLM_TRIAGE` (default `0`). Set `=1` only after the DPA is signed and the transfer basis (below) is confirmed. |
| **Google (News RSS)** | Adverse-media search | Subject name + risk terms (query) | Out | Public service; no account; no PII beyond the queried name | No customer record sent |
| **Wikimedia (Wikidata)** | PEP detection | Individual name (query) | Out | Public CC0 API | No customer record sent |
| **OpenSanctions** (`data.opensanctions.org`) | Bulk dataset downloads: EU FSF (primary), OFAC/UN mirror fallbacks, `peps` PEP-mirror fallback, `crime` adverse-exposure watchlist, `ae_local_terrorists` EOCN drift cross-check | **None** — pull-only bulk files; matching is on-runner; no name is ever sent | In | Bulk data is **CC-BY-NC 4.0** — a commercial production deployment needs an OpenSanctions licence before relying on the `peps`/`crime`/cross-check layers beyond resilience. Kill-switches: `PEP_MIRROR_FALLBACK=0`, `ADVERSE_WATCHLIST=0`, `EOCN_MIRROR_CROSSCHECK=0`. | Every mirror/watchlist result is provenance-marked in the report ("OpenSanctions mirror" / "watchlist") so the audit trail shows which source actually screened; the EOCN cross-check only ALARMS (local curated list stays the screening source). |
| **GitHub (Actions)** | Compute runner, code, run history, secrets | Code + run logs (no customer record persisted in logs) | In + Out | GitHub DPA | harden-runner egress controls; secrets encrypted |
| **GitHub (gov-list hosts)** | OFAC/UN/EU/UK/EOCN/Canada downloads | None (public lists fetched) | In | Public sources | — |

## Data residency (PDPL)
Declared/processing region per processor. Items marked **confirm** need written confirmation
from the vendor against the firm's contracted plan and recorded here.

| Processor | Processing region (declared) | Status |
|---|---|---|
| **Anthropic** | United States (API) | Confirm contracted region/zero-retention terms at DPA signing |
| **Asana** | US (Asana default; EU data centre available on plan) | **Confirm** the workspace's contracted region |
| **Google (News RSS)** | Global edge; query only (subject name) | No PII record stored; residency N/A |
| **Wikimedia (Wikidata)** | Global; query only (name) | No PII record stored; residency N/A |
| **OpenSanctions** | CDN download only — no query, no PII leaves the runner | Pull-only; residency N/A |
| **GitHub (Actions)** | US-hosted runners | Confirm runner region if EU residency is required |

## Actions / gaps
- [ ] **Confirm Asana DPA** on file and note ref here.
- [ ] **Sign Anthropic DPA** (authorised signatory) and attach this DPIA. ⚠ The
  `ANTHROPIC_API_KEY` secret was wired **ahead of** signature, so on 2026-06-29 the
  triage egress was **gated OFF** (`vars.LLM_TRIAGE` default `0`, applied in the
  screening workflows) to prevent an unauthorised cross-border transfer. **After
  signing**, record the DPA reference + date below and set the `LLM_TRIAGE` repo
  variable to `1` to re-enable.
- [x] Record data-residency region for each processor (PDPL) — see the table above; vendor-side
  regions still to be **confirmed** for Anthropic, Asana, and GitHub.
- [ ] Annual re-review of this register; update on any new processor.

## Anthropic DPA & cross-border transfer record  *(DRAFT — pending signature)*
> This block is **prepared for the firm's legal/compliance function to confirm and
> sign**. It is NOT evidence of an executed agreement until the reference and
> signatory below are completed by an authorised person. An AI assistant cannot
> execute the DPA; do not treat empty fields as satisfied.
>
> **Ready-to-sign pack:** [`anthropic-dpa-execution-pack.md`](anthropic-dpa-execution-pack.md)
> — processing schedule (Annex), PDPL transfer-basis assessment, and signature page.

| Field | Value |
|---|---|
| Processor | Anthropic, PBC |
| Agreement | Anthropic Commercial Terms / Data Processing Addendum | 
| DPA reference no. | _☐ to be completed on signature_ |
| Signed by (authorised signatory) | _☐_ |
| Date executed | _☐_ |
| Data exported | Subject name + one public adverse-media headline only (no full customer record) |
| Purpose / instruction | Grounded relevance/severity classification of a real headline; no generative prose in filed reports (`REPORT_ALLOW_LLM=0`) |
| Cross-border transfer basis (UAE PDPL Art. 22/23) | _Draft basis to confirm with counsel_: transfer to a processor under an adequate-safeguard contract (the executed Anthropic DPA incorporating the standard data-protection commitments), with data minimisation (name + headline only) and the DPIA on file. Confirm the specific PDPL mechanism (adequacy decision vs contractual safeguards vs explicit consent) before reliance. |
| Data residency | _☐ confirm Anthropic processing region_ |
| Retention at processor | Per Anthropic terms; no training on submitted data; content not retained by the firm |

## Data-minimisation note
The only processors that receive any subject identifier are Anthropic (name + one
headline), Google, and Wikidata (name only). **No processor receives the full
customer record.** All other processing is on-runner with no egress.
