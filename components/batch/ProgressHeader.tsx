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
      className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2 text-base">
          <strong className="text-2xl tabular-nums">{stats.done}</strong>
          <span className="text-muted-foreground">/ {stats.total} done</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-green-700">{stats.pass} pass</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-amber-700">{stats.review} review</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-red-700">{stats.fail + stats.errored} fail</span>
          <span className="text-muted-foreground">· ETA {formatEta(stats.etaMs)}</span>
        </div>
        {stats.active ? (
          <div className="flex items-center gap-2">
            {stats.paused ? (
              <Button onClick={onResume} variant="outline" size="sm" className="gap-1">
                <Play className="size-4" /> Resume
              </Button>
            ) : (
              <Button onClick={onPause} variant="outline" size="sm" className="gap-1">
                <Pause className="size-4" /> Pause
              </Button>
            )}
            <Button onClick={onCancel} variant="outline" size="sm" className="gap-1">
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
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full bg-primary transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}
