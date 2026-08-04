# Open Actions Register

> **Purpose: the single human-readable answer to "what is pending?".** Asana
> remains the system of record; this file is the dated snapshot, updated by
> automation whenever an item opens or closes. Everything NOT listed here is
> complete and evidenced (see the hardening checklist Section 7, the
> third-party register, and the readiness review addendum).
>
> **Last updated:** 2026-08-04 — the August 2026 full-repo audit opened nine
> engineering items (20–28) and added the `Target date` column the preamble
> below had reserved. No pre-existing item changed state.
>
> **Previous update (2026-07-29):** the **HS MLRO** signed everything within MLRO
> authority on this date: item 19 (Stakeholder Impact Assessment v1.1) **closed**;
> the interim transaction-feed compensating control **adopted** (item 6 stays open
> for the wiring); POL-19 and POL-30 **approved and in force** (item 18 stays open
> for the sixteen Board instruments); and the advisor model change recorded in the
> [model-validation sign-off log](model-validation-2026.md) §5. Items are numbered
> by who moves next, not by importance.
>
> **Who signs what.** The **Board is HS Management**; the MLRO mandate is held by
> the **HS MLRO**. An instrument's approver is fixed by its type, not by
> convenience: policies, standards and charters are Board acts, procedures are the
> MLRO's. Nothing here was signed by a role that does not hold the authority for
> it — which is why seven items below still say *Board*, and why the audit item
> still says *Internal Audit*.
>
> **Target dates.** The `Target date` column exists as of 2026-08-04. Dating
> the governance items (1–18) is the Board's act (item 17) — inventing those
> dates here would be the exact failure this register exists to prevent — so
> they carry `—` until R7 is minuted, and KRI-09 (overdue issue rate) stays
> *not instrumented*. The engineering items opened by the August 2026 audit
> (20–28) are maintainer commitments and carry dates under the maintainer's
> own authority. The gap stays counted:
> `openActionsWithoutTargetDate` in
> [`../../data/grc-metrics.json`](../../data/grc-metrics.json) now measures
> per row — 17 of 26 undated at this update.

| # | Action | Owner | What closes it | Target date | Asana |
|---|---|---|---|---|---|
| 1 | Git history scrub: rewrite and force-push per [`../security/history-scrub-runbook.md`](../security/history-scrub-runbook.md) sections 1 to 5. Requires temporarily allowing force pushes on `main` (Settings, Branches), restored immediately after. First attempt on 16 Jul was rejected by that protection setting. | Repo owner | A fresh clone shows the pre-redaction commit gone and the runbook pickaxe check at zero; verification is re-run and recorded on the task | — | P7 |
| 2 | Send the two prepared chase emails sitting in the MLRO's Gmail drafts (counsel: citation mapping and PDPL basis; transaction-feed owner: four data-source answers). Recipients are self-addressed placeholders to replace. | MLRO | Both emails sent; the replies are items 5 and 6 | — | P28, P26, P38 |
| 3 | Approve the queued Auto Release deployment holds in the Actions tab. Safe no-ops while `APP_VERSION` is unchanged; this is the release gate working as designed. | Repo owner | Approval queue empty | — | rolling |
| 4 | Board sitting: execute [`board-minute-template-2026-07.md`](board-minute-template-2026-07.md) (resolutions R1 to R6) and the adoption block of [`ai-governance-committee-charter.md`](ai-governance-committee-charter.md). | Board | Signed minute filed; AI Policy Section 9 cites it; charter block signed | — | P2, P12 |
| 5 | Return the completed 160-row citation mapping ([`../aims/advisor-citation-migration-worklist.md`](../aims/advisor-citation-migration-worklist.md)) and the written PDPL transfer-basis confirmation (Schedule B of the DPA pack). | Counsel | Each return becomes one mechanical PR; the CI citation guard drops its exemption | — | P28, P26 |
| 6 | Transaction-feed wiring: answer the four questions in [`../aims/transaction-feed-scoping.md`](../aims/transaction-feed-scoping.md) Section 6 and connect a feed (`TXN_FEED_PATH`). **The interim manual compensating control was adopted and signed 2026-07-29** ([`../aims/transaction-feed-compensating-control.md`](../aims/transaction-feed-compensating-control.md) §4), so the gap is mitigated but **not closed** — `txn_monitor.py` is still INACTIVE and OB-03 / OB-13 / OB-21 remain *partial* against this item. | MLRO / firm | The wiring PR per the scoping note's Section 5, with the feed live and the three obligations moving to *met* | — | P8, P38 |
| 7 | Deliver training beyond Compliance and populate the record table in [`../aims/competency-records.md`](../aims/competency-records.md). | MLRO / HR | Named rows with dates and evidence in the table | — | P10 |
| 8 | First Internal Audit thematic review per [`../aims/internal-audit.md`](../aims/internal-audit.md); findings into the Section 6 log and CAPA. | Internal Audit | Audit log row completed with findings and status | — | P9 |
| 9 | Extend the AI register enterprise-wide. Blocked by item 4: this belongs to the Committee once chartered. | AI Governance Committee | Enterprise rows added to the register | — | P11 |
| 10 | ISO/IEC 42001 path decision (resolution R6 of the minute template): readiness assessment, certification, or continued self-assessment. | Board | Decision minuted | — | P12 |
| 11 | Confirm whether the UAE→US transfers (Anthropic, Asana) additionally require a Data Office transfer approval — **draft position ready for counsel:** [`cross-border-transfer-position-2026.md`](cross-border-transfer-position-2026.md) §4. Related to item 5's PDPL confirmation. | MLRO / counsel | The §4 block signed and the position filed with the DPIA cross-border row | — | P39 |
| 13 | Determine and minute whether the deploying entity must formally designate a DPO — **decision paper ready for the item-4 sitting:** [`dpo-determination-2026.md`](dpo-determination-2026.md) §4. | MLRO / Board | The §4 minute block signed; any appointment recorded in the [committee charter](ai-governance-committee-charter.md) roles | — | P41 |
| 14 | Run the first backtesting cycle per [`backtesting-protocol-2026.md`](backtesting-protocol-2026.md) — blocked until ≥25 disposed cases accumulate (18 open / 0 disposed at creation), so disposition of the open screening cases is the path to unblocking it. | MLRO | Cycle-1 ledger row completed and signed; findings fed to the §5 validation sign-off | — | to open |
| 15 | Execute the first manual red-team campaign round per [`../aims/red-team-log.md`](../aims/red-team-log.md) §3 (2026 Q3, with the quarterly review): non-lexical obfuscations + in-the-wild sweep. | MLRO / maintainer | Round-1 row completed; any corpus/detector change merged | — | to open |
| 18 | Approve the remaining **sixteen** instruments of the [AML/CFT/CPF policy pack](../policies/README.md) — drafted 2026-07-28 and **not in force** until the Board (HS Management) approves them. **The two procedures were approved by the HS MLRO on 2026-07-29** (POL-19 STR/DPMSR filing, POL-30 regulatory change management) under the MLRO's own authority and are now in force; the policies, standards and charter are Board acts and remain draft. | Board (HS Management) | Each remaining instrument's approval block completed with approver and date, and its register row flipped from `draft` to `in-force` (CI checks the document, not just the register) | — | to open |
| 17 | Ratify the [Risk Appetite Statement](risk-appetite-statement-2026.md) (resolution **R7** of the minute template) and, with it, decide whether to set target dates on the governance rows of this register — the missing input that leaves the overdue-issue metric uninstrumented ([`grc-metrics.md`](grc-metrics.md) §3). | Board | R7 minuted; the statement's status line flips from DRAFT to ratified; if target dates are adopted, KRI-09 moves to instrumented | — | to open |
| 16 | Ratify the MRM framework — model tiering, PSI thresholds and the backtesting protocol — at the item-4 board sitting. | Board | Ratification minuted; the governance-pillar row in [`model-risk-management-2026.md`](model-risk-management-2026.md) §3 flips to ✅ | — | to open |
| 20 | Function-endpoint authentication. [`netlify/functions/_auth.js`](../../netlify/functions/_auth.js) states the honest limitation: every function endpoint is effectively public — a static browser app cannot keep a real secret, so Origin and shared-token checks deter but do not authenticate. Add verified identity (Netlify Identity / JWT or OIDC) with roles matching the user guides, starting with the confidential-read endpoints (`risk-backup`, `asana-mirror`). Opened by the 2026-08 full-repo audit. | Repo owner | Production endpoints reject unauthenticated requests and the `_auth.js` header drops its "effectively public" caveat | 2027-03-31 | to open |
| 21 | Second alert channel. Alert delivery is Asana-only; the only out-of-band alarm is the GitHub Actions failure email. Add at least one independent channel (e-mail or chat webhook) for screening alerts and hard-gate failures, so an Asana outage cannot silence a sanctions hit. | Repo owner / MLRO | A non-Asana channel carries a real alert end-to-end, with its delivery verified by a watcher the same way Asana delivery is | 2026-12-31 | to open |
| 22 | Distributed rate limiting on the LLM relay. [`netlify/functions/_ratelimit.js`](../../netlify/functions/_ratelimit.js) documents that the sliding window is per-instance, not fleet-wide, in front of a billed API key; the fix it names (Netlify Edge rate limiting or a shared store) needs an external account decision. | Repo owner | brain-soul enforces one fleet-wide quota and the `_ratelimit.js` header drops its per-instance caveat | 2027-03-31 | to open |
| 23 | Server-side persistence tier with an RPO/RTO statement. Assessments live in browser `localStorage`; the only off-device copy is the override-sheet mirror. [`../security/supabase-rls-policies.sql`](../security/supabase-rls-policies.sql) is the ready template; spend and architecture are a firm decision. | Repo owner / Board (spend) | An authenticated sync/backup tier is live and [`../aims/bcp.md`](../aims/bcp.md) states RPO/RTO for assessment data | 2027-06-30 | to open |
| 24 | Browser and function error telemetry. `monitoring.py` instruments the Python engine and `csp-report.js` catches CSP violations, but a JS exception in `app.js` or a function 500 is invisible. Extend the csp-report pattern to a client error beacon plus function error capture, wired into the existing anomaly escalation. | Repo owner | A deliberate test error in each surface appears in the monitoring trail | 2026-12-31 | to open |
| 25 | Toolchain deepening: line-coverage measurement (c8 / coverage.py), Python type checking (mypy) and a mutation spot-check of the scoring golden set — each report-only first; any gate that turns blocking gets its own PR. | Repo owner | Coverage and mypy reports publish as CI artifacts; a mutation run of `test/scoring-golden.test.js` is recorded with its kill rate | 2026-10-31 | to open |
| 26 | Deploy self-heal and rollback automation. The rollback runbook (`docs/security/deploy-rollback-runbook.md`) ships with this hardening cycle; automation extends the control-retry pattern to failed production-deploy runs — today a runner shutdown mid-verification leaves no retry (observed 2026-08-04, exit 143 at poll 35/54). | Repo owner | A failed production-deploy run re-dispatches itself once automatically; a rollback rehearsal is recorded | 2026-10-31 | to open |
| 27 | Engine maintainability: decompose `screen.py` (5,913 lines / 148 defs) into modules (matching, feeds, Asana I/O, narrative) and take the py/mjs matcher consolidation decision — the dual implementation has needed five parity fixes in two months (#360, #362, #363, #364, #373). | Repo owner | `screen.py` decomposed with all suites green, or an ADR recording the consolidation decision and its plan | 2027-06-30 | to open |
| 28 | Console/Advisor Arabic UI chrome. `index.html` carries 59 translated hooks; the console and advisor carry 3–4 each. Extend AR to labels, statuses and empty states on both pages — long-form legal prose stays English per [`../i18n-ar-legal-review.md`](../i18n-ar-legal-review.md). Needs an AR reviewer. | Repo owner + AR reviewer | Both pages render fully in AR chrome with the existing caveat banner scoped to prose only | 2026-12-31 | to open |

> Maintenance rule: automation edits this table only to reflect verified state
> changes (an item closes on evidence, a new item opens with an owner), one
> change per pull request, and never marks a human act as done without the
> named owner's confirmation or direct evidence.
