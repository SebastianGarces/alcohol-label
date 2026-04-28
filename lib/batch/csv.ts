import Papa from "papaparse";
import { Application } from "@/lib/schema/application";
import { BATCH_CSV_COLUMNS, type SkippedCsvRow } from "@/lib/schema/batch";

export type ParsedCsvRow = {
  filename: string;
  application: ReturnType<typeof Application.parse>;
};

export type CsvParseOutcome = {
  rows: ParsedCsvRow[];
  skipped: SkippedCsvRow[];
};

const REQUIRED_HEADERS = ["filename", "beverageType", "brandName", "classType", "netContents"];

export function parseBatchCsv(text: string): CsvParseOutcome {
  const trimmed = text.replace(/^﻿/, "").trim();
  if (!trimmed) {
    return {
      rows: [],
      skipped: [{ line: 1, filename: null, reason: "CSV is empty" }],
    };
  }

  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      skipped: [
        {
          line: 1,
          filename: null,
          reason: `CSV is missing required columns: ${missingHeaders.join(", ")}`,
        },
      ],
    };
  }

  const rows: ParsedCsvRow[] = [];
  const skipped: SkippedCsvRow[] = [];

  parsed.data.forEach((raw, index) => {
    const lineNumber = index + 2;
    const filename = raw.filename?.trim() ?? "";

    if (!filename) {
      skipped.push({ line: lineNumber, filename: null, reason: "Missing filename" });
      return;
    }

    const candidate: Record<string, string | undefined> = {};
    for (const col of BATCH_CSV_COLUMNS) {
      if (col === "filename") continue;
      const v = raw[col];
      if (typeof v === "string" && v.trim().length > 0) {
        candidate[col] = v.trim();
      }
    }

    const result = Application.safeParse(candidate);
    if (!result.success) {
      const first = result.error.issues[0];
      skipped.push({
        line: lineNumber,
        filename,
        reason: first?.message ?? "Invalid row",
      });
      return;
    }

    rows.push({ filename, application: result.data });
  });

  return { rows, skipped };
}
