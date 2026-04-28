import { describe, expect, it } from "vitest";
import { jaroWinkler } from "../jaro-winkler";

describe("jaroWinkler", () => {
  it("identical strings return 1", () => {
    expect(jaroWinkler("kentucky bourbon", "kentucky bourbon")).toBe(1);
  });
  it("close strings score >0.95", () => {
    expect(jaroWinkler("kentucky bourbon", "kentucky burbon")).toBeGreaterThan(0.95);
  });
  it("very different strings score below 0.85", () => {
    expect(jaroWinkler("vodka", "whiskey")).toBeLessThan(0.85);
  });
  it("classic Winkler example MARTHA/MARHTA scores ~0.96", () => {
    const score = jaroWinkler("MARTHA", "MARHTA");
    expect(score).toBeGreaterThan(0.96);
    expect(score).toBeLessThan(0.97);
  });
});
