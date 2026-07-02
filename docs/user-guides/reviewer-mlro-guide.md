# Reviewer / MLRO Guide — Second-line

*For the MLRO / second-line reviewer. Role = `reviewer`. You are the accountable
decision-maker; the system is decision-support.*

## Your role
Everything the analyst can do, **plus**: mark assessments **Complete** (the
sign-off that delivers evidence to Asana) and **edit the Risk Data baseline**.
Completion requires your identity in the sign-off field.

## Reviewing an assessment
1. Open the drafted assessment; verify the entity, factors and any analyst
   override reason.
2. Confirm screening posture: sanctions / adverse-media / PEP signals were
   considered; a MANUAL REVIEW subject has been screened.
3. **Complete** — on sign-off the system:
   - files a task in **HAWKEYE STERLING APP**, in the section matching the band
     (LOW/MEDIUM/HIGH/PROHIBITED), with custom fields (Reference/Tier/Score/Next
     Review) populated;
   - creates the auto-backup mirror tasks;
   - writes `asana.delivery.ok` to the tamper-evident activity log.
4. If delivery fails, it is visible and **retryable** (retry-all) — no assessment
   is silently lost.

## Decisions the system will never make for you
Sanctions freeze / decline / STR filing are **your** decisions with dual
attestation (UAE Federal Decree-Law 10/2025 Art.16/18; FATF R.26). The engine
detects and evidences; you decide and file.

## Adverse-media, PEP & repeat patterns
- Review the daily **Adverse Media & PEP** task and any **⚠ REPEAT ADVERSE-MEDIA
  PATTERN** (≥3 stories/90 days) — treat as EDD + STR-grounds assessment, mindful
  of tipping-off rules.
- A PEP non-hit is **not** clearance — record your determination.

## Risk Data baseline
You maintain the firm-approved country/activity/material scores and the FATF
call-for-action flag. Every override needs a reason, is audit-logged, and mirrors
to Asana (monthly git backup). Prefer **Import sheet** over re-keying.

## Monitoring you should read
- Daily **Compliance Brief** (AML rollup) and daily **AI Governance Report**
  (control health; a STALE flag means a control stopped running).
- Any **Anomaly Watch** GitHub issue (sustained degradation) — investigate and
  record disposition.

## Tokenised delivery (PDPL)
Decide per device: full detail vs **🔒 tokenise** (reference/tier/score/dates
only; identity stays on device).
