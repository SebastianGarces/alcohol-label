import type { ParsedCsvRow } from "./csv";

export type FileLike = { name: string };

export type MatchedRow<F extends FileLike> = {
  row: ParsedCsvRow;
  file: F;
};

export type MatchOutcome<F extends FileLike> = {
  matched: MatchedRow<F>[];
  unmatchedRows: string[];
  unmatchedImages: string[];
};

const baseName = (name: string) => name.split(/[\\/]/).pop() ?? name;

export function matchFilesToRows<F extends FileLike>(
  rows: ParsedCsvRow[],
  files: F[],
): MatchOutcome<F> {
  const fileMap = new Map<string, F>();
  for (const f of files) {
    fileMap.set(baseName(f.name).toLowerCase(), f);
  }

  const matched: MatchedRow<F>[] = [];
  const unmatchedRows: string[] = [];
  const usedKeys = new Set<string>();

  for (const row of rows) {
    const key = baseName(row.filename).toLowerCase();
    const file = fileMap.get(key);
    if (file) {
      matched.push({ row, file });
      usedKeys.add(key);
    } else {
      unmatchedRows.push(row.filename);
    }
  }

  const unmatchedImages = files
    .filter((f) => !usedKeys.has(baseName(f.name).toLowerCase()))
    .map((f) => f.name);

  return { matched, unmatchedRows, unmatchedImages };
}
