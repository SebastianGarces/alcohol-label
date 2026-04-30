import type { VerifierDeps } from "@/lib/verifier";
import { escalateField } from "@/lib/vlm/escalate";
import { extractLabel } from "@/lib/vlm/extract";
import { MODELS } from "@/lib/vlm/models";
import { tiebreak } from "@/lib/vlm/tiebreak";
import { extractWarning } from "@/lib/vlm/warning";

export type ModeName = "tiered" | "haiku-only" | "sonnet-warning" | "sonnet-only";

export const ALL_MODES: ModeName[] = ["tiered", "haiku-only", "sonnet-warning", "sonnet-only"];

// Tiered = production default. Haiku for field extract AND warning extract;
// Sonnet only on per-field escalation (low-confidence re-read) and the JW
// 0.85-0.95 tiebreak. The warning was Sonnet by default until 2026-04-30,
// when the 41-case eval showed swapping it to Haiku landed Tiered's p95
// from 7.2s to 4.5s (under the <5s SLO) at 44% lower cost, with 1 extra
// hard-tilt case lost — inside the report's stated noise floor.
export const TIERED: Partial<VerifierDeps> = {};

// Haiku-only = no Sonnet anywhere. Force escalate + tiebreak to Haiku too.
// (extractLabel and extractWarning already default to Haiku in production.)
export const HAIKU_ONLY: Partial<VerifierDeps> = {
  escalateField: (dataUrl, field, opts) => escalateField(dataUrl, field, opts, MODELS.HAIKU),
  tiebreak: (field, app, lab, opts) => tiebreak(field, app, lab, opts, MODELS.HAIKU),
};

// Sonnet-warning = the previous Tiered (pre-2026-04-30): use Sonnet for the
// warning sub-call. Kept as a mode so a reviewer can re-derive the SLO
// regression and confirm the model swap is justified.
export const SONNET_WARNING: Partial<VerifierDeps> = {
  extractWarning: (dataUrl, opts) => extractWarning(dataUrl, opts, MODELS.SONNET),
};

// Sonnet-only = max accuracy on extract. Force extract to Sonnet AND warning
// to Sonnet. Kept exported but excluded from the default eval:compare run —
// the 41-case run on 2026-04-30 showed Sonnet-only at 90.2% accuracy / p95
// 7.0s, *worse* than both Tiered and Haiku-only on accuracy *and* latency,
// so paying $0.83 to re-confirm that on every CI run isn't worth it.
// Available via --mode=sonnet-only for ad-hoc investigations.
export const SONNET_ONLY: Partial<VerifierDeps> = {
  extractLabel: (dataUrl, opts) => extractLabel(dataUrl, opts, MODELS.SONNET),
  extractWarning: (dataUrl, opts) => extractWarning(dataUrl, opts, MODELS.SONNET),
};

export function modeDeps(mode: ModeName): Partial<VerifierDeps> {
  switch (mode) {
    case "tiered":
      return TIERED;
    case "haiku-only":
      return HAIKU_ONLY;
    case "sonnet-warning":
      return SONNET_WARNING;
    case "sonnet-only":
      return SONNET_ONLY;
  }
}
