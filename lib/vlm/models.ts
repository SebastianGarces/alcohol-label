export const MODELS = {
  HAIKU: "anthropic/claude-haiku-4.5",
  SONNET: "anthropic/claude-sonnet-4.5",
} as const;

export type ModelSlug = (typeof MODELS)[keyof typeof MODELS];

export const PROVIDER_ROUTING = {
  order: ["anthropic"],
  allow_fallbacks: false,
} as const;
