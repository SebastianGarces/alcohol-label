import { CheckCircle2, CircleAlert, MinusCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fieldLabel } from "@/lib/match/field";
import type { FieldResult, FieldStatus } from "@/lib/schema/result";
import { cn } from "@/lib/utils";
import { ExplainRejection } from "./ExplainRejection";

const STATUS_META: Record<FieldStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> =
  {
    match: { label: "Match", tone: "bg-pass-tint text-pass-ink", icon: CheckCircle2 },
    fuzzy_match: {
      label: "Match (normalized)",
      tone: "bg-review-tint text-review-ink",
      icon: CircleAlert,
    },
    mismatch: { label: "Mismatch", tone: "bg-fail-tint text-fail-ink", icon: XCircle },
    missing: { label: "Missing", tone: "bg-fail-tint text-fail-ink", icon: XCircle },
    skipped: { label: "Not present", tone: "bg-bone text-graphite", icon: MinusCircle },
  };

export function FieldRow({ result, resultId }: { result: FieldResult; resultId: string }) {
  const meta = STATUS_META[result.status];
  const Icon = meta.icon;
  const canExplain = result.status === "mismatch" || result.status === "missing";

  return (
    <div
      className={cn(
        "@container/row flex flex-col gap-4 rounded-md border p-4",
        result.status === "mismatch" || result.status === "missing"
          ? "border-fail-rule bg-fail-tint/35"
          : result.status === "fuzzy_match"
            ? "border-review-rule bg-review-tint/35"
            : "border-ledger bg-paper",
      )}
    >
      <div className="flex flex-col gap-2 @xs/row:flex-row @xs/row:items-start @xs/row:justify-between @xs/row:gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="type-title text-ink">{fieldLabel(result.field)}</p>
          <p className="text-base leading-snug text-graphite">{result.rationale}</p>
          {result.escalated ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge
                    variant="outline"
                    className="mt-0.5 w-fit cursor-help gap-1.5 border-rule bg-bone text-graphite"
                  />
                }
              >
                <span aria-hidden className="inline-block size-1.5 rounded-full bg-graphite" />
                Reviewed by Sonnet
              </TooltipTrigger>
              <TooltipContent>
                Haiku 4.5 read this field with low confidence, so we re-checked it with Sonnet 4.5
                for higher accuracy.
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <Badge
          className={cn(
            "h-8 w-fit shrink-0 gap-1.5 whitespace-nowrap px-3 text-xs font-medium uppercase tracking-wider",
            meta.tone,
          )}
        >
          <Icon aria-hidden className="size-4" />
          {meta.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 @md/row:grid-cols-2">
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
  );
}

function ValueBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="type-label text-pencil">{label}</span>
      <span className="type-mono wrap-anywhere rounded-sm border border-ledger bg-paper px-2.5 py-1.5 text-ink">
        {value ?? <em className="not-italic opacity-60">—</em>}
      </span>
    </div>
  );
}
