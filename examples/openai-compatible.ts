/**
 * OpenAI-Compatible Agent Example
 *
 * Demonstrates how to build a custom agent for any server that exposes an
 * OpenAI-compatible `/v1/chat/completions` API — vLLM, LM Studio, Together AI,
 * Groq, or your own fine-tuned model server.
 *
 * This example shows:
 *   1. Using LlamaCppAgent (the built-in OpenAI-compatible agent for llama.cpp)
 *   2. Extending OpenAICompatibleAgent to create your own custom agent
 *
 * Prerequisites for the llama.cpp demo:
 *   npm install openai
 *   llama-server -m ./models/your-model.gguf   # defaults to http://localhost:8080
 *
 * Run this example:
 *   npx tsx examples/openai-compatible.ts
 */

import { LlamaCppAgent } from "../lib/agents/llamacpp/LlamaCppAgent";
import {
  OpenAICompatibleAgent,
  OpenAICompatibleConfig,
} from "../lib/agents/openai-compatible/OpenAICompatibleAgent";
import { Tool } from "../lib/tools/Tool";
import { History } from "../lib/history/History";

// =============================================================================
// Part 1: LlamaCppAgent — built-in, zero boilerplate
// =============================================================================

async function llamaCppDemo() {
  console.log("=== LlamaCppAgent (built-in) ===\n");

  const agent = new LlamaCppAgent({
    id: "llama-1",
    name: "Local Assistant",
    description: "You are a helpful assistant running locally via llama.cpp.",
    baseURL: "http://localhost:8080/v1", // default — can omit
    model: "default",
  });

  const response = await agent.execute(
    "What is the capital of France? Answer in one sentence."
  );
  console.log("Response:", response);
  console.log("Tokens:", agent.lastTokenUsage);

  // Discover which models the server has loaded
  const models = await agent.listModels();
  console.log(
    "Available models:",
    models.map((m) => m.id)
  );
}

// =============================================================================
// Part 2: Custom OpenAICompatibleAgent subclass
//
// Use this pattern to add your own config, vendor-specific request params, or
// a display name for a server that isn't llama.cpp (e.g. vLLM, LM Studio).
// =============================================================================

type VLLMConfig = Omit<OpenAICompatibleConfig, "baseURL" | "vendor"> & {
  /** URL of the vLLM server (default: http://localhost:8000/v1) */
  baseURL?: string;
};

class VLLMAgent extends OpenAICompatibleAgent {
  constructor(config: VLLMConfig, history?: History) {
    super(
      {
        ...config,
        vendor: "llamacpp", // reuse the "llamacpp" vendor slot for OpenAI-compatible servers
        baseURL: config.baseURL ?? "http://localhost:8000/v1",
        model: config.model ?? "default",
      },
      history
    );
  }

  protected getVendorName(): string {
    return "vLLM";
  }
}

async function vllmDemo() {
  console.log("\n=== VLLMAgent (custom subclass) ===\n");

  const weatherTool = new Tool({
    name: "get_weather",
    description: "Get the current weather for a location",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name (e.g. 'Amsterdam')",
        },
      },
      required: ["location"],
    },
    execute: async (input: { location: string }) => ({
      location: input.location,
      temperature: Math.round(10 + Math.random() * 20),
      unit: "celsius",
      condition: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
    }),
  });

  const agent = new VLLMAgent({
    id: "vllm-1",
    name: "vLLM Assistant",
    description: "You are a helpful assistant. Use tools when helpful.",
    baseURL: "http://localhost:8000/v1",
    tools: [weatherTool],
  });

  const response = await agent.execute(
    "What's the weather like in Amsterdam today?"
  );
  console.log("Response:", response);
  console.log("Tokens:", agent.lastTokenUsage);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  // Run whichever demo matches your running server.
  // Comment out the one you don't need.
  await llamaCppDemo().catch((err) =>
    console.warn("llama.cpp demo skipped:", err.message)
  );
  await vllmDemo().catch((err) =>
    console.warn("vLLM demo skipped:", err.message)
  );
}

main().catch(console.error);
