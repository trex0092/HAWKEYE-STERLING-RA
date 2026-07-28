# Enterprise Risk Assessment Methodology (EWRA / BWRA)

**Owner:** MLRO (accountable) · Compliance Officer (operational)
**Approver:** Board of Directors
**Status:** DRAFT — for Board approval (open-actions item 18)
**Version:** 0.1 · **Review cadence:** annually, and on any material change to the business, customer base, product set or regulatory framework.

**Regulatory basis:** Federal Decree-Law No. 10 of 2025 · Cabinet Resolution
No. 134 of 2025 (risk assessment must include PF risk) · MoE Circular No. 4 of
2025 (UAE National Risk Assessment 2024).

---

## 1. What this document is

The **method** by which the firm produces and maintains its business-wide risk
assessment. The assessment itself is a dated output produced under this method
and approved by the Board; this page defines how it is built, so that two
assessments a year apart are comparable.

The AI-system risk register at
[`../aims/ai-risk-register.md`](../aims/ai-risk-register.md) is a **different
artefact**: it scores the risks of the platform the firm uses, not the firm's
ML/TF/PF business risk. Neither substitutes for the other.

## 2. Scope — five risk domains, three pillars

Risk is assessed across **customers, products and services, delivery channels,
geographies, and counterparties/supply chain**, and for each of the three
pillars: **ML, TF and PF**. PF carries its own section and its own factors — a
PF conclusion may not be inferred from the ML score.

## 3. Scoring

**Inherent risk** = likelihood × impact on a 5×5 matrix (score 1–25):

- Likelihood: 1 Rare · 2 Unlikely · 3 Possible · 4 Likely · 5 Almost certain
- Impact: 1 Negligible · 2 Minor · 3 Moderate · 4 Major · 5 Severe
  (regulatory / enforcement consequence)
- Bands: **Low 1–6 · Medium 7–12 · High 13–25**

**Control effectiveness** is assessed separately per risk — Strong / Adequate /
Weak / Absent — with the evidence that supports the rating. A control with no
evidence is rated Absent, not Adequate.

**Residual risk** = inherent risk adjusted for assessed control effectiveness.
Residual risk is compared against the appetite in
[`../governance/risk-appetite-statement-2026.md`](../governance/risk-appetite-statement-2026.md);
anything above appetite requires a treatment plan with an owner and a date.

## 4. Inputs

| Input | Source |
|---|---|
| National risk context | UAE NRA 2024 (MoE Circular No. 4 of 2025) |
| Sector typologies | FATF and FIU typology publications; DPMS-specific red flags |
| Customer base composition | Risk-band distribution from the assessment register |
| Screening outcomes | Sanctions/PEP/adverse-media hit rates and dispositions |
| Filing history | STR / DPMSR / TFS filing log |
| Supply-chain findings | Responsible-sourcing due diligence and KYS assessments |
| Control test results | Assurance coverage matrix; independent audit findings |
| Regulatory change | Regulatory Watch feed and the change-management procedure |

## 5. Method

1. **Identify** risks per domain and pillar, using the inputs above.
2. **Score inherent risk** (likelihood × impact) with a written rationale.
3. **Map controls** to each risk and rate effectiveness against evidence.
4. **Derive residual risk** and compare with appetite.
5. **Treat** anything above appetite: accept (with reasoning), reduce, avoid, or
   transfer — with owner and target date.
6. **Approve** at Board level; record the approval date and version.
7. **Monitor** — treatments land in the CAPA log; breaches of appetite are KRIs.

## 6. Cadence and triggers

Annually at minimum. Also on: a new product, channel or market; a material
change in the customer base; a new or amended instrument or supervisory
circular; a significant control failure or enforcement event; or a material
finding from independent audit.

## 7. Current state — stated, not hidden

The firm's business-wide assessment is **outstanding** (obligation OB-10,
firm-side). The repository holds the method above, the AI-system risk register,
and much of the input data — but the EWRA covers customers, products, channels
and geographies that no repository control can observe on its own. Producing it
is the MLRO's task with the business; this method is what it must follow.

## 8. Approval

| Field | Value |
|---|---|
| Approved by (Board) | ☐ |
| Date of approval | ☐ |
| Next review due | ☐ (12 months from approval) |
