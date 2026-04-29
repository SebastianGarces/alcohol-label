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
  WarningResult,
} from "@/lib/schema/result";
import { VlmTimeoutError } from "@/lib/vlm/call";
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
    return { ...cached, cached: true, durationMs: Date.now() - start };
  }

  let labelExtract: LabelExtract | null = null;
  let warningExtract: WarningExtract | null = null;
  let timeout = false;
  let errorKind: VerificationError | null = null;

  try {
    [labelExtract, warningExtract] = await Promise.all([
      d.extractLabel(prepared.dataUrl),
      d.extractWarning(prepared.dataUrl),
    ]);
  } catch (err) {
    if (err instanceof VlmTimeoutError) {
      timeout = true;
      errorKind = "vlm_timeout";
    } else {
      errorKind = "vlm_error";
    }
  }

  if (errorKind && !labelExtract) {
    return failedResult(prepared, errorKind, timeout, Date.now() - start);
  }

  if (labelExtract && !labelExtract.is_alcohol_label) {
    return failedResult(prepared, "not_alcohol_label", false, Date.now() - start);
  }

  // Re-extract any field with confidence below threshold via Sonnet.
  if (labelExtract) {
    await escalateLowConfidenceFields(labelExtract, prepared, d);
  }

  const fields = await runFieldChecks(application, labelExtract!, prepared, d);
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
  };

  cache.set(prepared.hash, appKey, result);
  return result;
}

async function escalateLowConfidenceFields(
  labelExtract: LabelExtract,
  prepared: PreparedImage,
  deps: VerifierDeps,
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
        const replaced = await deps.escalateField(prepared.dataUrl, key);
        labelExtract[key] = replaced;
      } catch {
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
      const decision = await deps.tiebreak(
        outcome.field,
        outcome.applicationValue,
        outcome.labelValue,
      );
      out.push(tiebreakResolved(outcome, decision.same, decision.reason));
    } catch {
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
  };
}
