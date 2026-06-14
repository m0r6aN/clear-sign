# ClearSign model eval (advisory)

Picks the **cheapest Claude model that holds high-severity red-flag recall** for
freelance contract analysis. Advisory only — it reports a recommended ANALYSIS
model id; Lane A sets it in `api/_lib/anthropic.ts`.

## Run

```bash
cd evals
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run eval     # or: npx tsx run.ts
```

Writes:
- `results.json` — raw per-run data (analyses, token usage, scores)
- `RESULTS.md` — comparison table + recommendation

## What it does

For each of 4 hand-labeled freelance contracts (`contracts/`) × 3 models
(Haiku 4.5, Sonnet 4.6, Opus 4.8) it runs the **production analyze prompt +
schema** (`analyzePrompt.ts`, mirrors `src/lib/api-types.ts`), then scores
high-severity red-flag recall against the gold labels in `corpus.ts` using
deterministic concept matchers (`score.ts`). Cost is token usage × published
per-MTok pricing.

## Files

| File | Role |
|---|---|
| `contracts/*.txt` | The freelance contract corpus |
| `corpus.ts` | Gold high-severity flags + concept matchers; pricing; model list |
| `analyzePrompt.ts` | Production-faithful system prompt + user prompt + JSON schema |
| `score.ts` | Recall scoring (surfaced + severity-correct) |
| `run.ts` | Harness: call models, score, emit results |
| `report.ts` | Renders `RESULTS.md` + applies the recommendation rule |

## Tuning the recommendation

`report.ts` picks the cheapest model whose corpus-wide high-severity recall is
≥ 85% absolute **and** within 5 points of the best model. Adjust `ABS_FLOOR` /
`REL_TOLERANCE` there if the risk tolerance changes.
