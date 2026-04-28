import { z } from "zod";
import { BeverageType } from "./application";

export const Sample = z.object({
  filename: z.string(),
  label: z.string(),
  expectedStatus: z.enum(["pass", "review", "fail"]),
  expectedFailures: z.array(z.string()).optional(),
  applicationData: z.object({
    beverageType: BeverageType,
    brandName: z.string(),
    classType: z.string(),
    alcoholContent: z.string().optional(),
    netContents: z.string(),
    bottlerName: z.string().optional(),
    bottlerAddress: z.string().optional(),
    importerName: z.string().optional(),
    importerAddress: z.string().optional(),
    countryOfOrigin: z.string().optional(),
  }),
});
export type Sample = z.infer<typeof Sample>;

export const SampleManifest = z.array(Sample);
