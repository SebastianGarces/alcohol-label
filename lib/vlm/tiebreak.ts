import { z } from "zod";
import { fieldLabel } from "@/lib/match/field";
import type { FieldKey } from "@/lib/schema/application";
import { callChat, parseToolCallArguments, type VlmCallOptions } from "./call";
import { MODELS } from "./models";

const TOOL_NAME = "tiebreak_decision";

const Decision = z.object({
  same: z.boolean(),
  reason: z.string().min(1),
});
export type TiebreakDecision = z.infer<typeof Decision>;

export async function tiebreak(
  field: FieldKey,
  applicationValue: string,
  labelValue: string,
  options: VlmCallOptions = {},
): Promise<TiebreakDecision> {
  const prompt =
    `Two strings refer to the ${fieldLabel(field)} on a TTB label submission. ` +
    `Application: ${JSON.stringify(applicationValue)}. ` +
    `Label artwork: ${JSON.stringify(labelValue)}. ` +
    "Are they the same value, allowing for ordinary case, punctuation, and whitespace differences " +
    "but not for substantive word changes? Use the tiebreak_decision tool.";

  const completion = await callChat(
    {
      model: MODELS.SONNET,
      max_tokens: 256,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You decide whether two strings denote the same TTB-label field. " +
            "Treat case, punctuation, smart-quote, and whitespace differences as the same. " +
            "Treat different words or numbers as different. Be strict but not pedantic.",
        },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description: "Return whether the two strings represent the same value.",
            parameters: z.toJSONSchema(Decision) as Record<string, unknown>,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
    },
    options,
  );

  return Decision.parse(parseToolCallArguments(completion, TOOL_NAME));
}
