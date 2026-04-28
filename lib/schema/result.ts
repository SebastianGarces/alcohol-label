import { z } from "zod";
import { FieldKeyEnum } from "./application";

export const FieldStatus = z.enum(["match", "fuzzy_match", "mismatch", "missing", "skipped"]);
export type FieldStatus = z.infer<typeof FieldStatus>;

export const MatchMethod = z.enum([
  "exact",
  "normalized",
  "numeric",
  "address_token",
  "llm_tiebreak",
  "wine_14pp_rule",
  "absent",
]);
export type MatchMethod = z.infer<typeof MatchMethod>;

export const FieldResult = z.object({
  field: FieldKeyEnum,
  status: FieldStatus,
  method: MatchMethod,
  applicationValue: z.string().nullable(),
  labelValue: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  similarity: z.number().min(0).max(1).nullable(),
  rationale: z.string(),
  escalated: z.boolean(),
});
export type FieldResult = z.infer<typeof FieldResult>;

export const WarningFailureKind = z.enum([
  "wording",
  "header_not_all_caps",
  "header_not_bold",
  "paraphrased",
  "missing",
]);
export type WarningFailureKind = z.infer<typeof WarningFailureKind>;

export const WarningFailure = z.object({
  kind: WarningFailureKind,
  detail: z.string(),
});
export type WarningFailure = z.infer<typeof WarningFailure>;

export const WarningResult = z.object({
  status: z.enum(["pass", "fail", "review"]),
  extractedText: z.string().nullable(),
  canonicalText: z.string(),
  headerIsAllCaps: z.boolean(),
  headerAppearsBold: z.boolean(),
  failures: z.array(WarningFailure),
});
export type WarningResult = z.infer<typeof WarningResult>;

export const OverallStatus = z.enum(["pass", "review", "fail"]);
export type OverallStatus = z.infer<typeof OverallStatus>;

export const VerificationError = z.enum([
  "not_alcohol_label",
  "image_too_dark",
  "image_too_small",
  "vlm_timeout",
  "vlm_error",
  "auth_error",
  "rate_limited",
]);
export type VerificationError = z.infer<typeof VerificationError>;

export const VerificationResult = z.object({
  id: z.string(),
  status: OverallStatus,
  fields: z.array(FieldResult),
  warning: WarningResult,
  durationMs: z.number(),
  imageHash: z.string(),
  cached: z.boolean(),
  timeout: z.boolean(),
  error: VerificationError.nullable(),
  imageQuality: z
    .object({
      lowQuality: z.boolean(),
      reasons: z.array(z.enum(["too_small", "too_dark"])),
      width: z.number(),
      height: z.number(),
      meanBrightness: z.number(),
    })
    .optional(),
});
export type VerificationResult = z.infer<typeof VerificationResult>;

export type AppError = {
  kind: VerificationError;
  message: string;
};

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
