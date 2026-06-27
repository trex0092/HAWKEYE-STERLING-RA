# Cybersecurity Skills (Claude Code plugin)

Hawkeye Sterling ships with a Claude Code plugin reference to the
[**Anthropic Cybersecurity Skills**](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)
library — an Apache-2.0 knowledge base of **817 structured agent skills** across 29
security domains, mapped to MITRE ATT&CK, NIST CSF, MITRE ATLAS, MITRE D3FEND,
NIST AI RMF, and the MITRE **F3 (Fight Fraud Framework)**.

The plugin gives Claude Code (and any [agentskills.io](https://agentskills.io)-compliant
agent) expert-level, decision-workflow guidance when working on the security,
fraud-typology, and threat-intelligence aspects of this AML/CFT tool — code review,
incident response on the deployment, and enriching the screening pipeline.

> **Authorized & lawful use only.** These skills are operational security
> workflows. Use them solely for defensive work on assets you own or are
> explicitly authorized to test, and in compliance with applicable law and the
> upstream [SECURITY.md](https://github.com/mukul975/Anthropic-Cybersecurity-Skills/blob/main/SECURITY.md).

## How it's wired in

The plugin marketplace is pre-declared and the plugin is pre-enabled in
[`.claude/settings.json`](../.claude/settings.json):

```json
{
  "extraKnownMarketplaces": {
    "anthropic-cybersecurity-skills": {
      "source": { "source": "github", "repo": "mukul975/Anthropic-Cybersecurity-Skills" }
    }
  },
  "enabledPlugins": {
    "cybersecurity-skills@anthropic-cybersecurity-skills": true
  }
}
```

When you open this repo in Claude Code, it discovers the `anthropic-cybersecurity-skills`
marketplace and enables the `cybersecurity-skills` plugin automatically. (On first
use Claude Code will ask you to trust the marketplace — confirm it once.)

### Manual install (other agents / CLIs)

The library follows the agentskills.io standard, so it also installs outside
Claude Code:

```bash
# Any agentskills.io-compliant tool (Claude Code, Copilot, Cursor, Gemini CLI, Codex CLI)
npx skills add mukul975/Anthropic-Cybersecurity-Skills

# Or vendor the whole library locally
git clone https://github.com/mukul975/Anthropic-Cybersecurity-Skills.git
```

> **Network note (CI / sandboxes):** installing the plugin fetches from
> `github.com/mukul975/Anthropic-Cybersecurity-Skills`. In egress-restricted
> environments (including this project's hardened GitHub Actions runners) that
> host may be blocked by policy — the skills are intended for **local /
> developer Claude Code sessions**, not for the locked-down workflow runners.
> Do not add this host to a workflow's allowlist just to satisfy the plugin.

## Skill structure

Each skill is a self-contained folder:

```
skills/<skill-name>/
├── SKILL.md          # YAML frontmatter + the decision-workflow body
├── references/
│   ├── standards.md  # framework mappings
│   └── workflows.md  # technical procedures
├── scripts/          # helper code
└── assets/           # templates & checklists
```

## Domain coverage (29 domains, 817 skills)

| Domain | Skills | Domain | Skills |
|---|---:|---|---:|
| Cloud Security | 66 | Vulnerability Management | 25 |
| Threat Hunting | 58 | Penetration Testing | 21 |
| Threat Intelligence | 52 | DevSecOps | 18 |
| Network Security | 43 | Zero Trust Architecture | 17 |
| Web Application Security | 42 | Endpoint Security | 17 |
| Digital Forensics | 41 | Cryptography | 16 |
| Malware Analysis | 39 | Phishing Defense | 15 |
| Identity & Access Management | 37 | AI Security | 14 |
| SOC Operations | 35 | Mobile Security | 13 |
| Red Teaming | 33 | Ransomware Defense | 13 |
| Container Security | 33 | Compliance & Governance | 9 |
| Security Operations | 28 | Supply Chain Security | 8 |
| OT/ICS Security | 28 | Deception Technology | 6 |
| API Security | 28 | Hardware & Firmware Security | 4 |
| Incident Response | 26 | | |

### Framework mappings

- **MITRE ATT&CK** v19.1 — 286 techniques across 15 tactics
- **NIST CSF** 2.0 — 6 functions, 22 categories
- **MITRE ATLAS** v5.4 — AI/ML adversarial threats
- **MITRE D3FEND** v1.3 — 267 defensive techniques
- **NIST AI RMF** 1.0 — 72 subcategories
- **MITRE F3** v1.1 — Fight Fraud Framework, 123 fraud techniques

## Where it maps to Hawkeye Sterling

This tool is AML/CFT entity risk assessment, not a SOC platform — most of the 817
skills are out of scope. The slices that are directly useful here:

| Need in this repo | Relevant skill domains |
|---|---|
| **Fraud typologies & financial-crime TTPs** — informing risk factors, EDD triggers, and narrative rationale | **MITRE F3** fraud skills (Positioning / Monetization tactics), Compliance & Governance — see the [F3 mapping](fraud-f3-mapping.md) of this tool's own typologies |
| **Adverse-media & threat-feed enrichment** (`scripts/adverse-media.mjs`, `scripts/interpol-check.mjs`) | **Threat Intelligence** (STIX/TAXII, MISP, OpenCTI, IOC analysis, actor profiling) |
| **Phishing / BEC context** for onboarding-risk and impersonation narratives | **Phishing Defense** (BEC detection, phishing IR) |
| **Securing the deployment & supply chain** (the static site, GitHub Actions, dependencies) | Web Application Security, DevSecOps, Supply Chain Security, CodeQL/Scorecard-adjacent workflows |
| **AI-governance of the Advisor/Console personas** (ATLAS / NIST AI RMF), complementing [`docs/governance/`](governance/) | AI Security |

The AML *compliance* logic itself (sanctions list screening, PEP, FATF lists)
remains owned by this repo's own scripts and data — the skills library adds
adversary/fraud-side and engineering-security context around it, it does not
replace the compliance pipeline.

## Upstream

- Repository: <https://github.com/mukul975/Anthropic-Cybersecurity-Skills>
- License: Apache-2.0
- Standard: [agentskills.io](https://agentskills.io)
