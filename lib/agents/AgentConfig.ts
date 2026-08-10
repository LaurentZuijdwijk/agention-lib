import { Tool } from "../tools/Tool";
import { BuiltInTool } from "../tools/BuiltInTool";
import { BaseAgent } from "./BaseAgent";
import type { ReasoningEffort } from "./model-types";

/** Supported LLM vendors */
export type AgentVendor =
  | "openai"
  | "anthropic"
  | "mistral"
  | "gemini"
  | "ollama"
  | "llamacpp";

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
  : never;
