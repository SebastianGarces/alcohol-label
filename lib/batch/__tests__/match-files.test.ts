import { describe, expect, it } from "vitest";
import type { Application } from "@/lib/schema/application";
import type { ParsedCsvRow } from "../csv";
import { matchFilesToRows } from "../match-files";

const baseApp: Application = {
  beverageType: "distilled_spirits",
  brandName: "Test",
  classType: "Bourbon",
  alcoholContent: "45%",
  netContents: "750 mL",
  bottlerName: "Bottler",
  bottlerAddress: "Address",
};

const row = (filename: string): ParsedCsvRow => ({ filename, application: baseApp });

describe("matchFilesToRows", () => {
  it("matches by filename, case-insensitive", () => {
    const rows = [row("Stones-Throw.JPG"), row("missing.jpg")];
    const files = [{ name: "stones-throw.jpg" }, { name: "extra.jpg" }];
    const out = matchFilesToRows(rows, files);
    expect(out.matched).toHaveLength(1);
    expect(out.matched[0]?.row.filename).toBe("Stones-Throw.JPG");
    expect(out.unmatchedRows).toEqual(["missing.jpg"]);
    expect(out.unmatchedImages).toEqual(["extra.jpg"]);
  });
});
