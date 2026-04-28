import { describe, expect, it } from "vitest";
import type { FieldResult } from "@/lib/schema/result";
import { summarizeEscalations } from "@/lib/verifier/tiered-summary";

function makeField(overrides: Partial<FieldResult>): FieldResult {
  return {
    field: "brandName",
    status: "match",
    method: "exact",
    applicationValue: "Stone's Throw",
    labelValue: "Stone's Throw",
    confidence: 0.95,
    similarity: 1,
    rationale: "Exact match",
    escalated: false,
    ...overrides,
  };
}

describe("verifier > tiered-summary > summarizeEscalations", () => {
  it("returns count 0 and empty labels when no field escalated", () => {
    const summary = summarizeEscalations([
      makeField({ field: "brandName" }),
      makeField({ field: "classType" }),
    ]);
    expect(summary.count).toBe(0);
    expect(summary.fieldLabels).toEqual([]);
  });

  it("counts and labels only the escalated fields", () => {
    const summary = summarizeEscalations([
      makeField({ field: "brandName", escalated: false }),
      makeField({ field: "classType", escalated: true }),
      makeField({ field: "alcoholContent", escalated: true }),
    ]);
    expect(summary.count).toBe(2);
    expect(summary.fieldLabels).toEqual(["Class / type", "Alcohol content"]);
  });
});
