import { describe, expect, it } from "vitest";
import type { Application } from "@/lib/schema/application";
import type { BatchRow } from "@/lib/schema/batch";
import type { VerificationResult } from "@/lib/schema/result";
import { EXPORT_COLUMNS, rowsToCsv, rowsToExport } from "../export";

const app: Application = {
  beverageType: "distilled_spirits",
  brandName: "Stone's Throw",
  classType: "Bourbon",
  alcoholContent: "45%",
  netContents: "750 mL",
  bottlerName: "Bottler",
  bottlerAddress: "Address",
};

const passResult: VerificationResult = {
  id: "r1",
  status: "pass",
  fields: [],
  warning: {
    status: "pass",
    extractedText: "...",
    canonicalText: "...",
    headerIsAllCaps: true,
    headerAppearsBold: true,
    failures: [],
  },
  durationMs: 1234,
  imageHash: "h",
  cached: false,
  timeout: false,
  error: null,
};

const failResult: VerificationResult = {
  ...passResult,
  id: "r2",
  status: "fail",
  fields: [
    {
      field: "brandName",
      status: "mismatch",
      method: "exact",
      applicationValue: "Stone's Throw",
      labelValue: "Stones Throw",
      confidence: 0.95,
      similarity: 0.7,
      rationale: "different",
      escalated: false,
    },
  ],
  warning: {
    status: "fail",
    extractedText: "weird",
    canonicalText: "...",
    headerIsAllCaps: false,
    headerAppearsBold: true,
    failures: [{ kind: "header_not_all_caps", detail: "x" }],
  },
};

const baseRow = (overrides: Partial<BatchRow>): BatchRow => ({
  id: "row-x",
  filename: "f.jpg",
  application: app,
  state: "done",
  result: null,
  errorMessage: null,
  startedAt: 0,
  finishedAt: 1,
  ...overrides,
});

describe("rowsToExport", () => {
  it("matches the documented column shape", () => {
    const out = rowsToExport([
      baseRow({ result: passResult }),
      baseRow({ id: "r2", filename: "g.jpg", result: failResult }),
      baseRow({
        id: "r3",
        filename: "h.jpg",
        state: "error",
        errorMessage: "Image missing",
      }),
    ]);
    expect(EXPORT_COLUMNS).toEqual([
      "filename",
      "status",
      "durationMs",
      "fieldFailures",
      "warningFailures",
      "errorMessage",
    ]);
    expect(out[0]?.status).toBe("pass");
    expect(out[1]?.status).toBe("fail");
    expect(out[1]?.fieldFailures).toBe("brandName:mismatch");
    expect(out[1]?.warningFailures).toBe("header_not_all_caps");
    expect(out[2]?.status).toBe("error");
    expect(out[2]?.errorMessage).toBe("Image missing");
  });

  it("produces a parsable CSV", () => {
    const csv = rowsToCsv([baseRow({ result: passResult })]);
    const [header] = csv.split(/\r?\n/);
    expect(header).toBe("filename,status,durationMs,fieldFailures,warningFailures,errorMessage");
    expect(csv).toMatch(/f\.jpg,pass,1234/);
  });
});
