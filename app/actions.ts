"use server";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { z } from "zod";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { Application, FieldKeyEnum } from "@/lib/schema/application";
import type { AppError, Result, VerificationResult } from "@/lib/schema/result";
import { verifyLabel } from "@/lib/verifier";
import { VlmAuthError, VlmTimeoutError } from "@/lib/vlm/call";
import { explainRejection as runExplainRejection } from "@/lib/vlm/explain";

const MAX_BYTES = 5 * 1024 * 1024;

function authError(detail?: string): AppError {
  Sentry.withScope((scope) => {
    scope.setTag("error.kind", "auth");
    Sentry.captureMessage(`OpenRouter auth error${detail ? `: ${detail}` : ""}`, "error");
  });
  const isBilling = detail ? /402|insufficient credit|payment/i.test(detail) : false;
  return {
    kind: "auth_error",
    message: isBilling
      ? "The model provider account is out of credits. Please top up to continue."
      : "Server configuration error — see deployment notes.",
  };
}

export async function verifyLabelAction(
  formData: FormData,
): Promise<Result<VerificationResult, AppError>> {
  const ip = clientIpFromHeaders(await headers());
  const rl = checkRateLimit("single", ip);
  if (!rl.allowed) {
    return {
      ok: false,
      error: {
        kind: "rate_limited",
        message: `Too many verifications. Please wait ${rl.retryAfterSec}s and try again.`,
      },
    };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: { kind: "vlm_error", message: "No image attached." } };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: {
        kind: "image_too_small",
        message: "Image is over 5 MB. Please use a smaller photo.",
      },
    };
  }

  const raw: Record<string, FormDataEntryValue | null> = {
    beverageType: formData.get("beverageType"),
    brandName: formData.get("brandName"),
    classType: formData.get("classType"),
    alcoholContent: formData.get("alcoholContent"),
    netContents: formData.get("netContents"),
    bottlerName: formData.get("bottlerName"),
    bottlerAddress: formData.get("bottlerAddress"),
    importerName: formData.get("importerName"),
    importerAddress: formData.get("importerAddress"),
    countryOfOrigin: formData.get("countryOfOrigin"),
  };

  const parsed = Application.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: {
        kind: "vlm_error",
        message: first?.message ?? "Some required application fields are missing.",
      },
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await verifyLabel(buffer, parsed.data);
    return { ok: true, value: result };
  } catch (err) {
    if (err instanceof VlmTimeoutError) {
      return {
        ok: false,
        error: { kind: "vlm_timeout", message: "The model took too long. Please try again." },
      };
    }
    if (err instanceof VlmAuthError) {
      return { ok: false, error: authError(err.message) };
    }
    Sentry.captureException(err);
    return {
      ok: false,
      error: { kind: "vlm_error", message: "Something went wrong reading the label." },
    };
  }
}

const ExplainFieldInput = z.object({
  kind: z.literal("field"),
  field: FieldKeyEnum,
  applicationValue: z.string().nullable(),
  labelValue: z.string().nullable(),
  status: z.string(),
  rationale: z.string(),
});

const ExplainWarningInput = z.object({
  kind: z.literal("warning"),
  failures: z.array(z.object({ kind: z.string(), detail: z.string() })),
  extractedText: z.string().nullable(),
  canonicalText: z.string(),
});

const ExplainRequest = z.discriminatedUnion("kind", [ExplainFieldInput, ExplainWarningInput]);

export async function explainRejectionAction(
  input: unknown,
): Promise<Result<{ explanation: string }, AppError>> {
  const parsed = ExplainRequest.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "vlm_error", message: "Invalid explanation request." },
    };
  }

  try {
    const explanation = await runExplainRejection(parsed.data);
    return { ok: true, value: { explanation } };
  } catch (err) {
    if (err instanceof VlmTimeoutError) {
      return {
        ok: false,
        error: { kind: "vlm_timeout", message: "The model took too long. Please try again." },
      };
    }
    if (err instanceof VlmAuthError) {
      return { ok: false, error: authError(err.message) };
    }
    Sentry.captureException(err);
    return {
      ok: false,
      error: {
        kind: "vlm_error",
        message: "We couldn't draft an explanation right now. Please try again in a moment.",
      },
    };
  }
}
