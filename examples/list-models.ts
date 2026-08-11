/**
 * Ask every provider which models it currently offers.
 *
 * `listModels()` returns the same `ModelInfo` shape everywhere — `id` is the
 * value you pass back as an agent's `model`, and the provider's own untouched
 * entry is on `raw`. Providers fill in different amounts of the rest: Anthropic
 * has display names and release dates, OpenAI has owners, Mistral and Gemini
 * report context windows.
 *
 * Only the providers whose API key is set are queried.
 *
 * Run with:
 *   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... npx tsx examples/list-models.ts
 */
import { BaseAgent, ModelInfo } from "../lib/agents/BaseAgent";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { OpenAiAgent } from "../lib/agents/openai/OpenAiAgent";
import { MistralAgent } from "../lib/agents/mistral/MistralAgent";
import { GeminiAgent } from "../lib/agents/google/GeminiAgent";
import { OllamaAgent } from "../lib/agents/ollama/OllamaAgent";
import { LlamaCppAgent } from "../lib/agents/llamacpp/LlamaCppAgent";

const identity = { id: "1", name: "Lister", description: "Lists models" };

function print(provider: string, models: ModelInfo[]): void {
  const loaded = models.filter((m) => m.loaded).length;
  const suffix = models.some((m) => m.loaded !== undefined)
    ? `, ${loaded} loaded`
    : "";
  console.log(`\n${provider} — ${models.length} models${suffix}`);
  for (const model of models.slice(0, 10)) {
    const bits = [
      model.displayName && `"${model.displayName}"`,
      model.contextLength && `${model.contextLength.toLocaleString()} ctx`,
      model.ownedBy,
      model.created?.toISOString().slice(0, 10),
    ].filter(Boolean);
    // Only llama.cpp's router distinguishes offered from loaded
    const mark = model.loaded === undefined ? " " : model.loaded ? "●" : "○";
    console.log(`${mark} ${model.id}${bits.length ? `  (${bits.join(", ")})` : ""}`);
  }
  if (models.length > 10) {
    console.log(`  … and ${models.length - 10} more`);
  }
}

async function show(provider: string, agent: BaseAgent): Promise<void> {
  try {
    print(provider, await agent.listModels());
  } catch (error) {
    console.log(
      `\n${provider} — failed: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

async function main(): Promise<void> {
  if (process.env.ANTHROPIC_API_KEY) {
    await show(
      "Anthropic",
      new ClaudeAgent({ ...identity, apiKey: process.env.ANTHROPIC_API_KEY })
    );
  }

  if (process.env.OPENAI_API_KEY) {
    await show(
      "OpenAI",
      new OpenAiAgent({ ...identity, apiKey: process.env.OPENAI_API_KEY })
    );
  }

  if (process.env.MISTRAL_API_KEY) {
    await show(
      "Mistral",
      new MistralAgent({ ...identity, apiKey: process.env.MISTRAL_API_KEY })
    );
  }

  if (process.env.GOOGLE_API_KEY) {
    await show(
      "Gemini",
      new GeminiAgent({ ...identity, apiKey: process.env.GOOGLE_API_KEY })
    );
  }

  // Local servers need no key, so they are only tried when asked for
  if (process.env.OLLAMA_HOST) {
    await show(
      "Ollama",
      new OllamaAgent({
        ...identity,
        host: process.env.OLLAMA_HOST,
        apiKey: "", // Ollama doesn't require an API key
      })
    );
  }

  if (process.env.LLAMACPP_URL) {
    await show(
      "llama.cpp",
      new LlamaCppAgent({
        ...identity,
        baseURL: process.env.LLAMACPP_URL,
        apiKey: "", // llama-server takes any key, or none at all
      })
    );
  }

  // A model id from this list drops straight into an agent config:
  //   new ClaudeAgent({ ...identity, apiKey, model: models[0].id })
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
