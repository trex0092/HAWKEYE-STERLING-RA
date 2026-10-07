# BCP & Vendor-Exit Exercise Record

> **Template only.** An empty or partially completed copy is not evidence that an
> exercise occurred. Complete this record during each drill, retain supporting
> evidence, route findings to CAPA/open actions, and record the next exercise date.

**Related controls:** Business Continuity & Resilience Plan (`bcp.md`), risk
`R-17` key-person dependency, risk `R-15` vendor/dependency failure, and
open action 44 for the first recorded cycle.

## 1. Exercise identity

| Field | Record |
|---|---|
| Exercise date | _complete_ |
| Exercise lead | _complete_ |
| Second trained operator | _complete_ |
| Observer / reviewer | _complete_ |
| Scenario(s) tested | _complete_ |
| Systems/providers in scope | _complete_ |
| Start time | _complete_ |
| Recovery / operating capability demonstrated at | _complete_ |
| Observed RTO | _complete_ |
| Next annual exercise date | _complete_ |

## 2. Minimum drill steps

Record evidence or a clear result for every applicable step.

| Step | Result / evidence reference |
|---|---|
| Second operator locates the current BCP and setup runbook | _complete_ |
| Second operator obtains authorised administrative access without relying on the primary operator | _complete_ |
| Repository/application is recovered or a clean operating environment is established | _complete_ |
| Required configuration is reconstructed from approved documentation and protected environment settings | _complete_ |
| A representative governed workflow is dispatched or otherwise operated successfully | _complete_ |
| Vendor outage / exit path is demonstrated for at least one critical dependency | _complete_ |
| Manual fallback is demonstrated where automation is unavailable | _complete_ |
| Monitoring or evidence confirms the recovered service is operating as expected | _complete_ |
| Any required credential-rotation procedure is demonstrated without recording secret values in this file | _complete_ |

## 3. RTO and continuity observations

- **Expected RTO from the BCP:** _complete_
- **Observed RTO:** _complete_
- **RTO met:** _yes / no_
- **Manual fallback usable:** _yes / no_
- **Second operator able to operate independently:** _yes / no_
- **Vendor-exit / substitution path demonstrated:** _yes / no / not applicable, with rationale_

## 4. Findings and corrective actions

| Finding | Severity | Owner | CAPA / open-action reference | Target date | Verification |
|---|---|---|---|---|---|
| _none / complete_ | | | | | |

A finding is not closed by this record alone. Closure requires the named
verification evidence under the normal CAPA/open-actions process.

## 5. Sign-off

| Role | Name | Decision / comments | Date |
|---|---|---|---|
| Second operator | _complete_ | _complete_ | _complete_ |
| Repo owner / maintainer | _complete_ | _complete_ | _complete_ |
| MLRO | _complete_ | _complete_ | _complete_ |

**Outcome:** _pass / pass with actions / fail_

**Next exercise date:** _complete_

A PASS means the tested continuity objectives were demonstrated for this cycle.
It does not close unrelated vendor, legal, identity, persistence, security, or
external-assurance actions.
