import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { Application } from "@/lib/schema/application";
import { verifyLabel } from "@/lib/verifier";
import { VlmAuthError, VlmTimeoutError } from "@/lib/vlm/call";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const ip = clientIpFromHeaders(request.headers);
  const rl = checkRateLimit("single", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Slow down — try again shortly." },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Bad form data" }, { status: 400 });
  }

  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json(
      { error: "bad_request", message: "No image attached" },
      { status: 400 },
    );
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "image_too_small", message: "Image is over 5 MB" },
      { status: 413 },
    );
  }

  const applicationRaw = formData.get("application");
  if (typeof applicationRaw !== "string") {
    return NextResponse.json(
      { error: "bad_request", message: "Missing application JSON" },
      { status: 400 },
    );
  }

  let applicationJson: unknown;
  try {
    applicationJson = JSON.parse(applicationRaw);
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Invalid application JSON" },
      { status: 400 },
    );
  }

  const parsed = Application.safeParse(applicationJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid application" },
      { status: 422 },
    );
  }

  try {
    const buffer = Buffer.from(await image.arrayBuffer());
    const result = await verifyLabel(buffer, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VlmTimeoutError) {
      return NextResponse.json(
        { error: "vlm_timeout", message: "Model timed out" },
        { status: 504 },
      );
    }
    if (err instanceof VlmAuthError) {
      Sentry.withScope((scope) => {
        scope.setTag("error.kind", "auth");
        Sentry.captureMessage("OpenRouter auth error", "error");
      });
      return NextResponse.json(
        { error: "auth_error", message: "Server configuration error" },
        { status: 500 },
      );
    }
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "vlm_error", message: "Verification failed" },
      { status: 500 },
    );
  }
}
