import { z } from "zod";
import { fieldLabel } from "@/lib/match/field";
import type { FieldKey } from "@/lib/schema/application";
import type { ExtractedField } from "@/lib/schema/extract";
import {
  buildCachedSystemMessage,
  buildImageUserMessage,
  callChatWithTelemetry,
  parseToolCallArguments,
  type VlmCallOptions,
  type VlmCallResult,
} from "./call";
import { MODELS, type ModelSlug } from "./models";

const TOOL_NAME = "extract_field";

const SYSTEM_PROMPT =
  "You re-read a single TTB label field with extra care. Return the value verbatim, " +
  "or null if the field is genuinely absent. Never invent or infer.";

const SingleField = z.object({
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export async function escalateField(
  dataUrl: string,
  field: FieldKey,
  options: VlmCallOptions = {},
  model: ModelSlug = MODELS.SONNET,
): Promise<VlmCallResult<ExtractedField>> {
  const { completion, telemetry } = await callChatWithTelemetry(
    {
      model,
      max_tokens: 256,
      temperature: 0,
      messages: [
        buildCachedSystemMessage(SYSTEM_PROMPT),
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
    model,
    options,
  );

  const value = SingleField.parse(parseToolCallArguments(completion, TOOL_NAME));
  return { value, telemetry };
}
