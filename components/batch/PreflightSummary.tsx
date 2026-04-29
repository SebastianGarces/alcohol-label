"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
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
  const totalRows = matchedCount + skipped.length + unmatchedRows.length;
  const totalImages = matchedCount + unmatchedImages.length;

  let tone: "pass" | "review" | "fail";
  let headline: string;
  if (matchedCount === 0) {
    tone = "fail";
    headline = "Nothing matched — there's no batch to run";
  } else if (issuesCount === 0) {
    tone = "pass";
    headline = `Pre-flight passed · ${matchedCount} ready to verify`;
  } else {
    tone = "review";
    headline = `Pre-flight done · ${matchedCount} ready, ${issuesCount} need${
      issuesCount === 1 ? "s" : ""
    } attention`;
  }

  const HeaderIcon = tone === "pass" ? CheckCircle2 : tone === "review" ? AlertTriangle : XCircle;
  const headerIconColor =
    tone === "pass" ? "text-pass-ink" : tone === "review" ? "text-review-ink" : "text-fail-ink";

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-ledger bg-paper p-6 shadow-card">
      <header className="flex items-start gap-3">
        <HeaderIcon aria-hidden className={`mt-1 size-6 shrink-0 ${headerIconColor}`} />
        <div className="flex flex-col gap-2">
          <h2 className="type-headline text-ink">{headline}</h2>
          <p className="text-base leading-relaxed text-graphite">
            The verifier read <strong className="text-ink">{totalRows}</strong> row
            {totalRows === 1 ? "" : "s"} from your CSV, checked each one for the required fields,
            and matched filenames to your <strong className="text-ink">{totalImages}</strong> image
            {totalImages === 1 ? "" : "s"}. Nothing's been verified yet —{" "}
            {matchedCount === 0 ? "fix the CSV or filenames and try again." : "confirm to start."}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2 rounded-md border border-ledger bg-bone p-4">
        <p className="type-label text-pencil">Findings</p>
        <ul className="flex flex-col gap-1.5 text-base text-ink">
          <li className="flex items-baseline gap-2">
            <CheckCircle2 aria-hidden className="size-4 shrink-0 translate-y-0.5 text-pass-ink" />
            <span>
              <strong className="font-semibold">{matchedCount}</strong> row
              {matchedCount === 1 ? "" : "s"} matched to an image and ready to verify
            </span>
          </li>
          {skipped.length > 0 ? (
            <li className="flex items-baseline gap-2">
              <AlertTriangle
                aria-hidden
                className="size-4 shrink-0 translate-y-0.5 text-review-ink"
              />
              <span>
                <strong className="font-semibold">{skipped.length}</strong> CSV row
                {skipped.length === 1 ? "" : "s"} skipped — invalid data (see below)
              </span>
            </li>
          ) : null}
          {unmatchedRows.length > 0 ? (
            <li className="flex items-baseline gap-2">
              <AlertTriangle
                aria-hidden
                className="size-4 shrink-0 translate-y-0.5 text-review-ink"
              />
              <span>
                <strong className="font-semibold">{unmatchedRows.length}</strong> CSV row
                {unmatchedRows.length === 1 ? "" : "s"} without a matching image
              </span>
            </li>
          ) : null}
          {unmatchedImages.length > 0 ? (
            <li className="flex items-baseline gap-2">
              <AlertTriangle
                aria-hidden
                className="size-4 shrink-0 translate-y-0.5 text-review-ink"
              />
              <span>
                <strong className="font-semibold">{unmatchedImages.length}</strong> image
                {unmatchedImages.length === 1 ? "" : "s"} without a matching CSV row
              </span>
            </li>
          ) : null}
        </ul>
      </div>

      {skipped.length > 0 ? (
        <details className="rounded-md border border-review-rule bg-review-tint/55 p-3 text-base text-ink">
          <summary className="cursor-pointer font-medium">Skipped rows ({skipped.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
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
