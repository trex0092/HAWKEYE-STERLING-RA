# Administrator Guide — System owner

*For the system owner/administrator. Role = `admin`. Covers setup, secrets,
security settings and operations. Pairs with the
[app-setup runbook](../app-setup-runbook.md).*

## Your role
All reviewer capabilities **plus** security settings (2FA/device reset) and
risk-data resets. You own the server-side configuration.

## One-time server setup (already done centrally)
| Item | Where |
|---|---|
| `ASANA_ACCESS_TOKEN` | Netlify env (never in the browser) |
| `ASANA_PROJECT_GID` → HAWKEYE STERLING APP | Netlify env + code default |
| `ANTHROPIC_API_KEY` (optional, for Advisor/triage) | Netlify env + GitHub secret |
| Monitoring secrets (`ASANA_ACCESS_TOKEN`) | GitHub Actions secrets |
| `STATE_ENCRYPTION_KEY` (encrypts screening state branches, P30) | GitHub Actions secret, **pending: create it to switch state commits to encrypted** |
| **4 Asana custom fields** → `ASANA_CF_*` | **pending — create then wire** |

## Per-device setup (each officer)
Follow [`app-setup-runbook.md`](../app-setup-runbook.md) §2–§5: passphrase +
encryption, 2FA (TOTP), role, Risk Data review, identity/policy names/delivery
mode. Then the §6 TEST-000 verification before real use.

## Secrets & rotation
- Secrets live in Netlify env and GitHub Actions secrets — **never** in the repo
  or the browser (enforced by gitleaks + a Semgrep client-secret rule).
- Rotate on personnel change or suspected exposure: update the secret in Netlify
  and GitHub; no code change needed (values are read from env).

## Security settings
- 2FA (TOTP) and device reset are admin-only. There is **no passphrase recovery** —
  a lost passphrase means that device's local state is unreadable (the Asana
  mirror remains the off-device copy).
- Roles are stored per device; changes are audit-logged.

## Enabling the AI features (after the DPA)
1. Sign the Anthropic DPA; confirm the PDPL transfer basis.
2. Set `LLM_TRIAGE=1` (adverse-media triage) and/or provision `ANTHROPIC_API_KEY`
   for the Advisor. With no key, everything runs deterministic with no egress.
3. The quarterly advisor bias eval then self-runs.

## Operations you own
- **Backups/DR** — the Asana mirror + monthly git commit of risk-data overrides
  are automatic; GitHub/Netlify/Asana form the recovery triangle (see
  [`backup-recovery.md`](../governance/backup-recovery.md)).
- **BCP drill** — periodically confirm a second person can rotate secrets and
  operate (closes risk R-17).
- **Monitoring** — the assurance workflows run themselves (live count in
  [`data/board-figures.json`](../../data/board-figures.json), generated, never
  hand-maintained); the daily AI Governance Report flags any control that stops
  (STALE). Investigate Anomaly Watch issues.

## Reference
API contracts → [`../api/functions.md`](../api/functions.md) · architecture →
[`../architecture/`](../architecture/README.md) · assurance →
[`../governance/assurance-coverage-matrix.md`](../governance/assurance-coverage-matrix.md).
