# Free integration audit and coverage map

This change adds read-only, **manual-only**, low-volume connectivity diagnostics for three original public sources. It is **not** an approved full-population screen, not a substitute for any existing mandatory control, and cannot set `operational` or `sourceQuality.assured`.

| Integration | Existing repository control | Action |
| --- | --- | --- |
| Google News original global en-US RSS | screening engine and source diagnostic | Add independent public connectivity probe. Full per-subject evidence still required. |
| GDELT original DOC API | screening engine and source diagnostic | Add independent public connectivity probe. Full per-subject evidence still required. |
| Wikidata public entity API | PEP worldwide harvest | Add independent endpoint probe. No modification to source identities; all QIDs must still resolve. |
| OSV-Scanner | `.github/workflows/osv-scanner.yml` | Retain existing substantive scan and fail-closed behavior; diagnose failed runs rather than adding duplicate scanner. |
| GitHub CodeQL | `.github/workflows/codeql.yml` | Retain existing language coverage; independently inspect GitHub security findings using authorized access. Successful workflow alone is insufficient. |
| OpenSSF Scorecard | `.github/workflows/scorecard.yml` | Existing integration; no duplicate added. |
| Semgrep Community Edition | `.github/workflows/semgrep.yml` | Existing integration; no duplicate added. |
| Playwright (Chromium, Firefox, WebKit) | `.github/workflows/cross-browser.yml` | Already installs and tests three browser engines. Validate completed per-engine reports. |
| Fortify | `.github/workflows/fortify.yml` | Cannot be replaced with an open-source tool. Actual authenticated provider scan and usable evidence required. |
| Approved Anthropic evaluations | `.github/workflows/advisor-eval.yml`, `.github/workflows/advisor-bias-eval.yml` | Free models must not replace required real-provider, full-model/scenario evidence. |

## Diagnostic evidence contract

The new workflow runs **only on explicit dispatch**, does not read customer or employee subject data, uses generic public queries, cannot touch source identities or screening policy, and does not cancel active screening. It writes a JSON artifact containing timestamp, request target, status, body-kind validation, elapsed time, and bounded error classification. Any failed provider results in a failed job, not a green wrapper. This proves **only endpoint connectivity**, never availability at population-scale or evidence for original per-subject coverage. No workflow gates are weakened.

## Remediation still required

Original source completeness, source freshness, sanctions primary and supplementary coverage, complete screenable PEP identities, current-main full screening, independently successful Screening Assurance and Freshness Check, substantive Fortify, real Anthropic evaluations, and independent CodeQL findings checks must still pass together. Do not merge based solely on this diagnostic workflow.
