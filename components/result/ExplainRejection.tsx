"use client";

import { ChevronDown, Loader2, Sparkles } from "lucide-react";
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

export function ExplainRejection({ resultId, scope, payload }: ExplainRejectionProps) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const panelId = useId();

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
        size="sm"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-fit gap-2"
      >
        <Sparkles className="size-4" aria-hidden />
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
          className="rounded-md border bg-slate-50 p-3 text-sm leading-relaxed"
        >
          {state.kind === "loading" ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Drafting an explanation…
            </p>
          ) : state.kind === "error" ? (
            <div className="flex flex-col gap-2">
              <p className="text-red-800">{state.message}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => void loadExplanation()}
              >
                Try again
              </Button>
            </div>
          ) : state.kind === "ready" ? (
            <p className="text-foreground">{state.text}</p>
          ) : (
            <p className="text-muted-foreground">Preparing explanation…</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
