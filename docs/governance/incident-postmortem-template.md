# Post-Incident Review (Blameless) — Template

Use this template for every confirmed **Critical** or **High** security incident
(see [`SECURITY.md`](../../SECURITY.md)) and for any AI/Advisor incident
escalated by the [AI Incident Runbook](ai-incident-runbook.md). The review is
**blameless**: it examines systems and processes, not individuals. File the
completed review in the private GitHub advisory and link it from the incident log
in the AI Incident Runbook. Retain for ≥ 10 years (UAE FDL No. 26/2021, Art. 23).

> Copy the section below into a new dated file or advisory comment, e.g.
> `PIR-2026-001`.

---

## PIR-YYYY-NNN — <short title>

**Status:** Draft / Final
**Owner (MLRO / maintainer):** @trex0092
**Severity:** Critical / High · **CVSS v3.1:** `<base score>` `<vector>`
**Component(s):** e.g. `app.js` / `netlify/functions/…` / Advisor / workflow
**Reported by:** <reporter / channel> · **Date detected:** YYYY-MM-DD
**Date resolved:** YYYY-MM-DD

### 1. Summary
One paragraph: what happened, the impact, and the current state.

### 2. Impact
- Data affected (note: assessment data is on-device; was any server-side
  token/PII exposed?): …
- Users / scope affected: …
- Regulatory implications (e.g. record-keeping, TFS, tipping-off): …

### 3. Timeline (UTC)
| Time | Event |
|---|---|
| YYYY-MM-DD hh:mm | Detected / reported |
| | Acknowledged (SLA: ≤ 3 business days) |
| | Triaged + CVSS assigned (SLA: ≤ 7 business days) |
| | Mitigation applied (kill switch / revert / config) |
| | Fix deployed |
| | Resolved / verified |

### 4. Root cause
The underlying technical and process cause(s). Use "5 whys" if helpful. Separate
the **trigger** (what surfaced it) from the **root cause** (why it was possible).

### 5. Detection
How was it found (report, CI gate, CodeQL, gitleaks, advisor-eval, monitoring)?
Should an existing control have caught it earlier? Why didn't it?

### 6. Resolution & recovery
- Mitigation (immediate): e.g. `ADVISOR_ENABLED=false`, secret rotation, revert.
- Permanent fix: commit/PR link(s).
- **Regression test added:** link (every fix ships with a test that would have
  caught it — e.g. a golden-set case, a unit test, or a red-team prompt).

### 7. Corrective & preventive actions
| Action | Type (corrective/preventive) | Owner | Due | Status |
|---|---|---|---|---|
| | | | | |

### 8. Evidence retained
List artifacts preserved (report, PoC, logs, CVSS decision, fix PR, this PIR).
Confirm **no live secrets/PII** are stored in evidence (redacted).

### 9. Lessons learned
What went well, what was hard, and any control/runbook/documentation updates
made as a result.
