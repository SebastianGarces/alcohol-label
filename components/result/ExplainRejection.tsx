"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { explainRejectionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { FieldKey } from "@/lib/schema/application";
import type { WarningFailure } from "@/lib/schema/result";
import { explanationKey, getExplanation, setExplanation } from "@/lib/storage/explanations";
import { cn } from "@/lib/utils";

type FieldPayload = {
  kind: "field";
  field: FieldKey;
  applicationValue: string | null;
  labelValue: string | null;
  status: string;
  rationale: string;
};

type WarningPayload = {
  kind: "warning";
  failures: WarningFailure[];
  extractedText: string | null;
  canonicalText: string;
};

type ExplainRejectionProps = {
  resultId: string;
  scope: string;
  payload: FieldPayload | WarningPayload;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; text: string }
  | { kind: "error"; message: string };

type Variant = "fail" | "review";

function variantFor(payload: FieldPayload | WarningPayload): Variant {
  if (payload.kind === "warning") return "fail";
  if (payload.status === "fuzzy_match") return "review";
  return "fail";
}

const VARIANT_BUTTON: Record<Variant, string> = {
  fail: "border-fail-rule bg-fail-tint/40 text-fail-ink hover:bg-fail-tint/70 aria-expanded:bg-fail-tint/70 aria-expanded:text-fail-ink",
  review:
    "border-review-rule bg-review-tint/40 text-review-ink hover:bg-review-tint/70 aria-expanded:bg-review-tint/70 aria-expanded:text-review-ink",
};

const VARIANT_PANEL: Record<Variant, string> = {
  fail: "border-fail-rule bg-fail-tint/55 text-ink",
  review: "border-review-rule bg-review-tint/55 text-ink",
};

const VARIANT_LOADING: Record<Variant, string> = {
  fail: "text-fail-ink",
  review: "text-review-ink",
};

export function ExplainRejection({ resultId, scope, payload }: ExplainRejectionProps) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const variant = variantFor(payload);

  async function loadExplanation() {
    const key = explanationKey(resultId, scope);
    const cached = await getExplanation(key);
    if (cached) {
      setState({ kind: "ready", text: cached });
      return;
    }
    setState({ kind: "loading" });
    const out = await explainRejectionAction(payload);
    if (!out.ok) {
      setState({ kind: "error", message: out.error.message });
      return;
    }
    await setExplanation(key, out.value.explanation);
    setState({ kind: "ready", text: out.value.explanation });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && state.kind === "idle") void loadExplanation();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn("w-fit gap-2", VARIANT_BUTTON[variant])}
      >
        {open ? "Hide explanation" : "Explain this"}
        <ChevronDown
          aria-hidden
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </Button>
      {open ? (
        <section
          id={panelId}
          aria-label="Plain-English explanation"
          aria-live="polite"
          className={cn("rounded-md border p-4 text-base leading-relaxed", VARIANT_PANEL[variant])}
        >
          {state.kind === "loading" ? (
            <p className={cn("flex items-center gap-2", VARIANT_LOADING[variant])}>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Drafting an explanation…
            </p>
          ) : state.kind === "error" ? (
            <div className="flex flex-col gap-3">
              <p className="text-fail-ink">{state.message}</p>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => void loadExplanation()}
              >
                Try again
              </Button>
            </div>
          ) : state.kind === "ready" ? (
            <p className="text-ink">{state.text}</p>
          ) : (
            <p className={VARIANT_LOADING[variant]}>Preparing explanation…</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
