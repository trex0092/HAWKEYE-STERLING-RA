# Red-Team Log — Campaigns & Corpus Growth (AIMS A.5.5)

The [red-team procedure](red-team-procedure.md) runs its injection corpus on
**every push** — that standing regression is real and green. What a procedure
alone cannot show is *campaign* history: when a human last tried to beat the
detector with something new, what was tried, what got in, and how the corpus
grew because of it. This log is that record. **Owner: MLRO / system
maintainer · cadence: quarterly manual round + event-driven.**

## 1. Standing automated coverage (context, not a campaign)

15-payload corpus, 5 contract properties, CI-enforced on every push — current
result **all pass** (see the procedure's pass criteria and the
[eval scorecard](../governance/eval-scorecard.md) §2). The corpus is
lexical-detection-based; the procedure's own limitations section concedes a
sufficiently novel obfuscation could evade it, relying on the degrade-safely
architecture. Manual rounds exist to hunt exactly that gap.

## 2. Corpus growth

| Date | Payloads | Change | Source |
|---|---|---|---|
| 2026-07 (baseline) | 15 | Initial corpus: instruction-override, exfiltration, role-confusion families + benign FP controls | Procedure commissioning |

## 3. Campaign rounds

Each round: scope, techniques attempted (beyond the standing corpus), result,
and corpus/detector changes fed back per the procedure's "Adding a payload"
section.

| Round | Date | Scope & techniques | Result | Corpus/detector change | Signed |
|---|---|---|---|---|---|
| 1 | _scheduled — 2026 Q3 (with the quarterly review; open-actions item 15)_ | Planned: non-lexical obfuscations (homoglyph/zero-width smuggling, multilingual imperative phrasing incl. Arabic, split-across-headline payloads), plus a fresh in-the-wild sweep | — | — | — |

## 4. Rules

- A campaign finding that evades detection is a **CAPA** (risk R-02), not just
  a corpus addition; the round row links it.
- Every technique attempted is recorded even when detection holds — "tried and
  caught" is the evidence an examiner asks for.
- New in-the-wild patterns land as corpus payloads within the same quarter
  they are observed.
