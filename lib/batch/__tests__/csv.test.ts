import { describe, expect, it } from "vitest";
import { parseBatchCsv } from "../csv";

const HEADER =
  "filename,beverageType,brandName,classType,alcoholContent,netContents,bottlerName,bottlerAddress,importerName,importerAddress,countryOfOrigin";

const goodRow = [
  "01-bourbon.jpg",
  "distilled_spirits",
  "Stone's Throw",
  "Kentucky Straight Bourbon Whiskey",
  "45%",
  "750 mL",
  "Stone's Throw Distillery",
  "123 Main St, Louisville, KY",
  "",
  "",
  "",
].join(",");

describe("parseBatchCsv", () => {
  it("happy path: parses 5 valid rows", () => {
    const csv = [
      HEADER,
      ...Array.from({ length: 5 }, (_, i) => goodRow.replace("01", `0${i + 1}`)),
    ].join("\n");
    const result = parseBatchCsv(csv);
    expect(result.rows).toHaveLength(5);
    expect(result.skipped).toHaveLength(0);
    expect(result.rows[0]?.application.brandName).toBe("Stone's Throw");
  });

  it("reports the line number of a bad row", () => {
    const bad = [
      "02-bad.jpg",
      "distilled_spirits",
      "", // missing brand
      "Bourbon",
      "45%",
      "750 mL",
      "Bottler",
      "Address",
      "",
      "",
      "",
    ].join(",");
    const csv = [HEADER, goodRow, bad].join("\n");
    const result = parseBatchCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.line).toBe(3);
    expect(result.skipped[0]?.filename).toBe("02-bad.jpg");
  });

  it("returns a friendly error for empty CSV", () => {
    const result = parseBatchCsv("");
    expect(result.rows).toHaveLength(0);
    expect(result.skipped[0]?.reason).toMatch(/empty/i);
  });

  it("returns a friendly error when required columns are missing", () => {
    const result = parseBatchCsv("filename,brandName\nfoo.jpg,Test");
    expect(result.rows).toHaveLength(0);
    expect(result.skipped[0]?.reason).toMatch(/missing required columns/i);
  });
});
