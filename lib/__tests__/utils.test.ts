import { describe, expect, it } from "vitest";
import type { VerificationResult, VerificationTelemetry } from "@/lib/schema/result";
import {
  formatCostUsd,
  formatDurationSec,
  friendlyModelName,
  summarizeBatchTelemetry,
  summarizeTelemetry,
} from "../utils";

describe("formatCostUsd", () => {
  it("never uses scientific notation", () => {
    expect(formatCostUsd(0.0001)).not.toMatch(/e/i);
    expect(formatCostUsd(0.0000123)).not.toMatch(/e/i);
    expect(formatCostUsd(0.000001)).not.toMatch(/e/i);
  });

  it("rounds to 4 decimal places below $1 with trailing zeroes trimmed", () => {
    expect(formatCostUsd(0.0048)).toBe("$0.0048");
    expect(formatCostUsd(0.00478500000001)).toBe("$0.0048");
    expect(formatCostUsd(0.001)).toBe("$0.001");
    expect(formatCostUsd(0.0001)).toBe("$0.0001");
    expect(formatCostUsd(0.014392)).toBe("$0.0144");
    expect(formatCostUsd(0.0028)).toBe("$0.0028");
  });

  it("renders 2 decimals at or above $1", () => {
    expect(formatCostUsd(1)).toBe("$1.00");
    expect(formatCostUsd(1.18)).toBe("$1.18");
    expect(formatCostUsd(12.4)).toBe("$12.40");
    expect(formatCostUsd(99.99)).toBe("$99.99");
  });

  it("flags amounts below the smallest displayable cent fraction", () => {
    expect(formatCostUsd(0.00004)).toBe("<$0.0001");
    expect(formatCostUsd(0.000001)).toBe("<$0.0001");
  });

  it("handles zero and invalid values defensively", () => {
    expect(formatCostUsd(0)).toBe("$0.00");
    expect(formatCostUsd(-1)).toBe("$0.00");
    expect(formatCostUsd(Number.NaN)).toBe("$0.00");
  });
});

describe("formatDurationSec", () => {
  it("renders sub-minute durations to one decimal second", () => {
    expect(formatDurationSec(600)).toBe("0.6s");
    expect(formatDurationSec(4200)).toBe("4.2s");
    expect(formatDurationSec(59999)).toBe("60.0s");
  });

  it("renders minute-and-second durations", () => {
    expect(formatDurationSec(74000)).toBe("1m 14s");
    expect(formatDurationSec(60000)).toBe("1m");
    expect(formatDurationSec(120000)).toBe("2m");
  });

  it("clamps non-positive and invalid input to 0s", () => {
    expect(formatDurationSec(0)).toBe("0s");
    expect(formatDurationSec(-1)).toBe("0s");
    expect(formatDurationSec(Number.NaN)).toBe("0s");
  });
});

describe("friendlyModelName", () => {
  it("maps known slugs to short names", () => {
    expect(friendlyModelName("anthropic/claude-haiku-4.5")).toBe("Haiku");
    expect(friendlyModelName("anthropic/claude-sonnet-4.5")).toBe("Sonnet");
  });

  it("falls back to the slug tail for unknown models", () => {
    expect(friendlyModelName("anthropic/claude-opus-4.1")).toBe("Claude-opus-4.1");
    expect(friendlyModelName("opus")).toBe("Opus");
  });
});

const telemetry: VerificationTelemetry = {
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
};

describe("summarizeTelemetry", () => {
  it("aggregates per-model cost + call counts in declaration order", () => {
    const summary = summarizeTelemetry(telemetry);
    expect(summary.callCount).toBe(2);
    expect(summary.totalCostUsd).toBeCloseTo(0.014392, 6);
    expect(summary.byModel).toEqual([
      { name: "Haiku", costUsd: 0.004795, callCount: 1 },
      { name: "Sonnet", costUsd: 0.009597, callCount: 1 },
    ]);
  });

  it("collapses repeat-model calls into one row", () => {
    const t: VerificationTelemetry = {
      totalLatencyMs: 5000,
      totalCostUsd: 0.01,
      calls: [
        {
          purpose: "extract",
          model: "anthropic/claude-haiku-4.5",
          latencyMs: 1000,
          costUsd: 0.003,
          inputTokens: 100,
          outputTokens: 10,
          cachedInputTokens: 0,
        },
        {
          purpose: "escalate",
          model: "anthropic/claude-haiku-4.5",
          latencyMs: 1500,
          costUsd: 0.004,
          inputTokens: 100,
          outputTokens: 10,
          cachedInputTokens: 0,
        },
        {
          purpose: "warning",
          model: "anthropic/claude-sonnet-4.5",
          latencyMs: 2500,
          costUsd: 0.003,
          inputTokens: 100,
          outputTokens: 10,
          cachedInputTokens: 0,
        },
      ],
    };
    const summary = summarizeTelemetry(t);
    expect(summary.callCount).toBe(3);
    expect(summary.byModel).toEqual([
      { name: "Haiku", costUsd: 0.007, callCount: 2 },
      { name: "Sonnet", costUsd: 0.003, callCount: 1 },
    ]);
  });
});

const baseResult = (durationMs: number, telemetryTotal: number | null): VerificationResult => ({
  id: `r-${Math.random()}`,
  status: "pass",
  fields: [],
  warning: {
    status: "pass",
    extractedText: null,
    canonicalText: "",
    headerIsAllCaps: true,
    headerAppearsBold: true,
    failures: [],
  },
  durationMs,
  imageHash: "h",
  cached: false,
  timeout: false,
  error: null,
  telemetry:
    telemetryTotal === null
      ? undefined
      : {
          totalLatencyMs: durationMs,
          totalCostUsd: telemetryTotal,
          calls: [],
        },
});

describe("summarizeBatchTelemetry", () => {
  it("returns zero spend and null avg when there are no completed rows", () => {
    expect(summarizeBatchTelemetry([])).toEqual({
      spentUsd: 0,
      avgDurationMs: null,
      completedWithTelemetry: 0,
    });
    expect(summarizeBatchTelemetry([{ result: null }])).toEqual({
      spentUsd: 0,
      avgDurationMs: null,
      completedWithTelemetry: 0,
    });
  });

  it("sums cost and averages duration across completed rows that have telemetry", () => {
    const rows = [
      { result: baseResult(2000, 0.005) },
      { result: baseResult(4000, 0.01) },
      { result: baseResult(6000, 0.015) },
    ];
    const r = summarizeBatchTelemetry(rows);
    expect(r.completedWithTelemetry).toBe(3);
    expect(r.spentUsd).toBeCloseTo(0.03, 6);
    expect(r.avgDurationMs).toBe(4000);
  });

  it("includes durationMs even from rows without telemetry but excludes their cost", () => {
    const rows = [
      { result: baseResult(2000, 0.005) },
      { result: baseResult(4000, null) },
      { result: null },
    ];
    const r = summarizeBatchTelemetry(rows);
    expect(r.completedWithTelemetry).toBe(1);
    expect(r.spentUsd).toBeCloseTo(0.005, 6);
    expect(r.avgDurationMs).toBe(3000);
  });
});
