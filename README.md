# Hawkeye Sterling — Entity Risk Assessment (RA)

[![CI](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/ci.yml/badge.svg)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/ci.yml)

A single-file web application for **AML/CFT customer (entity) risk assessment**, built as a template for **Dealers in Precious Metals and Stones (DPMS)** and adaptable to other reporting entities.

**Live:** https://hawkeye-sterling-ra.netlify.app

The entire application lives in [`index.html`](index.html) — no build step, no dependencies, no backend. It runs offline, deploys to any static host, and keeps all data on the user's device.

## Features

- **Structured risk scoring** across jurisdiction, business activity, onboarding channel, operational history, relationship duration, ownership/control/compliance questions, and supply-chain material sources (recycled and mined).
- **Dark neon interface** — six numbered form sections beside a sticky risk-summary sidebar: an animated 270° SVG risk gauge, the required-diligence verdict with threshold chips, a 0–30 risk-position bar, and a collapsible per-factor score breakdown. Entrance and gauge animations respect `prefers-reduced-motion`.
- **Live verdict** — total score, numeric band (CDD / SDD / EDD), and boundary warnings one point below each band edge, recomputed on every change.
- **Hard outcomes** — designated-party exposure (sanctions on the entity or its principals, terrorist financing, proliferation financing) produces a **PROHIBITED — Do Not Onboard** verdict with freeze-and-report instructions; PEP exposure, FATF call-for-action jurisdictions, and the ASM/high-risk-country red flag force **mandatory EDD** regardless of the numeric score. Every escalation is shown with its reason and carried into the export and printed report.
- **Assessment metadata** — auto-generated reference (`RA-YYYYMMDD-NNN`), assessment date, assessor name and role.
- **Expanded entity identification** — legal and trading names, registration/licence number, jurisdiction, registered address, website/email, principals (beneficial owners / controllers / directors).
- **Analyst notes & rationale** — free-text section included in the printed report.
- **Sign-off & attestation** — first-line (assessed by) and second-line (reviewed & approved, MLRO) blocks with name, title, date, and signature lines under a formal attestation statement, plus an auto-suggested next review date based on the risk band (editable). A *Complete Assessment* toggle tracks draft/complete status.
- **Print-ready report** — a formal black/pink A4 letterhead report (exact-color printing) with the result box, hard-outcome notices, per-factor score chips across every section, notes, attestation, and signature blocks. Use *Print / Export PDF* → save as PDF.
- **Persistence** — drafts autosave to the browser (`localStorage`) and are restored on reload; assessments can be exported/imported as JSON for record-keeping.
- **Record completeness indicator** in the risk-summary sidebar.

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

### Numeric risk bands

| Total score | Band | Outcome | Suggested review cycle |
|---|---|---|---|
| 0–19 | **CDD** | Customer Due Diligence | 36 months |
| 20–22 | **SDD** | Simplified Due Diligence review | 24 months |
| 23+ | **EDD** | Enhanced Due Diligence | 12 months |

### Hard outcomes (override the numeric band)

The numeric score is always displayed unchanged; the operative outcome is layered on top, in strict priority order, with every reason shown in the banner, the JSON export, and the printed report.

**1 · PROHIBITED — Do Not Onboard.** A **Yes** on any designated-party question ends the assessment: do not onboard, freeze funds where held, and file a report with the FIU / relevant authority. No review date is suggested — the relationship is declined.

- Sanctions — beneficial owners, controllers, directors, or senior management
- Sanctions — the legal entity itself
- Terrorist financing connections
- Proliferation financing connections

**2 · Mandatory EDD floor.** When not prohibited, any of the following forces **EDD** regardless of the total score:

| Trigger | Basis |
|---|---|
| PEP exposure = Yes | FATF Recommendation 12 |
| Jurisdiction on the FATF call-for-action list (Iran, North Korea, Myanmar) | FATF public statements |
| Any mined source = ASM **and** jurisdiction risk score 3 | OECD Due Diligence Guidance, Annex II red flag |

**3 ·** Otherwise the numeric band applies.

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

**Deploy** — the Netlify project [`hawkeye-sterling-ra`](https://app.netlify.com/projects/hawkeye-sterling-ra) publishes the repo root as-is (`netlify.toml`, no build step). Link the repository to the project in the Netlify UI for continuous deploys, or deploy any other static host — the app is a single `index.html`.

## Tests

The scoring engine, hard-outcome escalations, persistence, and report rendering are covered by a dependency-free test suite that executes the app's full inline script against a DOM stub:

```bash
node test/app.test.js   # 77 checks
```

CI runs the suite on every push and pull request (`.github/workflows/ci.yml`).

## Project structure

```
.
├── index.html                  # The complete application (markup, styles, data, logic)
├── test/app.test.js            # Functional test suite (no dependencies)
├── .github/workflows/ci.yml    # CI — runs the tests on every push / PR
├── netlify.toml                # Static publish config (repo root, no build)
└── README.md
```

## Disclaimer

This tool is for **internal compliance use only**. It supports — and does not replace — professional judgement, firm policy, and applicable AML/CFT regulatory obligations. Country, activity, and material risk scores are template values sourced from the firm's risk data sheet and should be reviewed and maintained by the compliance function.
