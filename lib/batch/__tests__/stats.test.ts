import { describe, expect, it } from "vitest";
import type { Application } from "@/lib/schema/application";
import type { BatchRow } from "@/lib/schema/batch";
import type { VerificationResult } from "@/lib/schema/result";
import { computeBatchCounts, failedRowIndices } from "../stats";

const app: Application = {
  beverageType: "distilled_spirits",
  brandName: "Test",
  classType: "Bourbon",
  alcoholContent: "45%",
  netContents: "750 mL",
  bottlerName: "B",
  bottlerAddress: "A",
};

const result = (status: VerificationResult["status"], error: VerificationResult["error"] = null) =>
  ({
    id: status,
    status,
    fields: [],
    warning: {
      status: "pass",
      extractedText: null,
      canonicalText: "",
      headerIsAllCaps: true,
      headerAppearsBold: true,
      failures: [],
    },
    durationMs: 1000,
    imageHash: "h",
    cached: false,
    timeout: false,
    error,
  }) satisfies VerificationResult;

const row = (state: BatchRow["state"], r: BatchRow["result"] = null): BatchRow => ({
  id: `${state}-${Math.random()}`,
  filename: "f.jpg",
  application: app,
  state,
  result: r,
  errorMessage: state === "error" ? "boom" : null,
  startedAt: null,
  finishedAt: null,
});

describe("computeBatchCounts", () => {
  it("keeps done/total/review/fail consistent", () => {
    const rows: BatchRow[] = [
      row("done", result("pass")),
      row("done", result("review")),
      row("done", result("fail")),
      row("done", result("pass", "vlm_timeout")),
      row("running"),
      row("error"),
      row("pending"),
    ];
    const c = computeBatchCounts(rows);
    expect(c.total).toBe(7);
    expect(c.done).toBe(4);
    expect(c.running).toBe(1);
    expect(c.errored).toBe(1);
    expect(c.pass).toBe(1);
    expect(c.review).toBe(1);
    expect(c.fail).toBe(2); // explicit fail + result.error counts as fail
  });
});

describe("failedRowIndices", () => {
  it("re-runs only error/fail rows", () => {
    const rows: BatchRow[] = [
      row("done", result("pass")),
      row("error"),
      row("done", result("fail")),
      row("done", result("review")),
      row("done", result("pass", "vlm_timeout")),
    ];
    expect(failedRowIndices(rows)).toEqual([1, 2, 4]);
  });
});
