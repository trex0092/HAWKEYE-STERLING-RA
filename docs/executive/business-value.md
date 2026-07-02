# Business Value & ROI

*For senior management. Date: 2 Jul 2026. Figures marked **[measure]** are to be
baselined during the first live weeks; all others are structural facts of the
platform as built.*

## Value pillars

| Pillar | How the platform delivers it |
|---|---|
| **Analyst time saved** | Structured scoring + auto-assembled narrative replaces manual template work per assessment **[measure: minutes saved vs current process]**; screening runs unattended daily instead of ad-hoc manual checks. |
| **Screening coverage** | Every customer × 5 sanctions lists × adverse media (2 feeds) × PEP, **daily** — coverage a manual team could not sustain. Standing matches recorded once; new/changed matches always alert. |
| **Risk / incident avoidance** | A single missed sanctions designation or undetected PEP can mean regulatory penalty, remediation cost and reputational damage far exceeding the platform's near-zero running cost. The refuse-to-clear and degradation guards exist to prevent exactly that. |
| **Audit preparation** | Evidence is pre-assembled: the Assurance Coverage Matrix, daily Compliance Brief, daily AI Governance Report and hash-chained activity log mean exam preparation is *retrieval*, not *reconstruction* **[measure: prep hours vs prior exam]**. |
| **Operating cost** | Static site + serverless + free data feeds → hosting-only cost, no per-seat licences, no screening-vendor subscription (until/unless a commercial feed is chosen). |

## Operational improvements (observed in the build)
- **One controlled workspace** — all app deliverables land in *HAWKEYE STERLING
  APP*; all automated monitoring in *Ongoing Monitoring*. Nothing is lost to email.
- **Segregation of duties** — analyst drafts, reviewer (MLRO) completes; enforced.
- **Bilingual (EN/AR)** including Arabic-language adverse-media screening — direct
  fit for the UAE market.
- **Resilience** — 429/5xx retries, re-run de-duplication and 10/10 egress-locked
  monitoring workflows mean the pipeline is hard to break and hard to abuse.

## Cost-avoidance framing (for the board)
Position the platform cost against the **downside it mitigates**, not against a
software line item: supervisory penalties, forced remediation programmes, and the
opportunity cost of an analyst manually screening a growing book. The platform's
marginal cost per additional customer screened is effectively zero.

## Competitive / strategic advantages
- **Verifiable governance** — a differentiator most compliance tools claim but few
  can demonstrate control-by-control on demand.
- **Certification-ready trajectory** — the ISO/IEC 42001 corpus positions the firm
  for an external AIMS assessment without a documentation scramble.
- **No lock-in** — open, no-build architecture; data stays with the firm.

## How to substantiate the **[measure]** items
Run the first-week demo/live cycle with a stopwatch on one assessment and one
exam-prep task, and read the KPI dashboard ([`kpi-dashboard.md`](kpi-dashboard.md))
monthly. Replace the bracketed placeholders with the firm's real numbers before
any external presentation — do not present estimates as measured results.
