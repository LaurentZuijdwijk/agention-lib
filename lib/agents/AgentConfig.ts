import { Tool } from "../tools/Tool";
import { BaseAgent } from "./BaseAgent";

/** Supported LLM vendors */
export type AgentVendor = "openai" | "anthropic" | "mistral" | "gemini";

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
}

/**
 * Vendor-specific configuration for OpenAI
 */
export interface OpenAISpecificConfig {
  disableParallelToolUse?: boolean;
  disableReasoning?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
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
 * Generic vendor-specific configuration container
 * This allows any vendor to add custom config without modifying base types
 */
export interface VendorSpecificConfig {
  anthropic?: ClaudeSpecificConfig;
  openai?: OpenAISpecificConfig;
  mistral?: MistralSpecificConfig;
  gemini?: GeminiSpecificConfig;
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
  : never;
