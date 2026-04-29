import type { BeverageType, FieldKey } from "@/lib/schema/application";
import type { ExtractedField } from "@/lib/schema/extract";
import type { FieldResult, FieldStatus, MatchMethod } from "@/lib/schema/result";
import { jaroWinkler } from "./jaro-winkler";
import {
  normalizeAddress,
  normalizeBasic,
  parseAbv,
  parseNetContents,
  tokenSetRatio,
} from "./normalize";

export const JW_MATCH_THRESHOLD = 0.95;
export const JW_TIEBREAK_THRESHOLD = 0.85;
export const ADDRESS_TOKEN_THRESHOLD = 0.9;

const FIELD_LABELS: Record<FieldKey, string> = {
  brandName: "Brand name",
  classType: "Class / type",
  alcoholContent: "Alcohol content",
  netContents: "Net contents",
  bottlerName: "Bottler name",
  bottlerAddress: "Bottler address",
  importerName: "Importer name",
  importerAddress: "Importer address",
  countryOfOrigin: "Country of origin",
};

export function fieldLabel(field: FieldKey): string {
  return FIELD_LABELS[field];
}

export type MatchPending = {
  status: "pending_tiebreak";
  field: FieldKey;
  applicationValue: string;
  labelValue: string;
  similarity: number;
  confidence: number;
};

export type MatchOutcome = { status: "resolved"; result: FieldResult } | MatchPending;

function build(
  field: FieldKey,
  status: FieldStatus,
  method: MatchMethod,
  applicationValue: string | null,
  labelValue: string | null,
  confidence: number | null,
  similarity: number | null,
  rationale: string,
  escalated = false,
): FieldResult {
  return {
    field,
    status,
    method,
    applicationValue,
    labelValue,
    confidence,
    similarity,
    rationale,
    escalated,
  };
}

// Produces either a final FieldResult, or a "pending_tiebreak" sentinel that
// the orchestrator must resolve by calling the LLM tiebreak helper.
export function matchField(
  field: FieldKey,
  applicationValue: string | undefined,
  extracted: ExtractedField,
): MatchOutcome {
  const labelValue = extracted.value;
  const labelConf = extracted.confidence;

  if (!applicationValue && !labelValue) {
    return {
      status: "resolved",
      result: build(field, "skipped", "absent", null, null, labelConf, null, "Not present"),
    };
  }
  if (!applicationValue) {
    return {
      status: "resolved",
      result: build(
        field,
        "missing",
        "absent",
        null,
        labelValue,
        labelConf,
        null,
        "Label has value but application doesn't",
      ),
    };
  }
  if (!labelValue) {
    return {
      status: "resolved",
      result: build(
        field,
        "missing",
        "absent",
        applicationValue,
        null,
        labelConf,
        null,
        "Field is on the application but missing from the label",
      ),
    };
  }

  if (field === "alcoholContent") {
    return { status: "resolved", result: matchAbv(field, applicationValue, labelValue, labelConf) };
  }
  if (field === "netContents") {
    return {
      status: "resolved",
      result: matchNetContents(field, applicationValue, labelValue, labelConf),
    };
  }
  if (field === "bottlerAddress" || field === "importerAddress") {
    return {
      status: "resolved",
      result: matchAddress(field, applicationValue, labelValue, labelConf),
    };
  }

  const na = normalizeBasic(applicationValue);
  const nl = normalizeBasic(labelValue);

  if (applicationValue === labelValue) {
    return {
      status: "resolved",
      result: build(
        field,
        "match",
        "exact",
        applicationValue,
        labelValue,
        labelConf,
        1,
        "Exact string match",
      ),
    };
  }
  if (na === nl) {
    return {
      status: "resolved",
      result: build(
        field,
        "fuzzy_match",
        "normalized",
        applicationValue,
        labelValue,
        labelConf,
        1,
        "Match after case / whitespace / quote normalization",
      ),
    };
  }

  const sim = jaroWinkler(na, nl);
  if (sim >= JW_MATCH_THRESHOLD) {
    return {
      status: "resolved",
      result: build(
        field,
        "fuzzy_match",
        "normalized",
        applicationValue,
        labelValue,
        labelConf,
        sim,
        `Very close match (similarity ${sim.toFixed(2)})`,
      ),
    };
  }
  if (sim >= JW_TIEBREAK_THRESHOLD) {
    return {
      status: "pending_tiebreak",
      field,
      applicationValue,
      labelValue,
      similarity: sim,
      confidence: labelConf,
    };
  }

  return {
    status: "resolved",
    result: build(
      field,
      "mismatch",
      "normalized",
      applicationValue,
      labelValue,
      labelConf,
      sim,
      `Different values (similarity ${sim.toFixed(2)})`,
    ),
  };
}

function matchAbv(
  field: FieldKey,
  applicationValue: string,
  labelValue: string,
  confidence: number,
): FieldResult {
  const a = parseAbv(applicationValue);
  const b = parseAbv(labelValue);
  if (a === null || b === null) {
    return build(
      field,
      "mismatch",
      "numeric",
      applicationValue,
      labelValue,
      confidence,
      null,
      "Could not parse one of the ABV values as a number",
    );
  }
  // Exact match to one decimal place.
  const aRounded = Math.round(a * 10) / 10;
  const bRounded = Math.round(b * 10) / 10;
  if (aRounded === bRounded) {
    return build(
      field,
      "match",
      "numeric",
      applicationValue,
      labelValue,
      confidence,
      1,
      `Both read as ${aRounded.toFixed(1)}%`,
    );
  }
  return build(
    field,
    "mismatch",
    "numeric",
    applicationValue,
    labelValue,
    confidence,
    null,
    `Application ${aRounded.toFixed(1)}% vs label ${bRounded.toFixed(1)}%`,
  );
}

function matchNetContents(
  field: FieldKey,
  applicationValue: string,
  labelValue: string,
  confidence: number,
): FieldResult {
  const a = parseNetContents(applicationValue);
  const b = parseNetContents(labelValue);
  if (!a || !b) {
    return build(
      field,
      "mismatch",
      "numeric",
      applicationValue,
      labelValue,
      confidence,
      null,
      "Could not parse net contents as a volume",
    );
  }
  if (a.value === b.value) {
    return build(
      field,
      "match",
      "numeric",
      applicationValue,
      labelValue,
      confidence,
      1,
      `Both equal ${a.value} mL`,
    );
  }
  return build(
    field,
    "mismatch",
    "numeric",
    applicationValue,
    labelValue,
    confidence,
    null,
    `Application ${a.value} mL vs label ${b.value} mL`,
  );
}

function matchAddress(
  field: FieldKey,
  applicationValue: string,
  labelValue: string,
  confidence: number,
): FieldResult {
  const a = normalizeAddress(applicationValue);
  const b = normalizeAddress(labelValue);
  if (a === b) {
    return build(
      field,
      "match",
      "address_token",
      applicationValue,
      labelValue,
      confidence,
      1,
      "Addresses match after normalization",
    );
  }
  const ratio = tokenSetRatio(a, b);
  if (ratio >= ADDRESS_TOKEN_THRESHOLD) {
    return build(
      field,
      "fuzzy_match",
      "address_token",
      applicationValue,
      labelValue,
      confidence,
      ratio,
      `Token-set match (${ratio.toFixed(2)})`,
    );
  }
  return build(
    field,
    "mismatch",
    "address_token",
    applicationValue,
    labelValue,
    confidence,
    ratio,
    `Token overlap ${ratio.toFixed(2)} below ${ADDRESS_TOKEN_THRESHOLD}`,
  );
}

export function tiebreakResolved(
  pending: MatchPending,
  llmAgrees: boolean,
  reason: string,
): FieldResult {
  if (llmAgrees) {
    return build(
      pending.field,
      "fuzzy_match",
      "llm_tiebreak",
      pending.applicationValue,
      pending.labelValue,
      pending.confidence,
      pending.similarity,
      `LLM agrees: ${reason}`,
      true,
    );
  }
  return build(
    pending.field,
    "mismatch",
    "llm_tiebreak",
    pending.applicationValue,
    pending.labelValue,
    pending.confidence,
    pending.similarity,
    `LLM rejected: ${reason}`,
    true,
  );
}

// Cross-field "role swap" detection.
//
// Bottler (27 CFR 5.66) and Importer (27 CFR 5.67/5.68) are distinct mandatory
// fields, but the same legal entity often holds both roles — and applicants
// frequently file the value under the wrong column. When a bottler field has
// no label match but the same value appears on the label as the importer
// (or vice versa), we'd rather flag REVIEW with a clear "wrong slot" rationale
// than report MISSING (red), which is misleading.
const SWAP_PARTNER: Partial<Record<FieldKey, FieldKey>> = {
  bottlerName: "importerName",
  bottlerAddress: "importerAddress",
  importerName: "bottlerName",
  importerAddress: "bottlerAddress",
};

function rolePhrase(field: FieldKey): { self: string; other: string; cite: string } {
  if (field === "bottlerName" || field === "bottlerAddress") {
    return { self: "bottler", other: "importer", cite: "27 CFR 5.66 vs 5.67" };
  }
  return { self: "importer", other: "bottler", cite: "27 CFR 5.67 vs 5.66" };
}

export function categorySwapPartner(field: FieldKey): FieldKey | undefined {
  return SWAP_PARTNER[field];
}

export function detectCategorySwap(
  field: FieldKey,
  applicationValue: string,
  partnerExtracted: ExtractedField,
): FieldResult | null {
  const partnerValue = partnerExtracted.value;
  if (!partnerValue) return null;

  const isAddress = field === "bottlerAddress" || field === "importerAddress";
  let similarity: number;
  let matched: boolean;

  if (isAddress) {
    const a = normalizeAddress(applicationValue);
    const b = normalizeAddress(partnerValue);
    if (a === b) {
      similarity = 1;
      matched = true;
    } else {
      similarity = tokenSetRatio(a, b);
      matched = similarity >= ADDRESS_TOKEN_THRESHOLD;
    }
  } else {
    const a = normalizeBasic(applicationValue);
    const b = normalizeBasic(partnerValue);
    if (a === b) {
      similarity = 1;
      matched = true;
    } else {
      similarity = jaroWinkler(a, b);
      matched = similarity >= JW_TIEBREAK_THRESHOLD;
    }
  }

  if (!matched) return null;

  const roles = rolePhrase(field);
  const rationale =
    `The application lists this value under ${roles.self}, ` +
    `but the label shows the same entity as the ${roles.other} (${roles.cite}). ` +
    `Confirm the correct role.`;

  return build(
    field,
    "fuzzy_match",
    "category_swap",
    applicationValue,
    partnerValue,
    partnerExtracted.confidence,
    similarity,
    rationale,
  );
}

// Wine 14% threshold — tolerance never crosses 14% (27 CFR 4.36).
export function wine14Crossed(
  beverageType: BeverageType,
  applicationAbv: string | undefined,
  labelAbv: string | undefined,
): boolean {
  if (beverageType !== "wine") return false;
  const a = parseAbv(applicationAbv ?? null);
  const b = parseAbv(labelAbv ?? null);
  if (a === null || b === null) return false;
  return (a < 14 && b >= 14) || (a >= 14 && b < 14);
}
