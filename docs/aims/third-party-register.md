# Third-Party / Vendor & DPA Register (AIMS A.10)

Processors and external services the AI system relies on, the data shared, the legal
basis/safeguard, and DPA status. Owner: MLRO / DPO. Review: annually + on change.

| Vendor | Service | Data shared | Direction | Safeguard / DPA | Notes |
|---|---|---|---|---|---|
| **Asana** | Customer database (read) + report/case delivery (write) | Customer records, UBOs, screening results | In + Out | Vendor DPA — **confirm on file** | Token is a repo secret; never in browser. System of record. |
| **Anthropic** | LLM grounded triage (optional) | Subject **name + one public headline** only | Out | Vendor DPA + this DPIA — **required before enabling key** | OFF by default (`ANTHROPIC_API_KEY` unset ⇒ no egress) |
| **Google (News RSS)** | Adverse-media search | Subject name + risk terms (query) | Out | Public service; no account; no PII beyond the queried name | No customer record sent |
| **Wikimedia (Wikidata)** | PEP detection | Individual name (query) | Out | Public CC0 API | No customer record sent |
| **GitHub (Actions)** | Compute runner, code, run history, secrets | Code + run logs (no customer record persisted in logs) | In + Out | GitHub DPA | harden-runner egress controls; secrets encrypted |
| **GitHub (gov-list hosts)** | OFAC/UN/EU/UK/EOCN/Canada downloads | None (public lists fetched) | In | Public sources | — |

## Actions / gaps
- [ ] **Confirm Asana DPA** on file and note ref here.
- [ ] **Sign Anthropic DPA** and attach this DPIA **before** provisioning the LLM key in production.
- [ ] Record data-residency region for each processor (PDPL).
- [ ] Annual re-review of this register; update on any new processor.

## Data-minimisation note
The only processors that receive any subject identifier are Anthropic (name + one
headline), Google, and Wikidata (name only). **No processor receives the full
customer record.** All other processing is on-runner with no egress.
