# Explainability & Interpretability Statement — 2026

How every output of this system can be explained to an analyst, an auditor, or a
regulator — the "transparency/interpretability" expectation of the Alan Turing
Institute's FAST principles and the UAE AI Charter (transparency).

**Owner:** MLRO · Compliance Engineering · **Date:** 2026-06-30.

## 1. The risk score is fully interpretable (not a model)
The Entity Risk Assessment 0–30 score is **deterministic, rules-based** — no
machine-learned model, no opaque weights. Every score is reproducible and is
shown with its **contributing factors** (jurisdiction, activity, materials,
ownership, PEP, sanctions, FATF status, CDD gaps). The weights, band boundaries,
and hard-outcome logic are documented in [`model-validation-2026.md`](model-validation-2026.md)
and frozen by golden tests (`test/scoring-golden.test.js`). Anyone can trace a
band back to the exact inputs that produced it.

## 2. Hard outcomes are stated as rules
PROHIBITED and mandatory-EDD floors override the numeric band and are expressed as
explicit conditions, not inferred — so a "why was this prohibited?" question has a
one-line, rule-based answer.

## 3. The Advisor is transparent and grounded
- Outputs are labelled **`[AI]`** (vs `[Auto]`/deterministic) and carry the audit
  line *"decision support, not a decision — MLRO review required."*
- Answers are **cited** (the "every answer cited" promise) so the basis is checkable.
- The Advisor classifies/triages **grounded** inputs (real headlines), it does not
  invent facts; an output-structure validator and hallucination/PII/tipping-off
  guards run in `brain-soul.js`.
- On any model failure the system **falls back to deterministic logic**, which is
  the system of record.

## 4. Screening signals are explainable
Sanctions/PEP/adverse-media hits show the **matched entry, list/source, and score**;
fuzzy matches show the similarity basis; an **unscreenable** subject is explicitly
flagged for manual review rather than silently cleared.

## 5. Limits (stated honestly)
The third-party LLM's internal reasoning is not itself interpretable; this is why
the LLM is confined to grounded, decision-support tasks behind a human, never an
autonomous decision. PEP coverage via Wikidata is a documented best-effort signal,
not screening-grade — absence of a hit is not assurance.

See the controls crosswalk in [`ai-frameworks-crosswalk-2026.md`](ai-frameworks-crosswalk-2026.md)
and the system/data flow in [`../architecture.md`](../architecture.md).
