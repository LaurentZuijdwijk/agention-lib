import { History } from "../history/History";
import { ClaudeAgent } from "./anthropic/ClaudeAgent";
import { BaseAgentConfig } from "./BaseAgent";
import { OpenAiAgent } from "./openai/OpenAiAgent";
import { GeminiAgent } from "./google/GeminiAgent";
import { MistralAgent } from "./mistral/MistralAgent";
import { OllamaAgent } from "./ollama/OllamaAgent";
import {
  ClaudeModel,
  OpenAIModel,
  GeminiModel,
  MistralModel,
  OllamaModel,
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

type AgentConfig =
  | ClaudeAgentConfig
  | OpenAIAgentConfig
  | GeminiAgentConfig
  | MistralAgentConfig
  | OllamaAgentConfig;

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
    } else {
      throw new Error("No vendor defined");
    }
  }
}
