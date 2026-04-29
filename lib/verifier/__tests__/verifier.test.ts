import { describe, expect, it, vi } from "vitest";
import { GOVERNMENT_WARNING_TEXT } from "@/lib/canonical/government-warning";
import type { Application } from "@/lib/schema/application";
import type { LabelExtract, WarningExtract } from "@/lib/schema/extract";
import type { PreparedImage } from "@/lib/vlm/image";
import { verifyLabel } from "../index";

const baseExtract = (overrides: Partial<LabelExtract> = {}): LabelExtract => ({
  is_alcohol_label: true,
  brandName: { value: "Stone's Throw", confidence: 0.95 },
  classType: { value: "Kentucky Straight Bourbon Whiskey", confidence: 0.95 },
  alcoholContent: { value: "45% alc/vol", confidence: 0.95 },
  netContents: { value: "750 mL", confidence: 0.95 },
  bottlerName: { value: "Stone's Throw Distillery", confidence: 0.95 },
  bottlerAddress: { value: "123 Main St, Louisville, KY", confidence: 0.95 },
  importerName: { value: null, confidence: 0 },
  importerAddress: { value: null, confidence: 0 },
  countryOfOrigin: { value: null, confidence: 0 },
  ...overrides,
});

const goodWarning = (): WarningExtract => ({
  fullText: GOVERNMENT_WARNING_TEXT,
  headerIsAllCaps: true,
  headerAppearsBold: true,
  confidence: 0.99,
});

const preparedFor = (hash: string): PreparedImage => ({
  buffer: Buffer.from([0]),
  base64: "AA==",
  dataUrl: "data:image/jpeg;base64,AA==",
  hash,
  width: 1568,
  height: 1568,
  meanBrightness: 128,
  quality: {
    lowQuality: false,
    reasons: [],
    width: 1568,
    height: 1568,
    meanBrightness: 128,
  },
});

const baseApp: Application = {
  beverageType: "distilled_spirits",
  brandName: "Stone's Throw",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45%",
  netContents: "750 mL",
  bottlerName: "Stone's Throw Distillery",
  bottlerAddress: "123 Main Street, Louisville, KY",
};

let hashCounter = 0;
const newHash = () => `h${++hashCounter}`;

describe("verifyLabel orchestrator", () => {
  it("clean pass — all fields exact, warning ok", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () => baseExtract(),
      extractWarning: async () => goodWarning(),
      tiebreak: async () => ({ same: true, reason: "ok" }),
      escalateField: async () => ({ value: "", confidence: 1 }),
    });
    expect(result.status).toBe("pass");
    expect(result.warning.status).toBe("pass");
  });

  it("STONE'S THROW vs Stone's Throw → REVIEW (not FAIL)", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        baseExtract({ brandName: { value: "STONE'S THROW", confidence: 0.95 } }),
      extractWarning: async () => goodWarning(),
      tiebreak: async () => ({ same: true, reason: "ok" }),
      escalateField: async () => ({ value: "STONE'S THROW", confidence: 0.95 }),
    });
    expect(result.status).toBe("review");
    const brand = result.fields.find((f) => f.field === "brandName");
    expect(brand?.status).toBe("fuzzy_match");
  });

  it("title-case warning → FAIL with header_not_all_caps", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () => baseExtract(),
      extractWarning: async () => ({
        fullText: GOVERNMENT_WARNING_TEXT.replace("GOVERNMENT WARNING", "Government Warning"),
        headerIsAllCaps: false,
        headerAppearsBold: true,
        confidence: 0.99,
      }),
      tiebreak: async () => ({ same: true, reason: "ok" }),
      escalateField: async () => ({ value: null, confidence: 0 }),
    });
    expect(result.status).toBe("fail");
    expect(result.warning.failures.some((f) => f.kind === "header_not_all_caps")).toBe(true);
  });

  it("wrong ABV → FAIL", async () => {
    const result = await verifyLabel(
      Buffer.from([0]),
      { ...baseApp, alcoholContent: "45%" },
      {
        prepareImage: async () => preparedFor(newHash()),
        extractLabel: async () =>
          baseExtract({ alcoholContent: { value: "40% alc/vol", confidence: 0.95 } }),
        extractWarning: async () => goodWarning(),
        tiebreak: async () => ({ same: true, reason: "ok" }),
        escalateField: async () => ({ value: "40% alc/vol", confidence: 0.95 }),
      },
    );
    expect(result.status).toBe("fail");
    const abv = result.fields.find((f) => f.field === "alcoholContent");
    expect(abv?.status).toBe("mismatch");
  });

  it("wine ABV optional under 14% — no fail when absent on label", async () => {
    const wineApp: Application = {
      beverageType: "wine",
      brandName: "Sunny Hill",
      classType: "Table Wine",
      netContents: "750 mL",
      bottlerName: "Sunny Hill Vineyards",
      bottlerAddress: "1 Vine Rd, Napa, CA",
    };
    const result = await verifyLabel(Buffer.from([0]), wineApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        baseExtract({
          brandName: { value: "Sunny Hill", confidence: 0.95 },
          classType: { value: "Table Wine", confidence: 0.95 },
          alcoholContent: { value: null, confidence: 0 },
          netContents: { value: "750 mL", confidence: 0.95 },
          bottlerName: { value: "Sunny Hill Vineyards", confidence: 0.95 },
          bottlerAddress: { value: "1 Vine Road, Napa, CA", confidence: 0.95 },
        }),
      extractWarning: async () => goodWarning(),
      tiebreak: async () => ({ same: true, reason: "ok" }),
      escalateField: async () => ({ value: null, confidence: 0 }),
    });
    expect(result.status).toBe("pass");
    expect(result.fields.find((f) => f.field === "alcoholContent")).toBeUndefined();
  });

  it("optional country of origin: VLM hallucinates 'United States' on a domestic spirit → field skipped, still PASS", async () => {
    // Regression for the inferred-country-from-bottler-address case:
    // application doesn't supply countryOfOrigin and there's no importer info,
    // so the field is optional and must not fail just because the model
    // 'reads' a country off the U.S. bottler address.
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        baseExtract({ countryOfOrigin: { value: "United States", confidence: 0.9 } }),
      extractWarning: async () => goodWarning(),
      tiebreak: async () => ({ same: true, reason: "ok" }),
      escalateField: async () => ({ value: "United States", confidence: 0.9 }),
    });
    expect(result.status).toBe("pass");
    expect(result.fields.find((f) => f.field === "countryOfOrigin")).toBeUndefined();
  });

  it("beer ABV optional — absent on application and label is fine", async () => {
    const beerApp: Application = {
      beverageType: "malt_beverage",
      brandName: "Big River IPA",
      classType: "India Pale Ale",
      netContents: "12 fl oz",
      bottlerName: "Big River Brewing",
      bottlerAddress: "9 River St, Portland, OR",
    };
    const result = await verifyLabel(Buffer.from([0]), beerApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        baseExtract({
          brandName: { value: "Big River IPA", confidence: 0.95 },
          classType: { value: "India Pale Ale", confidence: 0.95 },
          alcoholContent: { value: null, confidence: 0 },
          netContents: { value: "12 fl oz", confidence: 0.95 },
          bottlerName: { value: "Big River Brewing", confidence: 0.95 },
          bottlerAddress: { value: "9 River Street, Portland, OR", confidence: 0.95 },
        }),
      extractWarning: async () => goodWarning(),
      tiebreak: async () => ({ same: true, reason: "ok" }),
      escalateField: async () => ({ value: null, confidence: 0 }),
    });
    expect(result.status).toBe("pass");
  });

  it("wine 14% threshold crossing → FAIL with wine_14pp_rule", async () => {
    const wineApp: Application = {
      beverageType: "wine",
      brandName: "Sunny Hill",
      classType: "Table Wine",
      alcoholContent: "14.1%",
      netContents: "750 mL",
      bottlerName: "Sunny Hill Vineyards",
      bottlerAddress: "1 Vine Rd, Napa, CA",
    };
    const result = await verifyLabel(Buffer.from([0]), wineApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        baseExtract({
          brandName: { value: "Sunny Hill", confidence: 0.95 },
          classType: { value: "Table Wine", confidence: 0.95 },
          alcoholContent: { value: "13.9% alc/vol", confidence: 0.95 },
          netContents: { value: "750 mL", confidence: 0.95 },
          bottlerName: { value: "Sunny Hill Vineyards", confidence: 0.95 },
          bottlerAddress: { value: "1 Vine Road, Napa, CA", confidence: 0.95 },
        }),
      extractWarning: async () => goodWarning(),
      tiebreak: async () => ({ same: true, reason: "ok" }),
      escalateField: async () => ({ value: "13.9% alc/vol", confidence: 0.95 }),
    });
    expect(result.status).toBe("fail");
    expect(result.fields.some((f) => f.method === "wine_14pp_rule")).toBe(true);
  });

  it("LLM tiebreak path — agrees → review", async () => {
    const tiebreak = vi.fn().mockResolvedValue({ same: true, reason: "OCR slip" });
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        baseExtract({ brandName: { value: "stones throw burbn", confidence: 0.95 } }),
      extractWarning: async () => goodWarning(),
      tiebreak,
      escalateField: async () => ({ value: "stones throw burbn", confidence: 0.95 }),
    });
    expect(tiebreak).toHaveBeenCalledOnce();
    expect(result.fields.find((f) => f.field === "brandName")?.method).toBe("llm_tiebreak");
  });

  it("LLM tiebreak path — rejects → fail", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        baseExtract({ brandName: { value: "stones throw burbn", confidence: 0.95 } }),
      extractWarning: async () => goodWarning(),
      tiebreak: async () => ({ same: false, reason: "different word" }),
      escalateField: async () => ({ value: "stones throw burbn", confidence: 0.95 }),
    });
    expect(result.status).toBe("fail");
  });

  it("not-an-alcohol-label sentinel returns early", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () => baseExtract({ is_alcohol_label: false }),
      extractWarning: async () => goodWarning(),
      tiebreak: async () => ({ same: true, reason: "ok" }),
      escalateField: async () => ({ value: null, confidence: 0 }),
    });
    expect(result.error).toBe("not_alcohol_label");
  });

  it("low-confidence field gets escalated to Sonnet", async () => {
    const escalate = vi.fn().mockResolvedValue({ value: "Stone's Throw", confidence: 0.95 });
    await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        baseExtract({ brandName: { value: "Stne's Trow", confidence: 0.4 } }),
      extractWarning: async () => goodWarning(),
      tiebreak: async () => ({ same: true, reason: "ok" }),
      escalateField: escalate,
    });
    expect(escalate).toHaveBeenCalledWith(expect.any(String), "brandName");
  });

  it("bottler value found under importer slot → REVIEW with category_swap, not FAIL", async () => {
    // Real-world case: imported tequila with "Imported by Velvet Crow Spirits LLC,
    // 88 Mission Street, San Diego, CA" on the label. The applicant filed the
    // same entity under bottlerName/Address. Verifier should recognize the
    // role swap and surface REVIEW rather than MISSING (red).
    const importedApp: Application = {
      beverageType: "distilled_spirits",
      brandName: "Velvet Crow",
      classType: "Tequila Reposado",
      alcoholContent: "40%",
      netContents: "750 mL",
      bottlerName: "Velvet Crow Spirits LLC",
      bottlerAddress: "88 Mission Street, San Diego, CA",
    };

    const result = await verifyLabel(Buffer.from([0]), importedApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        baseExtract({
          brandName: { value: "Velvet Crow", confidence: 0.95 },
          classType: { value: "Tequila Reposado", confidence: 0.95 },
          alcoholContent: { value: "40% alc/vol", confidence: 0.95 },
          netContents: { value: "750 mL", confidence: 0.95 },
          bottlerName: { value: null, confidence: 0 },
          bottlerAddress: { value: null, confidence: 0 },
          importerName: { value: "Velvet Crow Spirits LLC", confidence: 0.95 },
          importerAddress: { value: "88 Mission Street, San Diego, CA", confidence: 0.95 },
        }),
      extractWarning: async () => goodWarning(),
      tiebreak: async () => ({ same: true, reason: "ok" }),
      escalateField: async () => ({ value: "", confidence: 1 }),
    });

    expect(result.status).toBe("review");
    const bottlerName = result.fields.find((f) => f.field === "bottlerName");
    const bottlerAddress = result.fields.find((f) => f.field === "bottlerAddress");
    expect(bottlerName?.status).toBe("fuzzy_match");
    expect(bottlerName?.method).toBe("category_swap");
    expect(bottlerName?.labelValue).toBe("Velvet Crow Spirits LLC");
    expect(bottlerName?.rationale).toMatch(/importer/i);
    expect(bottlerAddress?.status).toBe("fuzzy_match");
    expect(bottlerAddress?.method).toBe("category_swap");
  });
});
