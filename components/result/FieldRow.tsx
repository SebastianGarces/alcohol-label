import { CheckCircle2, CircleAlert, MinusCircle, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fieldLabel } from "@/lib/match/field";
import type { FieldResult, FieldStatus } from "@/lib/schema/result";
import { cn } from "@/lib/utils";
import { ExplainRejection } from "./ExplainRejection";

const STATUS_META: Record<FieldStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> =
  {
    match: { label: "Match", tone: "bg-green-100 text-green-800", icon: CheckCircle2 },
    fuzzy_match: {
      label: "Match (normalized)",
      tone: "bg-amber-100 text-amber-900",
      icon: CircleAlert,
    },
    mismatch: { label: "Mismatch", tone: "bg-red-100 text-red-900", icon: XCircle },
    missing: { label: "Missing", tone: "bg-red-100 text-red-900", icon: XCircle },
    skipped: { label: "Not present", tone: "bg-slate-100 text-slate-700", icon: MinusCircle },
  };

export function FieldRow({ result, resultId }: { result: FieldResult; resultId: string }) {
  const meta = STATUS_META[result.status];
  const Icon = meta.icon;
  const canExplain = result.status === "mismatch" || result.status === "missing";

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-[16rem_1fr_auto] sm:items-start",
        result.status === "mismatch" || result.status === "missing"
          ? "border-red-200 bg-red-50/40"
          : result.status === "fuzzy_match"
            ? "border-amber-200 bg-amber-50/40"
            : "border-slate-200 bg-white",
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-foreground">{fieldLabel(result.field)}</p>
        <p className="text-sm text-muted-foreground">{result.rationale}</p>
        {result.escalated ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge
                  variant="outline"
                  className="w-fit cursor-help gap-1 border-violet-300 bg-violet-50 text-violet-900"
                />
              }
            >
              <Sparkles aria-hidden className="size-3" />
              Reviewed by Sonnet
            </TooltipTrigger>
            <TooltipContent>
              Haiku 4.5 read this field with low confidence, so we re-checked it with Sonnet 4.5 for
              higher accuracy.
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ValueBlock label="Application" value={result.applicationValue} />
          <ValueBlock label="Label" value={result.labelValue} />
        </div>
        {canExplain ? (
          <ExplainRejection
            resultId={resultId}
            scope={`field:${result.field}`}
            payload={{
              kind: "field",
              field: result.field,
              applicationValue: result.applicationValue,
              labelValue: result.labelValue,
              status: result.status,
              rationale: result.rationale,
            }}
          />
        ) : null}
      </div>

      <Badge className={cn("h-7 gap-1.5 px-3 text-sm font-medium", meta.tone)}>
        <Icon aria-hidden className="size-4" />
        {meta.label}
      </Badge>
    </div>
  );
}

function ValueBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value ?? <em className="opacity-60">—</em>}</span>
    </div>
  );
}
