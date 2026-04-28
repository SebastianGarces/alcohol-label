import { fieldLabel } from "@/lib/match/field";
import type { FieldResult } from "@/lib/schema/result";

export type TieredSummary = {
  count: number;
  fieldLabels: string[];
};

export function summarizeEscalations(fields: FieldResult[]): TieredSummary {
  const escalated = fields.filter((f) => f.escalated);
  return {
    count: escalated.length,
    fieldLabels: escalated.map((f) => fieldLabel(f.field)),
  };
}
