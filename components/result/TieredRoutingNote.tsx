import type { FieldResult } from "@/lib/schema/result";
import { summarizeEscalations } from "@/lib/verifier/tiered-summary";

export function TieredRoutingNote({ fields }: { fields: FieldResult[] }) {
  const { count, fieldLabels } = summarizeEscalations(fields);
  return (
    <div className="flex items-start gap-3 rounded-md border border-ledger bg-bone p-4 text-base text-graphite">
      <span aria-hidden className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-graphite" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-ink">Tiered routing</p>
        {count === 0 ? (
          <p className="leading-relaxed">
            Haiku 4.5 read every field with high confidence — no Sonnet 4.5 re-check needed.
          </p>
        ) : (
          <p className="leading-relaxed">
            Haiku 4.5 read the label; {count === 1 ? "1 field was" : `${count} fields were`}{" "}
            re-checked with Sonnet 4.5 for higher accuracy
            {": "}
            <span className="font-medium text-ink">{fieldLabels.join(", ")}</span>.
          </p>
        )}
      </div>
    </div>
  );
}
