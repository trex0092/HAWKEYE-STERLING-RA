# CBUAE AML/CFT Framework Update (April 2026) — Impact Assessment for a UAE DPMS

Prepared: 07/07/2026. Audience: the compliance function of Fine Gold LLC (DPMS, UAE).

**Provenance & verification status:** communicated to the compliance function via an
industry summary (infographic) of the Central Bank of the UAE's April 2026 AML/CFT
update — described there as the most significant change since Federal Decree-Law
No. 10 of 2025. The **primary instrument has not yet been read directly** from this
repository (official portals block automated reading); the CBUAE AML/CFT page is a
watched source in [`../../data/reg-sources.json`](../../data/reg-sources.json)
(`uae-cbuae`), so the Regulatory Watch pipeline will surface the primary text.
Verify each point against the primary source before citing in any filing. This is a
research summary, not legal advice. Key references cited by the summary: FDL No. 10
of 2025 · CBUAE AML/CFT Guidance (April 2026) · FATF 5th Round Mutual Evaluation
(June 2026).

Note on applicability: CBUAE guidance binds its licensees (banks, exchange houses);
the firm is a **DPMS supervised by the Ministry of Economy**. CBUAE guidance still
matters here as (a) the strongest signal of UAE supervisory direction ahead of the
FATF mutual evaluation, (b) directly applicable expectations wherever the firm
banks or remits, and (c) themes MoE inspections consistently mirror.

## The five changes, mapped to this system

### 1. Proliferation Financing (PF) — now a standalone risk area
The summary: PF is no longer folded into general AML/CFT; firms must conduct a
**dedicated PF risk assessment**, include PF in the business risk assessment, and
operate PF-specific controls.

- **Already in place:** the third pillar (CPF) of FDL 10/2025 is documented in
  [`2026-06-aml-regulatory-update.md`](2026-06-aml-regulatory-update.md) §1; PF/TFS
  screening is live — the engine screens the UN Consolidated List (which carries
  the PF designations), EU/UK/OFAC lists, and the EOCN local list
  ([`../../data/eocn-local-terrorist-list.json`](../../data/eocn-local-terrorist-list.json));
  EOCN is a watched source.
- **GAP — action:** no **standalone PF risk assessment document** exists in this
  pack. Added to the [management review](../aims/management-review.md) first-cycle
  prep: MLRO to produce a dedicated PF RA (exposure of gold/precious-metals flows
  to PF typologies — dual-use goods adjacency, sanctioned-jurisdiction supply
  chains, transshipment), referencing the existing TFS screening controls as
  mitigations. Owner: MLRO.

### 2. Trade-Based Money Laundering (TBML) & correspondent banking
The summary: supervisory focus on trade patterns, goods/pricing/routes,
counterparties; enhanced due diligence for correspondent relationships.

- **Directly relevant** to a gold DPMS: TBML through mispriced or misdescribed
  bullion flows is the sector's core typology. Current controls: jurisdiction risk
  factors and hard rules in the RA engine, adverse-media screening with
  trade/laundering typologies, CAHRA/OECD and LBMA/RMI sourcing sources watched.
- **Correspondent banking:** not applicable to the firm directly (not a bank);
  relevant when assessing the firm's own banking partners.
- **Action:** at the next quarterly methodology review, confirm the adverse-media
  keyword set and the RA engine's trade-route factors give TBML signals adequate
  weight (owner: MLRO; vehicle: the quarterly review task the pipeline already
  files).

### 3. Transaction monitoring — continuous, technology-driven
The summary: manual/periodic checks are no longer enough; regulators expect
continuous monitoring with technology and data analytics, on documents *and*
behaviour, with effective detection and escalation.

- **Known open item, priority RAISED by this update:** the transaction-monitoring
  engine (`txn_monitor.py`, FATF R.16) is **inactive pending a real transaction
  feed** — tracked as risk **R-13** in the
  [AI risk register](../aims/ai-risk-register.md) and in the assurance matrix's
  known-gaps table. This update strengthens the case to schedule the feed
  decision rather than defer it. Owner: firm management, tabled at the next
  management review.
- Continuous *screening* (the adjacent control) is already live daily.

### 4. FATF 5th Round Mutual Evaluation (June 2026) — effectiveness, not paper
The summary: the UAE is under review; regulators want real-world outcomes
demonstrated — evidence of effectiveness, not just policies.

- **This is the design philosophy of this repository**: every control maps to an
  automated proof in the
  [assurance coverage matrix](../governance/assurance-coverage-matrix.md), the
  daily governance report files an operating-effectiveness record, and the
  [regulatory-readiness pack](../executive/regulatory-readiness.md) maps examiner
  questions to artifacts. **Action:** none new — keep the evidence chain green;
  the [internal audit programme](../aims/internal-audit.md) checks it.

### 5. Compliance expectations — inspection-ready at all times
The summary's checklist (risk assessments current, controls tested, staff trained,
data quality, proactive regulator engagement) maps 1:1 onto existing artifacts:
risk register + SoA (current), CI-tested controls, competency/AI-literacy records
(training log **still to be populated** — existing open item), the data-quality
plan, and goAML/EOCN registration confirmations (existing first-cycle item).

## Consolidated new actions from this update

| # | Action | Owner | Vehicle |
|---|---|---|---|
| 1 | Produce the standalone **PF risk assessment** | MLRO | Management review first-cycle prep (added) |
| 2 | Confirm TBML weighting in adverse-media keywords + RA trade factors | MLRO | Next quarterly methodology review |
| 3 | Re-prioritise the R-13 transaction-feed decision | Management | Next management review |
| 4 | Verify this summary against the primary CBUAE April-2026 text when Regulatory Watch surfaces it | Compliance Eng. | Reg-watch pipeline (`uae-cbuae`) |

Related reference: [aml-regulators-directory.md](aml-regulators-directory.md) —
the global supervisor/FIU map for counterparty and cross-border questions.
