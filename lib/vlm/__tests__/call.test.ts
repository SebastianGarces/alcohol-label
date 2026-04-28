import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("@/lib/vlm/client", () => ({
  getOpenRouterClient: () => ({
    chat: { completions: { create: mockCreate } },
  }),
}));

import { callChat, VlmTimeoutError } from "@/lib/vlm/call";

const baseBody = {
  model: "anthropic/claude-haiku-4.5",
  messages: [{ role: "user" as const, content: "hi" }],
  max_tokens: 8,
};

const fakeCompletion = (text = "ok") => ({
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
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
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
