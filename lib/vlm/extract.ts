import { z } from "zod";
import { LabelExtract } from "@/lib/schema/extract";
import {
  buildImageUserMessage,
  callChat,
  parseToolCallArguments,
  type VlmCallOptions,
} from "./call";
import { MODELS } from "./models";

const TOOL_NAME = "extract_label";

const SYSTEM_PROMPT = [
  "You read alcoholic-beverage label artwork and extract printed fields verbatim.",
  "Return ONLY what you can read on the label. Do not infer, complete, or correct.",
  "If a field is not present, return null and confidence 0.",
  "Confidence is your subjective probability (0-1) that the value is correct.",
  "Never invent text. Never compare against external data.",
  "Never quote the government health warning here — it is captured separately.",
].join(" ");

const EXTRACT_PROMPT =
  "Extract every visible mandatory TTB field from this label image. " +
  "Use the extract_label tool. Read text exactly as printed (preserve case and punctuation).";

export async function extractLabel(dataUrl: string, options: VlmCallOptions = {}) {
  const completion = await callChat(
    {
      model: MODELS.HAIKU,
      max_tokens: 1024,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        buildImageUserMessage(EXTRACT_PROMPT, dataUrl),
      ],
      tools: [
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description: "Return the structured fields read from the label image.",
            parameters: z.toJSONSchema(LabelExtract) as Record<string, unknown>,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
    },
    options,
  );

  const args = parseToolCallArguments(completion, TOOL_NAME);
  return LabelExtract.parse(args);
}
