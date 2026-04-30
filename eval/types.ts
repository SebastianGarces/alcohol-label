import type { Application, FieldKey } from "@/lib/schema/application";
import type { OverallStatus, VerificationResult } from "@/lib/schema/result";

export type EvalCase = {
  id: string;
  source: "single" | "batch" | "hard";
  imagePath: string;
  application: Application;
  expectedStatus: OverallStatus;
  expectedFailures?: string[];
};

export type EvalCaseResult = {
  caseId: string;
  expected: OverallStatus;
  got: OverallStatus | null;
  correct: boolean;
  fields: VerificationResult["fields"];
  warning: VerificationResult["warning"] | null;
  telemetry: VerificationResult["telemetry"] | null;
  durationMs: number;
  aborted: boolean;
  error: string | null;
};

export type PerFieldAccuracy = Partial<Record<FieldKey, { correct: number; total: number }>>;

export type EvalRun = {
  mode: string;
  totalCases: number;
  correctCases: number;
  accuracy: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalCostUsd: number;
  costPerLabelUsd: number;
  perFieldAccuracy: PerFieldAccuracy;
  aborted: boolean;
  results: EvalCaseResult[];
};
