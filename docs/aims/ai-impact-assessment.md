# AI Impact Assessment / DPIA (AIMS A.5.2)

Assessment of the impact of the AI system on individuals, rights, and society,
including data protection (UAE PDPL). Owner: MLRO / DPO. Review: annually + on change.

## 1. Processing description
The system screens customers and their beneficial owners against sanctions lists,
adverse media, and PEP sources to support AML/CFT obligations. AI is used for:
risk rating (deterministic), adverse-media triage (optionally LLM, grounded), and
draft summaries/STRs (human-reviewed).

## 2. Personal data processed
- **Subjects:** customers (legal entities) and natural-person owners/directors/UBOs.
- **Data:** names, roles, nationality where recorded, and public adverse-media /
  Wikidata references matched to them.
- **Source:** Asana Customer Database (firm-owned). **Special categories:** none
  intentionally; adverse-media text may incidentally reference allegations.

## 3. Necessity & proportionality
Screening is a **legal obligation** (UAE FDL 26/2021; Cabinet 74/2020; FATF R.6/10/12).
Only data necessary for matching is used. The LLM (when enabled) receives **only a
subject name + a single public headline** — never the full customer record.

## 4. Data flows & residency
- Default: **all processing on the GitHub Actions runner; no customer data egress.**
- With `ANTHROPIC_API_KEY`: name+headline sent to Anthropic for classification.
- Public lookups (Google News, Wikidata) receive the subject name only.
- See `third-party-register.md` for processors and safeguards.

## 5. Risks to individuals & mitigations
| Risk to individual | Mitigation |
|---|---|
| Wrongful flag / reputational impact | Human-in-the-loop; decision-support only; raw evidence shown; no automated decision |
| Mis-identification (same-name) | Confidence tiers; relevance triage; MLRO verification before any action |
| Bias against non-Latin names | Transliteration recall; uniform thresholds; CI-enforced cross-script recall-parity test (`bias-fairness-testing.md`, `test/bias_eval.py`) |
| Excessive data exposure | Minimal payload to LLM; no-egress default; masking; 10-yr controlled retention |
| Tipping-off | "Do not tip off" controls; STR drafted for MLRO, never auto-filed |

## 6. Rights
Data-subject rights are handled under the firm's PDPL procedures; AML records are
exempt from certain erasure/access rights where retention is legally mandated
(10-year retention).

## 7. Conclusion
Residual risk **acceptable** with the controls above, provided: (a) the LLM key is
only provisioned alongside a signed DPA + this DPIA, and (b) human review remains
mandatory before any freeze/decline/report. Re-assess on any change to data sent to
third parties.
