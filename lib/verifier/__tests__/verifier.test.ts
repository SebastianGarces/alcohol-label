import { describe, expect, it, vi } from "vitest";
import { GOVERNMENT_WARNING_TEXT } from "@/lib/canonical/government-warning";
import type { Application } from "@/lib/schema/application";
import type { ExtractedField, LabelExtract, WarningExtract } from "@/lib/schema/extract";
import type { VlmCallTelemetry } from "@/lib/vlm/call";
import type { PreparedImage } from "@/lib/vlm/image";
import { MODELS } from "@/lib/vlm/models";
import type { TiebreakDecision } from "@/lib/vlm/tiebreak";
import { verifyLabel } from "../index";

const fakeTelemetry = (
  model: string = MODELS.HAIKU,
  overrides: Partial<VlmCallTelemetry> = {},
): VlmCallTelemetry => ({
  model: model as VlmCallTelemetry["model"],
  latencyMs: 100,
  usage: { inputTokens: 200, outputTokens: 50, cachedInputTokens: 0 },
  costUsd: 0.000_45,
  ...overrides,
});

const wrapExtract = (value: LabelExtract, t?: Partial<VlmCallTelemetry>) => ({
  value,
  telemetry: fakeTelemetry(MODELS.HAIKU, t),
});
const wrapWarning = (value: WarningExtract, t?: Partial<VlmCallTelemetry>) => ({
  value,
  telemetry: fakeTelemetry(MODELS.SONNET, t),
});
const wrapEscalate = (value: ExtractedField, t?: Partial<VlmCallTelemetry>) => ({
  value,
  telemetry: fakeTelemetry(MODELS.SONNET, t),
});
const wrapTiebreak = (value: TiebreakDecision, t?: Partial<VlmCallTelemetry>) => ({
  value,
  telemetry: fakeTelemetry(MODELS.SONNET, t),
});

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
      extractLabel: async () => wrapExtract(baseExtract()),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: "", confidence: 1 }),
    });
    expect(result.status).toBe("pass");
    expect(result.warning.status).toBe("pass");
  });

  it("STONE'S THROW vs Stone's Throw → REVIEW (not FAIL)", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        wrapExtract(baseExtract({ brandName: { value: "STONE'S THROW", confidence: 0.95 } })),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: "STONE'S THROW", confidence: 0.95 }),
    });
    expect(result.status).toBe("review");
    const brand = result.fields.find((f) => f.field === "brandName");
    expect(brand?.status).toBe("fuzzy_match");
  });

  it("title-case warning → FAIL with header_not_all_caps", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () => wrapExtract(baseExtract()),
      extractWarning: async () =>
        wrapWarning({
          fullText: GOVERNMENT_WARNING_TEXT.replace("GOVERNMENT WARNING", "Government Warning"),
          headerIsAllCaps: false,
          headerAppearsBold: true,
          confidence: 0.99,
        }),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: null, confidence: 0 }),
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
          wrapExtract(baseExtract({ alcoholContent: { value: "40% alc/vol", confidence: 0.95 } })),
        extractWarning: async () => wrapWarning(goodWarning()),
        tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
        escalateField: async () => wrapEscalate({ value: "40% alc/vol", confidence: 0.95 }),
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
        wrapExtract(
          baseExtract({
            brandName: { value: "Sunny Hill", confidence: 0.95 },
            classType: { value: "Table Wine", confidence: 0.95 },
            alcoholContent: { value: null, confidence: 0 },
            netContents: { value: "750 mL", confidence: 0.95 },
            bottlerName: { value: "Sunny Hill Vineyards", confidence: 0.95 },
            bottlerAddress: { value: "1 Vine Road, Napa, CA", confidence: 0.95 },
          }),
        ),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: null, confidence: 0 }),
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
        wrapExtract(baseExtract({ countryOfOrigin: { value: "United States", confidence: 0.9 } })),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: "United States", confidence: 0.9 }),
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
        wrapExtract(
          baseExtract({
            brandName: { value: "Big River IPA", confidence: 0.95 },
            classType: { value: "India Pale Ale", confidence: 0.95 },
            alcoholContent: { value: null, confidence: 0 },
            netContents: { value: "12 fl oz", confidence: 0.95 },
            bottlerName: { value: "Big River Brewing", confidence: 0.95 },
            bottlerAddress: { value: "9 River Street, Portland, OR", confidence: 0.95 },
          }),
        ),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: null, confidence: 0 }),
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
        wrapExtract(
          baseExtract({
            brandName: { value: "Sunny Hill", confidence: 0.95 },
            classType: { value: "Table Wine", confidence: 0.95 },
            alcoholContent: { value: "13.9% alc/vol", confidence: 0.95 },
            netContents: { value: "750 mL", confidence: 0.95 },
            bottlerName: { value: "Sunny Hill Vineyards", confidence: 0.95 },
            bottlerAddress: { value: "1 Vine Road, Napa, CA", confidence: 0.95 },
          }),
        ),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: "13.9% alc/vol", confidence: 0.95 }),
    });
    expect(result.status).toBe("fail");
    expect(result.fields.some((f) => f.method === "wine_14pp_rule")).toBe(true);
  });

  it("LLM tiebreak path — agrees → review", async () => {
    const tiebreak = vi.fn().mockResolvedValue(wrapTiebreak({ same: true, reason: "OCR slip" }));
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        wrapExtract(baseExtract({ brandName: { value: "stones throw burbn", confidence: 0.95 } })),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak,
      escalateField: async () => wrapEscalate({ value: "stones throw burbn", confidence: 0.95 }),
    });
    expect(tiebreak).toHaveBeenCalledOnce();
    expect(result.fields.find((f) => f.field === "brandName")?.method).toBe("llm_tiebreak");
  });

  it("LLM tiebreak path — rejects → fail", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        wrapExtract(baseExtract({ brandName: { value: "stones throw burbn", confidence: 0.95 } })),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: false, reason: "different word" }),
      escalateField: async () => wrapEscalate({ value: "stones throw burbn", confidence: 0.95 }),
    });
    expect(result.status).toBe("fail");
  });

  it("not-an-alcohol-label sentinel returns early", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () => wrapExtract(baseExtract({ is_alcohol_label: false })),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: null, confidence: 0 }),
    });
    expect(result.error).toBe("not_alcohol_label");
  });

  it("low-confidence field gets escalated to Sonnet", async () => {
    const escalate = vi
      .fn()
      .mockResolvedValue(wrapEscalate({ value: "Stone's Throw", confidence: 0.95 }));
    await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        wrapExtract(baseExtract({ brandName: { value: "Stne's Trow", confidence: 0.4 } })),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
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
        wrapExtract(
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
        ),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: "", confidence: 1 }),
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

describe("verifyLabel telemetry aggregation", () => {
  it("collects per-call telemetry and sums latency + cost", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () => wrapExtract(baseExtract(), { latencyMs: 250, costUsd: 0.001 }),
      extractWarning: async () => wrapWarning(goodWarning(), { latencyMs: 400, costUsd: 0.003 }),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: "", confidence: 1 }),
    });

    expect(result.telemetry).toBeDefined();
    expect(result.telemetry?.calls).toHaveLength(2);
    const purposes = result.telemetry!.calls.map((c) => c.purpose).sort();
    expect(purposes).toEqual(["extract", "warning"]);
    expect(result.telemetry?.totalLatencyMs).toBe(650);
    expect(result.telemetry?.totalCostUsd).toBeCloseTo(0.004, 6);
    const extractCall = result.telemetry!.calls.find((c) => c.purpose === "extract");
    expect(extractCall).toMatchObject({
      model: MODELS.HAIKU,
      latencyMs: 250,
      inputTokens: 200,
      outputTokens: 50,
      cachedInputTokens: 0,
      costUsd: 0.001,
    });
  });

  it("includes escalate and tiebreak calls in the telemetry breakdown", async () => {
    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: async () =>
        wrapExtract(baseExtract({ brandName: { value: "Stne's Trow", confidence: 0.4 } })),
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () =>
        wrapTiebreak({ same: true, reason: "ok" }, { latencyMs: 300, costUsd: 0.002 }),
      escalateField: async () =>
        wrapEscalate(
          { value: "Stone's Throw", confidence: 0.95 },
          { latencyMs: 500, costUsd: 0.004 },
        ),
    });

    expect(result.telemetry).toBeDefined();
    const purposes = result.telemetry!.calls.map((c) => c.purpose);
    expect(purposes).toContain("escalate");
    // After escalation rewrites brandName to "Stone's Throw" (matching the
    // application exactly), no tiebreak is triggered, but the escalate is.
    const escalate = result.telemetry!.calls.find((c) => c.purpose === "escalate");
    expect(escalate).toMatchObject({ latencyMs: 500, costUsd: 0.004 });
  });

  it("captures partial telemetry on extract failure (cost = 0)", async () => {
    const failingExtract = async () => {
      const err = new Error("boom") as Error & { telemetry?: unknown };
      err.telemetry = {
        model: MODELS.HAIKU,
        latencyMs: 175,
        usage: { inputTokens: 100, outputTokens: 0, cachedInputTokens: 0 },
        costUsd: 0,
      };
      throw err;
    };

    const result = await verifyLabel(Buffer.from([0]), baseApp, {
      prepareImage: async () => preparedFor(newHash()),
      extractLabel: failingExtract as never,
      extractWarning: async () => wrapWarning(goodWarning()),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: null, confidence: 0 }),
    });

    expect(result.error).toBe("vlm_error");
    expect(result.telemetry).toBeDefined();
    const extractCall = result.telemetry!.calls.find((c) => c.purpose === "extract");
    expect(extractCall).toMatchObject({ latencyMs: 175, costUsd: 0 });
  });

  it("cached results preserve their original telemetry (no double-counting)", async () => {
    const hash = "cache-hash";
    const deps = {
      prepareImage: async () => preparedFor(hash),
      extractLabel: async () => wrapExtract(baseExtract(), { latencyMs: 200, costUsd: 0.005 }),
      extractWarning: async () => wrapWarning(goodWarning(), { latencyMs: 400, costUsd: 0.01 }),
      tiebreak: async () => wrapTiebreak({ same: true, reason: "ok" }),
      escalateField: async () => wrapEscalate({ value: "", confidence: 1 }),
    };

    const first = await verifyLabel(Buffer.from([0]), baseApp, deps);
    const originalCost = first.telemetry?.totalCostUsd;
    const originalCalls = first.telemetry?.calls.length;

    // Reuses same hash -> cache hit. New mocks should NOT be invoked, and the
    // returned telemetry must equal the original.
    const extractSpy = vi.fn();
    const second = await verifyLabel(Buffer.from([0]), baseApp, {
      ...deps,
      extractLabel: async () => {
        extractSpy();
        return wrapExtract(baseExtract());
      },
    });

    expect(second.cached).toBe(true);
    expect(extractSpy).not.toHaveBeenCalled();
    expect(second.telemetry?.totalCostUsd).toBe(originalCost);
    expect(second.telemetry?.calls.length).toBe(originalCalls);
  });
});
