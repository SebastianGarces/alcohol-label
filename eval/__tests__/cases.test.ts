import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Application } from "@/lib/schema/application";
import { loadCases } from "../cases";

describe("eval > cases", () => {
  it("loads 41 cases (5 single + 24 batch + 12 hard)", () => {
    const cases = loadCases();
    expect(cases).toHaveLength(41);
    expect(cases.filter((c) => c.source === "single")).toHaveLength(5);
    expect(cases.filter((c) => c.source === "batch")).toHaveLength(24);
    expect(cases.filter((c) => c.source === "hard")).toHaveLength(12);
  });

  it("every case's image exists on disk", () => {
    for (const c of loadCases()) {
      expect(existsSync(c.imagePath), `missing image: ${c.imagePath}`).toBe(true);
    }
  });

  it("every case's application parses against the Application schema", () => {
    for (const c of loadCases()) {
      const reparse = Application.safeParse(c.application);
      expect(reparse.success, `${c.id} failed: ${JSON.stringify(reparse)}`).toBe(true);
    }
  });

  it("every case has a valid expected status", () => {
    for (const c of loadCases()) {
      expect(["pass", "review", "fail"]).toContain(c.expectedStatus);
    }
  });
});
