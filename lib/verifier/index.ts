import { randomUUID } from "node:crypto";
import {
  categorySwapPartner,
  detectCategorySwap,
  matchField,
  tiebreakResolved,
  wine14Crossed,
} from "@/lib/match/field";
import { verifyWarning } from "@/lib/match/warning";
import { type Application, requiredFields } from "@/lib/schema/application";
import type { ExtractedField, LabelExtract, WarningExtract } from "@/lib/schema/extract";
import type {
  FieldResult,
  OverallStatus,
  VerificationError,
  VerificationResult,
  VerificationTelemetry,
  VerificationTelemetryCall,
  WarningResult,
} from "@/lib/schema/result";
import { type VlmCallTelemetry, VlmTimeoutError } from "@/lib/vlm/call";
import { escalateField as defaultEscalateField } from "@/lib/vlm/escalate";
import { extractLabel as defaultExtractLabel } from "@/lib/vlm/extract";
import { prepareImage as defaultPrepareImage, type PreparedImage } from "@/lib/vlm/image";
import { tiebreak as defaultTiebreak } from "@/lib/vlm/tiebreak";
import { extractWarning as defaultExtractWarning } from "@/lib/vlm/warning";
import * as cache from "./cache";

export const ESCALATE_THRESHOLD = 0.7;

export type VerifierDeps = {
  prepareImage: typeof defaultPrepareImage;
  extractLabel: typeof defaultExtractLabel;
  extractWarning: typeof defaultExtractWarning;
  tiebreak: typeof defaultTiebreak;
  escalateField: typeof defaultEscalateField;
};

const defaultDeps: VerifierDeps = {
  prepareImage: defaultPrepareImage,
  extractLabel: defaultExtractLabel,
  extractWarning: defaultExtractWarning,
  tiebreak: defaultTiebreak,
  escalateField: defaultEscalateField,
};

type Purpose = VerificationTelemetryCall["purpose"];

function recordCall(
  bag: VerificationTelemetryCall[],
  purpose: Purpose,
  telemetry: VlmCallTelemetry,
): void {
  bag.push({
    purpose,
    model: telemetry.model,
    latencyMs: telemetry.latencyMs,
    inputTokens: telemetry.usage.inputTokens,
    outputTokens: telemetry.usage.outputTokens,
    cachedInputTokens: telemetry.usage.cachedInputTokens,
    costUsd: telemetry.costUsd,
  });
}

function recordFailedCall(bag: VerificationTelemetryCall[], purpose: Purpose, err: unknown): void {
  // Failed VLM calls expose partial telemetry on the error (latencyMs is
  // measured even on timeout / 5xx). Capture what we can; cost is 0 because
  // no completion was returned.
  const telemetry = (err as { telemetry?: VlmCallTelemetry } | null)?.telemetry;
  if (!telemetry) return;
  recordCall(bag, purpose, telemetry);
}

function summarize(calls: VerificationTelemetryCall[]): VerificationTelemetry {
  return {
    totalLatencyMs: calls.reduce((s, c) => s + c.latencyMs, 0),
    totalCostUsd: calls.reduce((s, c) => s + c.costUsd, 0),
    calls,
  };
}

export async function verifyLabel(
  imageBytes: Buffer | Uint8Array,
  application: Application,
  deps: Partial<VerifierDeps> = {},
): Promise<VerificationResult> {
  const d = { ...defaultDeps, ...deps };
  const start = Date.now();
  const prepared = await d.prepareImage(imageBytes);

  const appKey = JSON.stringify(application);
  const cached = cache.get(prepared.hash, appKey);
  if (cached) {
    // Cache hit: keep the original telemetry untouched (don't re-attribute
    // cost) but refresh wall-clock duration so the UI reflects actual latency.
    return { ...cached, cached: true, durationMs: Date.now() - start };
  }

  const calls: VerificationTelemetryCall[] = [];
  let labelExtract: LabelExtract | null = null;
  let warningExtract: WarningExtract | null = null;
  let timeout = false;
  let errorKind: VerificationError | null = null;

  const extractLabelTask = d.extractLabel(prepared.dataUrl).then(
    (r) => {
      recordCall(calls, "extract", r.telemetry);
      return r.value;
    },
    (err) => {
      recordFailedCall(calls, "extract", err);
      throw err;
    },
  );
  const extractWarningTask = d.extractWarning(prepared.dataUrl).then(
    (r) => {
      recordCall(calls, "warning", r.telemetry);
      return r.value;
    },
    (err) => {
      recordFailedCall(calls, "warning", err);
      throw err;
    },
  );

  try {
    [labelExtract, warningExtract] = await Promise.all([extractLabelTask, extractWarningTask]);
  } catch (err) {
    if (err instanceof VlmTimeoutError) {
      timeout = true;
      errorKind = "vlm_timeout";
    } else {
      errorKind = "vlm_error";
    }
    // Swallow the rejection from the *other* parallel task so we don't get an
    // unhandled-rejection warning. The recordFailedCall handlers already
    // captured its telemetry.
    void extractLabelTask.catch(() => {});
    void extractWarningTask.catch(() => {});
  }

  if (errorKind && !labelExtract) {
    return failedResult(prepared, errorKind, timeout, Date.now() - start, summarize(calls));
  }

  if (labelExtract && !labelExtract.is_alcohol_label) {
    return failedResult(prepared, "not_alcohol_label", false, Date.now() - start, summarize(calls));
  }

  // Re-extract any field with confidence below threshold via Sonnet.
  if (labelExtract) {
    await escalateLowConfidenceFields(labelExtract, prepared, d, calls);
  }

  const fields = await runFieldChecks(application, labelExtract!, prepared, d, calls);
  const wineFail = wine14Crossed(
    application.beverageType,
    application.alcoholContent,
    labelExtract!.alcoholContent.value ?? undefined,
  );
  if (wineFail) {
    fields.push({
      field: "alcoholContent",
      status: "mismatch",
      method: "wine_14pp_rule",
      applicationValue: application.alcoholContent ?? null,
      labelValue: labelExtract!.alcoholContent.value,
      confidence: labelExtract!.alcoholContent.confidence,
      similarity: null,
      rationale: "Wine ABV crosses the 14% threshold (27 CFR 4.36)",
      escalated: false,
    });
  }

  const warning: WarningResult = warningExtract
    ? verifyWarning(warningExtract)
    : {
        status: "fail",
        extractedText: null,
        canonicalText: "",
        headerIsAllCaps: false,
        headerAppearsBold: false,
        failures: [{ kind: "missing", detail: "Warning extraction failed" }],
      };

  const status = computeOverallStatus(fields, warning);

  const result: VerificationResult = {
    id: randomUUID(),
    status,
    fields,
    warning,
    durationMs: Date.now() - start,
    imageHash: prepared.hash,
    cached: false,
    timeout,
    error: errorKind,
    imageQuality: prepared.quality,
    telemetry: summarize(calls),
  };

  cache.set(prepared.hash, appKey, result);
  return result;
}

async function escalateLowConfidenceFields(
  labelExtract: LabelExtract,
  prepared: PreparedImage,
  deps: VerifierDeps,
  calls: VerificationTelemetryCall[],
): Promise<void> {
  const candidates: (keyof Omit<LabelExtract, "is_alcohol_label">)[] = [
    "brandName",
    "classType",
    "alcoholContent",
    "netContents",
    "bottlerName",
    "bottlerAddress",
    "importerName",
    "importerAddress",
    "countryOfOrigin",
  ];
  await Promise.all(
    candidates.map(async (key) => {
      const field = labelExtract[key] as ExtractedField;
      if (field.confidence >= ESCALATE_THRESHOLD) return;
      if (!field.value) return;
      try {
        const { value: replaced, telemetry } = await deps.escalateField(prepared.dataUrl, key);
        recordCall(calls, "escalate", telemetry);
        labelExtract[key] = replaced;
      } catch (err) {
        recordFailedCall(calls, "escalate", err);
        // Silently keep the original low-confidence value; the field still appears with low conf.
      }
    }),
  );
}

async function runFieldChecks(
  application: Application,
  labelExtract: LabelExtract,
  prepared: PreparedImage,
  deps: VerifierDeps,
  calls: VerificationTelemetryCall[],
): Promise<FieldResult[]> {
  const reqs = requiredFields(application.beverageType, {
    importerName: application.importerName,
    importerAddress: application.importerAddress,
    countryOfOrigin: application.countryOfOrigin,
  });
  const keys = Object.keys(reqs) as (keyof typeof reqs)[];
  const out: FieldResult[] = [];

  for (const key of keys) {
    const requirement = reqs[key];
    const appValue = application[key];
    const extracted = labelExtract[key];

    // For optional fields the application is the source of truth: if the
    // submitter didn't supply a value, we don't fail them just because the
    // model thinks it sees one (e.g. inferring "United States" from a
    // U.S. bottler address on a domestic spirit).
    if (requirement === "optional" && !appValue) continue;

    const outcome = matchField(key, appValue, extracted);
    if (outcome.status === "resolved") {
      out.push(outcome.result);
      continue;
    }

    try {
      const { value: decision, telemetry } = await deps.tiebreak(
        outcome.field,
        outcome.applicationValue,
        outcome.labelValue,
      );
      recordCall(calls, "tiebreak", telemetry);
      out.push(tiebreakResolved(outcome, decision.same, decision.reason));
    } catch (err) {
      recordFailedCall(calls, "tiebreak", err);
      // If the tiebreak call fails, fall back to a fuzzy_match flag for human review.
      out.push(tiebreakResolved(outcome, false, "Tiebreak unavailable — flagged for review"));
    }
  }

  void prepared; // reserved for future per-field re-OCR; keeps signature stable.
  return applyCategorySwapDetection(out, labelExtract);
}

function applyCategorySwapDetection(
  results: FieldResult[],
  labelExtract: LabelExtract,
): FieldResult[] {
  return results.map((r) => {
    if (r.status !== "missing" || !r.applicationValue) return r;
    const partnerKey = categorySwapPartner(r.field);
    if (!partnerKey) return r;
    const partner = labelExtract[partnerKey] as ExtractedField;
    const swap = detectCategorySwap(r.field, r.applicationValue, partner);
    return swap ?? r;
  });
}

function computeOverallStatus(fields: FieldResult[], warning: WarningResult): OverallStatus {
  if (
    warning.status === "fail" ||
    fields.some((f) => f.status === "mismatch" || f.status === "missing")
  ) {
    return "fail";
  }
  if (
    warning.status === "review" ||
    fields.some(
      (f) =>
        f.status === "fuzzy_match" || (f.confidence !== null && f.confidence < ESCALATE_THRESHOLD),
    )
  ) {
    return "review";
  }
  return "pass";
}

function failedResult(
  prepared: PreparedImage,
  error: VerificationError,
  timeout: boolean,
  durationMs: number,
  telemetry: VerificationTelemetry,
): VerificationResult {
  return {
    id: randomUUID(),
    status: "fail",
    fields: [],
    warning: {
      status: "fail",
      extractedText: null,
      canonicalText: "",
      headerIsAllCaps: false,
      headerAppearsBold: false,
      failures: [{ kind: "missing", detail: "Verification could not run" }],
    },
    durationMs,
    imageHash: prepared.hash,
    cached: false,
    timeout,
    error,
    imageQuality: prepared.quality,
    telemetry,
  };
}
