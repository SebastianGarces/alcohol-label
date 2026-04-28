import { AlertTriangle } from "lucide-react";
import type { VerificationResult } from "@/lib/schema/result";
import { FieldRow } from "./FieldRow";
import { StatusBanner } from "./StatusBanner";
import { TieredRoutingNote } from "./TieredRoutingNote";
import { WarningRedline } from "./WarningRedline";

const ERROR_COPY: Record<string, string> = {
  not_alcohol_label:
    "We couldn't find alcohol label content in this image. Please upload an actual label.",
  vlm_timeout:
    "The model took too long to read this label. Please try again — usually a retry succeeds.",
  vlm_error: "Something went wrong while reading the label. Please try again.",
  auth_error: "Server configuration problem — please contact the site owner.",
  image_too_dark: "Image quality too low — try a brighter or steadier photo.",
  image_too_small: "Image is too small to read clearly. Please upload a higher-resolution photo.",
  rate_limited: "You're going a bit fast. Please wait a moment and try again.",
};

const QUALITY_COPY: Record<"too_small" | "too_dark", string> = {
  too_small: "Image resolution is low",
  too_dark: "Image looks dark",
};

export function ResultDisplay({
  result,
  onRetry,
}: {
  result: VerificationResult;
  onRetry?: () => void;
}) {
  if (result.error) {
    return (
      <div role="alert" className="rounded-2xl border-2 border-red-300 bg-red-50 p-6 text-red-900">
        <h2 className="text-2xl font-semibold">We couldn't verify this label</h2>
        <p className="mt-2 text-base">
          {ERROR_COPY[result.error] ?? "Unknown error. Please try again."}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-12 items-center gap-2 rounded-md bg-red-700 px-6 text-base font-medium text-white hover:bg-red-800"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  const quality = result.imageQuality;
  const showQualityBanner = quality?.lowQuality;

  return (
    <div className="flex flex-col gap-6">
      <StatusBanner status={result.status} durationMs={result.durationMs} />
      {showQualityBanner ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-900"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-base font-semibold">Image quality looks low</p>
              <p className="text-sm">
                {quality.reasons.map((r) => QUALITY_COPY[r]).join(" · ")}. Results may be less
                accurate. Try a brighter, sharper photo for best results.
              </p>
            </div>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="self-start rounded-md border border-amber-400 bg-white px-4 py-2 text-sm font-medium hover:bg-amber-100"
            >
              Upload a different photo
            </button>
          ) : null}
        </div>
      ) : null}
      <WarningRedline warning={result.warning} resultId={result.id} />
      {result.fields.length > 0 ? <TieredRoutingNote fields={result.fields} /> : null}
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">Field-by-field</h3>
        {result.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checkable fields for this submission.</p>
        ) : (
          result.fields.map((f) => (
            <FieldRow key={`${f.field}-${f.method}`} result={f} resultId={result.id} />
          ))
        )}
      </section>
    </div>
  );
}
