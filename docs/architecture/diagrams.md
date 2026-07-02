# Architecture Diagrams

Enterprise diagram set (Mermaid — renders natively on GitHub, no tooling). These
complement the narrative and the data-flow / trust-boundary / STRIDE analysis in
[`../architecture.md`](../architecture.md). Date: 2 Jul 2026.

Index: [System Context](#1-system-context) · [Trust Boundaries](#2-trust-boundaries) ·
[Risk-Assessment Workflow](#3-risk-assessment-workflow-swimlane) ·
[Screening / Compliance Workflow](#4-screening--compliance-workflow) ·
[Scoring Decision Flow](#5-scoring-decision-flow) · [Audit-Trail Flow](#6-audit-trail-flow) ·
[User Journey](#7-user-journey).

## 1 · System Context
Who and what the platform talks to.

```mermaid
flowchart LR
    Analyst([Analyst]) --> APP
    MLRO([Reviewer / MLRO]) --> APP
    Admin([Administrator]) --> APP
    APP["Hawkeye Sterling RA<br/>(browser app + Netlify functions)"]
    CI["GitHub Actions<br/>monitoring estate"]
    APP -->|"completed assessments,<br/>register/log mirror"| ASANA[(Asana<br/>HAWKEYE STERLING APP)]
    CI -->|"sanctions/PEP/adverse/FATF/reg alerts"| OM[(Asana<br/>Ongoing Monitoring)]
    CI -->|"reads customers"| CUST[(Asana<br/>Customer Database)]
    APP -.->|"Advisor Q&A (gated)"| ANTH[[Anthropic API]]
    CI -->|"read-only"| SRC[[OFAC · UN · EU · UK · UAE lists<br/>Google News · GDELT · Wikidata]]
```

## 2 · Trust Boundaries
Every arrow that crosses a box is a control point (full control table in `architecture.md`).

```mermaid
flowchart TD
    subgraph UNTRUSTED["🔒 User device — untrusted"]
        BR["Browser app + encrypted local store<br/>AES-256-GCM · hash-chained log"]
    end
    subgraph EDGE["Netlify edge"]
        HD["Pure-'self' CSP · Trusted Types · HSTS"]
    end
    subgraph TRUSTED["☁️ Serverless — trusted (holds keys)"]
        FN["asana-task · asana-mirror · risk-backup · brain-soul"]
    end
    subgraph AUTO["⚙️ GitHub Actions — trusted (holds secrets)"]
        WF["screen.py · scripts/* · 10/10 egress-blocked"]
    end
    subgraph EXT["🌐 External processors / sources"]
        TP["Anthropic · Asana · public lists"]
    end
    BR -->|HTTPS same-origin| HD
    HD -->|/.netlify/functions/*| FN
    FN -->|"name + 1 headline (data-minimised)"| TP
    WF -->|"allowlisted egress only"| TP
```

## 3 · Risk-Assessment Workflow (swimlane)
Who does what, from draft to filed evidence.

```mermaid
flowchart TD
    subgraph A["Analyst"]
        A1[Enter entity + answer 6 sections] --> A2[Review score / band / factors]
        A2 --> A3[Apply override w/ reason<br/>optional, raises only]
    end
    subgraph R["Reviewer / MLRO"]
        R1{Second-line review} -->|approve| R2[Mark Complete]
        R1 -->|reject| A2
    end
    subgraph S["System"]
        S1[Deliver to HAWKEYE STERLING APP<br/>right band section + custom fields] --> S2[Mirror register/log · audit-log ok]
    end
    A3 --> R1
    R2 --> S1
```

## 4 · Screening / Compliance Workflow
The daily automated control loop.

```mermaid
flowchart TD
    T([Scheduled trigger]) --> RC[Read customers<br/>from Customer Database]
    RC --> G{customers &gt; 0<br/>AND lists loaded?}
    G -->|no| BAIL[⛔ Refuse to run —<br/>degrade loudly, open issue]
    G -->|yes| SC[Screen: sanctions · PEP · adverse media]
    SC --> D{new / changed match?}
    D -->|yes| AL[File alert in Ongoing Monitoring<br/>→ MLRO decision]
    D -->|no| LG[Record run evidence]
    SC --> AN[Runtime + coverage + AM-degradation<br/>anomaly checks]
    AN -->|sustained| ESC[Anomaly Watch opens MLRO issue]
```

## 5 · Scoring Decision Flow
How inputs become an operative outcome (deterministic).

```mermaid
flowchart TD
    IN[Questionnaire + Risk Data baseline + overrides] --> SUM[Aggregate score 0–30]
    SUM --> B{Numeric band}
    B -->|"≤19"| CDD[CDD]
    B -->|"20–22"| SDD[SDD]
    B -->|"≥23"| EDD[EDD]
    CDD --> H{Hard rules / escalations?}
    SDD --> H
    EDD --> H
    H -->|prohibitive trigger| PROH[⛔ PROHIBITED]
    H -->|escalation| EDD2[force EDD]
    H -->|none| OUT[Operative outcome]
    OUT --> OV{Analyst override?}
    OV -->|"raise only — never weakens PROHIBITED"| FINAL[Final outcome + audit line]
    OV -->|none| FINAL
```

## 6 · Audit-Trail Flow
Why every action is defensible.

```mermaid
flowchart LR
    ACT[Any action:<br/>score · override · role · complete] --> LOG[Hash-chained activity log<br/>tamper-evident, encrypted]
    LOG --> MIR[Asana mirror<br/>register + log backup]
    MIR --> REC[asana-reconcile<br/>drift check, PII-free]
    LOG --> DEL[Delivery outcome<br/>asana.delivery.ok / failed]
    DEL --> RETRY[Failed → retry-all queue]
```

## 7 · User Journey (first-run → steady state)

```mermaid
flowchart LR
    J1[Open app] --> J2[Set passphrase + 2FA]
    J2 --> J3[Set role]
    J3 --> J4[Review Risk Data baseline]
    J4 --> J5[TEST-000 verification]
    J5 --> J6[Real assessments]
    J6 --> J7[Reviewer completes → Asana evidence]
    J7 --> J6
```

*Diagrams describe the system as implemented at the date above; keep them in step
with `architecture.md` and the model cards when the design changes.*
