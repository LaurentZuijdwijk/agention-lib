import { Tool } from "../tools/Tool";
import { BuiltInTool } from "../tools/BuiltInTool";
import { BaseAgent } from "./BaseAgent";
import type { ReasoningEffort } from "./model-types";
import type {
  OpenRouterProviderPreferences,
  OpenRouterReasoningConfig,
  OpenRouterRetryConfig,
} from "./openrouter/types";

/** Supported LLM vendors */
export type AgentVendor =
  | "openai"
  | "anthropic"
  | "mistral"
  | "gemini"
  | "ollama"
  | "llamacpp"
  | "openrouter";

/**
 * Common configuration shared by all agents
 */
export interface CommonAgentConfig {
  /** Unique identifier for the agent instance */
  id: string;

  /** Human-readable name for the agent */
  name: string;

  /** Description of the agent's purpose and capabilities */
  description: string;

  /** API key for authenticating with the LLM provider */
  apiKey: string;

  /**
   * Extra HTTP headers sent with every request to the provider.
   *
   * Useful for gateway and proxy attribution, tracing, or corporate egress
   * requirements. OpenRouter, for example, uses `HTTP-Referer` and `X-Title`
   * to attribute traffic to your app:
   *
   * ```typescript
   * defaultHeaders: {
   *   "HTTP-Referer": "https://myapp.example",
   *   "X-Title": "My App",
   * }
   * ```
   *
   * These override headers the agent would otherwise set, including
   * `Authorization` / `x-api-key`. That follows the Anthropic and OpenAI SDKs'
   * own `defaultHeaders` behaviour and is deliberate — it lets a gateway swap
   * in its own auth scheme. The flip side is that setting an auth header here
   * replaces `apiKey`, so do it only when that is what you mean.
   */
  defaultHeaders?: Record<string, string>;

  /** Enable debug logging for troubleshooting (default: false) */
  debug?: boolean;

  /** Maximum number of messages to retain in conversation history */
  maxHistoryLength?: number;

  /**
   * Maximum estimated tokens to retain in conversation history.
   * When exceeded, oldest non-system entries are dropped.
   * Takes precedence over maxHistoryLength for context-window-aware trimming.
   */
  maxHistoryTokens?: number;

  /** Model identifier (e.g., "claude-3-5-sonnet-20241022", "gpt-4") */
  model?: string;

  /** Array of tools the agent can use during execution */
  tools?: Tool<unknown>[];

  /** Array of sub-agents this agent can delegate tasks to */
  agents?: BaseAgent[];

  // Sampling parameters

  /** Maximum number of tokens to generate in the response */
  maxTokens?: number;

  /** Sampling temperature (0.0-1.0). Higher values increase randomness */
  temperature?: number;

  /** Nucleus sampling threshold (0.0-1.0). Considers tokens with top cumulative probability */
  topP?: number;

  /** Top-K sampling. Only considers the K most likely tokens (Anthropic, Gemini) */
  topK?: number;

  // Control parameters

  /** Sequences that will stop generation when encountered */
  stopSequences?: string[];

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Maximum number of retry attempts on API failures */
  maxRetries?: number;

  // Reproducibility

  /** Random seed for deterministic outputs (when supported by vendor) */
  seed?: number;

  // Penalties (OpenAI-style, some vendors support)

  /** Penalty for using tokens that already appear in the text (-2.0 to 2.0) */
  presencePenalty?: number;

  /** Penalty based on token frequency in the text (-2.0 to 2.0) */
  frequencyPenalty?: number;
}

/**
 * Vendor-specific configuration for Anthropic Claude
 */
export interface ClaudeSpecificConfig {
  disableParallelToolUse?: boolean;
  metadata?: Record<string, string>;
  /**
   * Provider-defined / server-side tools (e.g. web search, bash, text editor).
   * These are executed by Anthropic rather than locally — see `lib/tools/BuiltInTool.ts`.
   */
  builtInTools?: BuiltInTool[];
  /**
   * How `apiKey` should be presented to the Anthropic SDK.
   * - `"apiKey"` (default): sent as the `x-api-key` header — for standard Anthropic API keys.
   * - `"oauth"`: sent as a bearer `authToken` — for OAuth access tokens (e.g. Claude Code /
   *   Claude.ai tokens, which look like `sk-ant-oat...`).
   *
   * Set this explicitly rather than relying on the token's prefix, since prefixes are an
   * implementation detail that can change.
   */
  authType?: "apiKey" | "oauth";
  /**
   * Enable extended thinking by setting a thinking token budget. When set (> 0), the
   * agent requests `thinking: { type: "enabled", budget_tokens }` and surfaces thinking
   * tokens as `"reasoning"` chunks from `executeStream()`.
   *
   * Constraints (enforced by Anthropic): `budget_tokens` must be ≥ 1024 and strictly less
   * than `maxTokens`. When enabled, `temperature`/`topP`/`topK` are not sent (the API
   * requires default sampling with thinking).
   */
  thinkingBudgetTokens?: number;
}

/**
 * How much the model should think before answering, for OpenAI reasoning models.
 *
 * Which values a given model accepts is **model-dependent**; see
 * {@link ReasoningEffortFor} for the per-model set and
 * {@link OPENAI_REASONING_SUPPORT} for the verified matrix.
 */
export type { ReasoningEffort, ReasoningEffortFor } from "./model-types";

/**
 * Vendor-specific configuration for OpenAI
 */
export interface OpenAISpecificConfig {
  disableParallelToolUse?: boolean;
  /**
   * Ask for the least reasoning the configured model supports.
   *
   * Resolved per model family — there is no single "off" value. Has no effect on
   * models that do not support `reasoning.effort` at all. Takes precedence over
   * {@link OpenAISpecificConfig.reasoningEffort}.
   */
  disableReasoning?: boolean;
  reasoningEffort?: ReasoningEffort;
  seed?: number;
  user?: string;
  /**
   * Provider-defined / server-side tools (e.g. web search, file search, code
   * interpreter). These run on OpenAI's infrastructure rather than locally —
   * see `lib/tools/BuiltInTool.ts`.
   */
  builtInTools?: BuiltInTool[];
}

/**
 * Vendor-specific configuration for Mistral
 */
export interface MistralSpecificConfig {
  disableParallelToolUse?: boolean;
  safePrompt?: boolean;
  randomSeed?: number;
  rateLimitDelay?: number; // Delay in ms between requests
}

/**
 * Vendor-specific configuration for Google Gemini
 */
export interface GeminiSpecificConfig {
  candidateCount?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: any; // Using 'any' here to avoid importing Gemini SDK types
}

/**
 * Vendor-specific configuration for Ollama (local)
 */
export interface OllamaSpecificConfig {
  /** Ollama server URL (default: `http://localhost:11434`) */
  host?: string;
}

/**
 * Vendor-specific configuration for llama.cpp server (local)
 */
export interface LlamaCppSpecificConfig {
  /** Base URL of the llama.cpp server's OpenAI-compatible API (default: `http://localhost:8080/v1`) */
  baseURL?: string;
}

/**
 * Vendor-specific configuration for OpenRouter
 *
 * @see https://openrouter.ai/docs/api-reference/chat/send-a-chat-completion-request
 */
export interface OpenRouterSpecificConfig {
  /**
   * Fallback models, tried in order when the primary `model` cannot serve the
   * request — including when it is rate limited.
   *
   * This is the one throttling mitigation that works against a `:free` model's
   * daily quota, which no amount of client-side backoff will wait out. Put a
   * paid model last if you want the run to finish regardless.
   *
   * @example
   * ```typescript
   * model: "deepseek/deepseek-chat-v3:free",
   * vendorConfig: { openrouter: { models: ["qwen/qwen3-235b-a22b", "openai/gpt-5.6"] } }
   * ```
   */
  models?: string[];

  /** Where OpenRouter may route the request. */
  provider?: OpenRouterProviderPreferences;

  /**
   * Retry policy for the chat request.
   *
   * Overriding the SDK's own default is deliberate. `@openrouter/sdk` retries
   * only `5XX` on this endpoint, so a 429 fails on the first response even
   * though its backoff already knows how to honour `Retry-After`; and its
   * default `maxElapsedTime` is an hour. The agent instead retries
   * `429`/`408`/`409`/`5XX` with a two-minute ceiling. Pass
   * `{ strategy: "none" }` to opt out entirely and handle 429s yourself.
   */
  retry?: OpenRouterRetryConfig;

  /**
   * HTTP status codes the retry policy applies to. Accepts exact codes
   * (`"429"`) and families (`"5XX"`). Defaults to
   * `["408", "409", "429", "5XX"]`.
   */
  retryCodes?: string[];

  /** Reasoning configuration for models that support it. */
  reasoning?: OpenRouterReasoningConfig;

  /**
   * OpenRouter plugins to enable — file parsing, context compression,
   * moderation. Passed through untouched; see
   * https://openrouter.ai/docs/guides/features/plugins for the shapes.
   *
   * The `{ id: "web" }` web search plugin is deprecated in favour of the
   * `openrouter:web_search` server tool — use {@link builtInTools} /
   * `openRouterWebSearchTool()` instead.
   */
  plugins?: unknown[];

  /**
   * Sticky routing key. Requests sharing one are pinned to the same upstream
   * provider, which is what makes prompt caching hit across a conversation.
   * Also groups the requests in OpenRouter's observability views.
   */
  sessionId?: string;

  /** Stable per-end-user identifier used for abuse isolation. Never forwarded raw. */
  user?: string;

  /** Processing tier; `"fast"` is an accepted alias for `"priority"`. */
  serviceTier?: string;

  /** Sent as `HTTP-Referer` — how OpenRouter attributes traffic to your app. */
  httpReferer?: string;

  /** Sent as `X-Title` — the app name shown on OpenRouter's leaderboards. */
  appTitle?: string;

  /** Disable parallel tool calling (sends `parallel_tool_calls: false`). */
  disableParallelToolUse?: boolean;

  /**
   * Provider-defined / server-side tools (e.g. `openrouter:web_search`,
   * `openrouter:web_fetch`). These run on OpenRouter's infrastructure rather
   * than locally — see `lib/tools/BuiltInTool.ts`. Prefer these over the
   * deprecated {@link OpenRouterSpecificConfig.plugins} web search plugin.
   */
  builtInTools?: BuiltInTool[];
}

/**
 * Generic vendor-specific configuration container
 * This allows any vendor to add custom config without modifying base types
 */
export interface VendorSpecificConfig {
  anthropic?: ClaudeSpecificConfig;
  openai?: OpenAISpecificConfig;
  mistral?: MistralSpecificConfig;
  gemini?: GeminiSpecificConfig;
  ollama?: OllamaSpecificConfig;
  llamacpp?: LlamaCppSpecificConfig;
  openrouter?: OpenRouterSpecificConfig;
}

/**
 * Complete agent configuration with vendor-specific extensions
 *
 * @example
 * ```typescript
 * const config: AgentConfig = {
 *   id: "1",
 *   name: "Assistant",
 *   description: "A helpful assistant",
 *   apiKey: process.env.API_KEY,
 *   temperature: 0.7,
 *   vendorConfig: {
 *     openai: {
 *       disableReasoning: true,
 *       reasoningEffort: "high"
 *     }
 *   }
 * };
 * ```
 */
export interface AgentConfig extends CommonAgentConfig {
  vendor: AgentVendor;
  vendorConfig?: VendorSpecificConfig;
}

/**
 * Type-safe agent configuration for specific vendors
 * Use this to get type hints for vendor-specific config
 */
export type TypedAgentConfig<V extends AgentVendor> = CommonAgentConfig & {
  vendor: V;
  vendorConfig?: V extends "anthropic"
    ? { anthropic?: ClaudeSpecificConfig }
    : V extends "openai"
    ? { openai?: OpenAISpecificConfig }
    : V extends "mistral"
    ? { mistral?: MistralSpecificConfig }
    : V extends "gemini"
    ? { gemini?: GeminiSpecificConfig }
    : V extends "ollama"
    ? { ollama?: OllamaSpecificConfig }
    : V extends "llamacpp"
    ? { llamacpp?: LlamaCppSpecificConfig }
    : V extends "openrouter"
    ? { openrouter?: OpenRouterSpecificConfig }
    : never;
};

/**
 * Helper type to extract vendor-specific config for a given vendor
 */
export type VendorConfigFor<V extends AgentVendor> = V extends "anthropic"
  ? ClaudeSpecificConfig
  : V extends "openai"
  ? OpenAISpecificConfig
  : V extends "mistral"
  ? MistralSpecificConfig
  : V extends "gemini"
  ? GeminiSpecificConfig
  : V extends "ollama"
  ? OllamaSpecificConfig
  : V extends "llamacpp"
  ? LlamaCppSpecificConfig
  : V extends "openrouter"
  ? OpenRouterSpecificConfig
  : never;
