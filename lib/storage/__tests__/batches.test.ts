import { describe, expect, it } from "vitest";
import type { Application } from "@/lib/schema/application";
import type { BatchRow } from "@/lib/schema/batch";
import { listBatches, loadRows, type StoredBatch, saveBatch, saveRow } from "@/lib/storage/batches";

const app: Application = {
  beverageType: "distilled_spirits",
  brandName: "Stone's Throw",
  classType: "Bourbon",
  alcoholContent: "45%",
  netContents: "750 mL",
  bottlerName: "B",
  bottlerAddress: "A",
};

const meta = (id: string, total: number): StoredBatch => ({
  id,
  createdAt: Date.now(),
  total,
});

const row = (id: string, state: BatchRow["state"]): BatchRow => ({
  id,
  filename: `${id}.jpg`,
  application: app,
  state,
  result: null,
  errorMessage: null,
  startedAt: null,
  finishedAt: null,
});

describe("storage/batches (in-memory fallback)", () => {
  it("persists + restores a batch and its rows", async () => {
    const batchId = "test-roundtrip";
    await saveBatch(meta(batchId, 3));
    await saveRow(batchId, row("a", "pending"));
    await saveRow(batchId, row("b", "pending"));

    // Update one row in place.
    await saveRow(batchId, { ...row("a", "done"), result: null });

    const all = await listBatches();
    expect(all.find((b) => b.id === batchId)?.total).toBe(3);

    const loaded = await loadRows(batchId);
    expect(loaded).toHaveLength(2);
    expect(loaded.find((r) => r.id === "a")?.state).toBe("done");
    expect(loaded.find((r) => r.id === "b")?.state).toBe("pending");
  });

  it("a saved pending row is the resume signal after a fresh listBatches/loadRows", async () => {
    const batchId = "test-resume";
    await saveBatch(meta(batchId, 2));
    await saveRow(batchId, row("x", "done"));
    await saveRow(batchId, row("y", "pending"));

    const batches = await listBatches();
    const target = batches.find((b) => b.id === batchId);
    expect(target).toBeDefined();
    const stored = await loadRows(batchId);
    const hasUnfinished = stored.some(
      (r) => r.state === "pending" || r.state === "running" || r.state === "error",
    );
    expect(hasUnfinished).toBe(true);
  });
});
