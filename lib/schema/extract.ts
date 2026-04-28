import { z } from "zod";

const ExtractedField = z.object({
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type ExtractedField = z.infer<typeof ExtractedField>;

export const LabelExtract = z.object({
  is_alcohol_label: z.boolean(),
  brandName: ExtractedField,
  classType: ExtractedField,
  alcoholContent: ExtractedField,
  netContents: ExtractedField,
  bottlerName: ExtractedField,
  bottlerAddress: ExtractedField,
  importerName: ExtractedField,
  importerAddress: ExtractedField,
  countryOfOrigin: ExtractedField,
});
export type LabelExtract = z.infer<typeof LabelExtract>;

export const WarningExtract = z.object({
  fullText: z.string().nullable(),
  headerIsAllCaps: z.boolean(),
  headerAppearsBold: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type WarningExtract = z.infer<typeof WarningExtract>;
