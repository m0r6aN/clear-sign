# ClearSign — Analysis Model Eval Results

> **STATUS: PENDING RUN.** The harness is built and ready; this file is a
> placeholder until it is run with a live `ANTHROPIC_API_KEY`. Run:
> `cd evals && npm install && ANTHROPIC_API_KEY=sk-ant-... npx tsx run.ts`
> — it overwrites this file with measured recall + cost and a final pick.

**Goal:** recommend the cheapest Claude model that holds high-severity red-flag
recall for freelance contract analysis.

## Recommendation

```
ANALYSIS model id: (pending run — see status above)
```

Candidates under test, cheapest → most expensive:

| Model | Input $/MTok | Output $/MTok |
|---|---|---|
| Haiku 4.5 (`claude-haiku-4-5`) | 1.00 | 5.00 |
| Sonnet 4.6 (`claude-sonnet-4-6`) | 3.00 | 15.00 |
| Opus 4.8 (`claude-opus-4-8`) | 5.00 | 25.00 |

## Method (already implemented)

- 4 hand-labeled freelance contracts: Mutual NDA, design SOW, IC agreement with
  an aggressive IP-assignment clause, and a freelance MSA (`evals/contracts/`).
- Each is labeled with its genuinely high-severity red flags (`evals/corpus.ts`):
  23 gold flags total.
- Each contract is analyzed by each model with the **production analyze prompt +
  `ContractAnalysis` JSON schema** (`evals/analyzePrompt.ts`), structured
  outputs, `max_tokens: 8000`, no extended thinking (cost-representative).
- Recall is scored by deterministic concept matchers (`evals/score.ts`).
- Cost is real token usage × published per-MTok pricing.

The recommendation rule (`evals/report.ts`): cheapest model whose corpus-wide
high-severity recall is ≥ 85% absolute **and** within 5 points of the best
model.
