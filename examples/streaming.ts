/**
 * Streaming Example
 *
 * Demonstrates executeStream() across all three streaming-capable agents:
 *   - LlamaCppAgent  (OpenAI-compatible servers — llama.cpp, vLLM, OpenAI itself)
 *   - OpenAiAgent    (OpenAI Responses API)
 *   - ClaudeAgent    (Anthropic messages API)
 *
 * All agents yield the same StreamChunk type:
 *   { type: "text" | "reasoning"; content: string }
 *
 * Reasoning chunks appear only on models that produce them
 * (DeepSeek R1 via llama.cpp, Claude with extended thinking, OpenAI o-series).
 *
 * Run:
 *   cd examples && npx tsx streaming.ts
 */

import "dotenv/config";
import { LlamaCppAgent } from "../lib/agents/llamacpp/LlamaCppAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { Tool } from "../lib/tools/Tool";

const weatherTool = new Tool({
  name: "get_weather",
  description: "Get the current weather for a location",
  inputSchema: {
    type: "object",
    properties: {
      location: { type: "string", description: "City name" },
    },
    required: ["location"],
  },
  execute: async (input: { location: string }) => {
    console.log(`  [tool: get_weather(${input.location})]`);
    return {
      location: input.location,
      temperature: Math.round(10 + Math.random() * 20),
      unit: "celsius",
      condition: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
    };
  },
});

// =============================================================================
// Part 1: LlamaCppAgent pointing at OpenAI's OpenAI-compatible endpoint
// =============================================================================

async function llamaCppStreamDemo() {
  console.log("=== LlamaCppAgent → gpt-4o-mini (basic streaming) ===\n");

  const agent = new LlamaCppAgent({
    id: "llama-stream",
    name: "Assistant",
    description: "You are a helpful assistant.",
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  });

  process.stdout.write("Response: ");
  for await (const chunk of agent.executeStream(
    "Count slowly from 1 to 5, one number per line."
  )) {
    if (chunk.type === "text") process.stdout.write(chunk.content);
  }
  console.log("\nTokens:", agent.lastTokenUsage);
}

// =============================================================================
// Part 2: OpenAiAgent (Responses API) with tool calls
// =============================================================================

async function openAiStreamDemo() {
  console.log("\n=== OpenAiAgent → gpt-4.1-mini (tool calls) ===\n");

  const agent = new OpenAiAgent({
    id: "openai-stream",
    name: "Weather Assistant",
    description: "You are a helpful assistant. Use tools when appropriate.",
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4.1-mini",
    tools: [weatherTool],
  });

  process.stdout.write("Response: ");
  for await (const chunk of agent.executeStream(
    "What's the weather in Amsterdam and Paris?"
  )) {
    if (chunk.type === "text") process.stdout.write(chunk.content);
  }
  console.log("\nTokens:", agent.lastTokenUsage);
}

// =============================================================================
// Part 3: ClaudeAgent with reasoning visible
// =============================================================================

async function claudeStreamDemo() {
  console.log("\n=== ClaudeAgent → claude-haiku-4-5 (reasoning visible) ===\n");

  const agent = new ClaudeAgent({
    id: "claude-stream",
    name: "Assistant",
    description: "You are a helpful assistant that thinks carefully.",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: "claude-haiku-4-5-20251001",
    tools: [weatherTool],
    // Enable extended thinking. budget must be ≥ 1024 and < maxTokens.
    maxTokens: 4096,
    thinkingBudgetTokens: 2048,
  });

  let reasoningChars = 0;
  let thinkingShown = false;
  for await (const chunk of agent.executeStream(
    "What's the weather in Berlin? Then tell me what 23 * 47 is."
  )) {
    if (chunk.type === "reasoning") {
      if (!thinkingShown) {
        process.stdout.write("\n[thinking] ");
        thinkingShown = true;
      }
      process.stdout.write(chunk.content);
      reasoningChars += chunk.content.length;
    } else {
      if (thinkingShown) {
        process.stdout.write("\n\nResponse: ");
        thinkingShown = false;
      }
      process.stdout.write(chunk.content);
    }
  }
  console.log(`\nTokens: ${JSON.stringify(agent.lastTokenUsage)}  reasoning chars: ${reasoningChars}`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  await llamaCppStreamDemo().catch((err) =>
    console.warn("LlamaCpp demo failed:", err.message)
  );
  await openAiStreamDemo().catch((err) =>
    console.warn("OpenAI demo failed:", err.message)
  );
  await claudeStreamDemo().catch((err) =>
    console.warn("Claude demo failed:", err.message)
  );
}

main().catch(console.error);
