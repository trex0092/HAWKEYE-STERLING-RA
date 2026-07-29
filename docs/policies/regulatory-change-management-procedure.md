# Regulatory Change Management Procedure

**Owner:** Compliance Officer (operational) · MLRO (accountable)
**Approver:** MLRO
**Status:** DRAFT — for MLRO approval (open-actions item 18)
**Version:** 0.1 · **Review cadence:** annually.

**Regulatory basis:** Federal Decree-Law No. 10 of 2025 · Cabinet Resolution
No. 134 of 2025 (internal controls kept current) · MoE AML/CFT Guidelines for
DNFBPs (September 2025).

---

## 1. Sources monitored

| Source | Cadence | What it changes |
|---|---|---|
| UAE Official Gazette | Weekly | New Decree-Laws and Cabinet Resolutions |
| Ministry of Economy | Weekly | Circulars, DNFBP guidance, inspection notices, DPMS thresholds |
| CBUAE notices | Weekly | AML standards |
| Executive Office (EOCN) | As published | TFS designations, PF guidance |
| UAE FIU | As published | goAML formats, typologies |
| FATF | Monthly | Guidance, evaluations, list changes |
| LBMA / OECD | Quarterly | Responsible sourcing guidance |
| UN Security Council | As published | Sanctions resolutions |

Most of these are watched automatically: `data/reg-sources.json` drives the
Regulatory Watch workflow, which detects content changes and files them for
review. Automation detects; **a human decides what it means**. Where a source
blocks automated fetching, the periodic manual review covers it — that limit is
recorded per source rather than assumed away.

## 2. The five steps

1. **Identify** — a change is detected by the watcher, or read from a source
   the watcher cannot reach.
2. **Assess impact** — map the change to this policy pack, the obligation
   register and the controls. Name what must change: an instrument, a
   procedure, a system threshold, a training module, or nothing.
3. **Plan** — remediation tasks with an owner and a date, entered in the CAPA
   log or the open-actions register.
4. **Implement** — update the instrument and bump its version; update the
   obligation register row; change the system or threshold; refresh training
   content.
5. **Evidence and verify** — record the change and the approval, notify the
   Board or senior management where the change is material, and confirm through
   testing that the new control operates.

## 3. Timeliness

| Change type | Assessment due |
|---|---|
| New sanctions designation | Immediately — screening within 24 hours |
| New or amended Decree-Law / Cabinet Resolution | Within 5 business days |
| Supervisory circular or guidance | Within 10 business days |
| FATF / LBMA / OECD guidance | At the next scheduled review, or sooner if material |

## 4. Instrument hygiene on change

When an instrument is superseded, every operative citation to it is updated
across the pack. **Repealed instruments may appear only in historical context.**
Federal Decree-Law No. 20 of 2018 and Cabinet Decision No. 10 of 2019 are
repealed and superseded by Federal Decree-Law No. 10 of 2025 and Cabinet
Resolution No. 134 of 2025; CI fails the build if either is cited as an
operative basis on a scanned surface or in the obligation register.

A residual content migration is tracked and stated: article-level citations in
the customer-facing Q&A catalogue still reference the old Implementing
Regulation and need MLRO/counsel verification before remapping (open-actions
item 5).

## 5. Records

Each change carries: what changed, the source and date, the impact assessment,
the decision, the instruments and systems updated, the approval, and the
verification. Retained for at least five years.

## 6. Approval

| Field | Value |
|---|---|
| Approved by (MLRO) | ☐ |
| Date of approval | ☐ |
| Next review due | ☐ (12 months from approval) |
