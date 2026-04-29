"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImagePreview } from "@/components/ui/ImagePreview";
import { parseBatchCsv } from "@/lib/batch/csv";
import { rowsToCsv } from "@/lib/batch/export";
import { matchFilesToRows } from "@/lib/batch/match-files";
import { estimateEtaMs, type QueueController, runQueue } from "@/lib/batch/queue";
import { computeBatchCounts, failedRowIndices } from "@/lib/batch/stats";
import type { BatchRow, SkippedCsvRow } from "@/lib/schema/batch";
import type { VerificationResult } from "@/lib/schema/result";
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
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [batchStartedAt, setBatchStartedAt] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [queueActive, setQueueActive] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const filesByKey = useRef<FileMap>(new Map());
  const queueRef = useRef<QueueController | null>(null);
  const rowsRef = useRef<BatchRow[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const next = new Map<string, string>();
    for (const f of images) {
      next.set(f.name.toLowerCase(), URL.createObjectURL(f));
    }
    setPreviewUrls(next);
    return () => {
      for (const url of next.values()) URL.revokeObjectURL(url);
    };
  }, [images]);

  function startQueue(preparedRows: BatchRow[], indices: number[], filesMap: FileMap) {
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
            markDone(row.id, result);
            return;
          }
          if (!res.ok) throw await asError(res);
          const result = (await res.json()) as VerificationResult;
          markDone(row.id, result);
        } catch (err) {
          if (signal.aborted) return;
          const message = err instanceof Error ? err.message : "Unknown error";
          markError(row.id, message);
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

  function markDone(rowId: string, result: VerificationResult): void {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              state: "done",
              result,
              finishedAt: Date.now(),
              errorMessage: null,
            }
          : r,
      ),
    );
  }

  function markError(rowId: string, message: string): void {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              state: "error",
              errorMessage: message,
              finishedAt: Date.now(),
            }
          : r,
      ),
    );
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

  function startBatch(): void {
    if (rows.length === 0) return;
    setPhase("running");
    startQueue(
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
    startQueue(rowsRef.current, failedIndices, filesByKey.current);
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

  function handleStartOver(): void {
    setPhase("idle");
    setRows([]);
    setImages([]);
    setCsv(null);
    setSkipped([]);
    setUnmatchedRows([]);
    setUnmatchedImages([]);
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
          {images.length > 0 ? (
            <ImageStrip
              title={`${images.length} image${images.length === 1 ? "" : "s"} staged`}
              caption="Click any thumbnail to enlarge before previewing matches."
              files={images}
              previewUrls={previewUrls}
            />
          ) : null}
        </section>
      ) : null}

      {phase === "preflight" ? (
        <>
          <PreflightSummary
            matchedCount={rows.length}
            skipped={skipped}
            unmatchedRows={unmatchedRows}
            unmatchedImages={unmatchedImages}
            onConfirm={startBatch}
            onCancel={handleStartOver}
          />
          {rows.length > 0 ? (
            <ImageStrip
              title={`${rows.length} matched image${rows.length === 1 ? "" : "s"}`}
              caption="These will run when you start verifying."
              files={rows
                .map((r) => images.find((f) => f.name.toLowerCase() === r.filename.toLowerCase()))
                .filter((f): f is File => Boolean(f))}
              previewUrls={previewUrls}
            />
          ) : null}
        </>
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
            <p className="flex items-center gap-2 text-base text-graphite">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {stats.running} in flight…
            </p>
          ) : null}
          <ResultsTable
            rows={rows}
            previewUrls={previewUrls}
            onExport={handleExport}
            onRetryFailed={phase === "complete" ? handleRetryFailed : undefined}
            retryDisabled={rows.every((r) => r.state !== "error" && !r.result?.error)}
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

function ImageStrip({
  title,
  caption,
  files,
  previewUrls,
}: {
  title: string;
  caption?: string;
  files: File[];
  previewUrls: Map<string, string>;
}) {
  if (files.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="type-label text-pencil">{title}</p>
        {caption ? <p className="text-sm text-graphite">{caption}</p> : null}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {files.map((file) => {
          const url = previewUrls.get(file.name.toLowerCase());
          if (!url) return null;
          return (
            <ImagePreview
              key={file.name}
              src={url}
              alt={file.name}
              caption={file.name}
              className="aspect-square w-full"
            />
          );
        })}
      </div>
    </section>
  );
}
