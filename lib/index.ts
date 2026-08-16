// Main index - exports all agents (requires all peer dependencies)
// For selective imports, use sub-paths:
//   import { ClaudeAgent } from "@agentionai/agents/claude";
//   import { OpenAiAgent } from "@agentionai/agents/openai";
//   import { MistralAgent } from "@agentionai/agents/mistral";
//   import { GeminiAgent } from "@agentionai/agents/gemini";
// Or use core-only imports:
//   import { BaseAgent } from "@agentionai/agents/core";

// Agents
export * from "./agents/BaseAgent";
export * from "./agents/anthropic/ClaudeAgent";
export { OpenAiAgent } from "./agents/openai/OpenAiAgent";
export { MistralAgent } from "./agents/mistral/MistralAgent";
export type { MistralModelCard } from "./agents/mistral/MistralAgent";
export {
  GeminiAgent,
  GEMINI_RETIRED_MODELS,
} from "./agents/google/GeminiAgent";
export type {
  GeminiModelCard,
  GeminiListModelsOptions,
} from "./agents/google/GeminiAgent";
export { OllamaAgent } from "./agents/ollama/OllamaAgent";
export type { OllamaModelInfo } from "./agents/ollama/OllamaAgent";
export { LlamaCppAgent } from "./agents/llamacpp/LlamaCppAgent";
export type {
  LlamaCppModelCard,
  LlamaCppModelMeta,
} from "./agents/llamacpp/LlamaCppAgent";
export { OpenAICompatibleAgent } from "./agents/openai-compatible/OpenAICompatibleAgent";
export type { OpenAICompatibleConfig, StreamChunk } from "./agents/openai-compatible/OpenAICompatibleAgent";
export { OpenRouterAgent } from "./agents/openrouter/OpenRouterAgent";
export type {
  OpenRouterConfig,
  OpenRouterModelCard,
} from "./agents/openrouter/OpenRouterAgent";
export type {
  OpenRouterProviderPreferences,
  OpenRouterProviderSort,
  OpenRouterMaxPrice,
  OpenRouterReasoningConfig,
  OpenRouterReasoningEffort,
  OpenRouterRetryConfig,
  OpenRouterGenerationInfo,
} from "./agents/openrouter/types";
export * from "./agents/model-types";
export * from "./agents/AgentConfig";
export * from "./agents/AgentEvent";
export * from "./agents/errors/AgentError";
export * from "./agents/cancellation";

// History
export * from "./history/History";
export * from "./history/types";
export {
  anthropicTransformer,
  openAiTransformer,
  mistralTransformer,
  geminiTransformer,
  ollamaTransformer,
  chatCompletionsTransformer,
  openRouterTransformer,
} from "./history/transformers";

// Graph
export * from "./graph/AgentGraph";

// Tools
export * from "./tools/Tool";
export * from "./tools/BuiltInTool";

// MCP (Model Context Protocol)
export * from "./mcp";

// Visualization
export * from "./viz";

// Vector Store
export * from "./vectorstore";

// Embeddings (also re-exported from vectorstore for backward compatibility)
export * from "./embeddings";

// Chunkers
export * from "./chunkers";

// Ingestion
export * from "./ingestion";
