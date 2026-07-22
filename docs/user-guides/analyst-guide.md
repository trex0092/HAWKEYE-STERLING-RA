# Analyst Guide — First-line

*For the first-line analyst who drafts and scores assessments. Role = `analyst`.*

## Your role
You **draft and score** customer risk assessments. You **cannot** mark an
assessment Complete — that is second-line (reviewer/MLRO) sign-off. Everything you
do is audit-logged.

## Daily flow
1. **Open the app** and unlock with your passphrase (and 2FA code if enabled).
2. **New assessment** — enter the entity and work through the six sections:
   jurisdiction, business activity, onboarding channel, operational history,
   relationship duration, ownership/control/compliance, and supply-chain materials.
3. **Read the result** — the gauge, the **band** (CDD / SDD / EDD / PROHIBITED),
   and the **per-factor breakdown**. If the score is 22, note the warning that a
   single factor change would tip it into EDD.
4. **Override (only if justified)** — you may *raise* diligence with a documented
   reason; you can never weaken a PROHIBITED outcome. The reason is logged.
5. **Hand off** — the assessment waits for a reviewer to complete it. You cannot
   self-complete (segregation of duties).

## What to check before handing off
- Entity legal name and identifiers are correct (they drive screening).
- Any override has a clear, defensible reason.
- Assessor name is set in the header (completion is blocked without it).

## Good practice
- Work screening alerts through the
  [alert-investigation decision tree](alert-investigation-decision-tree.md) —
  false positive? → enough information? → escalate? → suspicion? — and document
  every disposition.
- Treat every AI/advisor note as **decision-support, not a decision**.
- Use the **Advisor** page for "how do I treat this?" questions — it gives cited
  guidance, never a ruling on a specific customer's sanctions status.
- If a subject can't be screened (non-Latin/short name → MANUAL REVIEW), flag it
  for manual screening rather than assuming it's clear.

## What you cannot do
Mark Complete · edit the Risk Data baseline · change security/2FA settings. Ask a
reviewer/administrator for those. See the [reviewer](reviewer-mlro-guide.md) and
[administrator](administrator-guide.md) guides.
