import { z } from "zod";
import { Application } from "./application";
import { VerificationResult } from "./result";

export const BATCH_CSV_COLUMNS = [
  "filename",
  "beverageType",
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "bottlerName",
  "bottlerAddress",
  "importerName",
  "importerAddress",
  "countryOfOrigin",
] as const;

export const RowState = z.enum(["pending", "running", "done", "error"]);
export type RowState = z.infer<typeof RowState>;

export const BatchRow = z.object({
  id: z.string(),
  filename: z.string(),
  application: Application,
  state: RowState,
  result: VerificationResult.nullable(),
  errorMessage: z.string().nullable(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
});
export type BatchRow = z.infer<typeof BatchRow>;

export const SkippedCsvRow = z.object({
  line: z.number(),
  filename: z.string().nullable(),
  reason: z.string(),
});
export type SkippedCsvRow = z.infer<typeof SkippedCsvRow>;

export const BatchPreflight = z.object({
  matched: z.array(BatchRow),
  skipped: z.array(SkippedCsvRow),
  unmatchedImages: z.array(z.string()),
  unmatchedRows: z.array(z.string()),
});
export type BatchPreflight = z.infer<typeof BatchPreflight>;

export const BatchSummary = z.object({
  id: z.string(),
  createdAt: z.number(),
  total: z.number(),
  done: z.number(),
  review: z.number(),
  fail: z.number(),
  errored: z.number(),
});
export type BatchSummary = z.infer<typeof BatchSummary>;
