import { z } from "zod";

export const BeverageType = z.enum(["distilled_spirits", "wine", "malt_beverage"]);
export type BeverageType = z.infer<typeof BeverageType>;

const optionalString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const Application = z
  .object({
    beverageType: BeverageType,
    brandName: z.string().trim().min(1, "Brand name is required"),
    classType: z.string().trim().min(1, "Class/type is required"),
    alcoholContent: optionalString,
    netContents: z.string().trim().min(1, "Net contents required"),
    bottlerName: optionalString,
    bottlerAddress: optionalString,
    importerName: optionalString,
    importerAddress: optionalString,
    countryOfOrigin: optionalString,
  })
  .superRefine((data, ctx) => {
    if (data.beverageType === "distilled_spirits" && !data.alcoholContent) {
      ctx.addIssue({
        code: "custom",
        path: ["alcoholContent"],
        message: "Required for distilled spirits",
      });
    }
  });

export type Application = z.infer<typeof Application>;

export const FieldKeyEnum = z.enum([
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "bottlerName",
  "bottlerAddress",
  "importerName",
  "importerAddress",
  "countryOfOrigin",
]);
export type FieldKey = z.infer<typeof FieldKeyEnum>;

export type FieldRequirement = "required" | "optional" | "conditional";

export function requiredFields(
  beverageType: BeverageType,
  application: Pick<Application, "importerName" | "importerAddress" | "countryOfOrigin">,
): Record<FieldKey, FieldRequirement> {
  const isImport = Boolean(
    application.importerName || application.importerAddress || application.countryOfOrigin,
  );
  const importReq: FieldRequirement = isImport ? "required" : "optional";

  switch (beverageType) {
    case "distilled_spirits":
      return {
        brandName: "required",
        classType: "required",
        alcoholContent: "required",
        netContents: "required",
        bottlerName: "required",
        bottlerAddress: "required",
        importerName: importReq,
        importerAddress: importReq,
        countryOfOrigin: importReq,
      };
    case "wine":
      return {
        brandName: "required",
        classType: "required",
        alcoholContent: "optional",
        netContents: "required",
        bottlerName: "required",
        bottlerAddress: "required",
        importerName: importReq,
        importerAddress: importReq,
        countryOfOrigin: importReq,
      };
    case "malt_beverage":
      return {
        brandName: "required",
        classType: "required",
        alcoholContent: "optional",
        netContents: "required",
        bottlerName: "required",
        bottlerAddress: "required",
        importerName: importReq,
        importerAddress: importReq,
        countryOfOrigin: isImport ? "required" : "optional",
      };
  }
}
