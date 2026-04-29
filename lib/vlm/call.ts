import type OpenAI from "openai";
import { getOpenRouterClient } from "./client";
import { PROVIDER_ROUTING } from "./models";

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

export function buildImageUserMessage(
  text: string,
  dataUrl: string,
): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  return {
    role: "user",
    content: [
      { type: "text", text },
      { type: "image_url", image_url: { url: dataUrl } },
    ],
  };
}
