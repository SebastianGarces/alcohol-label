import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VerificationResult } from "@/lib/schema/result";
import { ResultDisplay } from "../ResultDisplay";

const baseResult = (overrides: Partial<VerificationResult> = {}): VerificationResult => ({
  id: "verif-1",
  status: "pass",
  fields: [],
  warning: {
    status: "pass",
    extractedText: "GOVERNMENT WARNING: …",
    canonicalText: "GOVERNMENT WARNING: …",
    headerIsAllCaps: true,
    headerAppearsBold: true,
    failures: [],
  },
  durationMs: 4200,
  imageHash: "h",
  cached: false,
  timeout: false,
  error: null,
  ...overrides,
});

describe("ResultDisplay > telemetry footer", () => {
  it("renders cost + duration + per-model breakdown when telemetry is present", () => {
    const result = baseResult({
      telemetry: {
        totalLatencyMs: 7406,
        totalCostUsd: 0.014392,
        calls: [
          {
            purpose: "extract",
            model: "anthropic/claude-haiku-4.5",
            latencyMs: 3258,
            costUsd: 0.004795,
            inputTokens: 3090,
            outputTokens: 341,
            cachedInputTokens: 0,
          },
          {
            purpose: "warning",
            model: "anthropic/claude-sonnet-4.5",
            latencyMs: 4148,
            costUsd: 0.009597,
            inputTokens: 2429,
            outputTokens: 154,
            cachedInputTokens: 0,
          },
        ],
      },
    });

    const html = renderToStaticMarkup(<ResultDisplay result={result} />);
    expect(html).toContain("Run telemetry");
    expect(html).toContain("4.2s"); // wall-clock from durationMs
    expect(html).toContain("$0.0144"); // total cost (4-decimal)
    expect(html).toContain("2 model calls");
    expect(html).toContain("Haiku");
    expect(html).toContain("Sonnet");
    expect(html).toContain("$0.0048"); // Haiku per-model rollup
    expect(html).toContain("$0.0096"); // Sonnet per-model rollup
  });

  it("omits the footer cleanly when telemetry is undefined", () => {
    const result = baseResult({ telemetry: undefined });
    const html = renderToStaticMarkup(<ResultDisplay result={result} />);
    expect(html).not.toContain("Run telemetry");
    expect(html).not.toContain("model calls");
    expect(html).not.toContain("Receipt");
    // Status banner is still rendered, so the page is not empty.
    expect(html).toContain("Verified in"); // StatusBanner copy
  });

  it("renders the footer for cached results without double-counting", () => {
    const result = baseResult({
      cached: true,
      telemetry: {
        totalLatencyMs: 1000,
        totalCostUsd: 0.005,
        calls: [
          {
            purpose: "extract",
            model: "anthropic/claude-haiku-4.5",
            latencyMs: 1000,
            costUsd: 0.005,
            inputTokens: 100,
            outputTokens: 10,
            cachedInputTokens: 0,
          },
        ],
      },
    });
    const html = renderToStaticMarkup(<ResultDisplay result={result} />);
    expect(html).toContain("$0.005");
    expect(html).toContain("1 model call");
  });
});
