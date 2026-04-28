"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseBatchCsv } from "@/lib/batch/csv";
import { rowsToCsv } from "@/lib/batch/export";
import { matchFilesToRows } from "@/lib/batch/match-files";
import { estimateEtaMs, type QueueController, runQueue } from "@/lib/batch/queue";
import { computeBatchCounts, failedRowIndices } from "@/lib/batch/stats";
import { type BatchRow, BatchRow as BatchRowSchema, type SkippedCsvRow } from "@/lib/schema/batch";
import type { VerificationResult } from "@/lib/schema/result";
import {
  deleteBatch,
  listBatches,
  loadRows,
  type StoredBatch,
  saveBatch,
  saveRow,
  setMemoryFallbackHandler,
} from "@/lib/storage/batches";
import { resizeImageForUpload } from "@/lib/upload/resize";
import { BatchDropzone, type DropPayload } from "./BatchDropzone";
import { PreflightSummary } from "./PreflightSummary";
import { ProgressHeader, type ProgressStats } from "./ProgressHeader";
import { ResultsTable } from "./ResultsTable";

type Phase = "idle" | "preflight" | "running" | "complete";

type FileMap = Map<string, File>;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `batch-${Math.random().toString(36).slice(2)}-${Date.now()}`;

export function BatchClient() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [images, setImages] = useState<File[]>([]);
  const [csv, setCsv] = useState<File | null>(null);
  const [skipped, setSkipped] = useState<SkippedCsvRow[]>([]);
  const [unmatchedRows, setUnmatchedRows] = useState<string[]>([]);
  const [unmatchedImages, setUnmatchedImages] = useState<string[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [batchStartedAt, setBatchStartedAt] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [resumable, setResumable] = useState<{ batch: StoredBatch; rows: BatchRow[] } | null>(null);
  const [queueActive, setQueueActive] = useState(false);

  const filesByKey = useRef<FileMap>(new Map());
  const queueRef = useRef<QueueController | null>(null);
  const rowsRef = useRef<BatchRow[]>([]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    setMemoryFallbackHandler((reason) => {
      toast.warning(`History won't persist this session: ${reason}`);
    });
    let cancelled = false;
    (async () => {
      const batches = await listBatches();
      if (cancelled) return;
      const latest = batches.sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!latest) return;
      const stored = await loadRows(latest.id);
      if (cancelled) return;
      const safe = stored.flatMap((r) => {
        const parsed = BatchRowSchema.safeParse(r);
        return parsed.success ? [parsed.data] : [];
      });
      if (safe.some((r) => r.state === "pending" || r.state === "running" || r.state === "error")) {
        setResumable({ batch: latest, rows: safe });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function startQueue(
    activeBatchId: string,
    preparedRows: BatchRow[],
    indices: number[],
    filesMap: FileMap,
  ) {
    setQueueActive(true);
    setPaused(false);
    setBatchStartedAt(Date.now());
    const items = indices.map((i) => preparedRows[i]!).filter(Boolean);
    const ctrl = runQueue(
      items,
      async (row, _i, signal) => {
        updateRow(row.id, (r) => ({
          ...r,
          state: "running",
          startedAt: Date.now(),
          errorMessage: null,
        }));
        try {
          const file = filesMap.get(row.filename.toLowerCase());
          if (!file) throw new Error("Image missing — re-upload to retry this row");
          const compressed = await resizeImageForUpload(file);
          const fd = new FormData();
          fd.set("image", compressed);
          fd.set("application", JSON.stringify(row.application));
          const res = await fetch("/api/verify-one", {
            method: "POST",
            body: fd,
            signal,
          });
          if (res.status === 429) {
            const retry = Number(res.headers.get("retry-after") ?? 5);
            await new Promise((r) => setTimeout(r, Math.min(10_000, retry * 1000)));
            const retryRes = await fetch("/api/verify-one", {
              method: "POST",
              body: fd,
              signal,
            });
            if (!retryRes.ok) throw await asError(retryRes);
            const result = (await retryRes.json()) as VerificationResult;
            await markDone(activeBatchId, row.id, result);
            return;
          }
          if (!res.ok) throw await asError(res);
          const result = (await res.json()) as VerificationResult;
          await markDone(activeBatchId, row.id, result);
        } catch (err) {
          if (signal.aborted) return;
          const message = err instanceof Error ? err.message : "Unknown error";
          await markError(activeBatchId, row.id, message);
        }
      },
      { concurrency: 6 },
    );
    ctrl.whenIdle.then(() => {
      setQueueActive(false);
      setPaused(false);
      setPhase("complete");
    });
    queueRef.current = ctrl;
  }

  function updateRow(rowId: string, patch: (row: BatchRow) => BatchRow): void {
    setRows((prev) => prev.map((r) => (r.id === rowId ? patch(r) : r)));
  }

  async function markDone(
    activeBatchId: string,
    rowId: string,
    result: VerificationResult,
  ): Promise<void> {
    let updated: BatchRow | undefined;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        updated = {
          ...r,
          state: "done",
          result,
          finishedAt: Date.now(),
          errorMessage: null,
        };
        return updated;
      }),
    );
    if (updated) await saveRow(activeBatchId, updated);
  }

  async function markError(activeBatchId: string, rowId: string, message: string): Promise<void> {
    let updated: BatchRow | undefined;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        updated = {
          ...r,
          state: "error",
          errorMessage: message,
          finishedAt: Date.now(),
        };
        return updated;
      }),
    );
    if (updated) await saveRow(activeBatchId, updated);
  }

  async function asError(res: Response): Promise<Error> {
    try {
      const body = (await res.json()) as { message?: string };
      return new Error(body.message ?? `${res.status} ${res.statusText}`);
    } catch {
      return new Error(`${res.status} ${res.statusText}`);
    }
  }

  function handleDrop(payload: DropPayload): void {
    setImages(payload.images);
    setCsv(payload.csv);
  }

  const [demoLoading, setDemoLoading] = useState(false);
  async function loadDemoBatch(): Promise<void> {
    setDemoLoading(true);
    try {
      const manifestRes = await fetch("/samples/batch/manifest.json");
      if (!manifestRes.ok) throw new Error("manifest missing");
      const manifest = (await manifestRes.json()) as {
        rows: { filename: string }[];
      };

      const imagePromises = manifest.rows.map(async ({ filename }) => {
        const res = await fetch(`/samples/batch/${filename}`);
        if (!res.ok) throw new Error(`failed to load ${filename}`);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type || "image/jpeg" });
      });
      const csvPromise = (async () => {
        const res = await fetch("/samples/batch/applications.csv");
        if (!res.ok) throw new Error("failed to load applications.csv");
        const blob = await res.blob();
        return new File([blob], "applications.csv", { type: "text/csv" });
      })();
      const [loadedImages, loadedCsv] = await Promise.all([Promise.all(imagePromises), csvPromise]);

      setImages(loadedImages);
      setCsv(loadedCsv);
      toast.success(
        `Loaded demo batch: ${loadedImages.length} labels + applications.csv. Click "Preview matches" to continue.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Could not load demo batch: ${err.message}`
          : "Could not load demo batch",
      );
    } finally {
      setDemoLoading(false);
    }
  }

  async function handlePreflight(): Promise<void> {
    if (!csv || images.length === 0) {
      toast.error("Please add label images and a CSV before previewing.");
      return;
    }
    const text = await csv.text();
    const parsed = parseBatchCsv(text);
    if (parsed.rows.length === 0 && parsed.skipped.length > 0) {
      const message = parsed.skipped[0]?.reason ?? "Could not read CSV";
      toast.error(message);
      setSkipped(parsed.skipped);
      setRows([]);
      setPhase("preflight");
      return;
    }
    const matched = matchFilesToRows(parsed.rows, images);

    const map: FileMap = new Map();
    for (const f of images) {
      map.set(f.name.toLowerCase(), f);
    }
    filesByKey.current = map;

    const preparedRows: BatchRow[] = matched.matched.map(({ row }) => ({
      id: newId(),
      filename: row.filename,
      application: row.application,
      state: "pending",
      result: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
    }));

    setSkipped(parsed.skipped);
    setUnmatchedRows(matched.unmatchedRows);
    setUnmatchedImages(matched.unmatchedImages);
    setRows(preparedRows);
    setPhase("preflight");
  }

  async function startBatch(): Promise<void> {
    if (rows.length === 0) return;
    const id = newId();
    setBatchId(id);
    setPhase("running");

    const meta: StoredBatch = {
      id,
      createdAt: Date.now(),
      total: rows.length,
    };
    await saveBatch(meta);
    for (const row of rows) {
      await saveRow(id, row);
    }
    startQueue(
      id,
      rows,
      rows.map((_, i) => i),
      filesByKey.current,
    );
  }

  function handlePause(): void {
    queueRef.current?.pause();
    setPaused(true);
  }
  function handleResume(): void {
    queueRef.current?.resume();
    setPaused(false);
  }
  function handleCancel(): void {
    queueRef.current?.cancel();
    setQueueActive(false);
    setPhase("complete");
    setPaused(false);
  }

  function handleRetryFailed(): void {
    if (!batchId) return;
    const failedIndices = failedRowIndices(rowsRef.current);
    if (failedIndices.length === 0) {
      toast.message("No failed rows to retry.");
      return;
    }
    setRows((prev) =>
      prev.map((r, i) =>
        failedIndices.includes(i)
          ? { ...r, state: "pending", errorMessage: null, result: null, finishedAt: null }
          : r,
      ),
    );
    setPhase("running");
    startQueue(batchId, rowsRef.current, failedIndices, filesByKey.current);
  }

  async function handleExport(): Promise<void> {
    const csvText = rowsToCsv(rowsRef.current);
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleResumeStored(): Promise<void> {
    if (!resumable) return;
    toast.message(
      "We can show your previous batch's results, but the original images aren't kept in the browser. Re-upload the same images to retry pending rows.",
    );
    setBatchId(resumable.batch.id);
    setRows(resumable.rows);
    setPhase("complete");
    setResumable(null);
  }

  async function handleDiscardStored(): Promise<void> {
    if (!resumable) return;
    await deleteBatch(resumable.batch.id);
    setResumable(null);
  }

  function handleStartOver(): void {
    setPhase("idle");
    setRows([]);
    setImages([]);
    setCsv(null);
    setSkipped([]);
    setUnmatchedRows([]);
    setUnmatchedImages([]);
    setBatchId(null);
    setQueueActive(false);
    setPaused(false);
  }

  const stats: ProgressStats = useMemo(() => {
    const counts = computeBatchCounts(rows);
    const elapsed = batchStartedAt ? Date.now() - batchStartedAt : 0;
    const etaMs = estimateEtaMs(counts.done, counts.total, elapsed);
    return { ...counts, etaMs, paused, active: queueActive };
  }, [rows, batchStartedAt, paused, queueActive]);

  return (
    <div className="flex flex-col gap-6">
      {resumable ? (
        <section
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-900"
        >
          <div>
            <p className="text-base font-medium">
              We have a saved batch with {resumable.batch.total} rows.
            </p>
            <p className="text-sm">
              Open it to view results, or start fresh. Original images aren't kept in the browser.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleResumeStored}>Open previous batch</Button>
            <Button variant="outline" onClick={handleDiscardStored}>
              Discard
            </Button>
          </div>
        </section>
      ) : null}

      {phase === "idle" ? (
        <section className="flex flex-col gap-4">
          <BatchDropzone images={images} csv={csv} onDrop={handleDrop} />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handlePreflight} disabled={!csv || images.length === 0}>
              Preview matches
            </Button>
            <Button
              variant="outline"
              onClick={loadDemoBatch}
              disabled={demoLoading}
              className="gap-2"
            >
              {demoLoading ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Sparkles aria-hidden className="size-4" />
              )}
              {demoLoading ? "Loading demo…" : "Load demo batch (24 labels)"}
            </Button>
          </div>
        </section>
      ) : null}

      {phase === "preflight" ? (
        <PreflightSummary
          matchedCount={rows.length}
          skipped={skipped}
          unmatchedRows={unmatchedRows}
          unmatchedImages={unmatchedImages}
          onConfirm={startBatch}
          onCancel={handleStartOver}
        />
      ) : null}

      {phase === "running" || phase === "complete" ? (
        <>
          <ProgressHeader
            stats={stats}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
          />
          {stats.running > 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {stats.running} in flight…
            </p>
          ) : null}
          <ResultsTable
            rows={rows}
            onExport={handleExport}
            onRetryFailed={phase === "complete" ? handleRetryFailed : undefined}
            retryDisabled={!batchId || rows.every((r) => r.state !== "error" && !r.result?.error)}
          />
          {phase === "complete" ? (
            <div>
              <Button variant="outline" onClick={handleStartOver}>
                Start a new batch
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
