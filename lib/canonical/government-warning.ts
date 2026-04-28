// 27 CFR 16.21. Verbatim. Do not edit without checking the regulation.
export const GOVERNMENT_WARNING_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export const GOVERNMENT_WARNING_HEADER = "GOVERNMENT WARNING";

// Strip "(1)" / "(2)" enumerator markers and collapse whitespace so the
// extracted text can be compared against canonical even when the VLM
// reads the markers as separate tokens or drops them entirely.
export function normalizeWarning(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\(\s*[12]\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const CANONICAL_WARNING_NORMALIZED = normalizeWarning(GOVERNMENT_WARNING_TEXT);
