import type OpenAI from "openai";
import { getOpenRouterClient } from "./client";
import { type ModelSlug, PROVIDER_ROUTING } from "./models";
import { computeCostUsd, type VlmUsage } from "./pricing";

// Hard upper bound so a hung request can't pin a worker indefinitely. We'd
// rather wait than cut off mid-extraction, so this is well above the
// historical p95 budget. UI marks any run >SLOW_VERIFICATION_MS as "slow".
export const DEFAULT_VLM_TIMEOUT_MS = 30_000;
export const SLOW_VERIFICATION_MS = 5_000;
export const RETRY_BACKOFF_MS = [200, 800] as const;

export type VlmCallOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class VlmTimeoutError extends Error {
  constructor() {
    super("VLM call timed out");
    this.name = "VlmTimeoutError";
  }
}

export class VlmAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VlmAuthError";
  }
}

type ChatBody = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
  provider?: typeof PROVIDER_ROUTING;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusOf(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status === 429) return true;
  if (status !== null && status >= 500 && status < 600) return true;
  return false;
}

function isAuthError(err: unknown): boolean {
  const status = statusOf(err);
  if (status === 401 || status === 402 || status === 403) return true;
  return (
    err instanceof Error &&
    /401|402|403|unauthor|insufficient credit|payment required/i.test(err.message)
  );
}

async function singleAttempt(
  body: ChatBody,
  outerSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const client = getOpenRouterClient();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  outerSignal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return (await client.chat.completions.create(body, {
      signal: controller.signal,
    })) as OpenAI.Chat.Completions.ChatCompletion;
  } catch (err) {
    if (controller.signal.aborted && !outerSignal?.aborted) {
      throw new VlmTimeoutError();
    }
    if (isAuthError(err)) {
      throw new VlmAuthError(err instanceof Error ? err.message : "Unauthorized");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener("abort", onAbort);
  }
}

export async function callChat(
  body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  options: VlmCallOptions = {},
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_VLM_TIMEOUT_MS;
  const withProvider: ChatBody = { ...body, provider: PROVIDER_ROUTING };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    try {
      return await singleAttempt(withProvider, options.signal, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (err instanceof VlmAuthError) throw err;
      if (err instanceof VlmTimeoutError) throw err;
      if (options.signal?.aborted) throw err;
      if (attempt < RETRY_BACKOFF_MS.length && isRetryable(err)) {
        await sleep(RETRY_BACKOFF_MS[attempt]!);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export function parseToolCallArguments(
  completion: OpenAI.Chat.Completions.ChatCompletion,
  expectedName: string,
): unknown {
  const choice = completion.choices[0];
  const call = choice?.message?.tool_calls?.[0];
  if (!call || call.type !== "function" || call.function.name !== expectedName) {
    throw new Error(`Expected tool call ${expectedName} not present in response`);
  }
  return JSON.parse(call.function.arguments);
}

export type VlmCallTelemetry = {
  model: ModelSlug;
  latencyMs: number;
  usage: VlmUsage;
  costUsd: number;
};

export type VlmCallResult<T> = {
  value: T;
  telemetry: VlmCallTelemetry;
};

export function readUsage(completion: OpenAI.Chat.Completions.ChatCompletion | null): VlmUsage {
  // Defensive parsing: OpenRouter forwards Anthropic's usage shape, but the
  // exact field names for cached tokens have shifted across versions. Treat
  // anything missing as 0 rather than crashing the verifier.
  const usage = (completion?.usage ?? null) as
    | (OpenAI.CompletionUsage & {
        prompt_tokens_details?: { cached_tokens?: number | null } | null;
        cached_tokens?: number | null;
      })
    | null;
  if (!usage) {
    return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  }
  const cached =
    usage.prompt_tokens_details?.cached_tokens ??
    (typeof usage.cached_tokens === "number" ? usage.cached_tokens : 0) ??
    0;
  return {
    inputTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0,
    outputTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : 0,
    cachedInputTokens: typeof cached === "number" ? cached : 0,
  };
}

// Wrapper around `callChat` that captures latency, token usage, and cost. Use
// this in VLM wrappers (extract/warning/escalate/tiebreak) so the verifier can
// aggregate per-call telemetry. `callChat` retry/timeout/auth-error semantics
// are preserved — we only measure around the outer call.
export async function callChatWithTelemetry(
  body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  model: ModelSlug,
  options: VlmCallOptions = {},
): Promise<{ completion: OpenAI.Chat.Completions.ChatCompletion; telemetry: VlmCallTelemetry }> {
  const start = Date.now();
  let completion: OpenAI.Chat.Completions.ChatCompletion | null = null;
  try {
    completion = await callChat(body, options);
    return {
      completion,
      telemetry: telemetryFor(model, start, completion),
    };
  } catch (err) {
    // Re-throw, but attach a partial telemetry so the verifier can still
    // record latency for the failed attempt. We use AggregateError-style
    // metadata on the error object rather than a custom subclass to avoid
    // changing call.ts's existing error shapes.
    (err as Error & { telemetry?: VlmCallTelemetry }).telemetry = telemetryFor(model, start, null);
    throw err;
  }
}

function telemetryFor(
  model: ModelSlug,
  startMs: number,
  completion: OpenAI.Chat.Completions.ChatCompletion | null,
): VlmCallTelemetry {
  const usage = readUsage(completion);
  return {
    model,
    latencyMs: Date.now() - startMs,
    usage,
    costUsd: completion ? computeCostUsd(model, usage) : 0,
  };
}

export function buildImageUserMessage(
  text: string,
  dataUrl: string,
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  // cache_control on the text block tells Anthropic to set a cache breakpoint
  // *after* the text part. The cached prefix becomes system + tools + this
  // user-text block — typically ~600-900 tokens for our extract/warning calls,
  // which crosses Anthropic's 1024-token minimum once you include tool schemas.
  // The image content varies per call so we deliberately don't mark it.
  return {
    role: "user",
    content: [
      { type: "text", text, cache_control: { type: "ephemeral" } },
      { type: "image_url", image_url: { url: dataUrl } },
    ],
  } as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam;
}

// Build a system message with Anthropic prompt-cache markers. OpenRouter
// passes `cache_control: { type: 'ephemeral' }` through to Anthropic on the
// content-block, marking a cache breakpoint at end-of-system-message.
//
// IMPORTANT: Anthropic's prompt cache requires a ≥1024-token cached prefix.
// At current prompt sizes (system ≈ 75 tok, tools ≈ 500 tok, user-text ≈ 50 tok)
// we're well below threshold, so cache hits do NOT fire today. Verified with
// fetch spy + back-to-back identical calls (cached_tokens stayed 0).
//
// Wiring is left in place because:
//   1. It's correct — when prompts grow (e.g., TTB rule corpus baked into the
//      system prompt) caching will start firing without code changes.
//   2. The cast is harmless if the model doesn't support cache_control.
//   3. Sentinel for future devs: this is the place to extend if you bake
//      examples/regulations into the system prompt.
//
// The OpenAI SDK types model `system.content` as `string`, but OpenRouter
// accepts Anthropic's content-block array shape for Anthropic models. We cast
// at the boundary to keep the rest of the call surface typed.
export function buildCachedSystemMessage(
  prompt: string,
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  return {
    role: "system",
    content: [
      {
        type: "text",
        text: prompt,
        cache_control: { type: "ephemeral" },
      },
    ],
  } as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam;
}
