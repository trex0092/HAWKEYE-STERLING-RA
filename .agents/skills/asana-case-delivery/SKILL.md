---
name: asana-case-delivery
description: Diagnose and verify Hawkeye Sterling screening results, case cards, evidence attachments and escalation delivery to Asana. Use when screening results are missing, Asana reports look successful but cannot be read back, retry/duplicate cases appear, or MLRO review cannot find the latest run.
---

# Asana Case Delivery Verification

## Inputs and identity boundaries

- GitHub Actions run URL, exact commit and persisted case/report state for that run.
- Expected screening-source projects **1214107620220121** and **1216239131596624**; verify their contents independently and confirm source vs destination semantics.
- Approved compliance evidence project **1216203370612914**. Verify actual section membership; never infer it from a successful POST alone.
- Access through an authorized Asana connector. Never request, print, copy, rotate, or store tokens.

## Safe verification workflow

1. Read `scripts/screening-cases.mjs`, `scripts/screening-delivery.mjs`, `scripts/asana-notify.mjs`, and `scripts/asana-alert.mjs` at the target commit.
2. Match run date, source provenance and report-card name. Resolve a card by verified task GID, project, section, ownership marker and remote read-back.
3. Verify report attachments and numbered evidence pages exist and match the intended run. Do not accept 2xx responses alone as proof of delivery.
4. For an uncertain POST outcome, **read before retry**. Never blindly replay non-idempotent task, comment or attachment creation.
5. If report/case delivery fails, escalate an aggregate-only operational alert. Keep cases open for human review and verify the failure reference appears in the existing approved Asana alert.
6. An MLRO clearance requires independently confirmed human disposition mark, exact audit story and final task state before updating the local AML ledger. No automated false-positive clearance.
7. Distinguish degraded-but-delivered reports from complete operational screening. Asana delivery does not cure a news-backbone outage.

## Report format

Provide task link/GID, expected destination, remotely confirmed section and attachment receipts, evidence age, source run/commit, missing or duplicate records, any ambiguous writes, and an explicit verified/unverified conclusion. Redact customer, employee, beneficiary, PEP and sanctions-hit identifiers from logs.

## Prohibitions

No Netlify changes. Never mark AML cases cleared, overwrite human explanations, change the MLRO, suppress screening failure, or silently alter the two source populations.
