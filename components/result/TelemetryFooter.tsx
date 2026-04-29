"use client";

import { ChevronDown, Receipt } from "lucide-react";
import { useId, useState } from "react";
import type { VerificationResult } from "@/lib/schema/result";
import {
  callPurposeLabel,
  cn,
  formatCostUsd,
  formatDurationSec,
  summarizeTelemetry,
} from "@/lib/utils";

export function TelemetryFooter({ result }: { result: VerificationResult }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const telemetry = result.telemetry;
  if (!telemetry) return null;

  const summary = summarizeTelemetry(telemetry);
  const wallClock = formatDurationSec(result.durationMs);
  const totalCost = formatCostUsd(summary.totalCostUsd);
  const callCountText = `${summary.callCount} model call${summary.callCount === 1 ? "" : "s"}`;
  const breakdown = summary.byModel.map((m) => `${m.name} ${formatCostUsd(m.costUsd)}`).join(" · ");

  return (
    <section
      aria-label="Run telemetry"
      className="rounded-md border border-ledger bg-paper/60 px-4 py-3 text-sm text-graphite"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-graphite transition-colors hover:text-ink"
      >
        <Receipt aria-hidden className="size-4 shrink-0" />
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span>
            Verified in <strong className="font-semibold text-ink tabular-nums">{wallClock}</strong>
          </span>
          <span aria-hidden className="text-pencil">
            ·
          </span>
          <span>
            <strong className="font-semibold text-ink tabular-nums">{totalCost}</strong>
          </span>
          <span aria-hidden className="text-pencil">
            ·
          </span>
          <span>{callCountText}</span>
          {breakdown ? (
            <span className="text-graphite">
              {" "}
              <span aria-hidden>(</span>
              {breakdown}
              <span aria-hidden>)</span>
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "ml-auto size-4 shrink-0 text-pencil transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
        />
        <span className="sr-only">{open ? "Hide call breakdown" : "Show call breakdown"}</span>
      </button>
      {open ? (
        <div id={detailsId} className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm tabular-nums">
            <thead>
              <tr className="text-pencil">
                <th className="py-1 pr-3 font-medium">Call</th>
                <th className="py-1 pr-3 font-medium">Model</th>
                <th className="py-1 pr-3 text-right font-medium">Latency</th>
                <th className="py-1 pr-3 text-right font-medium">Tokens (in / out)</th>
                <th className="py-1 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {telemetry.calls.map((call, i) => (
                <tr
                  // biome-ignore lint/suspicious/noArrayIndexKey: telemetry.calls is render-immutable; index disambiguates duplicate (purpose, model) tuples.
                  key={`${call.purpose}-${call.model}-${i}`}
                  className="border-t border-ledger/60 text-ink"
                >
                  <td className="py-1.5 pr-3">{callPurposeLabel(call.purpose)}</td>
                  <td className="py-1.5 pr-3 text-graphite">{call.model}</td>
                  <td className="py-1.5 pr-3 text-right">{formatDurationSec(call.latencyMs)}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {call.inputTokens.toLocaleString()}
                    {call.cachedInputTokens > 0 ? (
                      <span className="text-graphite">
                        {" "}
                        ({call.cachedInputTokens.toLocaleString()} cached)
                      </span>
                    ) : null}
                    {" / "}
                    {call.outputTokens.toLocaleString()}
                  </td>
                  <td className="py-1.5 text-right">{formatCostUsd(call.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-pencil">
            Per-call latency sums can exceed wall-clock time because the field extract and warning
            extract run in parallel.
          </p>
        </div>
      ) : null}
    </section>
  );
}
