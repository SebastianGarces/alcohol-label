import { describe, expect, it } from "vitest";
import { nextApproval, nextFocusIndex } from "@/lib/batch/keyboard-nav";

describe("keyboard-nav > nextApproval", () => {
  it("cycles null → approve → reject → null", () => {
    expect(nextApproval(null)).toBe("approve");
    expect(nextApproval("approve")).toBe("reject");
    expect(nextApproval("reject")).toBe(null);
  });
});

describe("keyboard-nav > nextFocusIndex", () => {
  it("returns -1 when there are no rows", () => {
    expect(nextFocusIndex(0, 0, "down")).toBe(-1);
    expect(nextFocusIndex(0, 0, "up")).toBe(-1);
  });

  it("starts at 0 when nothing is focused yet", () => {
    expect(nextFocusIndex(-1, 5, "down")).toBe(0);
    expect(nextFocusIndex(-1, 5, "up")).toBe(0);
  });

  it("clamps to last row when moving down", () => {
    expect(nextFocusIndex(0, 3, "down")).toBe(1);
    expect(nextFocusIndex(2, 3, "down")).toBe(2);
  });

  it("clamps to first row when moving up", () => {
    expect(nextFocusIndex(2, 3, "up")).toBe(1);
    expect(nextFocusIndex(0, 3, "up")).toBe(0);
  });
});
