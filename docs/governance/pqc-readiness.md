# Post-Quantum Cryptography (PQC) Readiness

**Subject application:** Hawkeye Sterling — Entity Risk Assessment (RA)
**Date:** 2026-07-04 · **Prepared by:** Compliance engineering
**Status:** Watch item — low present exposure, recorded for crypto-agility.

> This note answers a governance question, not a present incident: does the
> **"harvest now, decrypt later" (HNDL)** quantum threat require action for a
> browser-only AML/CFT risk-assessment tool that retains records for years? The
> honest answer is **"record it in the crypto inventory and stay agile,"** not
> "migrate today." It complements the AI-governance set in [`docs/governance/`](.)
> and the in-app Q&A ("AI Governance, Cybersecurity & Data Protection").

## 1 · Why this is on the register at all

AML records — KYC files, screening evidence, STR/SAR material — must be retained
for **at least five years** (UAE Federal Decree-Law No. 10 of 2025) and often
longer. HNDL adversaries copy encrypted data today and decrypt it later, once a
**cryptographically-relevant quantum computer (CRQC)** can break today's RSA/ECC.
Any data whose confidentiality must survive a decade is, in principle, in scope.

"Q-Day" (the day a CRQC exists) is **not here yet** and experts disagree on
timing, but because migration takes years and HNDL is available now, the prudent
posture is to **inventory and plan**, not to wait for the breach.

## 2 · This tool's actual cryptographic exposure

| Where crypto is used | Algorithm | Quantum exposure | Action |
|---|---|---|---|
| On-device data at rest (`localStorage`) | **AES-256-GCM** via WebCrypto, key from PBKDF2 | **Low.** Grover's algorithm only halves symmetric strength; AES-256 retains ~128-bit post-quantum security. | None beyond keeping key length ≥ 256-bit. |
| Data in transit | **TLS** (managed by Netlify / the browser) | Deferred to the platform. PQC/hybrid key exchange (e.g. ML-KEM) is arriving in TLS stacks. | Inherit platform PQC when available; no app change. |
| Long-term **asymmetric** secrets held by the app | **None** | N/A — the app holds no long-lived RSA/ECC private keys or signed archives. | Nothing to migrate. |

**Net:** the app's only long-lived protected data is **symmetric-encrypted**, the
class quantum computing threatens *least*. The genuine asymmetric exposure (TLS)
is owned by the platform, not this codebase.

## 3 · Crypto-agility principles we hold to

1. **Inventory** — this table *is* the cryptographic inventory; update it if any
   asymmetric or signing use is added.
2. **Don't hard-code one algorithm** — keep cipher choices swappable so a future
   PQC swap is configuration, not a rewrite.
3. **Prefer platform primitives** — WebCrypto / TLS inherit PQC upgrades centrally.
4. **Watch the standards** — the NIST post-quantum suite is finalised:
   **ML-KEM (FIPS 203)** for key encapsulation, **ML-DSA (FIPS 204)** and
   **SLH-DSA (FIPS 205)** for signatures. Adopt for any new long-lived asymmetric
   protection.

## 4 · Trigger conditions that would raise this from "watch" to "act"

- The app starts holding **long-lived asymmetric secrets** or signing archived
  records (e.g. a signed STR bundle retained 10 years).
- A backend/database with server-held private keys is introduced.
- Regulators or the platform mandate PQC/hybrid TLS for the sector.

Until then: **no migration action; review annually** with the AI/security
governance cycle.

## References

- NIST **FIPS 203 / 204 / 205** (August 2024) — ML-KEM, ML-DSA, SLH-DSA.
- NIST **SP 1800-38** (Migration to Post-Quantum Cryptography) — crypto-agility.
- UAE **Federal Decree-Law No. 10 of 2025** — AML record-retention obligations.
