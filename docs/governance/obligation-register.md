# Obligation Register

**Every obligation, the instrument that creates it, who answers for it, and what proves it.**

**Owner:** MLRO · Compliance Engineering (operational)
**Source of truth:** [`data/obligations.json`](../../data/obligations.json) (machine-readable; this page is the human view)
**Enforcement:** [`test/obligations.test.mjs`](../../test/obligations.test.mjs) (CI, every pull request)
**Review cadence:** quarterly, on any change flagged by [Regulatory Watch](../regulatory-watch.md), and on any new instrument entering force.
**Last reviewed:** 2026-07-28

> **Citation policy.** Instrument-level citations only. Article-level mapping to
> Cabinet Resolution No. 134 of 2025 is counsel's worklist (open-actions item 5)
> and no article number is asserted here that has not been verified in-repo. The
> one exception is **Article 25 of FDL 10/2025** (tipping-off), already cited
> operatively in code and pinned by CI. Citing a repealed instrument — FDL
> 20/2018 or Cabinet Decision 10/2019 — as an operative basis fails the build.

---

## 1. Regulatory obligations

| ID | Obligation | Instrument | Owner | Status |
|---|---|---|---|---|
| OB-01 | Identify and verify the customer and the beneficial owner | FDL 10/2025 · CR 134/2025 | MLRO | ✅ met |
| OB-02 | Enhanced due diligence for high-risk customers, PEPs and jurisdictions | FDL 10/2025 · CR 134/2025 | MLRO | ✅ met |
| OB-03 | Ongoing monitoring and transaction scrutiny | FDL 10/2025 · CR 134/2025 | MLRO | 🟡 partial — item 6 |
| OB-04 | TFS screening against UN and UAE local lists; freeze without delay | CR 74/2020 | MLRO | ✅ met |
| OB-05 | PNMR / CNMR / FFR reporting via goAML | CR 74/2020 | MLRO | 🟡 partial — item 7 |
| OB-06 | STR/SAR reporting to the FIU via goAML | FDL 10/2025 | MLRO | 🟡 partial — item 7 |
| OB-07 | Tipping-off prohibition | FDL 10/2025, Art. 25 | MLRO | ✅ met |
| OB-08 | Record-keeping and production on request | FDL 10/2025 | MLRO | ✅ met |
| OB-09 | MLRO appointment, independence and authority | FDL 10/2025 · CR 134/2025 | Board | 🟡 partial — item 4 |
| OB-10 | Business-wide (enterprise) AML/CFT risk assessment | FDL 10/2025 · CR 134/2025 | MLRO | 🔴 pending — firm-side |
| OB-11 | Role-appropriate training and training records | FDL 10/2025 · CR 134/2025 | MLRO | 🟡 partial — item 7 |
| OB-12 | Independent audit of the AML/CFT programme | FDL 10/2025 · CR 134/2025 | Internal Audit | 🟡 partial — item 8 |
| OB-13 | DPMS cash-threshold reporting (AED 55,000, single or linked) | FDL 10/2025 · CR 134/2025 | MLRO | 🟡 partial — item 6 |
| OB-14 | PDPL: lawful basis, minimisation, cross-border transfer | FDL 45/2021 | MLRO / DPO | 🟡 partial — item 11 |
| OB-15 | Designation-list currency and change detection | CR 74/2020 | Compliance Eng. | ✅ met |
| OB-16 | Supervisor and goAML registration currency | FDL 10/2025 | MLRO / firm | 🔴 pending — firm-side |

## 2. Voluntary standards and monitored regimes

| ID | Obligation | Instrument | Status |
|---|---|---|---|
| OB-17 | EU AI Act obligations for the applicable role and risk class | Regulation (EU) 2024/1689 | 👁 monitored — outside territorial scope; general applicability 2 Aug 2026 is watched |
| OB-18 | AI management system to ISO/IEC 42001; certification path | ISO/IEC 42001:2023 | 👁 monitored — R6 decision at the board sitting (item 10) |
| OB-19 | Responsible sourcing and chain of custody | LBMA RGG · OECD DDG | 👁 monitored — firm programme outside this repository |

## 3. What the statuses mean

- **met** — control built, operating and evidenced. Nothing outstanding.
- **partial** — control built and evidenced; a *human act* is outstanding. Every
  partial row names the open-actions register item that closes it, and CI checks
  that item still exists.
- **pending** — firm-side obligation the repository cannot discharge or evidence.
- **monitored** — not currently applicable; watched so that a change in
  applicability is detected rather than assumed.

Read alongside the [open-actions register](open-actions-register.md), the shape
is consistent: the engineering is done, the human acts are not. Six obligations
are fully met, eight are built-but-waiting on a sitting, a filing, a delivery or
a signature, and two are firm-side.

## 4. Change detection

Every obligation names the [Regulatory Watch](../regulatory-watch.md) source
that would tell us it changed — `uae-moe` for supervisor guidance, `uae-fiu` for
goAML and filing formats, `uae-eocn` for TFS lists and duties, `uae-cbuae`,
`eu-ai-act` — or states why none applies. CI verifies each id against
`data/reg-sources.json`, so a watched source cannot be removed while an
obligation still depends on it, and the three UAE supervisors must each carry at
least one obligation.

Dated duties (training refreshes, procedure reviews, list reviews) are linked to
their `data/compliance-calendar.json` entry, which files the reminder with lead
time; CI verifies those ids too.

## 5. Framework mapping

| Framework | Clause | How this register satisfies it |
|---|---|---|
| FATF | R.1, R.34 (RBA, guidance and feedback) | Obligations enumerated with owner, control and evidence |
| ISO/IEC 42001 | 4.2 (needs and expectations of interested parties), 9.1 | Compliance obligations documented and measured |
| NIST AI RMF | GOVERN 1.1 (legal and regulatory requirements understood and managed) | The inventory that makes "understood" demonstrable |
| GRC practice | Obligation inventory + compliance register | Step 3 of the framework; the denominator of the compliance-completion metric |

---

**Related:** [`risk-appetite-statement-2026.md`](risk-appetite-statement-2026.md) ·
[`grc-metrics.md`](grc-metrics.md) ·
[`open-actions-register.md`](open-actions-register.md) ·
[`../executive/regulatory-readiness.md`](../executive/regulatory-readiness.md)
