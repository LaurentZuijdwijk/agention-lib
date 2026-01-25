/**
 * Type definitions for supported models across different AI providers.
 * These types provide autocomplete and type safety when configuring agents.
 * All types also accept custom string values for new/unlisted models.
 */

/**
 * Supported Claude/Anthropic models.
 * You can also provide any custom string for newer models not yet listed.
 * @see https://docs.anthropic.com/en/docs/about-claude/models
 */
export type ClaudeModel =
  | "claude-opus-4-5"
  | "claude-sonnet-4-5"
  | "claude-haiku-4-5"
  // Latest aliases
  | (string & Record<never, never>);

/**
 * Supported Google Gemini models.
 * You can also provide any custom string for newer models not yet listed.
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 */
export type GeminiModel =
  | "gemini-flash-latest"
  | "gemini-flash-lite-latest"
  | "gemini-3.0-pro"
  | "gemini-3.0-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-2.0-flash-exp"
  | "gemini-2.0-flash"
  | "gemini-2.0-flash-lite"
  // Allow custom strings for new models while preserving autocomplete
  | (string & {});

/**
 * Supported Mistral models.
 * You can also provide any custom string for newer models not yet listed.
 * @see https://docs.mistral.ai/getting-started/models/
 */
export type MistralModel =
  | "mistral-large-latest"
  | "mistral-small-latest"
  | "ministral-8b-latest"
  | "ministral-8b-2410"
  | "ministral-3b-latest"
  | "ministral-3b-2410"
  | "codestral-latest"
  | "codestral-2405"
  | "mistral-embed"
  | "mistral-moderation-latest"
  | "mistral-moderation-2411"
  // Allow custom strings for new models while preserving autocomplete
  | (string & {});

/**
 * Supported OpenAI models.
 * You can also provide any custom string for newer models not yet listed.
 * @see https://platform.openai.com/docs/models
 */
export type OpenAIModel =
  | "gpt-5.2"
  | "gpt-5"
  | "gpt-4.1"
  | "gpt-5-mini"
  | "gpt-5-nano"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4o-2024-11-20"
  | "gpt-4o-2024-08-06"
  | "gpt-4o-2024-05-13"
  | "gpt-4o-mini-2024-07-18"
  | "gpt-4-turbo"
  | "gpt-4-turbo-2024-04-09"
  | "gpt-4-turbo-preview"
  | "gpt-4-0125-preview"
  | "gpt-4-1106-preview"
  | "gpt-4"
  | "gpt-4-0613"
  | "gpt-3.5-turbo"
  | "gpt-3.5-turbo-0125"
  | "gpt-3.5-turbo-1106"
  | "o1"
  | "o1-preview"
  | "o1-mini"
  | "o3-mini"
  // Allow custom strings for new models while preserving autocomplete
  | (string & {});
