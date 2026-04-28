"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Keyboard,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ResultDisplay } from "@/components/result/ResultDisplay";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Approval, nextApproval, nextFocusIndex } from "@/lib/batch/keyboard-nav";
import type { BatchRow, RowState } from "@/lib/schema/batch";
import type { OverallStatus } from "@/lib/schema/result";
import { cn } from "@/lib/utils";

type SortKey = "status" | "filename" | "duration";
type FilterKey = "all" | OverallStatus | "error";

const STATUS_RANK: Record<string, number> = {
  fail: 0,
  error: 1,
  review: 2,
  pass: 3,
  pending: 4,
  running: 5,
};

function rowStatus(row: BatchRow): { label: string; tone: string } {
  if (row.state === "error") return { label: "error", tone: "bg-red-100 text-red-900" };
  if (row.state === "pending") return { label: "pending", tone: "bg-slate-100 text-slate-700" };
  if (row.state === "running") return { label: "running", tone: "bg-blue-100 text-blue-900" };
  const r = row.result;
  if (!r) return { label: row.state, tone: "bg-slate-100 text-slate-700" };
  if (r.error) return { label: r.error, tone: "bg-red-100 text-red-900" };
  if (r.status === "pass") return { label: "pass", tone: "bg-green-100 text-green-900" };
  if (r.status === "review") return { label: "review", tone: "bg-amber-100 text-amber-900" };
  return { label: "fail", tone: "bg-red-100 text-red-900" };
}

function compareRows(a: BatchRow, b: BatchRow, key: SortKey, dir: 1 | -1): number {
  if (key === "filename") {
    return dir * a.filename.localeCompare(b.filename);
  }
  if (key === "duration") {
    const da = a.result?.durationMs ?? 0;
    const db = b.result?.durationMs ?? 0;
    return dir * (da - db);
  }
  // status
  const ra = STATUS_RANK[rowStatus(a).label] ?? 99;
  const rb = STATUS_RANK[rowStatus(b).label] ?? 99;
  return dir * (ra - rb);
}

export type ResultsTableProps = {
  rows: BatchRow[];
  onExport: () => void;
  onRetryFailed?: () => void;
  retryDisabled?: boolean;
};

export function ResultsTable({ rows, onExport, onRetryFailed, retryDisabled }: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<Record<string, Approval>>({});
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = rows.filter((row) => {
      if (filter === "all") return true;
      const s = rowStatus(row).label;
      return s === filter;
    });
    return [...list].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [rows, filter, sortKey, sortDir]);

  useEffect(() => {
    if (filtered.length === 0) {
      if (focusedId !== null) setFocusedId(null);
      return;
    }
    if (!focusedId || !filtered.some((r) => r.id === focusedId)) {
      setFocusedId(filtered[0]!.id);
    }
  }, [filtered, focusedId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (filtered.length === 0) return;
      const idx = focusedId ? filtered.findIndex((r) => r.id === focusedId) : -1;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedId(filtered[nextFocusIndex(idx, filtered.length, "down")]!.id);
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedId(filtered[nextFocusIndex(idx, filtered.length, "up")]!.id);
        return;
      }
      if (e.key === " ") {
        if (!focusedId) return;
        e.preventDefault();
        setApprovals((prev) => ({ ...prev, [focusedId]: nextApproval(prev[focusedId] ?? null) }));
        return;
      }
      if (e.key === "Enter" || e.key === "x") {
        if (!focusedId) return;
        const row = filtered.find((r) => r.id === focusedId);
        if (!row?.result) return;
        e.preventDefault();
        setExpandedId((prev) => (prev === focusedId ? null : focusedId));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusedId]);

  function toggleSort(next: SortKey) {
    if (sortKey === next) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(next);
      setSortDir(1);
    }
  }

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: `All (${rows.length})` },
    { key: "pass", label: "Pass" },
    { key: "review", label: "Review" },
    { key: "fail", label: "Fail" },
    { key: "error", label: "Error" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter results">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-9 rounded-md px-3 text-sm font-medium transition",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Show keyboard shortcuts"
          >
            <Keyboard className="size-4" /> Shortcuts
          </Button>
          {onRetryFailed ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={onRetryFailed}
              disabled={retryDisabled}
            >
              <RotateCcw className="size-4" /> Retry failed
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="gap-1" onClick={onExport}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <SortableHead onClick={() => toggleSort("status")}>Status</SortableHead>
              <SortableHead onClick={() => toggleSort("filename")}>Filename</SortableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Class / type</TableHead>
              <TableHead>ABV</TableHead>
              <TableHead>Decision</TableHead>
              <SortableHead onClick={() => toggleSort("duration")}>Time</SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No rows in this view.
                </TableCell>
              </TableRow>
            ) : null}
            {filtered.map((row) => {
              const expanded = expandedId === row.id;
              const status = rowStatus(row);
              return (
                <RowEntry
                  key={row.id}
                  row={row}
                  expanded={expanded}
                  focused={focusedId === row.id}
                  approval={approvals[row.id] ?? null}
                  statusLabel={status.label}
                  statusTone={status.tone}
                  onToggle={() => setExpandedId(expanded ? null : row.id)}
                  onFocusRow={() => setFocusedId(row.id)}
                  onCycleApproval={() =>
                    setApprovals((prev) => ({
                      ...prev,
                      [row.id]: nextApproval(prev[row.id] ?? null),
                    }))
                  }
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </section>
  );
}

function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const items: { keys: string[]; label: string }[] = [
    { keys: ["j", "↓"], label: "Move down a row" },
    { keys: ["k", "↑"], label: "Move up a row" },
    { keys: ["Space"], label: "Cycle decision: approve → reject → none" },
    { keys: ["Enter"], label: "Expand or collapse the focused row" },
    { keys: ["?"], label: "Open this shortcut help" },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Triage faster — focus a row and use these keys. Decisions are local-only and don't
            change the verdict.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span>{item.label}</span>
              <span className="flex gap-1">
                {item.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-slate-300 bg-slate-50 px-1.5 font-mono text-xs text-slate-700"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function RowEntry({
  row,
  expanded,
  focused,
  approval,
  statusLabel,
  statusTone,
  onToggle,
  onFocusRow,
  onCycleApproval,
}: {
  row: BatchRow;
  expanded: boolean;
  focused: boolean;
  approval: Approval;
  statusLabel: string;
  statusTone: string;
  onToggle: () => void;
  onFocusRow: () => void;
  onCycleApproval: () => void;
}) {
  const expandable = Boolean(row.result);
  const ms = row.result?.durationMs;
  return (
    <>
      <TableRow
        aria-expanded={expanded}
        data-focused={focused ? "true" : undefined}
        className={cn(
          expandable ? "cursor-pointer" : "",
          expanded ? "bg-slate-50" : "",
          focused ? "outline outline-2 -outline-offset-2 outline-indigo-400" : "",
        )}
        onClick={() => {
          onFocusRow();
          if (expandable) onToggle();
        }}
      >
        <TableCell className="align-top">
          {expandable ? (
            <button
              type="button"
              aria-label={expanded ? "Collapse row" : "Expand row"}
              className="rounded p-1 hover:bg-slate-100"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : null}
        </TableCell>
        <TableCell>
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium uppercase",
              statusTone,
            )}
          >
            {statusLabel}
          </span>
        </TableCell>
        <TableCell className="font-mono text-sm">{row.filename}</TableCell>
        <TableCell className="text-sm">{row.application.brandName}</TableCell>
        <TableCell className="text-sm">{row.application.classType}</TableCell>
        <TableCell className="text-sm">{row.application.alcoholContent ?? "—"}</TableCell>
        <TableCell>
          <button
            type="button"
            aria-label={`Cycle decision for ${row.filename}`}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium",
              approval === "approve"
                ? "bg-green-100 text-green-900"
                : approval === "reject"
                  ? "bg-red-100 text-red-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onFocusRow();
              onCycleApproval();
            }}
          >
            {approval === "approve" ? (
              <>
                <CheckCircle2 aria-hidden className="size-3.5" /> Approved
              </>
            ) : approval === "reject" ? (
              <>
                <XCircle aria-hidden className="size-3.5" /> Rejected
              </>
            ) : (
              "—"
            )}
          </button>
        </TableCell>
        <TableCell className="text-sm tabular-nums">
          {ms != null ? `${(ms / 1000).toFixed(1)}s` : "—"}
        </TableCell>
      </TableRow>
      {expanded && row.result ? (
        <TableRow>
          <TableCell colSpan={8} className="whitespace-normal bg-slate-50 p-6">
            <ResultDisplay result={row.result} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function SortableHead({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className="-mx-2 inline-flex items-center gap-1 rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-slate-100"
      >
        {children}
      </button>
    </TableHead>
  );
}

export type RowStateForDownstream = RowState;
