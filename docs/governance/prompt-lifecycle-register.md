# Prompt Lifecycle Register — PromptOps

**What the model is told, versioned like code that it is.**

**Owner:** MLRO (accountable) · Compliance Engineering (operational)
**Source of truth:** [`data/prompt-assets.json`](../../data/prompt-assets.json) (machine-readable; this page is the human view)
**Enforcement:** [`test/prompt-register.test.mjs`](../../test/prompt-register.test.mjs) (CI, every pull request)
**Change control:** [`model-validation-2026.md`](model-validation-2026.md)
**Review cadence:** quarterly with the [AI asset register](ai-asset-register.md), **and on every edit** — the edit is the trigger.
**Last reviewed:** 2026-07-28

> **Why this register exists.** The [AI asset register](ai-asset-register.md)
> answers *which* AI surfaces exist. The eval and bias packs answer *how well*
> they perform. Neither answers *what they were told to do, and who approved
> that wording* — and for this suite the wording is the control: the Advisor's
> ten prohibitions, the "invent nothing" clause on report prose, and the
> untrusted-data contract that stops a headline from issuing instructions are
> all prompt text, not code paths. Until now that text was governed only by git
> history and by content assertions in
> [`test/advisor-assurance.test.js`](../../test/advisor-assurance.test.js),
> which check that certain phrases are *present* — not that the surrounding
> instruction set is the one an accountable person approved.

---

## 1. The register

Seven governed prompt artefacts across the three registered AI surfaces. Every
row is pinned to a SHA-256 of the exact source region that defines it.

| ID | Serves | Role | Where | What it controls |
|---|---|---|---|---|
| `advisor-soul-charter` | `advisor` | system | `netlify/functions/brain-soul.js` → `SOUL_CHARTER` | Prohibitions P1–P10, refusal protocol, match-confidence and allegation taxonomies, injection resistance |
| `advisor-knowledge-context` | `advisor` | system | same file → `buildKnowledgeContext()` | The framing that carries typologies, KRIs, red flags and appetite thresholds into the prompt |
| `advisor-persona-suffix` | `advisor` | system fragment set | same file → `PERSONA_SUFFIX` | 16 persona specialisms — may narrow focus, never widen authority |
| `triage-grounding-system` | `ai-triage` | system | `ai.py` → `GROUNDING_SYSTEM` | Grounding + the `<<UNTRUSTED>>` prompt-security contract for every Python-side call |
| `triage-classify-user` | `ai-triage` | user template | `ai.py` (classification call) | The minimised payload actually sent: name + one headline, JSON output contract, 120-token budget |
| `triage-narrative-user` | `ai-triage` | user template | `ai.py` (`REPORT_ALLOW_LLM` gate) | The only template whose output could reach a filed report — off in production |
| `reg-draft-analyst` | `reg-draft` | user template | `scripts/reg-draft.mjs` | Delta-grounded drafting, severity line, do-not-invent-citations clause |

Each row in the JSON also carries its **purpose**, the **risk if changed
unreviewed**, its **runtime guards**, the **assurance controls** attached to it,
a **version**, and the **approval record** (`approved_by` / `approved_on`).

---

## 2. How change control works

1. Someone edits a prompt.
2. CI fails: `prompt "<id>" matches its approved fingerprint` — with the fix in
   the failure message.
3. The change is reviewed **as a prompt change**, not as an incidental diff.
4. `node scripts/prompt-register.mjs --update` re-pins the hash and bumps the
   row's version; the author records `approved_by` / `approved_on` in the same
   pull request.
5. The diff of `data/prompt-assets.json` is the audit trail: what the text was,
   what it became, which version, approved by whom, on what date.

There is no way to ship an edited prompt without step 4, and no way to do step 4
without stating who approved it. That is the whole control.

```
$ node scripts/prompt-register.mjs
  ok       advisor-soul-charter        079099dfacc41e98…  (8618 bytes)
  changed  triage-grounding-system     4b1c…              (860 bytes)
```

**Anti-shadow-prompt.** The same suite scans every file that calls
`api.anthropic.com` and fails if it has no registered prompt, so a new LLM
surface cannot ship with an unreviewed instruction set. The two eval harnesses
are allowlisted: their adversarial inputs are assurance *over* these prompts,
listed in each row's `assurance` field.

---

## 3. What each prompt is assured by

Fingerprinting proves the text is the approved text. It says nothing about
whether the text is *good* — that is what these controls are for, and each row
names the ones that apply to it:

| Control | Covers | Cadence |
|---|---|---|
| [`test/advisor-assurance.test.js`](../../test/advisor-assurance.test.js) | Charter content: P1–P10, refusal protocol, injection clause, Article 25 basis, taxonomies; knowledge-block integrity | Every PR |
| [`test/redteam_injection.py`](../../test/redteam_injection.py) | The `<<UNTRUSTED>>` contract under a standing injection corpus: detection, non-execution, no-downgrade | Every PR |
| [`scripts/advisor-eval.mjs`](../../scripts/advisor-eval.mjs) | Live behavioural eval of the assembled system prompt | Weekly (key-gated) |
| [`scripts/advisor-bias-eval.mjs`](../../scripts/advisor-bias-eval.mjs) | Paired-prompt bias review across personas — see [`advisor-bias-review-2026.md`](advisor-bias-review-2026.md) | Quarterly (key-gated) |
| [`red-team-procedure.md`](../aims/red-team-procedure.md) + [`red-team-log.md`](../aims/red-team-log.md) | Manual campaign rounds against the charter and the untrusted-data contract | Quarterly (register item 15) |

---

## 4. Scope and limits — stated honestly

- **The fingerprint covers a source region, not a rendered prompt.** For the
  Advisor the final system prompt is `SOUL_CHARTER` + `KNOWLEDGE_CONTEXT` +
  one persona suffix, assembled per request; all three parts are registered, the
  concatenation itself is code covered by the surface's own tests.
- **`advisor-knowledge-context` pins the framing, not the catalogue.** Editing a
  typology's wording does not trip this register; it trips the integrity checks
  in `test/advisor-assurance.test.js` and is versioned by git history. Adding or
  removing a whole knowledge *block* does trip it, which is the failure that
  matters.
- **Approval is a human act.** Every row currently reads *baseline registration*
  by Compliance Engineering: the text pinned is the text already running in
  production on 2026-07-28, not a fresh MLRO ratification. First ratification is
  due at the next quarterly review, together with the asset register.
- **Model versions are not prompt versions.** Model routing (haiku/sonnet/opus)
  is governed in [`ai-asset-register.md`](ai-asset-register.md) and pinned by
  `test/advisor-assurance.test.js`; this register governs instructions only.

---

## 5. Framework mapping

| Framework | Clause | How this register satisfies it |
|---|---|---|
| ISO/IEC 42001 | A.6.2.4 (AI system verification/validation), A.6.2.2 (documentation of system design) | Prompt artefacts are documented, versioned and approved; change triggers re-validation |
| NIST AI RMF | MANAGE 2.2 (mechanisms to sustain AI systems), MAP 2.3 | Change to system behaviour cannot occur without a recorded, reviewed decision |
| EU AI Act (voluntary) | Art. 13-style transparency; Art. 12-style record-keeping | The instruction set behind every output is on file with its approval record |
| UAE "Securing Agentic AI" | Prompt Security pillar | The untrusted-data contract is a registered, fingerprinted artefact with a standing red-team corpus against it |

---

**Related:** [`ai-asset-register.md`](ai-asset-register.md) ·
[`tool-connector-register.md`](tool-connector-register.md) ·
[`model-validation-2026.md`](model-validation-2026.md) ·
[`assurance-coverage-matrix.md`](assurance-coverage-matrix.md)
