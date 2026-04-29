import { readFileSync } from "node:fs";
import { FieldKeyEnum } from "@/lib/schema/application";
import type { FieldStatus } from "@/lib/schema/result";
import { type VerifierDeps, verifyLabel } from "@/lib/verifier";
import type { EvalCase, EvalCaseResult, EvalRun, PerFieldAccuracy } from "./types";

export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_PER_CASE_TIMEOUT_MS = 60_000;
export const DEFAULT_COST_CAP_USD = 1.0;

export type RunnerOptions = {
  concurrency?: number;
  perCaseTimeoutMs?: number;
  costCapUsd?: number;
  // Hook for tests: override the verifier function (defaults to lib/verifier.verifyLabel).
  verify?: (
    bytes: Buffer,
    application: EvalCase["application"],
    deps: Partial<VerifierDeps>,
    signal: AbortSignal,
  ) => ReturnType<typeof verifyLabel>;
  // Read image bytes (test seam — defaults to fs.readFileSync).
  readImage?: (path: string) => Buffer;
};

const FIELD_CORRECT_STATUSES = new Set<FieldStatus>(["match", "fuzzy_match", "skipped"]);

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const t = rank - lo;
  return sorted[lo]! * (1 - t) + sorted[hi]! * t;
}

function summarizeFieldAccuracy(results: EvalCaseResult[]): PerFieldAccuracy {
  const out: PerFieldAccuracy = {};
  for (const key of FieldKeyEnum.options) {
    let correct = 0;
    let total = 0;
    for (const r of results) {
      if (r.aborted || !r.fields) continue;
      const f = r.fields.find((x) => x.field === key);
      if (!f) continue;
      total += 1;
      if (FIELD_CORRECT_STATUSES.has(f.status)) correct += 1;
    }
    if (total > 0) out[key] = { correct, total };
  }
  return out;
}

async function runOne(
  cse: EvalCase,
  deps: Partial<VerifierDeps>,
  opts: Required<Pick<RunnerOptions, "perCaseTimeoutMs" | "verify" | "readImage">>,
): Promise<EvalCaseResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.perCaseTimeoutMs);
  try {
    const bytes = opts.readImage(cse.imagePath);
    const result = await opts.verify(bytes, cse.application, deps, ctrl.signal);
    return {
      caseId: cse.id,
      expected: cse.expectedStatus,
      got: result.status,
      correct: result.status === cse.expectedStatus,
      fields: result.fields,
      warning: result.warning,
      telemetry: result.telemetry ?? null,
      durationMs: Date.now() - start,
      aborted: false,
      error: null,
    };
  } catch (err) {
    return {
      caseId: cse.id,
      expected: cse.expectedStatus,
      got: null,
      correct: false,
      fields: [],
      warning: null,
      telemetry: null,
      durationMs: Date.now() - start,
      aborted: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runEval(
  cases: EvalCase[],
  modeName: string,
  modeDeps: Partial<VerifierDeps>,
  options: RunnerOptions = {},
): Promise<EvalRun> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const costCap = options.costCapUsd ?? DEFAULT_COST_CAP_USD;
  const opts = {
    perCaseTimeoutMs: options.perCaseTimeoutMs ?? DEFAULT_PER_CASE_TIMEOUT_MS,
    verify: options.verify ?? ((bytes, application, deps) => verifyLabel(bytes, application, deps)),
    readImage: options.readImage ?? ((p: string) => readFileSync(p)),
  };

  const results: EvalCaseResult[] = new Array(cases.length);
  let cumulativeCost = 0;
  let aborted = false;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= cases.length) return;
      if (aborted) {
        results[i] = abortedPlaceholder(cases[i]!);
        continue;
      }
      const r = await runOne(cases[i]!, modeDeps, opts);
      results[i] = r;
      cumulativeCost += r.telemetry?.totalCostUsd ?? 0;
      if (cumulativeCost >= costCap) {
        aborted = true;
        // eslint-disable-next-line no-console
        console.warn(
          `[eval:${modeName}] cost cap reached ($${cumulativeCost.toFixed(4)} >= $${costCap.toFixed(2)}); aborting remaining cases`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, () => worker()));

  for (let i = 0; i < cases.length; i++) {
    if (!results[i]) results[i] = abortedPlaceholder(cases[i]!);
  }

  const finalized = results;
  const completed = finalized.filter((r) => !r.aborted);
  const correctCases = completed.filter((r) => r.correct).length;
  const totalCases = finalized.length;
  const sortedLatency = completed.map((r) => r.durationMs).sort((a, b) => a - b);
  const totalCostUsd = finalized.reduce((s, r) => s + (r.telemetry?.totalCostUsd ?? 0), 0);

  return {
    mode: modeName,
    totalCases,
    correctCases,
    accuracy: totalCases === 0 ? 0 : correctCases / totalCases,
    p50LatencyMs: percentile(sortedLatency, 50),
    p95LatencyMs: percentile(sortedLatency, 95),
    totalCostUsd,
    costPerLabelUsd: completed.length === 0 ? 0 : totalCostUsd / completed.length,
    perFieldAccuracy: summarizeFieldAccuracy(finalized),
    aborted,
    results: finalized,
  };
}

function abortedPlaceholder(cse: EvalCase): EvalCaseResult {
  return {
    caseId: cse.id,
    expected: cse.expectedStatus,
    got: null,
    correct: false,
    fields: [],
    warning: null,
    telemetry: null,
    durationMs: 0,
    aborted: true,
    error: "cost_cap",
  };
}
