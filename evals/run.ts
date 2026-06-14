// ============================================================================
// Eval harness — run the analyze prompt across models, score recall + cost
// ----------------------------------------------------------------------------
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... npx tsx run.ts
//
// Output:
//   evals/results.json   raw per-run data (analyses, usage, scores)
//   evals/RESULTS.md     human-readable comparison table + recommendation
//
// ADVISORY lane. Does not touch api/_lib/anthropic.ts; reports a recommended
// ANALYSIS model id for Lane A to set.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

import { ANALYZE_SYSTEM, analyzeUserPrompt, ANALYZE_SCHEMA } from './analyzePrompt';
import { CORPUS, MODELS, PRICING } from './corpus';
import { scoreRecall, type AnalyzedRedFlag, type RecallResult } from './score';
import { renderResults, type RunRecord } from './report';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = join(HERE, 'contracts');

// Cost per run, in USD, from token usage and the per-model pricing table.
function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return NaN;
  return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
}

async function analyzeOnce(
  client: Anthropic,
  model: string,
  contractText: string,
): Promise<{ analysis: any; inputTokens: number; outputTokens: number; stopReason: string | null }> {
  const resp = await client.messages.create({
    model,
    max_tokens: 8000,
    system: ANALYZE_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: ANALYZE_SCHEMA } },
    messages: [{ role: 'user', content: analyzeUserPrompt(contractText) }],
  } as any);

  const stopReason = (resp.stop_reason as string) ?? null;
  let analysis: any = { summary: '', redFlags: [], obligations: [] };
  if (stopReason !== 'refusal') {
    const textBlock = resp.content.find((b: any) => b.type === 'text') as any;
    if (textBlock?.text) {
      try {
        analysis = JSON.parse(textBlock.text);
      } catch {
        // leave empty analysis; recorded as zero recall for this run
      }
    }
  }
  return {
    analysis,
    inputTokens: resp.usage.input_tokens,
    outputTokens: resp.usage.output_tokens,
    stopReason,
  };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set. Export a key and re-run: ANTHROPIC_API_KEY=sk-ant-... npx tsx run.ts');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });

  const runs: RunRecord[] = [];

  for (const contract of CORPUS) {
    const text = readFileSync(join(CONTRACTS_DIR, contract.file), 'utf8');
    for (const model of MODELS) {
      process.stderr.write(`Running ${PRICING[model]?.label ?? model} on ${contract.id}... `);
      try {
        const { analysis, inputTokens, outputTokens, stopReason } = await analyzeOnce(client, model, text);
        const redFlags: AnalyzedRedFlag[] = Array.isArray(analysis.redFlags) ? analysis.redFlags : [];
        const score: RecallResult = scoreRecall(contract.goldFlags, redFlags);
        const cost = costUsd(model, inputTokens, outputTokens);
        runs.push({
          model,
          contractId: contract.id,
          contractKind: contract.kind,
          inputTokens,
          outputTokens,
          costUsd: cost,
          redFlagCount: redFlags.length,
          stopReason,
          score,
        });
        process.stderr.write(`recall ${(score.recall * 100).toFixed(0)}%  $${cost.toFixed(5)}\n`);
      } catch (err: any) {
        process.stderr.write(`ERROR: ${err?.message ?? err}\n`);
        runs.push({
          model,
          contractId: contract.id,
          contractKind: contract.kind,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: NaN,
          redFlagCount: 0,
          stopReason: 'error',
          error: String(err?.message ?? err),
          score: scoreRecall(contract.goldFlags, []),
        });
      }
    }
  }

  writeFileSync(join(HERE, 'results.json'), JSON.stringify(runs, null, 2));
  const md = renderResults(runs);
  writeFileSync(join(HERE, 'RESULTS.md'), md);
  console.error('\nWrote evals/results.json and evals/RESULTS.md');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
