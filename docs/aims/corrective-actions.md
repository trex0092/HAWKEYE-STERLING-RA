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
| CA-11 | 2026-06-28 | Repeated manual run cancellations tripped the freshness-check (no successful daily run) | Process | Operator churn (cancel-and-redeploy) | Stop cancelling; let runs complete; speedup prevents pile-ups | Freshness-check green after a successful run | In progress |

> Append new findings as they arise; every CRITICAL/HIGH should carry a regression test.
