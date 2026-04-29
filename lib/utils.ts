import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { VerificationTelemetry, VerificationTelemetryCall } from "@/lib/schema/result";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCostUsd(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "$0.00";
  if (n === 0) return "$0.00";
  if (n >= 1) return `$${n.toFixed(2)}`;
  // Below $1: round to 4 decimals, trim trailing zeroes for sub-$0.01 amounts.
  // Sub-$0.0001 amounts that would round to zero get a "<$0.0001" hint instead of "$0".
  if (n < 0.00005) return "<$0.0001";
  let s = n.toFixed(4);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return `$${s}`;
}

export function formatDurationSec(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

const MODEL_FRIENDLY_NAME: Record<string, string> = {
  "anthropic/claude-haiku-4.5": "Haiku",
  "anthropic/claude-sonnet-4.5": "Sonnet",
};

export function friendlyModelName(slug: string): string {
  if (MODEL_FRIENDLY_NAME[slug]) return MODEL_FRIENDLY_NAME[slug];
  // Fallback: take the segment after the slash, strip vendor noise.
  const tail = slug.includes("/") ? slug.slice(slug.indexOf("/") + 1) : slug;
  // Capitalize first letter; "claude-haiku-4.5" -> "Claude-haiku-4.5". Acceptable fallback.
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

export type TelemetryByModel = {
  name: string;
  costUsd: number;
  callCount: number;
};

export type TelemetrySummary = {
  callCount: number;
  totalCostUsd: number;
  byModel: TelemetryByModel[];
};

export function summarizeTelemetry(telemetry: VerificationTelemetry): TelemetrySummary {
  const byModelMap = new Map<string, { costUsd: number; callCount: number }>();
  for (const call of telemetry.calls) {
    const existing = byModelMap.get(call.model) ?? { costUsd: 0, callCount: 0 };
    existing.costUsd += call.costUsd;
    existing.callCount += 1;
    byModelMap.set(call.model, existing);
  }
  const byModel: TelemetryByModel[] = Array.from(byModelMap.entries()).map(([slug, agg]) => ({
    name: friendlyModelName(slug),
    costUsd: agg.costUsd,
    callCount: agg.callCount,
  }));
  return {
    callCount: telemetry.calls.length,
    totalCostUsd: telemetry.totalCostUsd,
    byModel,
  };
}

export type BatchRollup = {
  spentUsd: number;
  avgDurationMs: number | null;
  completedWithTelemetry: number;
};

type RollupRow = {
  result: { durationMs?: number; telemetry?: VerificationTelemetry } | null;
};

export function summarizeBatchTelemetry(rows: readonly RollupRow[]): BatchRollup {
  let spentUsd = 0;
  let totalDurationMs = 0;
  let durationSamples = 0;
  let completedWithTelemetry = 0;
  for (const row of rows) {
    const result = row.result;
    if (!result) continue;
    if (result.telemetry) {
      spentUsd += result.telemetry.totalCostUsd;
      completedWithTelemetry += 1;
    }
    if (typeof result.durationMs === "number") {
      totalDurationMs += result.durationMs;
      durationSamples += 1;
    }
  }
  return {
    spentUsd,
    avgDurationMs: durationSamples === 0 ? null : totalDurationMs / durationSamples,
    completedWithTelemetry,
  };
}

export function callPurposeLabel(purpose: VerificationTelemetryCall["purpose"]): string {
  switch (purpose) {
    case "extract":
      return "Field extract";
    case "warning":
      return "Warning extract";
    case "escalate":
      return "Field escalate";
    case "tiebreak":
      return "Tiebreak";
  }
}
