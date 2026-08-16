import { History } from "../history/History";
import { ClaudeAgent } from "./anthropic/ClaudeAgent";
import { BaseAgentConfig } from "./BaseAgent";
import { OpenAiAgent } from "./openai/OpenAiAgent";
import { GeminiAgent } from "./google/GeminiAgent";
import { MistralAgent } from "./mistral/MistralAgent";
import { OllamaAgent } from "./ollama/OllamaAgent";
import { LlamaCppAgent } from "./llamacpp/LlamaCppAgent";
import { OpenRouterAgent } from "./openrouter/OpenRouterAgent";
import type { OpenRouterSpecificConfig } from "./AgentConfig";
import {
  ClaudeModel,
  OpenAIModel,
  GeminiModel,
  MistralModel,
  OllamaModel,
  LlamaCppModel,
} from "./model-types";

// Vendor-specific agent configurations with typed models
type ClaudeAgentConfig = Omit<BaseAgentConfig, "vendor" | "model"> & {
  vendor: "anthropic";
  model?: ClaudeModel;
};

type OpenAIAgentConfig = Omit<BaseAgentConfig, "vendor" | "model"> & {
  vendor: "openai";
  model?: OpenAIModel;
};

type GeminiAgentConfig = Omit<BaseAgentConfig, "vendor" | "model"> & {
  vendor: "gemini";
  model?: GeminiModel;
};

type MistralAgentConfig = Omit<BaseAgentConfig, "vendor" | "model"> & {
  vendor: "mistral";
  model?: MistralModel;
};

type OllamaAgentConfig = Omit<BaseAgentConfig, "vendor" | "model"> & {
  vendor: "ollama";
  model?: OllamaModel;
  host?: string;
};

type LlamaCppAgentConfig = Omit<BaseAgentConfig, "vendor" | "model"> & {
  vendor: "llamacpp";
  model?: LlamaCppModel;
  baseURL?: string;
};

// `model` stays a plain string: OpenRouter fronts 400+ models across every
// provider it routes to, so a hand-maintained union would be stale on arrival.
// `listModels()` is the live answer.
type OpenRouterAgentConfig = Omit<BaseAgentConfig, "vendor" | "model"> &
  OpenRouterSpecificConfig & {
    vendor: "openrouter";
    model?: string;
    baseURL?: string;
  };

type AgentConfig =
  | ClaudeAgentConfig
  | OpenAIAgentConfig
  | GeminiAgentConfig
  | MistralAgentConfig
  | OllamaAgentConfig
  | LlamaCppAgentConfig
  | OpenRouterAgentConfig;

export class Agent {
  static create(config: AgentConfig, history?: History) {
    if (config.vendor === "anthropic") {
      return new ClaudeAgent(config, history);
    } else if (config.vendor === "openai") {
      return new OpenAiAgent(config, history);
    } else if (config.vendor === "gemini") {
      return new GeminiAgent(config, history);
    } else if (config.vendor === "mistral") {
      return new MistralAgent(config, history);
    } else if (config.vendor === "ollama") {
      return new OllamaAgent(config, history);
    } else if (config.vendor === "llamacpp") {
      return new LlamaCppAgent(config, history);
    } else if (config.vendor === "openrouter") {
      return new OpenRouterAgent(config, history);
    } else {
      throw new Error("No vendor defined");
    }
  }
}
