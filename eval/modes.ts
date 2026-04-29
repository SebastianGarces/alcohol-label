import type { VerifierDeps } from "@/lib/verifier";
import { escalateField } from "@/lib/vlm/escalate";
import { extractLabel } from "@/lib/vlm/extract";
import { MODELS } from "@/lib/vlm/models";
import { tiebreak } from "@/lib/vlm/tiebreak";
import { extractWarning } from "@/lib/vlm/warning";

export type ModeName = "tiered" | "haiku-only" | "sonnet-only";

export const ALL_MODES: ModeName[] = ["tiered", "haiku-only", "sonnet-only"];

// Tiered = production default (Haiku extract + Sonnet for warning/escalate/tiebreak).
export const TIERED: Partial<VerifierDeps> = {};

// Haiku-only = cheapest. Force every wrapper to use Haiku.
export const HAIKU_ONLY: Partial<VerifierDeps> = {
  extractWarning: (dataUrl, opts) => extractWarning(dataUrl, opts, MODELS.HAIKU),
  escalateField: (dataUrl, field, opts) => escalateField(dataUrl, field, opts, MODELS.HAIKU),
  tiebreak: (field, app, lab, opts) => tiebreak(field, app, lab, opts, MODELS.HAIKU),
};

// Sonnet-only = max accuracy. Force extract to use Sonnet (the others already do).
export const SONNET_ONLY: Partial<VerifierDeps> = {
  extractLabel: (dataUrl, opts) => extractLabel(dataUrl, opts, MODELS.SONNET),
};

export function modeDeps(mode: ModeName): Partial<VerifierDeps> {
  switch (mode) {
    case "tiered":
      return TIERED;
    case "haiku-only":
      return HAIKU_ONLY;
    case "sonnet-only":
      return SONNET_ONLY;
  }
}
