import { z } from "zod";
import { WarningExtract } from "@/lib/schema/extract";
import {
  buildCachedSystemMessage,
  buildImageUserMessage,
  callChatWithTelemetry,
  parseToolCallArguments,
  type VlmCallOptions,
  type VlmCallResult,
} from "./call";
import { MODELS, type ModelSlug } from "./models";

const TOOL_NAME = "extract_warning";

const SYSTEM_PROMPT = [
  "You inspect alcoholic-beverage label artwork to find the US government health warning statement.",
  "Return the full warning text verbatim (or null if absent), and report whether the leading",
  '"GOVERNMENT WARNING" header is rendered in all-capital letters and bold type.',
  "Do not paraphrase, do not normalize, do not correct apparent typos.",
  "If you cannot see the warning, return fullText: null and confidence: 0.",
].join(" ");

const PROMPT =
  "Find the government health warning on this label. " +
  "Use the extract_warning tool to report the verbatim text and the formatting flags.";

export async function extractWarning(
  dataUrl: string,
  options: VlmCallOptions = {},
  // Default to Haiku 4.5: the 41-case eval (2026-04-30) showed Tiered with
  // Sonnet on the warning at 97.6% accuracy / p95 7.2s (over SLO), vs the
  // same pipeline with Haiku on the warning at 95.1% / p95 4.5s — same single
  // velvet-crow miss as Sonnet, plus one extra hard-tilt case that's inside
  // the report's stated noise floor. Haiku is the right default to land the
  // <5s p95 SLO from the brief; the next-iteration mitigation for the lost
  // hard case is a confidence-gated escalation back to Sonnet (same pattern
  // already used for low-confidence field extraction).
  model: ModelSlug = MODELS.HAIKU,
): Promise<VlmCallResult<WarningExtract>> {
  const { completion, telemetry } = await callChatWithTelemetry(
    {
      model,
      max_tokens: 1024,
      temperature: 0,
      messages: [buildCachedSystemMessage(SYSTEM_PROMPT), buildImageUserMessage(PROMPT, dataUrl)],
      tools: [
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description: "Return the verbatim warning text and formatting observations.",
            parameters: z.toJSONSchema(WarningExtract) as Record<string, unknown>,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
    },
    model,
    options,
  );

  const args = parseToolCallArguments(completion, TOOL_NAME);
  return { value: WarningExtract.parse(args), telemetry };
}
