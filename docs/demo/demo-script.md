# Demo Script — 10-minute walkthrough

*For live demonstrations to management, auditors, or prospective reviewers. Uses
the live site and clearly-fake data only. Date: 2 Jul 2026.*

**Setup (before the room):** open the live app, ensure a device passphrase is set,
role = `reviewer`, and have the *HAWKEYE STERLING APP* Asana project visible on a
second screen. Have this script and [`scenarios.md`](scenarios.md) open.

## Minute-by-minute

**0:00 — Framing (1 min).**
> "This is a self-hosted AML risk-assessment and screening platform. Everything
> you'll see is either on-device and encrypted, or delivered into a controlled
> Asana workspace. Every control it claims is machine-verified — I'll show you."

**1:00 — Risk assessment, happy path (2 min).** Score **Scenario A** (low-risk
domestic dealer). Show: the six sections → animated gauge → **CDD** verdict →
per-factor breakdown. Point out the 22/23 boundary note if near it.

**3:00 — Risk Data transparency (1 min).** Open **Risk Data**; show a country
override with its required reason and audit stamp. Message: *the baseline is
firm-approved and every change is logged*.

**4:00 — Sanctions-hit path (2 min).** Score **Scenario B** (entity whose UBO
matches a designated party). Show: the score jumps, **EDD/PROHIBITED** outcome,
the 50%/control-rule note, and that the action stays an **MLRO decision**, not an
automated freeze.

**6:00 — Tokenised (PII-free) delivery (1 min).** Toggle **🔒 Asana: tokenise**;
explain full-detail vs tokenised (reference/tier/score/dates only) — the PDPL
data-minimisation choice.

**7:00 — Deliver + evidence (1.5 min).** As `reviewer`, mark **Complete**. Switch
to Asana: the task appears in *HAWKEYE STERLING APP*, right risk-band section,
custom fields populated, with the auto-backup mirror. Show the **Activity Log**
line `asana.delivery.ok`.

**8:30 — The assurance story (1 min).** Open the **daily AI Governance Report** and
**Daily Compliance Brief** tasks in Asana. Message: *these file themselves every
day; a control that silently stops running is flagged STALE — silence is never
evidence.*

**9:30 — Close (0.5 min).** Show the **Assurance Coverage Matrix** — "every row is
a control with an automated proof; that's what makes this audit-ready." State the
open items honestly (DPA, transaction feed) from
[`../executive/regulatory-readiness.md`](../executive/regulatory-readiness.md).

## Do / don't
- **Do** use only the fake names in [`sample-data.md`](sample-data.md).
- **Do** narrate human-in-the-loop at every AI/automation step.
- **Don't** present target KPIs as achieved; **don't** enable LLM features live
  unless the DPA is signed; **don't** use any real customer data.

## Reset after the demo
Delete the demo register entries and any demo Asana tasks (both deletions are
audit-logged), or keep the TEST-000 task as documented E2E proof.
