# AI Use-Case Intake & Approval Gate

**Owner:** MLRO  
**Operator:** Compliance Engineering  
**Applies to:** Every new AI/LLM capability and every material change to an existing AI capability.  
**Related controls:** EAI-POL-03, EAI-RSK-05.

This is the repository change-control gate for AI use cases. It prevents a new model call, provider, autonomous capability, prompt charter, material data flow, or connector from reaching production without first being classified and linked to evidence.

It complements, and does not replace, the [AI Asset Register](ai-asset-register.md), [AI Risk Register](../aims/ai-risk-register.md), [DPIA](dpia-2026.md), [third-party register](../aims/third-party-register.md), and existing PR approval controls.

## When an intake is mandatory

Complete this gate before deployment when any of the following occurs:

- a new AI/LLM surface is added;
- an existing AI surface gains a new provider or model family;
- a prompt charter materially changes the system's purpose, prohibitions or decision boundary;
- new personal, confidential, customer, employee or case data can reach an AI provider;
- an AI surface gains tools, write capability, autonomous actions or a new external connector;
- a new vendor processes AI inputs or outputs;
- human oversight, retention, geographic processing, or escalation changes materially.

Routine dependency updates or wording changes that do not alter those characteristics do not create a new use case, but remain subject to ordinary change control.

## Intake record

Copy this block into the implementing PR or its governance decision record.

| Field | Required entry |
|---|---|
| Use-case ID | Stable identifier |
| Business purpose | The decision/support task and why AI is needed |
| Accountable owner | Named role, normally MLRO for compliance AI |
| Operational owner | Team/role maintaining the capability |
| Users | Who can invoke or consume it |
| Provider/model | Provider, model family and routing |
| Inputs | Exact classes of data sent to the model |
| Outputs | What the model returns and where it can flow |
| Personal/confidential data | Yes/No, categories, minimisation |
| Tools/actions | None, read-only, or write-capable; enumerate connectors |
| Human oversight | HITL/HOTL and the exact decision retained by the human |
| Retention | Input/output/log retention and deletion route |
| Failure mode | Worst credible error or misuse |
| Risk tier | LOW / MEDIUM / HIGH |
| Legal/privacy review | DPIA/transfer/DPA applicability and evidence |
| Validation plan | Offline tests, live evals, red team, bias/fairness where applicable |
| Security controls | Auth, secrets, egress, rate limit, injection controls |
| Kill switch | How the capability is disabled |
| Incident route | Runbook and escalation owner |
| Evidence links | Register rows, tests, workflows, policy references |
| Approval | Required approver(s) and recorded decision |

## Risk-tier gates

### LOW

All of the following are required:

- asset-register entry;
- named accountable and operational owner;
- documented purpose, inputs, outputs and human review;
- no autonomous compliance decision;
- provider and retention position documented;
- at least one deterministic/offline acceptance test where technically meaningful;
- PR review.

### MEDIUM

LOW requirements, plus:

- AI risk-register review or new risk row;
- DPIA/privacy applicability review when personal data or a new cross-border flow is involved;
- provider/third-party assurance review;
- model/prompt validation plan with measurable pass criteria;
- incident route and tested kill switch;
- MLRO approval recorded in the authoritative governance record.

### HIGH

A HIGH tier is **not auto-approved by this repository process**. It requires a specific governance decision before implementation, including:

- MLRO and senior-management/Board decision rights as applicable;
- legal/privacy review;
- independent validation appropriate to the use case;
- explicit residual-risk decision;
- stronger access control and segregation;
- pre-production red-team and failure-mode testing;
- documented rollback/decommissioning route.

An AI capability that autonomously files, freezes, rejects a customer, changes a compliance record, or takes another material compliance action is outside the current Hawkeye Sterling design boundary and must be treated as a new architecture decision.

## Approval outcomes

Only four outcomes are valid:

- **APPROVED** — all required evidence exists and the named human approver has recorded the decision.
- **APPROVED WITH CONDITIONS** — conditions, owner and due date are explicit.
- **HOLD** — evidence or external dependency is incomplete; capability remains disabled.
- **REJECTED** — use case is not permitted.

No CI success, generated dashboard, model response or absence of objection constitutes approval.

## Post-approval obligations

After approval:

1. update `data/ai-assets.json`;
2. update `data/ai-controls.json` if the control boundary changes;
3. update prompt/tool/provider registers as applicable;
4. add or amend assurance tests;
5. update the six-layer crosswalk if the control model changes;
6. set a review trigger and decommissioning condition.


---

## Staged signed MLRO review evidence (8 October 2026)

The pure `netlify/functions/_human-review.js` review-readiness preflight
provides a deterministic check over a **PROPOSED-only** case artifact.
It only returns `REVIEW_READY` or `HOLD` and always sets
`approved_for_execution: false`. It **cannot authorize an STR/SAR filing,
sanctions clearance, asset freeze, case closure or customer onboarding**.

The proposal must match a bounded, recognized schema and reference evidence
IDs supplied from a trusted backend registry. Signoffs must be detached
RS256 signatures on the exact proposal SHA-256, case ID, signer identity,
approved audience, issue/expiry window and unique nonce. Each signer must
match an independently provisioned **Reviewer-MLRO** public-key identity.
Signers cannot be the case initiator. HIGH-risk proposals require at least
two different human MLRO signers; lower-risk reviews require at least one.
Untrusted or unavailable keys, missing evidence or an unrecognized risk
tier yield HOLD. This is a **readiness policy proposal**, not a Board-ratified
approval matrix.

**Critical missing enforcement:** This offline library cannot stop the
reuse of a valid signed approval. Before any production authority decision,
a server-side authenticated identity and lifecycle process, centrally
controlled current public-key register, **durable spent-nonce storage**,
race-safe idempotency, attestation retention, second-person approval,
revocation, incident handling and MLRO/Board approval are mandatory.
These signed test tokens are entirely synthetic. The existing single-device
UI role selector and shared browser token do not satisfy these prerequisites.
Human approvals and implementation of the executor remain entirely separate.
No runtime action endpoint invokes this module today.

Evidence tests are in `test/identity.test.js`. OA-20 and OA-23 remain
open; do not treat passing tests as operational control closure.
