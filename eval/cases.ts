import { readFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { Application } from "@/lib/schema/application";
import { OverallStatus } from "@/lib/schema/result";
import type { EvalCase } from "./types";

const REPO_ROOT = process.cwd();
const SINGLE_DIR = join(REPO_ROOT, "public", "samples");
const BATCH_DIR = join(REPO_ROOT, "public", "samples", "batch");

type SingleSample = {
  filename: string;
  label: string;
  expectedStatus: string;
  expectedFailures?: string[];
  applicationData: unknown;
};

type BatchManifestRow = {
  filename: string;
  brand: string;
  beverageType: string;
  expected: string;
};

type BatchManifest = {
  generatedAt: string;
  rows: BatchManifestRow[];
};

type BatchCsvRow = {
  filename: string;
  beverageType: string;
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  bottlerName: string;
  bottlerAddress: string;
  importerName: string;
  importerAddress: string;
  countryOfOrigin: string;
};

function blankToUndefined<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "string" && v.trim() === "" ? undefined : v;
  }
  return out;
}

function loadSingleCases(): EvalCase[] {
  const raw = readFileSync(join(SINGLE_DIR, "samples.json"), "utf8");
  const samples = JSON.parse(raw) as SingleSample[];
  return samples.map((s) => ({
    id: `single/${s.filename}`,
    source: "single" as const,
    imagePath: join(SINGLE_DIR, s.filename),
    application: Application.parse(s.applicationData),
    expectedStatus: OverallStatus.parse(s.expectedStatus),
    expectedFailures: s.expectedFailures,
  }));
}

function loadBatchCases(): EvalCase[] {
  const manifest = JSON.parse(
    readFileSync(join(BATCH_DIR, "manifest.json"), "utf8"),
  ) as BatchManifest;
  const csvText = readFileSync(join(BATCH_DIR, "applications.csv"), "utf8");
  const parsed = Papa.parse<BatchCsvRow>(csvText, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`Failed to parse applications.csv: ${first?.message ?? "unknown"}`);
  }
  const byFilename = new Map(parsed.data.map((r) => [r.filename, r]));

  return manifest.rows.map((row) => {
    const csv = byFilename.get(row.filename);
    if (!csv) {
      throw new Error(`Manifest row ${row.filename} has no matching applications.csv entry`);
    }
    const { filename: _filename, ...appFields } = csv;
    void _filename;
    const application = Application.parse(blankToUndefined(appFields));
    return {
      id: `batch/${row.filename}`,
      source: "batch" as const,
      imagePath: join(BATCH_DIR, row.filename),
      application,
      expectedStatus: OverallStatus.parse(row.expected),
    };
  });
}

export function loadCases(): EvalCase[] {
  return [...loadSingleCases(), ...loadBatchCases()];
}
