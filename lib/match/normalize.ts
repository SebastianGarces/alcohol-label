export function normalizeBasic(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const ABV_REGEX = /(\d+(?:\.\d+)?)\s*(?:%|percent)/i;
const ABV_LOOSE_REGEX = /alc(?:ohol|\.)?\s*(?:vol\.?\s*)?(\d+(?:\.\d+)?)/i;

export function parseAbv(input: string | null | undefined): number | null {
  if (!input) return null;
  const m = ABV_REGEX.exec(input) ?? ABV_LOOSE_REGEX.exec(input);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

const NET_REGEX = /(\d+(?:\.\d+)?)\s*(ml|cl|l|fl\s*oz|oz|liters?|millilit(?:re|er)s?)/i;

export function parseNetContents(
  input: string | null | undefined,
): { value: number; unit: "ml" } | null {
  if (!input) return null;
  const m = NET_REGEX.exec(input.toLowerCase());
  if (!m) return null;
  const num = Number.parseFloat(m[1]!);
  if (!Number.isFinite(num)) return null;
  const rawUnit = m[2]!.replace(/\s+/g, "");
  let ml: number;
  if (rawUnit.startsWith("ml") || rawUnit.startsWith("millilit")) ml = num;
  else if (rawUnit === "cl") ml = num * 10;
  else if (rawUnit === "l" || rawUnit.startsWith("liter")) ml = num * 1000;
  else if (rawUnit.startsWith("floz")) ml = Math.round(num * 29.5735);
  else if (rawUnit === "oz") ml = Math.round(num * 29.5735);
  else return null;
  return { value: ml, unit: "ml" };
}

export function normalizeAddress(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\n\r,;]+/g, " ")
    .replace(/\bst\b\.?/gi, "street")
    .replace(/\brd\b\.?/gi, "road")
    .replace(/\bave\b\.?/gi, "avenue")
    .replace(/\bblvd\b\.?/gi, "boulevard")
    .replace(/\bsuite\s+/gi, "ste ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function tokenSetRatio(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}
