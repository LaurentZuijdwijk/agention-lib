/**
 * OpenRouter Agent Example
 *
 * Demonstrates using OpenRouterAgent with one API key and dozens of upstream
 * providers: routing control, fallback models, cost reporting, and reasoning.
 *
 * Requires:
 *   npm install @openrouter/sdk
 *
 * Run with:
 *   OPENROUTER_API_KEY=... npx tsx examples/openrouter.ts
 */

import { OpenRouterAgent } from "../lib/agents/openrouter/OpenRouterAgent";

// =============================================================================
// Routing: let OpenRouter pick the provider behind the scenes
// =============================================================================

async function routing() {
  const agent = new OpenRouterAgent({
    id: "router",
    name: "Router",
    description: "Answers questions and picks the best provider automatically.",
    apiKey: process.env.OPENROUTER_API_KEY!,
    model: "openrouter/auto", // default — routes automatically
    provider: {
      sort: "throughput",
      allowFallbacks: true,
    },
  });

  const answer = await agent.execute("What is the fastest way to sort a list?");
  console.log("Router said:", answer.slice(0, 120), "...");

  // OpenRouter reports the credit cost of the run.
  console.log(
    `Cost: ${agent.lastGeneration?.cost ?? "n/a"} credits (model: ${agent.lastGeneration?.model})`
  );
}

// =============================================================================
// Fallback models: used when the primary is rate limited or out of quota
// =============================================================================

async function fallbacks() {
  const agent = new OpenRouterAgent({
    id: "fallback",
    name: "FallbackAgent",
    description: "Tries a primary model, then falls back.",
    apiKey: process.env.OPENROUTER_API_KEY!,
    model: "deepseek/deepseek-chat-v3:free",
    models: ["qwen/qwen3-235b-a22b", "openai/gpt-5.6"], // tried on failure
  });

  const answer = await agent.execute("Give me a haiku about queues.");
  console.log("Fallback agent:", answer.slice(0, 120), "...");
  console.log("Served by:", agent.lastGeneration?.model);
  console.log("Attempts (providers tried):", agent.lastGeneration?.attempts);
}

// =============================================================================
// Streaming with reasoning
// =============================================================================

async function streaming() {
  const agent = new OpenRouterAgent({
    id: "stream",
    name: "StreamAgent",
    description: "Streams tokens.",
    apiKey: process.env.OPENROUTER_API_KEY!,
    model: "anthropic/claude-sonnet-4",
    reasoning: { effort: "medium" },
  });

  let text = "";
  for await (const chunk of agent.executeStream("What is 17 * 13?")) {
    if (chunk.type === "text") {
      text += chunk.content;
      process.stdout.write(chunk.content);
    }
  }
  console.log("\n---\nFinal cost:", agent.lastGeneration?.cost);
}

// =============================================================================
// Pick one — run with `npx tsx examples/openrouter.ts <name>`
// =============================================================================

const which = process.argv[2] ?? "routing";

(async () => {
  switch (which) {
    case "routing":
      await routing();
      break;
    case "fallbacks":
      await fallbacks();
      break;
    case "streaming":
      await streaming();
      break;
    default:
      console.error(`Unknown demo "${which}". Use routing | fallbacks | streaming`);
      process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
