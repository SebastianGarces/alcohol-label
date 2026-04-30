import { describe, expect, it } from "vitest";
import {
  categorySwapPartner,
  detectCategorySwap,
  matchField,
  tiebreakResolved,
  wine14Crossed,
} from "../field";

const ext = (value: string | null, confidence = 0.95) => ({ value, confidence });

describe("matchField — strings", () => {
  it("exact match for brandName", () => {
    const o = matchField("brandName", "Stone's Throw", ext("Stone's Throw"));
    expect(o.status).toBe("resolved");
    if (o.status === "resolved") {
      expect(o.result.status).toBe("match");
      expect(o.result.method).toBe("exact");
    }
  });

  it("normalized match — case (Dave's STONE'S THROW vs Stone's Throw → REVIEW)", () => {
    const o = matchField("brandName", "Stone's Throw", ext("STONE'S THROW"));
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("fuzzy_match");
    expect(o.result.method).toBe("normalized");
  });

  it("normalized match — whitespace", () => {
    const o = matchField("brandName", "Stone's   Throw", ext("Stone's Throw"));
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("fuzzy_match");
  });

  it("normalized match — smart quotes", () => {
    const o = matchField("brandName", "Stone’s Throw", ext("Stone's Throw"));
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("fuzzy_match");
  });

  it("normalized match — diacritics (foreign producer names)", () => {
    const o = matchField("bottlerName", "Destilería Velvet Crow", ext("Destileria Velvet Crow"));
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("fuzzy_match");
    expect(o.result.method).toBe("normalized");
  });

  it("classType exact match", () => {
    const o = matchField(
      "classType",
      "Kentucky Straight Bourbon Whiskey",
      ext("Kentucky Straight Bourbon Whiskey"),
    );
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("match");
  });

  it("Jaro-Winkler boundary — just-match (≥0.95)", () => {
    // 'kentucky burbon' vs 'kentucky bourbon' jw > 0.97
    const o = matchField("classType", "kentucky bourbon", ext("kentucky burbon"));
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("fuzzy_match");
  });

  it("Jaro-Winkler boundary — pending tiebreak (between 0.85 and 0.95)", () => {
    // 'Highland Reserve' vs 'Hghlnd Resrv' lands at JW ≈ 0.925
    const o = matchField("brandName", "Highland Reserve", ext("Hghlnd Resrv"));
    expect(o.status).toBe("pending_tiebreak");
  });

  it("very-different strings → mismatch", () => {
    const o = matchField("brandName", "Stone's Throw", ext("Eagle Rare"));
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("mismatch");
  });
});

describe("matchField — ABV", () => {
  it("matches '45%' to '45% alc/vol'", () => {
    const o = matchField("alcoholContent", "45%", ext("45% alc/vol"));
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("match");
    expect(o.result.method).toBe("numeric");
  });

  it("flags ABV mismatch when label and application differ", () => {
    const o = matchField("alcoholContent", "40%", ext("45% alc/vol"));
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("mismatch");
  });

  it("ABV format leniency — 'Alc. 13.5 percent by vol.' equals '13.5% alc/vol'", () => {
    const o = matchField("alcoholContent", "13.5% alc/vol", ext("Alc. 13.5 percent by vol."));
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("match");
  });
});

describe("matchField — netContents", () => {
  it("750 mL == 750ml == 750 ML", () => {
    for (const variant of ["750ml", "750 ML", "750 mL"]) {
      const o = matchField("netContents", "750 mL", ext(variant));
      if (o.status !== "resolved") throw new Error("expected resolved");
      expect(o.result.status).toBe("match");
    }
  });

  it("flags mL/oz mismatch", () => {
    const o = matchField("netContents", "750 mL", ext("12 fl oz"));
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("mismatch");
  });
});

describe("matchField — addresses", () => {
  it("token-set match treats 'St.' and 'Street' the same", () => {
    const o = matchField(
      "bottlerAddress",
      "123 Main St., Louisville, KY",
      ext("123 Main Street\nLouisville, KY"),
    );
    if (o.status !== "resolved") throw new Error("expected resolved");
    expect(o.result.status).toBe("match");
  });
});

describe("tiebreakResolved", () => {
  it("LLM agrees → fuzzy_match", () => {
    const r = tiebreakResolved(
      {
        status: "pending_tiebreak",
        field: "brandName",
        applicationValue: "Stone's Throw",
        labelValue: "Stoes Thrwo",
        similarity: 0.9,
        confidence: 0.95,
      },
      true,
      "OCR transposition",
    );
    expect(r.status).toBe("fuzzy_match");
    expect(r.method).toBe("llm_tiebreak");
    expect(r.escalated).toBe(true);
  });

  it("LLM rejects → mismatch", () => {
    const r = tiebreakResolved(
      {
        status: "pending_tiebreak",
        field: "brandName",
        applicationValue: "Eagle Rare",
        labelValue: "Eagle Pure",
        similarity: 0.88,
        confidence: 0.95,
      },
      false,
      "different word",
    );
    expect(r.status).toBe("mismatch");
  });
});

describe("detectCategorySwap", () => {
  it("partner map covers both directions", () => {
    expect(categorySwapPartner("bottlerName")).toBe("importerName");
    expect(categorySwapPartner("bottlerAddress")).toBe("importerAddress");
    expect(categorySwapPartner("importerName")).toBe("bottlerName");
    expect(categorySwapPartner("importerAddress")).toBe("bottlerAddress");
    expect(categorySwapPartner("brandName")).toBeUndefined();
  });

  it("demotes a missing bottler when the same name is on the label as importer", () => {
    const r = detectCategorySwap(
      "bottlerName",
      "Velvet Crow Spirits LLC",
      ext("Velvet Crow Spirits LLC"),
    );
    expect(r).not.toBeNull();
    expect(r?.status).toBe("fuzzy_match");
    expect(r?.method).toBe("category_swap");
    expect(r?.rationale).toMatch(/bottler/);
    expect(r?.rationale).toMatch(/importer/);
    expect(r?.rationale).toMatch(/27 CFR 5\.66 vs 5\.67/);
  });

  it("demotes a missing bottler address using token-set match against the importer address", () => {
    const r = detectCategorySwap(
      "bottlerAddress",
      "88 Mission Street, San Diego, CA",
      ext("88 Mission St\nSan Diego, CA"),
    );
    expect(r).not.toBeNull();
    expect(r?.method).toBe("category_swap");
    expect(r?.status).toBe("fuzzy_match");
  });

  it("works in the reverse direction (missing importer matches the bottler slot)", () => {
    const r = detectCategorySwap(
      "importerName",
      "Velvet Crow Spirits LLC",
      ext("Velvet Crow Spirits LLC"),
    );
    expect(r?.method).toBe("category_swap");
    expect(r?.rationale).toMatch(/27 CFR 5\.67 vs 5\.66/);
  });

  it("returns null when the partner slot has no value on the label", () => {
    expect(detectCategorySwap("bottlerName", "Velvet Crow Spirits LLC", ext(null))).toBeNull();
  });

  it("returns null when the partner value is unrelated", () => {
    expect(
      detectCategorySwap("bottlerName", "Velvet Crow Spirits LLC", ext("Heaven Hill Distillery")),
    ).toBeNull();
  });
});

describe("wine14Crossed", () => {
  it("crosses if labeled 13.9% and application 14.1%", () => {
    expect(wine14Crossed("wine", "13.9%", "14.1%")).toBe(true);
  });
  it("does not cross if both under 14%", () => {
    expect(wine14Crossed("wine", "12.5%", "13.5%")).toBe(false);
  });
  it("ignores spirits", () => {
    expect(wine14Crossed("distilled_spirits", "12.5%", "14.1%")).toBe(false);
  });
});
