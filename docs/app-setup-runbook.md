# App Setup Runbook — Day 0 (before first use)

**Owner:** Compliance Engineering (operational) · MLRO (accountable)
**Review cadence:** annually, and on any change to the setup steps or the deployment.

Ordered setup for **hawkeye-sterling-ra.netlify.app** before the first real
assessment. The app is on-device: every officer's browser holds its own
encrypted state, so **§2–§5 are per device**; §1 is already done centrally.

---

## 1 · Server side — already configured ✅

| Item | State |
|---|---|
| Asana delivery target (`ASANA_PROJECT_GID` → HAWKEYE STERLING APP `1216203370612914`) | ✅ Netlify env + code default |
| `ASANA_ACCESS_TOKEN` (server-side only) | ✅ set |
| Watcher/monitoring pipelines → Ongoing Monitoring | ✅ live, validated |
| **Custom fields** (Reference · Risk Tier · Score · Next Review) | ⬜ create 4 *text* fields in the HAWKEYE STERLING APP project, then set `ASANA_CF_REF/TIER/SCORE/NEXT_REVIEW` in Netlify — the one remaining setup-phase config. Do it now so the very first delivery is fully structured. |

## 2 · Device security (first thing on each device)

On first open the app shows the **Device Security** gate.

1. Choose **Set passphrase & encrypt** — never *Skip* on a production device.
   Everything stored in the browser (drafts, register, risk-data overrides,
   delivery state, activity log) is then AES-256-GCM encrypted at rest;
   sessions last 1 hour and lock after 15 minutes idle.
2. Passphrase policy: unique per officer, not reused from other systems,
   recorded in the firm's credential process. **There is no recovery** — a lost
   passphrase means the device's local state is unreadable (the Asana mirror
   remains your off-device copy).
3. Enable **2FA (TOTP)**: generate the secret in the app, scan into an
   authenticator app, confirm one code. The secret is stored encrypted.

## 3 · Role (segregation of duties)

Default role is `admin` — set the correct role per device before use:

| Device / user | Role to set | Can |
|---|---|---|
| First-line analyst | `analyst` | draft & score assessments |
| MLRO / second line | `reviewer` | everything + **mark Complete** (completion requires second-line approval) |
| System owner only | `admin` | all, incl. risk-data resets |

Role changes are written to the tamper-evident activity log.

## 4 · Risk data sheet (the scoring baseline)

Open **Risk Data** and, before any scoring:

1. Review the shipped country/activity baseline (versioned, e.g. FATF-aligned).
2. Apply the officer's overrides (e.g. current grey-list moves the watchdog has
   flagged) — each override needs a reason and is audit-logged.
3. Overrides auto-mirror to Asana and are committed to git monthly by the
   watchdog — no manual backup needed.
4. If you maintain the sheet elsewhere: **Import sheet** instead of re-keying.

## 5 · Identity, policy names & delivery mode

1. **Assessor identity** — set the assessor name (and role) in the header;
   the policy gate blocks completion if assessor / sign-off names are empty.
2. **Policy names** — narratives cite the firm's policies by name (Targeted
   Financial Sanctions procedure, Risk Appetite Statement, SoF/SoW policy,
   Responsible Sourcing, KYC, UBO, Risk Control Plan). If your manual titles
   them differently, request a rename (one-line code change) **before** real
   narratives are generated.
3. **Delivery mode decision (PDPL)** — the Register footer has
   `🔒 Asana: tokenise (no PII)`. Decide per device before the first send:
   *full detail* (entity + signatories in the Asana task) or *tokenised*
   (reference/tier/score/dates only; identity stays on device).
4. **Language** — EN/AR toggle as preferred.

## 6 · Verification protocol (closes setup)

1. Create one assessment for a clearly-labelled dummy entity
   (e.g. `TEST-000 · SETUP VERIFICATION — DELETE`).
2. As `reviewer`, mark it **Complete** → confirm the task appears in
   **HAWKEYE STERLING APP** in the right risk-band section, with the custom
   fields populated and the two auto-backup mirror tasks created.
3. Confirm the Activity Log shows `asana.delivery.ok`.
4. Delete the test task in Asana and the register entry in the app
   (both deletions are audit-logged) — or keep it as the documented E2E proof.
5. Only then begin real assessments.

## 7 · Rolling out to more devices

Each additional officer device repeats §2–§5. The register travels via the
Asana mirror: on a new device use the Console's **Refresh from Asana** to pull
the register/log summary (display-only; full state stays with its device).

---

*Server-side wiring, delivery dedup/idempotency, screening fail-safes and the
monitoring pipelines are already live and validated — see
[`assurance-coverage-matrix.md`](governance/assurance-coverage-matrix.md).*
