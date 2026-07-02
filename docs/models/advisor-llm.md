# Model Card — Hawkeye Sterling Advisor (LLM)

*Card date: 2 Jul 2026 · Type: **LLM, retrieval-grounded, guardrailed** · `netlify/functions/brain-soul.js` · **gated on `ANTHROPIC_API_KEY`***

> This is the card a regulator or auditor is most likely to read closely: it is the
> only *generative* customer-facing surface. It is opt-in, guardrailed, logged, and
> never asserts sanctions/adverse-media status as fact.

| Field | Detail |
|---|---|
| **Purpose** | Answer AML/CFT compliance questions with a verdict, cited legal basis, decision guide and recommended steps — an on-demand knowledge assistant for the analyst/MLRO. **Advisory only; not a screening tool and not a decision.** |
| **Business owner** | MLRO. |
| **Technical owner** | Compliance Engineering. |
| **Inputs** | The user's typed question + a fixed system prompt = **SOUL_CHARTER** (behavioural guardrails) + **KNOWLEDGE_CONTEXT** (embedded AML typologies/red-flags/legal references) + a persona suffix. No customer database is sent. |
| **Outputs** | A structured cited answer (verdict · legal basis · decision guide · steps · **audit line** with timestamp, scope hash and model-version caveat). Runs server-side; the Anthropic key never reaches the browser. |
| **Model** | Selectable per mode: **speed** = `claude-haiku-4-5`, default = `claude-sonnet-4-6`, **deep** = `claude-opus-4-8`. Max tokens 1024/4096/8192 respectively. |
| **Prompt strategy** | Retrieval-grounded system prompt (charter + embedded knowledge). The charter forbids asserting a specific entity's sanctions/adverse-media status (P1/P2/P8), requires a SCOPE declaration on screening-shaped questions, and enforces a **tipping-off guard** (P4) that withholds output where a response could tip off a subject. |
| **Limitations** | Generative — can be wrong or incomplete; not a substitute for the deterministic screening engine or legal advice; knowledge is embedded/point-in-time, not a live regulatory feed (the Regulatory Watch covers currency separately). |
| **Known risks** | **Hallucination** — mitigated by retrieval grounding, the "no generated facts about a named entity" charter rule, `[AI]` labelling, cited sources, and a deterministic decline path. **Prompt injection / jailbreak** — mitigated by input-pattern detection, a charter-leak/degeneracy output check, and refusal patterns. **Tipping-off** — mitigated by the P4 guard (output withheld). **Automation bias** — mitigated by "decision-support, not a decision" framing. Risk register R-03/R-08/R-09. |
| **Bias / fairness** | Guardrail regression (`test/advisor-assurance.test.js`, 65 checks) runs charter-integrity + tipping-off + routing every push/PR; a **quarterly live-model bias eval** (`advisor-bias-eval.yml`) runs once the DPA is signed. |
| **Human oversight** | Advisory surface only; the analyst/MLRO decides and files. No advisor output writes to the register or Asana. |
| **Monitoring** | Weekly live guardrail eval (`advisor-eval.yml`, key-gated); offline red-team + charter battery every push/PR; prompt-injection red team (`test/redteam_injection.py`). |
| **Performance metrics** | Guardrail pass-rate (weekly eval); tipping-off catch-rate; injection-refusal rate; charter-leak rate (target 0). |
| **Retirement / change control** | Any charter or prompt change is a methodology change → `model-validation-2026.md` §5 sign-off. Retire on provider change or a failed guardrail eval that cannot be remediated. **Prerequisite to first live use: signed Anthropic DPA** (currently pending — see [`regulatory-readiness.md`](../executive/regulatory-readiness.md)). |
