# Third-Party / Vendor & DPA Register (AIMS A.10)

Processors and external services the AI system relies on, the data shared, the legal
basis/safeguard, and DPA status. Owner: MLRO / DPO. Review: annually + on change.

| Vendor | Service | Data shared | Direction | Safeguard / DPA | Notes |
|---|---|---|---|---|---|
| **Asana** | Customer database (read) + report/case delivery (write) | Customer records, UBOs, screening results | In + Out | Vendor DPA — **confirm on file** (open-actions item 35) | Token is a repo secret; never in browser. System of record. |
| **Anthropic** | LLM grounded triage (optional) | Subject **name + one public headline** only | Out | Vendor DPA + this DPIA. **Owner attestation dated 2026-07-16 reports execution, but the repository execution block below remains DRAFT with required fields blank. Treat the DPA as unverified/outstanding until item 36 reconciles the evidence.** Counsel's written transfer-basis confirmation also remains outstanding. | Owner reports `vars.LLM_TRIAGE` set to `1` on 2026-07-16 (attestation; no API read surface for repo variables from the recording session). Runtime enablement is not evidence of DPA execution. Item 42 separately verifies whether triage is currently ON and enforces the unsigned go-live checklist. |
| **Google (News RSS)** | Adverse-media search | Subject name + risk terms (query) | Out | Public service; no account; no PII beyond the queried name | No customer record sent |
| **Wikimedia (Wikidata)** | PEP detection: live per-name lookup, plus the weekly worldwide PEP harvest (`data/pep-worldwide.json`, ~424k office-holders) screened as a bulk net by both engines | Individual name (query, live lookup only) | Out | Public CC0 API; structured data released under CC0 (public domain) — no licence needed | No customer record sent; the bulk net matches on-runner |
| **OpenSanctions** (`data.opensanctions.org`) | Bulk dataset downloads, all optional: UK/EU/AU/CH and OFAC/UN mirror **fallbacks** (the official publishers' files are primary since 2026-10-03), `peps` PEP/RCA net, `crime` adverse-exposure watchlist, optional `debarment` / `regulatory` adverse nets (OFF unless the `ADVERSE_WATCHLIST_EXTRA` repository variable names them), the `sanctions` worldwide net, `ae_local_terrorists` EOCN drift cross-check, and 28 national-list mirrors in `data/sanctions-extra.json` | **None** — pull-only bulk files; matching is on-runner; no name is ever sent | In | Bulk data is **CC-BY-NC 4.0**; OpenSanctions states that businesses must acquire a data licence. **Licence-free mode:** the repository variable `OPENSANCTIONS_DATA=0` stops every download from this host in both engines (core lists then come from their official publishers only, the worldwide PEP net is the Wikidata harvest, and each switched-off net is named OFF in the report). Unset = on. Per-net kill-switches: `PEP_MIRROR_FALLBACK=0`, `ADVERSE_WATCHLIST=0`, `WORLDWIDE_SANCTIONS=0`, `EOCN_MIRROR_CROSSCHECK=0`. | Every mirror/watchlist result is provenance-marked in the report ("OpenSanctions mirror" / "watchlist") so the audit trail shows which source actually screened; the EOCN cross-check only ALARMS (local curated list stays the screening source). Licence-free mode loses the RCA (relatives / close associates) bulk net and the crime watchlist; the report says so. |
| **GitHub (Actions)** | Compute runner, code, run history, secrets | Code + run logs (no customer record persisted in logs) | In + Out | GitHub DPA | harden-runner egress controls; secrets encrypted |
| **GitHub (gov-list hosts)** | OFAC/UN/EU/UK/EOCN/Canada downloads | None (public lists fetched) | In | Public sources | — |
| **Composio** | Optional business-app orchestration across Asana, Gmail, Google Drive, Slack and GitHub | Only data required by an explicitly invoked connected-app tool, which may include email text, files/documents, messages, Asana task data or GitHub repository data | In + Out | **DPA / PDPL transfer basis must be confirmed before production enablement** | Default OFF with `COMPOSIO_ENABLED=0`. Project key and webhook secret stay server-side. It is not part of sanctions, PEP, adverse-media, scoring or runtime-assurance decisions. |

## Data residency (PDPL)
Declared/processing region per processor. Items marked **confirm** need written confirmation
from the vendor against the firm's contracted plan and recorded here.

| Processor | Processing region (declared) | Status |
|---|---|---|
| **Anthropic** | United States (API) | Confirm contracted region/zero-retention terms at DPA signing; open-actions item 36 |
| **Asana** | US (Asana default; EU data centre available on plan) | **Confirm** the workspace's contracted region; open-actions item 35 |
| **Google (News RSS)** | Global edge; query only (subject name) | No PII record stored; residency N/A |
| **Wikimedia (Wikidata)** | Global; query only (name) | No PII record stored; residency N/A |
| **OpenSanctions** | CDN download only — no query, no PII leaves the runner | Pull-only; residency N/A |
| **GitHub (Actions)** | US-hosted runners | Confirm runner region if EU residency is required |
| **Composio** | **Confirm contracted processing region** | Keep `COMPOSIO_ENABLED=0` until DPA, subprocessors, retention and UAE PDPL transfer basis are recorded |

## Actions / gaps
- [ ] **Confirm Asana DPA** on file, record the contracted processing region and note the evidence/ref here. Tracked as open-actions item 35.
- [ ] **Reconcile and verify the Anthropic DPA execution record** (authorised signatory/evidence) and attach this DPIA. The owner attestation and the blank execution block are not treated as equivalent evidence. Tracked as open-actions item 36. Open-actions item 42 separately verifies the live `LLM_TRIAGE` state and requires the AI impact-assessment go-live checklist to be completed or triage to be confirmed OFF. ⚠ The
  `ANTHROPIC_API_KEY` secret was wired **ahead of** signature, so on 2026-06-29 the
  triage egress was **gated OFF** (`vars.LLM_TRIAGE` default `0`, applied in the
  screening workflows) to prevent an unauthorised cross-border transfer. **After
  signing**, record the DPA reference + date below and set the `LLM_TRIAGE` repo
  variable to `1` to re-enable.
- [x] Record data-residency region for each processor (PDPL) — see the table above; vendor-side
  regions still to be **confirmed** for Anthropic, Asana, and GitHub.
- [ ] **Composio go-live gate:** confirm DPA, subprocessors, data retention, processing region and UAE PDPL transfer basis before setting `COMPOSIO_ENABLED=1`; record the approved business-app scopes and connected accounts.
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
The **current approved/default screening path** sends subject identifiers to
Anthropic (only when its separately approved opt-in is active), Google and
Wikidata. **No external model receives the full customer record by default.**
All other screening/matching is performed on-runner.

## OpenAI analyst digest candidate (NOT APPROVED, OFF by default)

The repository also contains an optional `scripts/openai-screening-enrichment.mjs`
path, which could send a **bounded sample of named sanctions/PEP/adverse-media
screening evidence** to OpenAI for a reviewer-facing note in the daily Asana
digest. This data is more sensitive than the single headline referenced for
Anthropic above. Its provider DPA, retention region, contractual and UAE PDPL
cross-border basis, ROPA and DPIA update, purpose/role permissions, and
processor/subprocessor scope are **not verified here**. Do not treat this
future processor as approved just because code or an API key exists.

The feature is explicitly **default OFF** in code and needs
`OPENAI_SCREENING_ENABLED=1` *and* a separately provisioned server-side
`OPENAI_API_KEY` before any named evidence egress is possible. Do **not**
enable it until MLRO/DPO/IT legal approval and the go-live controls above are
recorded; if approved, add OpenAI to the active processor and data-residency
tables above, refresh the generated GRC metric snapshot through its generator,
and re-ratify the DPIA. The existing signed DPIA does not constitute such an
approval. Neither a real key nor customer-screening evidence belongs in GitHub.
