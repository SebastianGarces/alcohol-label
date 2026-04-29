import { CheckCircle2, Clock, Eye, XCircle } from "lucide-react";
import type { OverallStatus } from "@/lib/schema/result";
import { cn } from "@/lib/utils";
import { SLOW_VERIFICATION_MS } from "@/lib/vlm/call";

const COPY: Record<OverallStatus, { title: string; subtitle: string }> = {
  pass: {
    title: "PASS",
    subtitle: "Every checked field matches the application and the warning is correct.",
  },
  review: {
    title: "REVIEW",
    subtitle:
      "Some fields matched after normalization or the model was uncertain. A reviewer should look.",
  },
  fail: {
    title: "FAIL",
    subtitle:
      "One or more required fields do not match, or the government warning is non-compliant.",
  },
};

const STYLES: Record<OverallStatus, string> = {
  pass: "bg-pass-tint text-pass-ink border-pass-rule",
  review: "bg-review-tint text-review-ink border-review-rule",
  fail: "bg-fail-tint text-fail-ink border-fail-rule",
};

const ICONS: Record<OverallStatus, typeof CheckCircle2> = {
  pass: CheckCircle2,
  review: Eye,
  fail: XCircle,
};

export function StatusBanner({
  status,
  durationMs,
}: {
  status: OverallStatus;
  durationMs: number;
}) {
  const { title, subtitle } = COPY[status];
  const Icon = ICONS[status];
  const slow = durationMs > SLOW_VERIFICATION_MS;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-start gap-4 rounded-xl border-2 p-6 shadow-card", STYLES[status])}
    >
      <Icon aria-hidden className="mt-1 size-10 shrink-0" />
      <div className="flex flex-col gap-1">
        <h2 className="type-display tracking-tight">{title}</h2>
        <p className="type-body">{subtitle}</p>
        <p className="flex items-center gap-2 type-label !tracking-normal !normal-case opacity-80 mt-1">
          Verified in {(durationMs / 1000).toFixed(1)} s
          {slow ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-paper/70 px-2 py-0.5 text-xs font-medium">
              <Clock aria-hidden className="size-3" />
              Slow ({">"}5 s)
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
