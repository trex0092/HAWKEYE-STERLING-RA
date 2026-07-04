# Security Tooling Reference — relevance to Hawkeye Sterling

**Subject application:** Hawkeye Sterling — Entity Risk Assessment (RA)
**Date:** 2026-07-04 · **Prepared by:** Compliance engineering

> Hawkeye Sterling is an **AML/CFT entity risk-assessment tool**, not a SOC
> platform. A general catalogue of security tools is therefore mostly *out of
> scope*. This note is the honest mapping: for each widely-cited free tool, does
> it touch this repository's actual attack surface (a static site + serverless
> functions + hardened GitHub Actions) or its screening pipeline — and if not, it
> is named as **not applicable** rather than silently implied. It complements
> [`docs/cybersecurity-skills.md`](../cybersecurity-skills.md).

## What this repo's security posture already uses

The app-security and supply-chain controls are wired into CI, not bolted on:

| Concern | In this repo |
|---|---|
| Static code security scanning | **CodeQL** (`.github/workflows/codeql.yml`), **Semgrep** (`semgrep.yml`, `.semgrep/`) |
| Secret scanning | **Gitleaks** (`gitleaks.yml`, `.gitleaks.toml`) |
| Dependency / supply-chain | **OSV-Scanner** (`osv-scanner.yml`), dependency review, **SBOM** (`scripts/gen-sbom.mjs`), **OpenSSF Scorecard** |
| Dynamic app testing | **OWASP ZAP** baseline (`dast-zap.yml`) |
| Content-Security-Policy | pure `'self'` policy; CSP-report function (`netlify/functions/csp-report.js`) |

## Mapping the "20 free tools" to this codebase

| Tool | Purpose | Relevance here |
|---|---|---|
| **OWASP ZAP** | Web app & API security testing | ✅ **In use** — `dast-zap.yml` scans the deployed site. |
| **Semgrep CE** | Static code security scanning | ✅ **In use** — `semgrep.yml`. |
| **Gitleaks** | Secret scanning for repositories | ✅ **In use** — `gitleaks.yml`. |
| **Checkov** | Infrastructure-as-code scanning | ⚠️ **Limited** — little IaC (Netlify config only); low value now, reconsider if IaC grows. |
| **YARA** | Malware rule matching | ◐ **Adjacent** — pattern-matching model that informs adverse-media / threat-feed enrichment concepts, not run in-app. |
| **MISP** / **OpenCTI** | Threat-intelligence sharing / management | ◐ **Adjacent** — the STIX/TAXII sharing model behind CTI-style adverse-media & PEP enrichment; conceptually relevant, not integrated. |
| **CyberChef** | Encoding / decoding / data analysis | ◐ **Adjacent** — useful *manually* during an investigation (decoding indicators), not part of the app. |
| **Hashcat** | Password audit & recovery | ◐ **Adjacent** — informs credential-hygiene guidance only. |
| **Wireshark** | Packet capture & protocol analysis | ❌ N/A — no network layer to inspect in a static site. |
| **Nmap** | Network discovery & port scanning | ❌ N/A — no owned network/hosts. |
| **Burp Community** | Manual web security testing | ➖ Optional — a manual complement to ZAP for ad-hoc testing. |
| **Metasploit** | Exploit validation & lab testing | ❌ N/A — offensive lab tool, out of scope. |
| **OpenVAS** | Vulnerability scanning | ❌ N/A — no owned infrastructure to scan (host is managed). |
| **Snort** | Network intrusion detection | ❌ N/A — no network to monitor. |
| **Falco** | Runtime (container) threat detection | ❌ N/A — no containers/K8s. |
| **osquery** | Endpoint visibility with SQL | ❌ N/A — no fleet of endpoints. |
| **Velociraptor** | DFIR collection & live response | ❌ N/A — no endpoints/hosts to respond on. |
| **Ghidra** | Reverse-engineering analysis | ❌ N/A — no binaries in scope. |

**Legend:** ✅ in use · ◐ conceptually adjacent to the AML/threat-intel side ·
⚠️ limited value · ➖ optional · ❌ not applicable to this attack surface.

## Bottom line

The tools that matter here — SAST, secret-scanning, dependency/SBOM, and DAST —
are **already running in CI**. The threat-intelligence tools (MISP/OpenCTI/YARA/
CyberChef) are relevant only as the *conceptual* backdrop to the app's
adverse-media and threat-feed enrichment. The network/endpoint/offensive tools do
not map to a static-site + serverless attack surface and are listed as N/A so the
boundary is explicit.

> **Authorized & lawful use only.** Any use of these tools must be against assets
> you own or are explicitly authorized to test, in compliance with applicable law.
