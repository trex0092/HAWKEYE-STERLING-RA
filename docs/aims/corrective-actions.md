# Corrective Actions / CAPA Log (AIMS 10.2)

Nonconformities and defects, their root cause, and the corrective action taken.
Owner: system maintainer / MLRO. Source of truth for "what went wrong and how we fixed it".

| ID | Date | Finding (nonconformity) | Severity | Root cause | Corrective action | Verification | Status |
|---|---|---|---|---|---|---|---|
| CA-01 | 2026-06-28 | `parse_uk` could silently zero the UK OFSI list on a format/HTML change | Critical | Blindly skipped row 0 (title line) without validating the header | Header auto-detect; flag PARSE ERROR instead of 0 silent names | `engine_test.py` regression | Closed |
| CA-02 | 2026-06-28 | `get_all_customers` crashed the run on a malformed Asana page | Critical | Hard `data["data"]`/`gid`/`name` subscripts | `.get` guards; skip bad rows; guard pagination | Smoke test | Closed |
| CA-03 | 2026-06-28 | No 429/rate-limit handling → run crash mid-flight | Critical | Direct `requests` calls without retry | `asana_request()` retries 429/5xx (Retry-After) | Code review | Closed |
| CA-04 | 2026-06-28 | Stray LLM severity could `KeyError`-crash risk rating | High | Unvalidated model output into bare dict lookups | Clamp severity to allowed set; `_SEV_RANK.get` | `engine_test.py` regression | Closed |
| CA-05 | 2026-06-28 | Report truncation could amputate MLRO sign-off / retention notice | Medium | Hard slice at 65k; daily/weekly had no cap | `cap_notes()` preserves footer; applied to all posts | Code review | Closed |
| CA-06 | 2026-06-28 | Delta keyed on volatile Google-News URL → standing stories re-flagged NEW | Medium | URL changes each fetch | Key on normalized title; PEP fallback to description/label | `engine_test.py` regression | Closed |
| CA-07 | 2026-06-28 | `_mask` wrote secret-derived bytes into the filed report | Medium | Masked tail `secret[-3:]` | Presence-only mask | `engine_test.py` regression | Closed |
| CA-08 | 2026-06-28 | Onboarding silently dropped customers with odd `created_at` | Medium | Bare `except: continue` | Log the skip (left to daily batch) | Code review | Closed |
| CA-09 | 2026-06-28 | UAE EOCN list read from a non-existent PDF (always degraded) | High | Engine read `eocn_list.pdf` not the maintained JSON | Read `data/eocn-local-terrorist-list.json` (312 names) | Live run: EOCN OK | Closed |
| CA-10 | 2026-06-28 | Daily sweep exceeded the runner budget (~5h+ → timeout risk) | High | Sequential per-subject network sweep | Parallelized sweep (bounded pool) → minutes | Live run | Closed |
| CA-11 | 2026-06-28 | Repeated manual run cancellations tripped the freshness-check (no successful daily run) | Process | Operator churn (cancel-and-redeploy) | Stop cancelling; let runs complete; speedup prevents pile-ups | Freshness-check green after a successful run | Closed |
| CA-12 | 2026-07-02 | `data/run-metrics.json` written by every screening run but never committed — anomaly-watch always saw an empty history, so SUSTAINED-anomaly escalation (incl. the adverse-media degradation class) could never fire | High | Metrics file missing from the state-commit steps of both screening workflows | Added to the porcelain check + `git add` in `weekly-adverse-media.yml` and `onboarding-screen.yml`; history now accumulates run-over-run | First committed history after the next scheduled run; anomaly-watch reads it at 06:30 UTC | Closed (verify on next run) |
| CA-13 | 2026-07-02 | 42 open code-scanning alerts (CodeQL/Semgrep) surfaced by the daily AI Governance Report but untriaged | Medium | Alert triage cadence not yet established | Full triage 2026-07-07 ([record](../security/code-scanning-triage-2026-07.md)): 10 fixed in code, 6 scoped out with justification (design mockups / test fixtures), 30 classified for dismissal-with-reason (by-design Scorecard posture + watcher data flows) | Fixed/scoped alerts auto-close on next CodeQL run; dismissal count to zero tracked by the daily governance report | Open — remaining action: owner records the 30 dismissals in the Security tab |

> Append new findings as they arise; every CRITICAL/HIGH should carry a regression test.

## Hardening actions (from the risk register, 2026-06-29)
Planned mitigations closed in the hardening pass — each lowered a residual risk and
carries a CI-enforced test or a formal document.

| ID | Risk | Action | Verification | Status |
|---|---|---|---|---|
| HA-01 | R-05 bias | Formal cross-script recall-parity test | `test/bias_eval.py` (CI) + bias-fairness-testing.md | Closed |
| HA-02 | R-02 injection | Standing prompt-injection red-team corpus | `test/redteam_injection.py` (CI) + red-team-procedure.md | Closed |
| HA-03 | R-08/R-12 | Runtime monitoring (latency/usage/anomaly) → QA gate | `monitoring.py` + engine_test + runtime-monitoring.md | Closed |
| HA-04 | R-06 privacy | Formal PDPL data-processing assessment + ROPA | pdpl-data-processing-assessment.md | Closed (DPA action open) |
| HA-05 | R-09 coverage | Source-coverage drift monitor (≥20% core drop) | `monitoring.check_source_coverage` + engine_test | Closed |
| HA-06 | R-03 / R.10 | Identity corroboration + CDD gaps + jurisdiction risk | `kyc.py` + engine_test + in-domain-aml-coverage.md | Closed |
| HA-07 | R.25 | Trust / legal-arrangement detection & screening | `kyc.py` + engine_test | Closed |
| HA-08 | R-13 / R.16 | Transaction-monitoring engine (synthetic; inert until feed) | `txn_monitor.py` + engine_test | Engine closed; feed connection open (firm) |
