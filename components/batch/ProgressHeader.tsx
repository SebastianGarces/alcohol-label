"use client";

import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEta } from "@/lib/batch/queue";

export type ProgressStats = {
  total: number;
  done: number;
  running: number;
  pass: number;
  review: number;
  fail: number;
  errored: number;
  etaMs: number | null;
  paused: boolean;
  active: boolean;
};

export function ProgressHeader({
  stats,
  onPause,
  onResume,
  onCancel,
}: {
  stats: ProgressStats;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const pct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);
  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-3 rounded-xl border border-ledger bg-paper p-5 shadow-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2 text-base text-ink">
          <strong className="text-2xl tabular-nums">{stats.done}</strong>
          <span className="text-graphite">/ {stats.total} done</span>
          <span className="text-pencil">·</span>
          <span className="text-pass-ink">{stats.pass} pass</span>
          <span className="text-pencil">·</span>
          <span className="text-review-ink">{stats.review} review</span>
          <span className="text-pencil">·</span>
          <span className="text-fail-ink">{stats.fail + stats.errored} fail</span>
          <span className="text-graphite">· ETA {formatEta(stats.etaMs)}</span>
        </div>
        {stats.active ? (
          <div className="flex items-center gap-2">
            {stats.paused ? (
              <Button onClick={onResume} variant="outline" className="gap-2">
                <Play className="size-4" /> Resume
              </Button>
            ) : (
              <Button onClick={onPause} variant="outline" className="gap-2">
                <Pause className="size-4" /> Pause
              </Button>
            )}
            <Button onClick={onCancel} variant="outline" className="gap-2">
              <Square className="size-4" /> Cancel
            </Button>
          </div>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={stats.total}
        aria-valuenow={stats.done}
        className="h-2 w-full overflow-hidden rounded-full bg-ledger"
      >
        <div
          className="h-full bg-rust transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}
