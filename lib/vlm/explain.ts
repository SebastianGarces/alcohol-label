import { z } from "zod";
import { fieldLabel } from "@/lib/match/field";
import type { FieldKey } from "@/lib/schema/application";
import { callChat, parseToolCallArguments, type VlmCallOptions } from "./call";
import { MODELS } from "./models";

const TOOL_NAME = "explain_rejection";

const Explanation = z.object({
  explanation: z
    .string()
    .min(1)
    .max(800)
    .describe("Plain-English explanation under 80 words for a non-technical reviewer."),
});
export type Explanation = z.infer<typeof Explanation>;

export type FieldExplainInput = {
  kind: "field";
  field: FieldKey;
  applicationValue: string | null;
  labelValue: string | null;
  status: string;
  rationale: string;
};

export type WarningExplainInput = {
  kind: "warning";
  failures: { kind: string; detail: string }[];
  extractedText: string | null;
  canonicalText: string;
};

export type ExplainInput = FieldExplainInput | WarningExplainInput;

const SYSTEM_PROMPT = [
  "You write short, friendly explanations of TTB label rejections for a senior reviewer.",
  "Audience: a 28-year veteran or a 73-year-old reviewer learning new tools.",
  "Tone: calm, factual, encouraging. No jargon. No code names. No regulation citations unless asked.",
  "Length: under 80 words. Two short sentences is ideal.",
  "Always end by suggesting one concrete next step the applicant could take.",
].join(" ");

function buildPrompt(input: ExplainInput): string {
  if (input.kind === "field") {
    return [
      `Field: ${fieldLabel(input.field)}.`,
      `Application says: ${JSON.stringify(input.applicationValue)}.`,
      `Label shows: ${JSON.stringify(input.labelValue)}.`,
      `Verdict: ${input.status}.`,
      `Internal rationale: ${input.rationale}.`,
      "Explain why this is flagged in plain English and suggest one concrete fix.",
    ].join(" ");
  }
  const failures = input.failures.map((f) => `- ${f.kind}: ${f.detail}`).join("\n");
  return [
    "Field: Government Health Warning.",
    `Failures:\n${failures}`,
    `Extracted text: ${JSON.stringify(input.extractedText)}.`,
    `Canonical text starts: ${JSON.stringify(input.canonicalText.slice(0, 80))}...`,
    "Explain why the warning is non-compliant and suggest one concrete fix.",
  ].join("\n");
}

export async function explainRejection(
  input: ExplainInput,
  options: VlmCallOptions = {},
): Promise<string> {
  const completion = await callChat(
    {
      model: MODELS.SONNET,
      max_tokens: 384,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(input) },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description: "Return one short, friendly explanation of the rejection.",
            parameters: z.toJSONSchema(Explanation) as Record<string, unknown>,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
    },
    options,
  );

  const parsed = Explanation.parse(parseToolCallArguments(completion, TOOL_NAME));
  return parsed.explanation;
}
