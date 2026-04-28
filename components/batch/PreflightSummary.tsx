"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SkippedCsvRow } from "@/lib/schema/batch";

export type PreflightProps = {
  matchedCount: number;
  skipped: SkippedCsvRow[];
  unmatchedRows: string[];
  unmatchedImages: string[];
  onConfirm: () => void;
  onCancel: () => void;
};

export function PreflightSummary({
  matchedCount,
  skipped,
  unmatchedRows,
  unmatchedImages,
  onConfirm,
  onCancel,
}: PreflightProps) {
  const issuesCount = skipped.length + unmatchedRows.length + unmatchedImages.length;
  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-white p-6 shadow-sm">
      <header className="flex items-center gap-3">
        {issuesCount === 0 ? (
          <CheckCircle2 aria-hidden className="size-6 text-green-700" />
        ) : (
          <AlertTriangle aria-hidden className="size-6 text-amber-700" />
        )}
        <h2 className="text-2xl font-semibold">Pre-flight summary</h2>
      </header>
      <ul className="flex flex-col gap-1 text-base">
        <li>
          <strong>{matchedCount}</strong> labels matched
        </li>
        {skipped.length > 0 ? (
          <li>
            <strong>{skipped.length}</strong> CSV rows skipped (bad data)
          </li>
        ) : null}
        {unmatchedRows.length > 0 ? (
          <li>
            <strong>{unmatchedRows.length}</strong> CSV rows have no matching image
          </li>
        ) : null}
        {unmatchedImages.length > 0 ? (
          <li>
            <strong>{unmatchedImages.length}</strong> images have no matching CSV row
          </li>
        ) : null}
      </ul>

      {skipped.length > 0 ? (
        <details className="rounded-md border bg-amber-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Skipped rows ({skipped.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {skipped.slice(0, 25).map((r) => (
              <li key={`${r.line}-${r.filename ?? "no-file"}`}>
                Line {r.line}
                {r.filename ? ` · ${r.filename}` : ""}: {r.reason}
              </li>
            ))}
            {skipped.length > 25 ? (
              <li className="italic">…and {skipped.length - 25} more</li>
            ) : null}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onConfirm} disabled={matchedCount === 0} className="gap-2">
          Start verifying {matchedCount} labels
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Start over
        </Button>
      </div>
    </section>
  );
}
