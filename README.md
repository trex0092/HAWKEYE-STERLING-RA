# Hawkeye Sterling — Entity Risk Assessment (RA)

A single-file web application for **AML/CFT customer (entity) risk assessment**, built as a template for **Dealers in Precious Metals and Stones (DPMS)** and adaptable to other reporting entities.

The entire application lives in [`index.html`](index.html) — no build step, no dependencies, no backend. It runs offline, deploys to any static host, and keeps all data on the user's device.

## Features

- **Structured risk scoring** across jurisdiction, business activity, onboarding channel, operational history, relationship duration, ownership/control/compliance questions, and supply-chain material sources (recycled and mined).
- **Live verdict** — total score, risk band (CDD / SDD / EDD), score bar, and a full per-factor breakdown table.
- **Critical-factor auto-escalation** — a "Yes" on sanctions (entity or individuals), terrorist financing, or proliferation financing forces an **EDD** outcome regardless of the numeric score, with a clearly labelled banner.
- **Assessment metadata** — auto-generated reference (`RA-YYYYMMDD-NNN`), assessment date, assessor name and role.
- **Expanded entity identification** — legal and trading names, registration/licence number, jurisdiction, registered address, website/email.
- **Analyst notes & rationale** — free-text section included in the printed report.
- **Sign-off & review** — completed-by / approved-by (MLRO) fields with dates, plus an auto-suggested next review date based on the risk band (editable).
- **Print-ready report** — a dedicated print layout (A4) with entity details, full factor breakdown, verdict, notes, signature lines, and disclaimer. Use *Print report* → save as PDF.
- **Persistence** — drafts autosave to the browser (`localStorage`) and are restored on reload; assessments can be exported/imported as JSON for record-keeping.
- **Record completeness indicator** and automatic dark-mode support.

## Risk methodology

### Scored factors

| Factor | Scoring |
|---|---|
| Jurisdiction of incorporation & operation | Per-country score (1 Low / 2 Medium / 3 High) from the embedded country list |
| Nature & complexity of business activities | Per-activity score (Regulated Financial Entities = 1; trading, mining, refining, jewellery, wholesale/pawn = 3) |
| Ownership, control & compliance (11 questions) | Yes = 3, No = 1 — except *AML/CFT control adequacy*, which is inverted (Yes = 1, No = 3) |
| Onboarding channel | In-person = 1, Remote / non-face-to-face = 3 |
| Operational history & relationship duration | < 1 year = 3, 1 year = 2, 2+ years = 1 |
| Supply chain — recycled sources (×3 suppliers) | Per-material score 0–3 (e.g. LBMA Good Delivery = 1, gold-processing chemicals = 3) |
| Supply chain — mined sources (×3 suppliers) | LSM / MSM = 2, ASM (artisanal) = 3, N/A = 0 |

### Risk bands

| Total score | Band | Outcome | Suggested review cycle |
|---|---|---|---|
| 0–19 | **CDD** | Customer Due Diligence | 36 months |
| 20–22 | **SDD** | Simplified Due Diligence review | 24 months |
| 23+ | **EDD** | Enhanced Due Diligence | 12 months |

### Critical factors (automatic EDD)

A **Yes** answer to any of the following escalates the assessment to **EDD** regardless of the total score:

- Sanctions — beneficial owners, controllers, directors, or senior management
- Sanctions — the legal entity itself
- Terrorist financing connections
- Proliferation financing connections

The numeric score is still displayed unchanged; the escalation is shown as an explicit banner and reflected in the verdict and printed report.

## Data management & privacy

- **Autosave** — the working draft is saved to `localStorage` in the user's browser only; nothing is transmitted anywhere.
- **Export / Import** — the full assessment (inputs + computed result) round-trips as a JSON file named after the reference (e.g. `RA-20260611-001.json`).
- **Print report** — produces an audit-ready PDF via the browser's print dialog.

## Getting started

**Open directly** — download `index.html` and open it in any modern browser.

**Serve locally:**

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

**Deploy** — push to any static host (GitHub Pages, Netlify, S3, …). The app is a single `index.html` at the repository root, so no configuration is required.

## Project structure

```
.
├── index.html   # The complete application (markup, styles, data, logic)
└── README.md
```

## Disclaimer

This tool is for **internal compliance use only**. It supports — and does not replace — professional judgement, firm policy, and applicable AML/CFT regulatory obligations. Country, activity, and material risk scores are template values sourced from the firm's risk data sheet and should be reviewed and maintained by the compliance function.
