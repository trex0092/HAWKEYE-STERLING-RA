# Alert Investigation — Decision Tree

*The disposition path for a screening alert, from first look to close, escalation
or STR. Applies to every alert this system raises — daily sanctions screen,
adverse-media / PEP watch, repeat-pattern flags — and to anything reported
manually. First line works the tree; the STR decision itself is second-line only
(see the [reviewer / MLRO guide](reviewer-mlro-guide.md)).*

**Goal: identify risk, make informed decisions, protect the organization.**
Not every alert is a true positive; good investigation prevents risk.

## The tree

```mermaid
flowchart TD
    A["1 · ALERT GENERATED<br/>daily screen · adverse media · PEP<br/>repeat pattern · manual report"] --> B{"2 · Clearly a<br/>false positive?"}
    B -- yes --> C["CLOSE ALERT<br/>document the reason<br/>on the case"]
    B -- no --> D{"3 · Enough information<br/>to decide?"}
    D -- no --> E["OBTAIN MORE INFORMATION<br/>documents · identifiers ·<br/>clarification from the file"]
    E --> D
    D -- yes --> F{"4 · Elevated risk or<br/>senior review needed?"}
    F -- yes --> G["ESCALATE<br/>to the reviewer / MLRO"]
    F -- no --> H{"5 · Suspicion of ML, TF or<br/>other financial crime?"}
    G --> H
    H -- yes --> I["FILE STR/SAR<br/>MLRO verifies every ground and<br/>submits via goAML — the system<br/>only ever drafts"]
    H -- no --> J["CLOSE ALERT<br/>no suspicion — document<br/>the rationale"]
    H -- unresolved --> K["MONITOR & REVIEW<br/>keep the case open;<br/>reopen on new information"]
```

## Key questions before any disposition

- What is the **nature** of the alert (list hit, adverse media, PEP, pattern)?
- Who is the **customer**, and what is their current **risk rating / band**?
- What exactly **triggered** it (which list, which story, which identifiers)?
- Do I have **enough information** to make a defensible decision?
- Is there a **suspicion** of money laundering, terrorist financing or another
  financial crime?

## Where each step lives in this system

| Tree step | Mechanism here |
|---|---|
| Alert generated | Daily sanctions screen + adverse-media/PEP watch file **screening cases** (Asana tasks) with confidence tiers; the delta engine surfaces only what is new |
| False-positive check | Core-token FP suppression and confidence tiers do the first cut; the analyst documents the human call on the case |
| Obtain more information | A subject that cannot be screened cleanly (non-Latin / short name) is flagged **MANUAL REVIEW**, never assumed clear |
| Escalate | Hand-off to reviewer/MLRO; completion is second-line only (segregation of duties). Cases open past SLA get an **⏰ AGING** comment automatically |
| STR decision | **MLRO only**, with dual attestation (Federal Decree-Law 10/2025 Art. 16/18; FATF R.26). `ai.draft_str` attaches a grounds narrative to HIGH cases and [`str_dossier.py`](../../str_dossier.py) assembles a goAML-aligned **DRAFT** dossier — the system never files |
| Monitor & review | Keep the case open; the repeat-pattern watch (≥3 stories/90 days) and daily delta re-raise what changes |

## Documentation checklist — every disposition, every time

Undocumented work did not happen. Each case should carry:

- [ ] alert details & case ID
- [ ] customer information and identifiers used
- [ ] risk rating / band at the time of review
- [ ] investigation steps taken
- [ ] information reviewed (lists, versions, stories)
- [ ] evidence collected (attached to the case)
- [ ] decision & rationale
- [ ] approvals / escalations (who, when)
- [ ] final outcome
- [ ] date & time

The case task, the tamper-evident activity log and the sign-off fields are where
this record lives; the [assurance coverage matrix](../governance/assurance-coverage-matrix.md)
ties the trail to the controls that test it.

## Remember

- **Stay objective** — dispose of what the evidence shows, not what is quickest.
- **Follow the process** — the tree exists so identical facts get identical
  treatment.
- **Document everything** — the rationale is the deliverable, not the click.
- **When in doubt, escalate** — a false escalation costs minutes; a missed
  suspicion costs the licence.
- **Mind tipping-off (Art. 25)** — never signal to the customer that a report is
  being considered or filed; the Advisor refuses to draft such text by charter,
  and so should you.

*Right investigation. Right decision. Right outcome — stronger compliance, safer
organization.*
