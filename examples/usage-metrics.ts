/**
 * Usage metrics against a local llama.cpp server.
 *
 * Prints the token counts, timings and throughput that `lastTokenUsage`
 * exposes after a normal call, a streamed call, and a multi-turn tool loop.
 *
 * Run with:
 *   LLAMACPP_URL=http://localhost:8080/v1 npx tsx examples/usage-metrics.ts
 */
import { LlamaCppAgent } from "../lib/agents/llamacpp/LlamaCppAgent";
import { TokenUsage } from "../lib/agents/BaseAgent";
import { Tool } from "../lib/tools/Tool";

const baseURL = process.env.LLAMACPP_URL ?? "http://localhost:8080/v1";
const model = process.env.LLAMACPP_MODEL ?? "default";

function report(label: string, usage?: TokenUsage): void {
  if (!usage) {
    console.log(`\n${label}: no usage reported`);
    return;
  }

  const ms = (v?: number) => (v === undefined ? "—" : `${Math.round(v)}ms`);
  const tps = (v?: number) => (v === undefined ? "—" : `${v.toFixed(1)} tok/s`);

  console.log(`\n${label}`);
  console.log(
    `  tokens      in ${usage.input_tokens} / out ${usage.output_tokens} / total ${usage.total_tokens}` +
      (usage.reasoning_tokens === undefined
        ? ""
        : ` (reasoning ${usage.reasoning_tokens})`)
  );
  console.log(
    `  time up     ${ms(usage.timeToFirstTokenMs)}   ${tps(
      usage.inputTokensPerSecond
    )}`
  );
  console.log(
    `  time down   ${ms(usage.generationMs)}   ${tps(
      usage.outputTokensPerSecond
    )}`
  );
  console.log(`  total       ${ms(usage.totalMs)}`);
}

async function main(): Promise<void> {
  const agent = new LlamaCppAgent({
    id: "metrics",
    name: "MetricsAgent",
    description: "Answers briefly.",
    baseURL,
    model,
    maxTokens: 1024,
  });

  await agent.execute("Name three primary colours.");
  report("non-streaming (server-reported timings)", agent.lastTokenUsage);

  const streamAgent = new LlamaCppAgent({
    id: "metrics-stream",
    name: "MetricsAgent",
    description: "Answers briefly.",
    baseURL,
    model,
    maxTokens: 1024,
  });

  for await (const _chunk of streamAgent.executeStream("Count from 1 to 20.")) {
    // drain
  }
  report("streaming (locally measured timings)", streamAgent.lastTokenUsage);

  const weather = new Tool<string>({
    name: "get_weather",
    description: "Get the current weather for a city",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string", description: "City name" } },
      required: ["city"],
    },
    execute: async (input) => {
      const { city } = input as { city: string };
      return `It is 21°C and sunny in ${city}.`;
    },
  });

  const toolAgent = new LlamaCppAgent({
    id: "metrics-tools",
    name: "MetricsAgent",
    description: "Uses tools to answer weather questions.",
    baseURL,
    model,
    maxTokens: 1024,
    tools: [weather],
  });

  await toolAgent.execute("What is the weather in Amsterdam?");
  report("tool loop (summed across both calls)", toolAgent.lastTokenUsage);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
