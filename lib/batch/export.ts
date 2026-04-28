import Papa from "papaparse";
import type { BatchRow } from "@/lib/schema/batch";

export type ExportRow = {
  filename: string;
  status: string;
  durationMs: number | "";
  fieldFailures: string;
  warningFailures: string;
  errorMessage: string;
};

export const EXPORT_COLUMNS = [
  "filename",
  "status",
  "durationMs",
  "fieldFailures",
  "warningFailures",
  "errorMessage",
] as const;

export function rowsToExport(rows: BatchRow[]): ExportRow[] {
  return rows.map((row) => {
    const r = row.result;
    if (!r) {
      return {
        filename: row.filename,
        status: row.state === "error" ? "error" : row.state,
        durationMs: "",
        fieldFailures: "",
        warningFailures: "",
        errorMessage: row.errorMessage ?? "",
      };
    }
    const fieldFailures = r.fields
      .filter((f) => f.status === "mismatch" || f.status === "missing")
      .map((f) => `${f.field}:${f.status}`)
      .join("|");
    const warningFailures = r.warning.failures.map((f) => f.kind).join("|");
    return {
      filename: row.filename,
      status: r.error ? `error:${r.error}` : r.status,
      durationMs: r.durationMs,
      fieldFailures,
      warningFailures,
      errorMessage: row.errorMessage ?? "",
    };
  });
}

export function rowsToCsv(rows: BatchRow[]): string {
  return Papa.unparse({
    fields: [...EXPORT_COLUMNS],
    data: rowsToExport(rows).map((r) => EXPORT_COLUMNS.map((c) => r[c])),
  });
}
