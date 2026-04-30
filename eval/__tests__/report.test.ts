import { describe, expect, it } from "vitest";
import { renderReport } from "../report";
import type { EvalCaseResult, EvalRun } from "../types";

function caseRes(
  caseId: string,
  expected: EvalCaseResult["expected"],
  got: EvalCaseResult["got"],
): EvalCaseResult {
  return {
    caseId,
    expected,
    got,
    correct: expected === got,
    fields: [],
    warning: null,
    telemetry: null,
    durationMs: 1000,
    aborted: false,
    error: null,
  };
}

const TIERED: EvalRun = {
  mode: "tiered",
  totalCases: 3,
  correctCases: 2,
  accuracy: 2 / 3,
  p50LatencyMs: 2000,
  p95LatencyMs: 3500,
  totalCostUsd: 0.05,
  costPerLabelUsd: 0.05 / 3,
  perFieldAccuracy: {
    brandName: { correct: 3, total: 3 },
    classType: { correct: 2, total: 3 },
  },
  aborted: false,
  results: [
    caseRes("batch/01.jpg", "pass", "pass"),
    caseRes("batch/02.jpg", "pass", "pass"),
    caseRes("batch/03.jpg", "fail", "pass"),
  ],
};

const SONNET: EvalRun = {
  mode: "sonnet-only",
  totalCases: 3,
  correctCases: 3,
  accuracy: 1,
  p50LatencyMs: 4000,
  p95LatencyMs: 5500,
  totalCostUsd: 0.2,
  costPerLabelUsd: 0.2 / 3,
  perFieldAccuracy: { brandName: { correct: 3, total: 3 } },
  aborted: false,
  results: [
    caseRes("batch/01.jpg", "pass", "pass"),
    caseRes("batch/02.jpg", "pass", "pass"),
    caseRes("batch/03.jpg", "fail", "fail"),
  ],
};

const HAIKU: EvalRun = {
  mode: "haiku-only",
  totalCases: 3,
  correctCases: 2,
  accuracy: 2 / 3,
  p50LatencyMs: 1500,
  p95LatencyMs: 2800,
  totalCostUsd: 0.02,
  costPerLabelUsd: 0.02 / 3,
  perFieldAccuracy: { brandName: { correct: 3, total: 3 } },
  aborted: false,
  results: [
    caseRes("batch/01.jpg", "pass", "pass"),
    caseRes("batch/02.jpg", "pass", "pass"),
    caseRes("batch/03.jpg", "fail", "pass"),
  ],
};

describe("eval > report", () => {
  it("renders deterministic markdown for a single-run input (no Headline line)", () => {
    const md = renderReport({
      runs: [TIERED],
      generatedAt: "2026-04-29T03:14:22Z",
      commitSha: "abcdef1",
    });
    expect(md).toContain("# Eval Results");
    expect(md).toContain("Generated: 2026-04-29T03:14:22Z");
    expect(md).toContain("Commit: abcdef1");
    expect(md).toContain("## Summary");
    expect(md).toContain(
      "**Tiered** (Haiku extract + warning, Sonnet escalate/tiebreak — default)",
    );
    expect(md).toContain("2/3 (66.7%)");
    expect(md).toContain("Per-field accuracy (Tiered mode)");
    expect(md).toContain("brandName | 3 | 3 | 100.0%");
    expect(md).toContain("Verdict differences (Tiered mode)");
    expect(md).toContain("03.jpg");
    expect(md).toContain("Methodology");
    expect(md).toContain("Limitations");
    expect(md).not.toContain("**Headline:**");
    expect(md).not.toContain("Mode-by-mode failures");
  });

  it("includes Headline (Tiered vs Haiku-only) and mode comparison for multi-run input", () => {
    const md = renderReport({
      runs: [TIERED, HAIKU, SONNET],
      generatedAt: "2026-04-29T03:14:22Z",
      commitSha: "abcdef1",
    });
    expect(md).toContain("**Headline:**");
    // New headline frames Tiered vs Haiku-only directly.
    expect(md).toContain("Tiered 66.7% accuracy");
    expect(md).toContain("Haiku-only 66.7%");
    // Haiku-only's $0.02 / Tiered's $0.05 = 40%
    expect(md).toContain("**40%** of Tiered's cost");
    // Both p95 in this fixture are < 5s, so the SLO line says both meet it.
    expect(md).toContain("Both modes meet the <5s p95 SLO.");
    expect(md).toContain("## Mode-by-mode failures (compare runs)");
    expect(md).toContain("Tiered mode");
    expect(md).toContain("Sonnet-only mode");
  });

  it("flags Tiered SLO miss when its p95 exceeds 5s but Haiku-only is under", () => {
    const md = renderReport({
      runs: [
        { ...TIERED, p95LatencyMs: 5400 },
        { ...HAIKU, p95LatencyMs: 4300 },
      ],
      generatedAt: "2026-04-29T03:14:22Z",
      commitSha: "abcdef1",
    });
    expect(md).toContain("Haiku-only meets the <5s p95 SLO; Tiered does not (5.4s)");
  });

  it("formats cost in USD with stable precision", () => {
    const md = renderReport({
      runs: [{ ...TIERED, totalCostUsd: 0.0028, costPerLabelUsd: 0.0028 / 29 }],
      generatedAt: "2026-04-29T03:14:22Z",
      commitSha: "abcdef1",
    });
    expect(md).toContain("$0.0028");
    expect(md).not.toMatch(/\$2\.8e-3/);
  });
});
