import { describe, expect, it } from "vitest";
import {
  normalizeAddress,
  normalizeBasic,
  parseAbv,
  parseNetContents,
  tokenSetRatio,
} from "../normalize";

describe("normalizeBasic", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeBasic("  STONE'S  Throw  ")).toBe("stone's throw");
  });
  it("normalizes smart quotes to straight", () => {
    expect(normalizeBasic("Stone’s Throw")).toBe("stone's throw");
  });
});

describe("parseAbv", () => {
  it("parses '45%'", () => expect(parseAbv("45%")).toBe(45));
  it("parses '40% Alc/Vol'", () => expect(parseAbv("40% Alc/Vol")).toBe(40));
  it("parses 'Alc. 13.5 percent by vol.'", () =>
    expect(parseAbv("Alc. 13.5 percent by vol.")).toBe(13.5));
  it("returns null on garbage", () => expect(parseAbv("forty proof")).toBeNull());
});

describe("parseNetContents", () => {
  it("750 mL", () => expect(parseNetContents("750 mL")?.value).toBe(750));
  it("750ml", () => expect(parseNetContents("750ml")?.value).toBe(750));
  it("1.75 L", () => expect(parseNetContents("1.75 L")?.value).toBe(1750));
  it("12 fl oz", () => expect(parseNetContents("12 fl oz")?.value).toBe(355));
});

describe("normalizeAddress + tokenSetRatio", () => {
  it("treats 'St.' and 'Street' as the same token", () => {
    const a = normalizeAddress("123 Main St., Louisville, KY");
    const b = normalizeAddress("123 Main Street\nLouisville, KY");
    expect(tokenSetRatio(a, b)).toBe(1);
  });
});
