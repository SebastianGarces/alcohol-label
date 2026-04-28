import { describe, expect, it } from "vitest";
import { estimateEtaMs, formatEta, runQueue } from "../queue";

const tick = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("runQueue", () => {
  it("never exceeds the concurrency limit", async () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    let active = 0;
    let max = 0;
    const ctrl = runQueue(
      items,
      async () => {
        active++;
        max = Math.max(max, active);
        await tick(5);
        active--;
      },
      { concurrency: 6 },
    );
    await ctrl.whenIdle;
    expect(max).toBeLessThanOrEqual(6);
  });

  it("does not let one row's failure block siblings", async () => {
    const items = [0, 1, 2];
    const completed: number[] = [];
    const ctrl = runQueue(
      items,
      async (item) => {
        if (item === 1) throw new Error("boom");
        await tick(2);
        completed.push(item);
      },
      { concurrency: 3 },
    );
    await ctrl.whenIdle;
    expect(completed.sort()).toEqual([0, 2]);
  });
});

describe("estimateEtaMs", () => {
  it("produces a reasonable estimate after some rows complete", () => {
    // 10 done in 5s → 0.5s per row → 90 remaining → 45_000ms
    const eta = estimateEtaMs(10, 100, 5_000);
    expect(eta).toBe(45_000);
    expect(formatEta(eta)).toBe("45s");
  });

  it("returns null until at least one row finishes", () => {
    expect(estimateEtaMs(0, 100, 1000)).toBeNull();
  });
});
