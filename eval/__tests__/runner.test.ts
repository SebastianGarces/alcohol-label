import { describe, expect, it } from "vitest";
import type { Application } from "@/lib/schema/application";
import type { VerificationResult } from "@/lib/schema/result";
import { MODELS } from "@/lib/vlm/models";
import { runEval } from "../runner";
import type { EvalCase } from "../types";

const APP: Application = {
  beverageType: "distilled_spirits",
  brandName: "Stone's Throw",
  classType: "Bourbon",
  alcoholContent: "45%",
  netContents: "750 mL",
  bottlerName: "Stone's Throw Distillery",
  bottlerAddress: "123 Main Street, Louisville, KY",
};

function makeCase(id: string, expected: EvalCase["expectedStatus"]): EvalCase {
  return {
    id,
    source: "batch",
    imagePath: `/dev/null/${id}`,
    application: APP,
    expectedStatus: expected,
  };
}

function makeResult(status: VerificationResult["status"], costUsd = 0.001): VerificationResult {
  return {
    id: `r-${status}`,
    status,
    fields: [
      {
        field: "brandName",
        status: status === "pass" ? "match" : "mismatch",
        method: "exact",
        applicationValue: APP.brandName,
        labelValue: APP.brandName,
        confidence: 0.99,
        similarity: 1,
        rationale: "test",
        escalated: false,
      },
    ],
    warning: {
      status: status === "pass" ? "pass" : "fail",
      extractedText: null,
      canonicalText: "",
      headerIsAllCaps: true,
      headerAppearsBold: true,
      failures: [],
    },
    durationMs: 100,
    imageHash: `hash-${status}`,
    cached: false,
    timeout: false,
    error: null,
    telemetry: {
      totalLatencyMs: 100,
      totalCostUsd: costUsd,
      calls: [
        {
          purpose: "extract",
          model: MODELS.HAIKU,
          latencyMs: 100,
          inputTokens: 100,
          outputTokens: 50,
          cachedInputTokens: 0,
          costUsd,
        },
      ],
    },
  };
}

describe("eval > runner", () => {
  it("computes verdict accuracy across mixed-result cases", async () => {
    const cases = [makeCase("c1", "pass"), makeCase("c2", "review"), makeCase("c3", "fail")];
    // c1: pass-correct, c2: review-correct, c3: expected fail but verifier returns pass (wrong)
    const verdicts: Record<string, VerificationResult["status"]> = {
      c1: "pass",
      c2: "review",
      c3: "pass",
    };
    let callIdx = 0;
    const run = await runEval(
      cases,
      "test",
      {},
      {
        concurrency: 1,
        readImage: () => Buffer.from(""),
        verify: async () => {
          const cse = cases[callIdx++];
          return makeResult(verdicts[cse?.id ?? ""] ?? "fail");
        },
      },
    );
    expect(run.totalCases).toBe(3);
    expect(run.correctCases).toBe(2);
    expect(run.accuracy).toBeCloseTo(2 / 3);
  });

  it("aborts remaining cases when cost cap is breached", async () => {
    const cases = Array.from({ length: 6 }, (_, i) => makeCase(`c${i}`, "pass"));
    let calls = 0;
    const run = await runEval(
      cases,
      "test",
      {},
      {
        concurrency: 1,
        costCapUsd: 1.0,
        readImage: () => Buffer.from(""),
        verify: async () => {
          calls += 1;
          // First call is $1.50 — should trip the cap immediately.
          return makeResult("pass", calls === 1 ? 1.5 : 0.001);
        },
      },
    );
    expect(run.aborted).toBe(true);
    // First case ran; the remaining 5 must be marked aborted.
    const aborted = run.results.filter((r) => r.aborted);
    expect(aborted.length).toBe(5);
    for (const r of aborted) {
      expect(r.error).toBe("cost_cap");
    }
  });

  it("scores per-field metric on outcome, not on label-match (intentional fail-cases count as correct)", async () => {
    const failCase = makeCase("c-abv-mismatch", "fail");
    const verifyResult: VerificationResult = {
      ...makeResult("fail"),
      fields: [
        {
          field: "alcoholContent",
          status: "mismatch",
          method: "numeric",
          applicationValue: "45%",
          labelValue: "40%",
          confidence: 0.99,
          similarity: null,
          rationale: "Application 45.0% vs label 40.0%",
          escalated: false,
        },
      ],
    };
    const run = await runEval(
      [failCase],
      "test",
      {},
      {
        concurrency: 1,
        readImage: () => Buffer.from(""),
        verify: async () => verifyResult,
      },
    );
    expect(run.perFieldAccuracy.alcoholContent).toEqual({ correct: 1, total: 1 });
  });

  it("handles per-case errors without crashing the run", async () => {
    const cases = [makeCase("ok", "pass"), makeCase("err", "pass")];
    let callIdx = 0;
    const run = await runEval(
      cases,
      "test",
      {},
      {
        concurrency: 1,
        readImage: () => Buffer.from(""),
        verify: async () => {
          const cse = cases[callIdx++];
          if (cse?.id === "err") throw new Error("boom");
          return makeResult("pass");
        },
      },
    );
    expect(run.totalCases).toBe(2);
    expect(run.correctCases).toBe(1);
    const errResult = run.results.find((r) => r.caseId === "err")!;
    expect(errResult.error).toMatch(/boom/);
    expect(errResult.correct).toBe(false);
  });
});
