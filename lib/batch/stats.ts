import type { BatchRow } from "@/lib/schema/batch";

export type BatchCounts = {
  total: number;
  done: number;
  running: number;
  pass: number;
  review: number;
  fail: number;
  errored: number;
};

export function computeBatchCounts(rows: readonly BatchRow[]): BatchCounts {
  let done = 0;
  let running = 0;
  let pass = 0;
  let review = 0;
  let fail = 0;
  let errored = 0;
  for (const row of rows) {
    if (row.state === "done") done++;
    if (row.state === "running") running++;
    if (row.state === "error") errored++;
    const result = row.result;
    if (!result) continue;
    if (result.error || result.status === "fail") fail++;
    else if (result.status === "review") review++;
    else if (result.status === "pass") pass++;
  }
  return { total: rows.length, done, running, pass, review, fail, errored };
}

export function failedRowIndices(rows: readonly BatchRow[]): number[] {
  const out: number[] = [];
  rows.forEach((row, i) => {
    if (row.state === "error" || row.result?.error || row.result?.status === "fail") {
      out.push(i);
    }
  });
  return out;
}
