# Open Actions Register

> **Purpose: the single human-readable answer to "what is pending?".** Asana
> remains the system of record; this file is the dated snapshot, updated by
> automation whenever an item opens or closes. Everything NOT listed here is
> complete and evidenced (see the hardening checklist Section 7, the
> third-party register, and the readiness review addendum).
>
> **Last updated:** 2026-10-07 — completed the fifth six-layer reconciliation.
> Regular-control-testing currency is now represented as its own enterprise
> assurance control. Item 41 tracks two in-force instruments whose recorded
> review dates passed on 2026-09-15 without a completed review record: the TFS
> name-match procedure and the EOCN/internal-watchlist SOP. The policy-register
> guard now requires every overdue in-force instrument to point to a live open
> action instead of allowing an expired review date to remain unowned.
>
> **Previous update (2026-10-07):** completed the fourth six-layer reconciliation.
> The overdue 2026 Q3 model-validation sign-off remains explicit as item 38.
> The apparent 2026-10-01 bias-eval evidence gap was checked against GitHub
> Actions and closed in that change: run 36890910912 completed successfully with
> 0 findings and 0 eval errors, and the governance ledgers now record it. The
> weekly Advisor behavioural eval exposed a different live gap: scheduled runs
> 36453013672 (2026-09-28) and 37345739408 (2026-10-05) were incomplete because
> the Anthropic account hit usage/credit limits. Item 40 tracks restoration of
> live behavioural assurance and a successful recovery run. No successful
> evaluation was fabricated.
>
> **Previous update (2026-10-07):** completed the third six-layer reconciliation.
> Vendor-assurance and external-assurance closure paths became explicit rather
> than implied by broader counsel/strategy rows: item 35 verifies the Asana DPA
> and contracted region, item 36 resolves the Anthropic DPA execution-record
> inconsistency, and item 37 resolves the independent-assurance posture after the
> ISO/IEC 42001 path decision. No vendor position, audit, certification or human
> approval was marked complete by that edit.
>
> **Previous update (2026-10-07):** completed the second six-layer reconciliation.
> The residual-risk dashboard already showed two risks above appetite with no
> dated treatment or exceptional acceptance, but neither had a dedicated closure
> row. Items 33 and 34 now make those decisions explicit for R-03 and R-21.
> That edit did not accept either risk and did not invent a deadline.
>
> **Previous update (2026-10-07):** reconciled the enterprise six-layer governance
> dashboard with this register. Three human actions that were already stated as
> incomplete in repository evidence, but had no numbered closure row, are now
> explicit: item 30 adopts the AI use-case intake/classification gate
> (EAI-POL-03 / EAI-RSK-05), item 31 runs the first AI incident-response
> tabletop (EAI-MON-04 / R-20), and item 32 records the first formal AIMS
> management review (EAI-AUD-03). No control was marked complete by that edit.
>
> **Previous update (2026-10-07):** merged PR #768 closed item 25 after the
> report-only toolchain run retained its coverage, mypy and mutation artifact
> (JavaScript line coverage 40.11%, Python line coverage 77%, 25 mypy findings,
> and 5/5 scoring mutants killed). The same review exposed Composio as an
> outstanding vendor-assurance gap with no explicit closing row, so item 29 was
> added rather than leaving KRI-04 without a complete action path.
>
> **Previous update (2026-08-04):** the August 2026 full-repo audit opened nine
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
> *not instrumented*. The remaining maintainer-owned engineering items
> (20–24 and 26–28) carry dates under the maintainer's own authority. Items
> 29–38 and 40–41 are vendor/governance/assurance actions whose deadlines belong to their
> named human owners, so no deadline is invented here. The gap stays counted:
> `openActionsWithoutTargetDate` in
> [`../../data/grc-metrics.json`](../../data/grc-metrics.json) now measures
> per row — 29 of 37 undated at this update.

| # | Action | Owner | What closes it | Target date | Asana |
|---|---|---|---|---|---|
| 1 | Git history scrub: rewrite and force-push per [`../security/history-scrub-runbook.md`](../security/history-scrub-runbook.md) sections 1 to 5. Requires temporarily allowing force pushes on `main` (Settings, Branches), restored immediately after. First attempt on 16 Jul was rejected by that protection setting. | Repo owner | A fresh clone shows the pre-redaction commit gone and the runbook pickaxe check at zero; verification is re-run and recorded on the task | — | P7 |
| 2 | Send the two prepared chase emails sitting in the MLRO's Gmail drafts (counsel: citation mapping and PDPL basis; transaction-feed owner: four data-source answers). Recipients are self-addressed placeholders to replace. | MLRO | Both emails sent; the replies are items 5 and 6 | — | P28, P26, P38 |
| 3 | Approve the queued Auto Release deployment holds in the Actions tab. Safe no-ops while `APP_VERSION` is unchanged; this is the release gate working as designed. | Repo owner | Approval queue empty | — | rolling |
| 4 | Board sitting: execute [`board-minute-template-2026-07.md`](board-minute-template-2026-07.md) (resolutions R1 to R6) and the adoption block of [`ai-governance-committee-charter.md`](ai-governance-committee-charter.md). | Board | Signed minute filed; AI Policy Section 9 cites it; charter block signed | — | P2, P12 |
| 5 | Complete the legal-source work: return the 160-row Advisor citation mapping ([`../aims/advisor-citation-migration-worklist.md`](../aims/advisor-citation-migration-worklist.md)); source the 21 rows in [`data/obligations.json`](../../data/obligations.json) under the `source_citation` standard (official URL, article/clause, verbatim quote, locator, human verifier/date); and return the written PDPL transfer-basis confirmation (Schedule B of the DPA pack). | Counsel / MLRO | The Advisor migration can be applied mechanically; all obligation rows move from `needs-source` to human-verified `sourced`; the CI citation exemption is removed where applicable; and the written transfer-basis confirmation is filed | — | P28, P26 |
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
| 20 | Function-endpoint authentication. [`netlify/functions/_auth.js`](../../netlify/functions/_auth.js) supports Origin checks plus an optional shared `X-App-Token`, and the confidential `asana-mirror` / `risk-backup` paths require that token when configured. This is still a shared bearer secret, not verified per-user identity or role-based authorization, and a browser-delivered secret is not a substitute for authentication. Add verified identity (JWT/OIDC or equivalent) with roles matching the user guides, starting with the confidential-read endpoints. Opened by the 2026-08 full-repo audit. | Repo owner | Production confidential endpoints require verified authenticated identity and enforce the intended roles; the shared-token mechanism is retained only as defense in depth or removed | 2027-03-31 | to open |
| 21 | Second alert channel. Alert delivery is Asana-only; the only out-of-band alarm is the GitHub Actions failure email. Add at least one independent channel (e-mail or chat webhook) for screening alerts and hard-gate failures, so an Asana outage cannot silence a sanctions hit. | Repo owner / MLRO | A non-Asana channel carries a real alert end-to-end, with its delivery verified by a watcher the same way Asana delivery is | 2026-12-31 | to open |
| 22 | Distributed rate limiting on the LLM relay. [`netlify/functions/_ratelimit.js`](../../netlify/functions/_ratelimit.js) documents that the sliding window is per-instance, not fleet-wide, in front of a billed API key; the fix it names (Netlify Edge rate limiting or a shared store) needs an external account decision. | Repo owner | brain-soul enforces one fleet-wide quota and the `_ratelimit.js` header drops its per-instance caveat | 2027-03-31 | to open |
| 23 | Server-side persistence tier with an RPO/RTO statement. Assessments and the activity log are primarily browser `localStorage`; `asana-mirror` already provides off-device register/log mirrors and `risk-backup` mirrors risk-data overrides, but these are operational copies rather than a dedicated authenticated persistence tier with a documented assessment-data RPO/RTO. [`../security/supabase-rls-policies.sql`](../security/supabase-rls-policies.sql) is the ready template; spend and architecture are a firm decision. | Repo owner / Board (spend) | An authenticated persistence/sync tier is live, recovery is rehearsed against it, and [`../aims/bcp.md`](../aims/bcp.md) states RPO/RTO for assessment data | 2027-06-30 | to open |
| 24 | Browser and function error telemetry. **Implementation added 2026-10-07:** `telemetry.js` captures browser exceptions/rejections without application state, `client-error-report.js` writes sanitized structured events, and `_telemetry.js` records returned 5xx/uncaught exceptions across every public Netlify function. Regression tests deliberately exercise both log paths. **Still open:** record one production rehearsal for a browser error and one function 500 in the Netlify monitoring trail before calling the control operationally proven. | Repo owner | A deliberate production test error in each surface appears in the monitoring trail | 2026-12-31 | to open |
| 26 | Deploy self-heal and rollback automation. The rollback runbook (`docs/security/deploy-rollback-runbook.md`) ships with this hardening cycle; automation extends the control-retry pattern to failed production-deploy runs — today a runner shutdown mid-verification leaves no retry (observed 2026-08-04, exit 143 at poll 35/54). | Repo owner | A failed production-deploy run re-dispatches itself once automatically; a rollback rehearsal is recorded | 2026-10-31 | to open |
| 27 | Engine maintainability: decompose `screen.py` (6,918 lines) into modules (matching, feeds, Asana I/O, narrative) and take the py/mjs matcher consolidation decision — the dual implementation has needed **six** parity fixes since 2026-07 (#360, #362, #363, #364, #373, #421), the sixth landing 2026-08-06, two days after this item's ADR was first recorded. **Partially addressed 2026-09-09**: [`adr-005-dual-engine-matcher.md`](adr-005-dual-engine-matcher.md) §5 records the consolidation decision (keep both, actively shrink shared-logic surface area per-fix) and moves the revisit trigger up to whichever comes first of a 7th parity PR, `screen.py` crossing 7,500 lines, or 2027-06-30 — replacing the single fixed date with a checkable one. Full decomposition itself is not attempted (correctly a project-scale change, not a same-session one). | Repo owner | `screen.py` decomposed with all suites green, or the moved-up trigger in ADR-005 §5 fires and is acted on | 2027-06-30 | to open |
| 28 | Console/Advisor Arabic UI chrome. **Engineering completed 2026-10-07:** shared `i18n.js` now covers static and JavaScript-rendered navigation, labels, statuses, modes, controls, refresh/error messages and empty states on both pages; persona role captions are localized and the service-worker shell is bumped. Regulatory Q&A answers, tool playbooks, citations and filed-record prose stay English per [`../i18n-ar-legal-review.md`](../i18n-ar-legal-review.md). **Still open for linguistic QA only.** | AR reviewer | Qualified Arabic reviewer checks both live pages in RTL and confirms the chrome terminology; no legal-text translation is required | 2026-12-31 | to open |
| 29 | Composio vendor-assurance go-live gate. The [third-party register](../aims/third-party-register.md) keeps `COMPOSIO_ENABLED=0` until the DPA, subprocessors, retention, contracted processing region and UAE PDPL transfer basis are confirmed, with approved business-app scopes and connected accounts recorded. | MLRO / DPO + Repo owner | All five vendor-assurance fields plus approved scopes/accounts are recorded in the third-party register; only then may `COMPOSIO_ENABLED=1` | — | to open |
| 30 | Formal organizational adoption of the [AI use-case intake and approval gate](ai-use-case-intake.md). The repository gate exists, but `EAI-POL-03` and `EAI-RSK-05` remain **PARTIAL** until the responsible governance body adopts it for organizational use. This is blocked on item 4 for Committee authority. | MLRO / AI Governance Committee (after item 4) | Item 4 is complete and a dated governance record makes the intake/classification gate mandatory for every new or materially changed AI use case; only then are the two control statuses reconsidered | — | to open |
| 31 | Run the first AI incident-response tabletop against the [AI incident runbook](ai-incident-runbook.md), closing the undrilled mitigation in risk `R-20` and the outstanding exercise condition in `EAI-MON-04`. | MLRO / maintainer | A dated exercise record captures the scenario, decisions, escalation, kill-switch/containment steps and lessons; any findings are entered in CAPA before `EAI-MON-04` is reconsidered | — | to open |
| 32 | Hold and record the first formal AIMS [management review](../aims/management-review.md). The log still shows `_scheduled — Q3 2026_`; the review should follow item 8 so real Internal Audit results are tabled rather than a template being treated as evidence. | MLRO + senior management | The management-review log contains a dated completed row with decisions, actions/owners and next review; only then is `EAI-AUD-03` reconsidered | — | to open |
| 33 | Resolve above-appetite risk `R-03` (sanctions false-negative risk, residual 10 against RA-01 ceiling 6). The repository must not treat the current quarterly threshold-tuning cadence as a dated treatment plan or as acceptance. | MLRO | Either a dated treatment plan is recorded with owner, target and measurable exit criteria that brings the residual position within appetite, or an authorized exceptional acceptance is recorded in `data/ai-risk-acceptances.json` with decision evidence and review/expiry | — | to open |
| 34 | Resolve above-appetite risk `R-21` (shadow-AI disclosure risk, residual 12 against RA-04 ceiling 6). Current controls are policy/awareness only and the risk register says periodic operator attestation is still required. | MLRO / DPO | Either a dated mitigation plan is recorded and implemented, including the required operator-attestation control or equivalent stronger control, or an authorized exceptional acceptance is recorded in `data/ai-risk-acceptances.json` with decision evidence and review/expiry | — | to open |
| 35 | Verify the Asana vendor DPA and contracted processing region. The third-party register still says **confirm on file** and **confirm** for the region, so `EAI-DMG-05` and KRI-04 cannot treat Asana as assessed. | MLRO / DPO | DPA reference/evidence and the contracted processing region are recorded in the third-party register; the safeguard cell no longer contains an unresolved confirmation marker | — | to open |
| 36 | Resolve the Anthropic DPA execution record. The vendor row records an owner attestation dated 2026-07-16, while the execution block remains explicitly **DRAFT — pending signature** with blank DPA reference, signatory, execution date and processing region. | MLRO / DPO / counsel | The repository records one verified position: either an executed DPA with reference, authorised signatory/date, processing region and transfer basis, or a corrected statement that execution remains pending with the AI path gated as required | — | to open |
| 37 | Resolve `EAI-AUD-06` independent external assurance after item 10. A Board decision to remain on self-assessment does not equal an external audit; a certification/assurance path requires an actual independent assessor. | Board / MLRO | After item 10, either an independent AI-governance/ISO 42001 assurance engagement is commissioned and its result/evidence recorded, or the control is formally reclassified `not_applicable` with a Board-approved rationale for continued self-assessment | — | to open |
| 38 | Complete the overdue 2026 Q3 model-validation sign-off. [`model-validation-2026.md`](model-validation-2026.md) states next review **2026-09-30** and its Q3 quarterly row remains pending as of 2026-10-07. | MLRO | The Q3 row is completed with the actual validation run/evidence, findings, MLRO sign-off and date; the document's next-review date moves to the next approved cycle | — | to open |
| 40 | Restore live Advisor behavioural-evaluation capacity. Scheduled run [36453013672](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/runs/36453013672) on 2026-09-28 was incomplete because the Anthropic account hit its specified API usage limit; scheduled run [37345739408](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/runs/37345739408) on 2026-10-05 was incomplete because the credit balance was too low. Both produced zero regression findings but did not complete the governed 30-case live suite. | Repo owner / MLRO | Restore provider capacity or an approved equivalent live-eval route, dispatch `advisor-eval.yml`, obtain a completed run with zero eval errors, record the recovery in [`eval-scorecard.md`](eval-scorecard.md), and clear the monitoring alert | — | to open |
| 41 | Complete the overdue 2026-09-15 control reviews for the [TFS name-match procedure](../aims/tfs-name-match-procedure.md) and the [EOCN/internal-watchlist SOP](../aims/eocn-list-update-sop.md). The policy register still carries 2026-09-15 as the next-review date for both instruments; the TFS procedure's event log contains no completed annual tabletop, and `data/internal-watchlist.json` still records its last review as 2026-07-28. | MLRO | Review both instruments against current requirements, perform and record the TFS tabletop, review every internal-watchlist entry or confirm the empty-list position, update the evidence logs/`lastReviewed`, and move each policy-register review date to its next approved cycle | — | to open |

> Maintenance rule: automation edits this table only to reflect verified state
> changes (an item closes on evidence, a new item opens with an owner), one
> change per pull request, and never marks a human act as done without the
> named owner's confirmation or direct evidence.
