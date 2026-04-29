import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("@/lib/vlm/client", () => ({
  getOpenRouterClient: () => ({
    chat: { completions: { create: mockCreate } },
  }),
}));

import {
  callChat,
  callChatWithTelemetry,
  readUsage,
  type VlmCallTelemetry,
  VlmTimeoutError,
} from "@/lib/vlm/call";
import { MODELS } from "@/lib/vlm/models";
import { computeCostUsd } from "@/lib/vlm/pricing";

const baseBody = {
  model: MODELS.HAIKU,
  messages: [{ role: "user" as const, content: "hi" }],
  max_tokens: 8,
};

const fakeCompletion = (
  text = "ok",
  usage: Record<string, unknown> = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
) => ({
  id: "c1",
  object: "chat.completion" as const,
  created: 0,
  model: baseBody.model,
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: text, refusal: null, tool_calls: [] },
      finish_reason: "stop" as const,
      logprobs: null,
    },
  ],
  usage,
});

class FakeRateLimit extends Error {
  status = 429;
  constructor() {
    super("Too Many Requests");
  }
}

describe("callChat retry & timeout", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("retries once on 429 and returns the second response", async () => {
    mockCreate.mockRejectedValueOnce(new FakeRateLimit());
    mockCreate.mockResolvedValueOnce(fakeCompletion("after-retry"));

    const out = await callChat(baseBody, { timeoutMs: 1000 });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(out.choices[0]?.message.content).toBe("after-retry");
  });

  it("throws VlmTimeoutError when the underlying call exceeds the timeout", async () => {
    mockCreate.mockImplementationOnce(
      (_body: unknown, opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    );

    await expect(callChat(baseBody, { timeoutMs: 50 })).rejects.toBeInstanceOf(VlmTimeoutError);
  });
});

describe("readUsage", () => {
  it("returns zeros when usage is missing", () => {
    expect(readUsage(null)).toEqual({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 });
  });

  it("forwards prompt/completion tokens and reads cached_tokens from prompt_tokens_details", () => {
    const completion = fakeCompletion("ok", {
      prompt_tokens: 1234,
      completion_tokens: 56,
      total_tokens: 1290,
      prompt_tokens_details: { cached_tokens: 900 },
    }) as unknown as Parameters<typeof readUsage>[0];
    expect(readUsage(completion)).toEqual({
      inputTokens: 1234,
      outputTokens: 56,
      cachedInputTokens: 900,
    });
  });

  it("treats cached_tokens fallback at the top level if prompt_tokens_details is absent", () => {
    const completion = fakeCompletion("ok", {
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      cached_tokens: 40,
    }) as unknown as Parameters<typeof readUsage>[0];
    expect(readUsage(completion)).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      cachedInputTokens: 40,
    });
  });
});

describe("computeCostUsd", () => {
  it("Haiku 4.5: 1k input + 500 output = $1/M*1000 + $5/M*500 = $0.0035", () => {
    const cost = computeCostUsd(MODELS.HAIKU, {
      inputTokens: 1000,
      outputTokens: 500,
      cachedInputTokens: 0,
    });
    expect(cost).toBeCloseTo(0.0035, 6);
  });

  it("Sonnet 4.5: 2k input + 1k output = $3/M*2000 + $15/M*1000 = $0.021", () => {
    const cost = computeCostUsd(MODELS.SONNET, {
      inputTokens: 2000,
      outputTokens: 1000,
      cachedInputTokens: 0,
    });
    expect(cost).toBeCloseTo(0.021, 6);
  });

  it("does not double-bill cached tokens (prompt_tokens already includes them)", () => {
    // 1000 prompt tokens, 800 of which were cache hits.
    // billable input = 200 @ $1/M = $0.0002
    // cached       = 800 @ $0.10/M = $0.00008
    // output       = 0
    // total        = $0.00028
    const cost = computeCostUsd(MODELS.HAIKU, {
      inputTokens: 1000,
      outputTokens: 0,
      cachedInputTokens: 800,
    });
    expect(cost).toBeCloseTo(0.000_28, 8);
  });
});

describe("callChatWithTelemetry", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns latencyMs > 0, model slug, and forwards usage", async () => {
    mockCreate.mockResolvedValueOnce(
      fakeCompletion("ok", {
        prompt_tokens: 800,
        completion_tokens: 120,
        total_tokens: 920,
        prompt_tokens_details: { cached_tokens: 600 },
      }),
    );

    const { telemetry } = await callChatWithTelemetry(baseBody, MODELS.HAIKU, {
      timeoutMs: 1000,
    });

    expect(telemetry.model).toBe(MODELS.HAIKU);
    expect(telemetry.latencyMs).toBeGreaterThanOrEqual(0);
    expect(telemetry.usage).toEqual({
      inputTokens: 800,
      outputTokens: 120,
      cachedInputTokens: 600,
    });
    // Cost = (200 input * $1/M) + (600 cached * $0.10/M) + (120 output * $5/M)
    //      = 0.0002 + 0.00006 + 0.0006 = 0.00086
    expect(telemetry.costUsd).toBeCloseTo(0.000_86, 8);
  });

  it("attaches partial telemetry to thrown errors (latencyMs measured, costUsd = 0)", async () => {
    mockCreate.mockImplementationOnce(
      (_body: unknown, opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    );

    try {
      await callChatWithTelemetry(baseBody, MODELS.HAIKU, { timeoutMs: 30 });
      throw new Error("expected timeout to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(VlmTimeoutError);
      const t = (err as Error & { telemetry?: VlmCallTelemetry }).telemetry;
      expect(t).toBeDefined();
      expect(t?.model).toBe(MODELS.HAIKU);
      expect(t?.latencyMs).toBeGreaterThanOrEqual(0);
      expect(t?.costUsd).toBe(0);
    }
  });
});
