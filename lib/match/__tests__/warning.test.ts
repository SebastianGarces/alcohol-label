import { describe, expect, it } from "vitest";
import { GOVERNMENT_WARNING_TEXT } from "@/lib/canonical/government-warning";
import { verifyWarning } from "../warning";

describe("verifyWarning", () => {
  it("passes on canonical text + caps + bold", () => {
    const r = verifyWarning({
      fullText: GOVERNMENT_WARNING_TEXT,
      headerIsAllCaps: true,
      headerAppearsBold: true,
      confidence: 0.99,
    });
    expect(r.status).toBe("pass");
    expect(r.failures).toHaveLength(0);
  });

  it("fails on title-case header (caps flag false)", () => {
    const r = verifyWarning({
      fullText: GOVERNMENT_WARNING_TEXT,
      headerIsAllCaps: false,
      headerAppearsBold: true,
      confidence: 0.99,
    });
    expect(r.status).toBe("fail");
    expect(r.failures.some((f) => f.kind === "header_not_all_caps")).toBe(true);
  });

  it("fails when bold flag missing", () => {
    const r = verifyWarning({
      fullText: GOVERNMENT_WARNING_TEXT,
      headerIsAllCaps: true,
      headerAppearsBold: false,
      confidence: 0.99,
    });
    expect(r.failures.some((f) => f.kind === "header_not_bold")).toBe(true);
  });

  it("fails on wording mismatch with diff-able failure", () => {
    const r = verifyWarning({
      fullText: GOVERNMENT_WARNING_TEXT.replace("birth defects", "birth defect"),
      headerIsAllCaps: true,
      headerAppearsBold: true,
      confidence: 0.99,
    });
    expect(r.status).toBe("fail");
    expect(r.failures.some((f) => f.kind === "wording" || f.kind === "paraphrased")).toBe(true);
  });

  it("flags missing warning", () => {
    const r = verifyWarning({
      fullText: null,
      headerIsAllCaps: false,
      headerAppearsBold: false,
      confidence: 0,
    });
    expect(r.failures[0]?.kind).toBe("missing");
  });

  it("tolerates dropped enumerator markers", () => {
    const stripped = GOVERNMENT_WARNING_TEXT.replace(/\([12]\)\s*/g, "");
    const r = verifyWarning({
      fullText: stripped,
      headerIsAllCaps: true,
      headerAppearsBold: true,
      confidence: 0.99,
    });
    expect(r.status).toBe("pass");
  });
});
