/**
 * Ollama Agent Example
 *
 * Demonstrates using OllamaAgent with locally-hosted Ollama models.
 * Requires: ollama running on localhost:11434 and the `ollama` npm package.
 *
 * Install ollama npm package:
 *   npm install ollama
 *
 * Pull a model with tool support (in terminal):
 *   ollama pull llama3.2
 *   ollama pull qwen2.5   # better tool-use support
 *
 * Run this example:
 *   npx tsx examples/ollama.ts
 */

import { OllamaAgent } from "../lib/agents/ollama/OllamaAgent";
import { Tool } from "../lib/tools/Tool";

// =============================================================================
// Tools
// =============================================================================

interface WeatherInput {
  location: string;
}

const getWeatherTool = new Tool({
  name: "get_weather",
  description: "Get the current weather for a location",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City name or location (e.g. 'Amsterdam', 'New York')",
      },
    },
    required: ["location"],
  },
  execute: async (input: WeatherInput) => {
    // Simulated weather data — replace with a real API call
    const conditions = ["sunny", "cloudy", "rainy", "windy", "snowy"];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const temp = Math.round(5 + Math.random() * 25);
    return {
      location: input.location,
      temperature: temp,
      unit: "celsius",
      condition,
      humidity: Math.round(40 + Math.random() * 40),
    };
  },
});

interface CalculatorInput {
  expression: string;
}

const calculatorTool = new Tool({
  name: "calculate",
  description: "Evaluate a mathematical expression",
  inputSchema: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description:
          "Math expression to evaluate, e.g. '2 + 2' or '10 * 5 / 2'",
      },
    },
    required: ["expression"],
  },
  execute: async (input: CalculatorInput) => {
    // Safe evaluation of simple math expressions
    const sanitized = input.expression.replace(/[^0-9+\-*/().\s]/g, "");
    try {
      const result = Function(`"use strict"; return (${sanitized})`)();
      return { expression: input.expression, result };
    } catch {
      return { expression: input.expression, error: "Invalid expression" };
    }
  },
});

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=== Ollama Agent Example ===\n");

  // Basic chat (no tools)
  console.log("--- Basic Chat ---");
  const chatAgent = new OllamaAgent({
    id: "ollama-chat",
    name: "Ollama Chat",
    description: "A helpful assistant",
    model: "gemma4:e4b",
    think: false,
    apiKey: "", // Ollama doesn't require an API key
  });

  const chatResponse = await chatAgent.execute(
    "What is the capital of France? Answer in one sentence."
  );
  console.log("Response:", chatResponse);
  console.log("Tokens:", chatAgent.lastTokenUsage);

  console.log("\n--- Tool-Use Agent ---");

  // Agent with tools — use a model with strong tool support
  const toolAgent = new OllamaAgent({
    id: "ollama-tool-agent",
    name: "Ollama Tool Agent",
    think: false,

    description: "An agent that can check weather and do math",
    model: "gemma4:e4b", // qwen2.5 has good tool-call support
    tools: [getWeatherTool, calculatorTool],
    apiKey: "",
  });

  const toolResponse = await toolAgent.execute(
    "What's the weather in Amsterdam? Also, what is 42 * 7?"
  );
  console.log("Response:", toolResponse);
  console.log("Tokens:", toolAgent.lastTokenUsage);

  // Custom host example
  console.log("\n--- Custom Host ---");
  const remoteAgent = new OllamaAgent({
    id: "ollama-remote",
    name: "Remote Ollama",
    thinking: false,

    description: "Agent connecting to a non-default Ollama server",
    model: "gemma4:e4b",
    host: "http://localhost:11434", // default, but can point to any Ollama instance
    apiKey: "",
  });

  const remoteResponse = await remoteAgent.execute("Say hello in Dutch.");
  console.log("Response:", remoteResponse);
}

main().catch(console.error);
