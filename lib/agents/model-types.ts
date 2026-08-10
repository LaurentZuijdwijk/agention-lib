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
  // Claude 5
  | "claude-opus-5"
  | "claude-sonnet-5"
  | "claude-fable-5"
  // Claude 4.8
  | "claude-opus-4-8"
  // Claude 4.7
  | "claude-opus-4-7"
  // Claude 4.6
  | "claude-opus-4-6"
  | "claude-sonnet-4-6"
  // Claude 4.5
  | "claude-opus-4-5"
  | "claude-opus-4-5-20251101"
  | "claude-sonnet-4-5"
  | "claude-sonnet-4-5-20250929"
  | "claude-haiku-4-5"
  | "claude-haiku-4-5-20251001"
  // Allow custom strings for new models while preserving autocomplete
  | (string & Record<never, never>);

/**
 * Supported Google Gemini models.
 * You can also provide any custom string for newer models not yet listed.
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 */
export type GeminiModel =
  // Rolling aliases — track the current generation
  | "gemini-pro-latest"
  | "gemini-flash-latest"
  | "gemini-flash-lite-latest"
  // Gemini 3.x
  | "gemini-3.6-flash"
  | "gemini-3.5-flash"
  | "gemini-3.5-flash-lite"
  | "gemini-3.1-pro-preview"
  | "gemini-3.1-flash-lite"
  | "gemini-3.1-flash-lite-preview"
  | "gemini-3-pro-preview"
  | "gemini-3-flash-preview"
  // Gemini 2.5
  | "gemini-2.5-pro"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  // Gemini 2.0
  | "gemini-2.0-flash"
  | "gemini-2.0-flash-001"
  | "gemini-2.0-flash-lite"
  | "gemini-2.0-flash-lite-001"
  // Allow custom strings for new models while preserving autocomplete
  | (string & {});

/**
 * Supported Mistral models.
 * You can also provide any custom string for newer models not yet listed.
 * @see https://docs.mistral.ai/getting-started/models/
 */
export type MistralModel =
  // General purpose
  | "mistral-large-latest"
  | "mistral-large-2512"
  | "mistral-medium-latest"
  | "mistral-medium-3.5"
  | "mistral-small-latest"
  | "mistral-small-2603"
  // Reasoning
  | "magistral-small-latest"
  // Edge / small
  | "ministral-14b-latest"
  | "ministral-8b-latest"
  | "ministral-8b-2512"
  | "ministral-3b-latest"
  | "ministral-3b-2512"
  // Code
  | "codestral-latest"
  | "codestral-2508"
  | "devstral-latest"
  | "devstral-medium-latest"
  // Embedding / moderation / OCR
  | "mistral-embed"
  | "codestral-embed"
  | "mistral-moderation-latest"
  | "mistral-moderation-2603"
  | "mistral-ocr-latest"
  // Allow custom strings for new models while preserving autocomplete
  | (string & {});

/**
 * Popular Ollama models (locally hosted).
 * You can also provide any custom string for models you have pulled.
 * @see https://ollama.com/library
 */
export type OllamaModel =
  // Meta Llama
  | "llama3.2"
  | "llama3.2:1b"
  | "llama3.1"
  | "llama3.1:70b"
  | "llama3"
  // Mistral
  | "mistral"
  | "mistral-nemo"
  | "mixtral"
  // Alibaba Qwen (strong tool-use support)
  | "qwen2.5"
  | "qwen2.5:7b"
  | "qwen2.5:72b"
  | "qwen2.5-coder"
  // Google Gemma
  | "gemma2"
  | "gemma2:27b"
  // Microsoft Phi
  | "phi3"
  | "phi4"
  // DeepSeek
  | "deepseek-r1"
  | "deepseek-r1:7b"
  | "deepseek-r1:14b"
  | "deepseek-r1:70b"
  // Code
  | "codellama"
  // Allow custom strings for any pulled model
  | (string & {});

/**
 * Models served by a local llama.cpp server (`llama-server`).
 * The model is identified by the GGUF file/alias loaded by the server, so any
 * string is accepted — the values below are common conventions.
 * @see https://github.com/ggml-org/llama.cpp/tree/master/tools/server
 */
export type LlamaCppModel =
  | "default"
  | "gpt-oss-20b"
  | "gpt-oss-120b"
  | "llama-3.1-8b-instruct"
  | "llama-3.2-3b-instruct"
  | "qwen2.5-7b-instruct"
  | "qwen2.5-coder-7b-instruct"
  | "mistral-7b-instruct"
  | "phi-4"
  | "deepseek-r1-distill-qwen-7b"
  // Allow custom strings for any locally loaded GGUF model
  | (string & {});

/**
 * Supported OpenAI models.
 * You can also provide any custom string for newer models not yet listed.
 * @see https://platform.openai.com/docs/models
 */
export type OpenAIModel =
  | OpenAIReasoningModel
  | "gpt-4.1"
  | "gpt-4.1-mini"
  | "gpt-4.1-nano"
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
  | "o1-preview"
  | "o1-mini"
  // Allow custom strings for new models while preserving autocomplete
  | (string & {});

// =============================================================================
// OpenAI reasoning effort support
// =============================================================================

/**
 * Every value the Responses API's `reasoning.effort` parameter defines.
 *
 * Which subset a given model accepts is model-dependent — see
 * {@link OPENAI_REASONING_SUPPORT} and {@link ReasoningEffortFor}.
 */
export type ReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/**
 * Which reasoning efforts each OpenAI model accepts.
 *
 * There is no universal set and no universal "off" value: the families reject
 * each other's minimum (`none` is rejected before `gpt-5.1`, `minimal` is
 * rejected from `gpt-5.1` on, o-series takes neither), and `pro` variants drop
 * the lower end. `effort: null` is not an off switch either — it means *unset*,
 * so the model applies its own default.
 *
 * Each group's `efforts` are ordered lowest-first, so `efforts[0]` is the least
 * reasoning that family will do.
 *
 * Every row was verified against the live Responses API on 2026-08-05. Models not
 * listed here — non-reasoning models, and families released after this table was
 * written — accept no `reasoning.effort` guess, so callers fall back to the full
 * {@link ReasoningEffort} union and the runtime helper omits the parameter.
 */
export const OPENAI_REASONING_SUPPORT = [
  { models: ["gpt-5-pro"], efforts: ["high"] },
  { models: ["gpt-5.2-pro", "gpt-5.4-pro", "gpt-5.5-pro"], efforts: ["medium", "high", "xhigh"] },
  { models: ["o1", "o1-pro", "o3", "o3-mini", "o4-mini"], efforts: ["low", "medium", "high"] },
  { models: ["gpt-5", "gpt-5-mini", "gpt-5-nano"], efforts: ["minimal", "low", "medium", "high"] },
  { models: ["gpt-5.1"], efforts: ["none", "low", "medium", "high"] },
  {
    models: ["gpt-5.2", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.5"],
    efforts: ["none", "low", "medium", "high", "xhigh"],
  },
  {
    models: ["gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
    efforts: ["none", "low", "medium", "high", "xhigh", "max"],
  },
] as const;

type ReasoningGroup = (typeof OPENAI_REASONING_SUPPORT)[number];

/** Every OpenAI model known to accept `reasoning.effort`. */
export type OpenAIReasoningModel = ReasoningGroup["models"][number];

/**
 * Strip a dated snapshot suffix (`gpt-5-nano-2025-08-07` → `gpt-5-nano`) so
 * pinned model ids resolve to the same support set as their alias. Snapshots
 * always start `-20`, which keeps `gpt-5-mini` from looking like a snapshot of
 * `gpt-5`.
 */
type BaseModel<M extends string> = M extends `${infer Base}-20${string}` ? Base : M;

type EffortsOf<M extends string, G = ReasoningGroup> = G extends {
  models: readonly (infer Models)[];
  efforts: readonly (infer Efforts)[];
}
  ? BaseModel<M> extends Models
    ? Efforts
    : never
  : never;

/**
 * The reasoning efforts a given model accepts.
 *
 * Resolves to the exact set for every model in {@link OPENAI_REASONING_SUPPORT},
 * and to the full {@link ReasoningEffort} union for anything else — an unknown or
 * newer model should not be blocked by a table that has gone stale.
 *
 * @example
 * ```typescript
 * type A = ReasoningEffortFor<"gpt-5-nano">;  // "minimal" | "low" | "medium" | "high"
 * type B = ReasoningEffortFor<"gpt-5.6-sol">; // adds "none", "xhigh", "max"; no "minimal"
 * type C = ReasoningEffortFor<"gpt-5-pro">;   // "high"
 * ```
 */
export type ReasoningEffortFor<M extends string> = [EffortsOf<M>] extends [never]
  ? ReasoningEffort
  : EffortsOf<M>;
