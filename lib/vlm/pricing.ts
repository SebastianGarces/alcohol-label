// Anthropic public pricing for Claude 4.5 family, in USD per 1M tokens.
//
// Verify against the live OpenRouter model pages if uncertain — the input and
// output rates are listed there directly:
//   https://openrouter.ai/anthropic/claude-haiku-4.5
//   https://openrouter.ai/anthropic/claude-sonnet-4.5
//
// Cached-input rate is the Anthropic prompt-cache "cache read" tier, which
// OpenRouter passes through verbatim for Anthropic models. Anthropic charges
// 1/10 of the regular input rate for cache reads. (See Anthropic's
// prompt-caching docs for confirmation.)
import { MODELS, type ModelSlug } from "./models";

export type VlmUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

export const PRICING_USD_PER_MTOK: Record<
  ModelSlug,
  { input: number; output: number; cachedInput: number }
> = {
  [MODELS.HAIKU]: { input: 1.0, output: 5.0, cachedInput: 0.1 },
  [MODELS.SONNET]: { input: 3.0, output: 15.0, cachedInput: 0.3 },
};

const PER_TOKEN = 1_000_000;

export function computeCostUsd(model: ModelSlug, usage: VlmUsage): number {
  const rates = PRICING_USD_PER_MTOK[model];
  if (!rates) return 0;
  // OpenRouter usage reports total prompt_tokens (which already includes
  // cached_tokens). To avoid double-billing, subtract cached_tokens from the
  // input bucket and price them at the cached rate instead.
  const billableInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const inputCost = (billableInput * rates.input) / PER_TOKEN;
  const cachedCost = (usage.cachedInputTokens * rates.cachedInput) / PER_TOKEN;
  const outputCost = (usage.outputTokens * rates.output) / PER_TOKEN;
  return inputCost + cachedCost + outputCost;
}
