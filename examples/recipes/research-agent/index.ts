/**
 * Recipe: Terminal research agent
 * -------------------------------
 *
 * An interactive command-line research assistant that:
 *   - uses Claude's server-side web search to gather live information,
 *   - streams its reasoning and answer to the terminal as it works,
 *   - keeps the conversation going so you can ask follow-ups,
 *   - saves the final report to a Markdown file on request.
 *
 * This shows three building blocks working together:
 *   1. `webSearchTool()`  — an Anthropic built-in (server-side) tool.
 *   2. `executeStream()`  — token streaming with visible reasoning.
 *   3. a shared `History`  — so follow-up questions have context.
 *
 * Run:
 *   npm install
 *   ANTHROPIC_API_KEY=sk-ant-... npm start
 *
 * Commands inside the REPL:
 *   save <file.md>   write the last answer to a file
 *   reset            start a new research thread
 *   exit             quit
 */

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { writeFile } from "node:fs/promises";

import { ClaudeAgent } from "@agentionai/agents/claude";
import { History } from "@agentionai/agents/history";
import { webSearchTool } from "@agentionai/agents/core";

const SYSTEM_PROMPT = `You are a meticulous research assistant.
When a question needs current or factual information, use web search before answering.
Structure answers in Markdown: a short summary, then key findings as bullet points,
then a "Sources" section listing the URLs you relied on. Be precise and cite specifics.`;

const history = new History([], { maxTokens: 30000 });

const agent = new ClaudeAgent(
  {
    id: "researcher",
    name: "Research Agent",
    description: SYSTEM_PROMPT,
    apiKey: process.env.ANTHROPIC_API_KEY as string,
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    // Extended thinking: let the model plan its searches out loud.
    thinkingBudgetTokens: 2048,
    // Anthropic runs this tool itself — no execute() to implement.
    builtInTools: [webSearchTool({ maxUses: 5 })],
  },
  history
);

const rl = createInterface({ input: process.stdin, output: process.stdout });

// Track the most recent answer so `save` can write it out.
let lastAnswer = "";

/** Run one research turn, streaming reasoning + answer to the terminal. */
async function research(question: string): Promise<void> {
  let answer = "";
  let inThinking = false;

  for await (const chunk of agent.executeStream(question)) {
    if (chunk.type === "reasoning") {
      if (!inThinking) {
        process.stdout.write("\n\x1b[2m[thinking] ");
        inThinking = true;
      }
      process.stdout.write(chunk.content);
    } else {
      if (inThinking) {
        process.stdout.write("\x1b[0m\n\n");
        inThinking = false;
      }
      process.stdout.write(chunk.content);
      answer += chunk.content;
    }
  }
  if (inThinking) process.stdout.write("\x1b[0m");
  process.stdout.write("\n");

  lastAnswer = answer;
  if (agent.lastTokenUsage) {
    const { input_tokens, output_tokens } = agent.lastTokenUsage;
    console.log(
      `\x1b[2m(${input_tokens} in / ${output_tokens} out tokens)\x1b[0m`
    );
  }
}

async function main(): Promise<void> {
  console.log("Terminal Research Agent — ask a question, or:");
  console.log("  save <file.md>   reset   exit\n");

  while (true) {
    const input = (await rl.question("\n🔎 ")).trim();
    if (!input) continue;

    if (input === "exit") break;

    if (input === "reset") {
      history.clear();
      lastAnswer = "";
      console.log("Started a fresh research thread.");
      continue;
    }

    if (input.startsWith("save ")) {
      const file = input.slice(5).trim() || "report.md";
      if (!lastAnswer) {
        console.log("Nothing to save yet — ask a question first.");
        continue;
      }
      await writeFile(file, lastAnswer, "utf-8");
      console.log(`Saved to ${file}`);
      continue;
    }

    try {
      await research(input);
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
    }
  }

  rl.close();
}

main().catch(console.error);
