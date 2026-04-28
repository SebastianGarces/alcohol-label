import {
  CANONICAL_WARNING_NORMALIZED,
  GOVERNMENT_WARNING_TEXT,
  normalizeWarning,
} from "@/lib/canonical/government-warning";
import type { WarningExtract } from "@/lib/schema/extract";
import type { WarningFailure, WarningResult } from "@/lib/schema/result";

export function verifyWarning(extract: WarningExtract): WarningResult {
  const failures: WarningFailure[] = [];

  if (!extract.fullText || extract.fullText.trim().length === 0) {
    return {
      status: "fail",
      extractedText: extract.fullText,
      canonicalText: GOVERNMENT_WARNING_TEXT,
      headerIsAllCaps: extract.headerIsAllCaps,
      headerAppearsBold: extract.headerAppearsBold,
      failures: [{ kind: "missing", detail: "No government warning detected on the label" }],
    };
  }

  const extractedNormalized = normalizeWarning(extract.fullText);
  const wordingMatches = extractedNormalized === CANONICAL_WARNING_NORMALIZED;

  if (!wordingMatches) {
    const isParaphrase = looksLikeParaphrase(extractedNormalized);
    failures.push({
      kind: isParaphrase ? "paraphrased" : "wording",
      detail: isParaphrase
        ? "Wording differs substantively from the regulation"
        : "Wording does not match the canonical text exactly",
    });
  }
  if (!extract.headerIsAllCaps) {
    failures.push({
      kind: "header_not_all_caps",
      detail: '"GOVERNMENT WARNING" must appear in all capital letters',
    });
  }
  if (!extract.headerAppearsBold) {
    failures.push({
      kind: "header_not_bold",
      detail: '"GOVERNMENT WARNING" must appear in bold type',
    });
  }

  if (failures.length === 0) {
    return {
      status: "pass",
      extractedText: extract.fullText,
      canonicalText: GOVERNMENT_WARNING_TEXT,
      headerIsAllCaps: true,
      headerAppearsBold: true,
      failures: [],
    };
  }

  return {
    status: "fail",
    extractedText: extract.fullText,
    canonicalText: GOVERNMENT_WARNING_TEXT,
    headerIsAllCaps: extract.headerIsAllCaps,
    headerAppearsBold: extract.headerAppearsBold,
    failures,
  };
}

function looksLikeParaphrase(extractedNormalized: string): boolean {
  // Heuristic: header missing or core phrases absent → paraphrased rather than
  // a small wording slip. The header check still catches casing issues separately.
  return (
    !extractedNormalized.toLowerCase().includes("according to the surgeon general") ||
    !extractedNormalized.toLowerCase().includes("birth defects")
  );
}
