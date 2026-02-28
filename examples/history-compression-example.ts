/**
 * History Compression Example
 *
 * Demonstrates the history plugin system with two complementary strategies:
 *
 * 1. toolResultMaskingPlugin — Read-time masking of old tool results.
 *    Full content is always stored; only the view seen by the LLM is masked.
 *    The agent can fetch any masked result on demand via retrieve_tool_result.
 *
 * 2. compressionPlugin — Rolling LLM summarization of old conversation turns.
 *    Older turns are replaced by a compact summary entry, reducing token usage
 *    while preserving the gist of what happened.
 *
 * Both plugins compose on the same history instance. Tool result masking is
 * free (sync, no LLM calls). Rolling summarization runs automatically via
 * autoReduceWhen when the token budget is exceeded — no manual history.reduce()
 * call required.
 */

import "dotenv/config";
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { History } from "../lib/history/History";
import { Tool } from "../lib/tools/Tool";
import { compressionPlugin } from "../lib/history/plugins/compressionPlugin";
import { toolResultMaskingPlugin } from "../lib/history/plugins/toolResultMaskingPlugin";

// ---------------------------------------------------------------------------
// Simulated tools
// ---------------------------------------------------------------------------

const searchTool = new Tool<string>({
  name: "web_search",
  description: "Search the web for information",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
    },
    required: ["query"],
  },
  execute: async ({ query }: { query: string }): Promise<string> => {
    // Simulate a large search result
    return (
      `Search results for "${query}":\n` +
      "1. Result one with detailed information about the topic...\n".repeat(
        20
      ) +
      "2. Result two with more details...\n".repeat(20)
    );
  },
});

const calculatorTool = new Tool<number>({
  name: "calculator",
  description: "Perform arithmetic calculations",
  inputSchema: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "Math expression to evaluate",
      },
    },
    required: ["expression"],
  },
  execute: async ({ expression }: { expression: string }): Promise<number> => {
    // Safe eval for demo purposes only
    return Function(`"use strict"; return (${expression})`)() as number;
  },
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");

// Dedicated summarization agent — cheap, fast model, no tools
const summaryAgent = new ClaudeAgent({
  id: "summarizer",
  name: "Summarizer",
  description: "Summarizes conversation history concisely",
  apiKey,
  model: "claude-haiku-4-5-20251001",
});

// Masking plugin: keep 1 recent web_search result verbatim; mask older ones.
// Calculator results are excluded — they're tiny and always useful verbatim.
const maskingPlugin = toolResultMaskingPlugin({
  keepRecentResults: 1,
  exclude: ["calculator"],
  minTokensToMask: 50,
});

// Shared history with both plugins registered.
// compressionPlugin auto-triggers when the history exceeds 2 000 tokens.
const history = new History([], { maxTokens: 2000 })
  .use(maskingPlugin)
  .use(compressionPlugin(summaryAgent, { autoReduceWhen: { maxTokens: 2000 } }));

// Surface async plugin errors
history.on("pluginError", (error: Error, _plugin: unknown, hook: string) => {
  console.error(`[pluginError] ${hook}: ${error.message}`);
});

// Main agent with the retrieve tool wired in
const agent = new ClaudeAgent(
  {
    id: "assistant",
    name: "Research Assistant",
    description: "A research assistant with web search and calculation tools",
    apiKey,
    model: "claude-sonnet-4-6",
    tools: [
      searchTool,
      calculatorTool,
      maskingPlugin.retrieveTool, // allows retrieval of masked results
    ],
  },
  history
);

// ---------------------------------------------------------------------------
// Simulated conversation
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== History Compression Example ===\n");

  const turns = [
    "Search for information about the history of the internet.",
    "Now search for information about artificial intelligence milestones.",
    "What is 1024 * 768?",
    "Search for quantum computing breakthroughs in 2024.",
    "Summarise everything we've discussed so far.",
  ];

  for (const turn of turns) {
    console.log(`\n[User] ${turn}`);
    console.log(
      `  History before: ${history.length} entries, ~${history.totalEstimatedTokens} tokens`
    );

    const response = await agent.execute(turn);
    console.log(`[Assistant] ${response.slice(0, 200)}...`);
    console.log(
      `  History after: ${history.length} entries, ~${history.totalEstimatedTokens} tokens`
    );
  }

  console.log(
    "\nNote: compressionPlugin auto-triggered whenever history exceeded 2 000 tokens."
  );
  console.log(
    "Tool results are masked in the agent view but stored in full."
  );
  console.log(
    "The agent can call retrieve_tool_result(tool_call_id) to access any masked result."
  );
}

main().catch(console.error);
