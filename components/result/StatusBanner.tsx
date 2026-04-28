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
  pass: "bg-green-50 text-green-800 border-green-300",
  review: "bg-amber-50 text-amber-900 border-amber-300",
  fail: "bg-red-50 text-red-900 border-red-300",
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
      className={cn("flex items-start gap-4 rounded-2xl border-2 p-6 shadow-sm", STYLES[status])}
    >
      <Icon aria-hidden className="mt-1 size-10 shrink-0" />
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="text-base leading-relaxed">{subtitle}</p>
        <p className="flex items-center gap-2 text-sm opacity-70">
          Verified in {(durationMs / 1000).toFixed(1)} s
          {slow ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/60 px-2 py-0.5 text-xs font-medium">
              <Clock aria-hidden className="size-3" />
              Slow ({">"}5 s)
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
