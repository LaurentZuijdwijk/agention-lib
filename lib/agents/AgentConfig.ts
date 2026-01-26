import { Tool } from "../tools/Tool";
import { BaseAgent } from "./BaseAgent";

/** Supported LLM vendors */
export type AgentVendor = "openai" | "anthropic" | "mistral" | "gemini";

/**
 * Common configuration shared by all agents
 */
export interface CommonAgentConfig {
  id: string;
  name: string;
  description: string;
  apiKey: string;
  debug?: boolean;
  maxHistoryLength?: number;
  model?: string;
  tools?: Tool<unknown>[];
  agents?: BaseAgent[];

  // Sampling parameters
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;

  // Control parameters
  stopSequences?: string[];
  timeout?: number;
  maxRetries?: number;

  // Reproducibility
  seed?: number;

  // Penalties (OpenAI-style, some vendors support)
  presencePenalty?: number;
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
