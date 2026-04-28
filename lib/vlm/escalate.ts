import { z } from "zod";
import { fieldLabel } from "@/lib/match/field";
import type { FieldKey } from "@/lib/schema/application";
import type { ExtractedField } from "@/lib/schema/extract";
import {
  buildImageUserMessage,
  callChat,
  parseToolCallArguments,
  type VlmCallOptions,
} from "./call";
import { MODELS } from "./models";

const TOOL_NAME = "extract_field";

const SingleField = z.object({
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export async function escalateField(
  dataUrl: string,
  field: FieldKey,
  options: VlmCallOptions = {},
): Promise<ExtractedField> {
  const completion = await callChat(
    {
      model: MODELS.SONNET,
      max_tokens: 256,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You re-read a single TTB label field with extra care. Return the value verbatim, " +
            "or null if the field is genuinely absent. Never invent or infer.",
        },
        buildImageUserMessage(
          `Re-read the ${fieldLabel(field)} on this label. Use the extract_field tool.`,
          dataUrl,
        ),
      ],
      tools: [
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description: "Return the verbatim text of one field with confidence.",
            parameters: z.toJSONSchema(SingleField) as Record<string, unknown>,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
    },
    options,
  );

  return SingleField.parse(parseToolCallArguments(completion, TOOL_NAME));
}
