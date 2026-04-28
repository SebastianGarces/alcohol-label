import { Sparkles } from "lucide-react";
import type { FieldResult } from "@/lib/schema/result";
import { summarizeEscalations } from "@/lib/verifier/tiered-summary";

export function TieredRoutingNote({ fields }: { fields: FieldResult[] }) {
  const { count, fieldLabels } = summarizeEscalations(fields);
  return (
    <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-sm text-violet-900">
      <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">Tiered routing</p>
        {count === 0 ? (
          <p className="leading-relaxed">
            Haiku 4.5 read every field with high confidence — no Sonnet 4.5 re-check needed.
          </p>
        ) : (
          <p className="leading-relaxed">
            Haiku 4.5 read the label; {count === 1 ? "1 field was" : `${count} fields were`}{" "}
            re-checked with Sonnet 4.5 for higher accuracy
            {": "}
            <span className="font-medium">{fieldLabels.join(", ")}</span>.
          </p>
        )}
      </div>
    </div>
  );
}
