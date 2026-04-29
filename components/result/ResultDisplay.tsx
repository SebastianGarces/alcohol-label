import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VerificationResult } from "@/lib/schema/result";
import { FieldRow } from "./FieldRow";
import { StatusBanner } from "./StatusBanner";
import { TelemetryFooter } from "./TelemetryFooter";
import { TieredRoutingNote } from "./TieredRoutingNote";
import { WarningRedline } from "./WarningRedline";

const ERROR_COPY: Record<string, string> = {
  not_alcohol_label:
    "We couldn't find alcohol label content in this image. Please upload an actual label.",
  vlm_timeout:
    "The model took too long to read this label. Please try again — usually a retry succeeds.",
  vlm_error:
    "We couldn't read this label. Try a sharper, brighter photo, or wait a moment and try again.",
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
      <div
        role="alert"
        className="rounded-xl border border-fail-rule bg-fail-tint p-6 text-fail-ink shadow-card"
      >
        <h2 className="type-headline">We couldn't verify this label</h2>
        <p className="mt-2 text-base leading-relaxed">
          {ERROR_COPY[result.error] ?? "Unknown error. Please try again."}
        </p>
        {onRetry ? (
          <Button type="button" onClick={onRetry} className="mt-4">
            Try again
          </Button>
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
          className="flex flex-col gap-3 rounded-md border border-review-rule bg-review-tint p-5 text-review-ink"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden className="mt-1 size-5 shrink-0" />
            <div>
              <p className="text-base font-semibold">Image quality looks low</p>
              <p className="text-base leading-relaxed">
                {quality.reasons.map((r) => QUALITY_COPY[r]).join(" · ")}. Results may be less
                accurate. Try a brighter, sharper photo for best results.
              </p>
            </div>
          </div>
          {onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry} className="self-start">
              Upload a different photo
            </Button>
          ) : null}
        </div>
      ) : null}
      <WarningRedline warning={result.warning} resultId={result.id} />
      {result.fields.length > 0 ? <TieredRoutingNote fields={result.fields} /> : null}
      <section className="flex flex-col gap-3">
        <h3 className="type-title text-ink">Field-by-field</h3>
        {result.fields.length === 0 ? (
          <p className="text-base text-graphite">No checkable fields for this submission.</p>
        ) : (
          result.fields.map((f) => (
            <FieldRow key={`${f.field}-${f.method}`} result={f} resultId={result.id} />
          ))
        )}
      </section>
      <TelemetryFooter result={result} />
    </div>
  );
}
