/**
 * Recover the reasoning trail from a streamed turn that never finished.
 *
 * Streaming agents accumulate a turn as it arrives and only write it to history
 * once the stream ends cleanly. A dropped connection, a provider error, a
 * token-limit stop or a caller who walks away would otherwise discard
 * everything generated up to that point — which on a local reasoning model can
 * be twenty minutes of compute.
 *
 * Whatever was generated is therefore always handed back on
 * `agent.lastPartialTurn`, on the thrown error's `.partial`, and on the
 * `AgentEvent.PARTIAL_TURN` event. It is never written to history: an
 * interrupted turn is frequently not replayable, so what to do with it is left
 * to you.
 *
 * Run against a local llama.cpp server with a reasoning model loaded:
 *   LLAMACPP_URL=http://localhost:8080/v1 npx tsx examples/partial-turn.ts
 */
import { LlamaCppAgent } from "../lib/agents/llamacpp/LlamaCppAgent";
import { AgentEvent } from "../lib/agents/AgentEvent";
import type { PartialTurn } from "../lib/agents/BaseAgent";

const agent = new LlamaCppAgent({
  id: "1",
  name: "Thinker",
  description: "You think carefully before answering.",
  baseURL: process.env.LLAMACPP_URL ?? "http://localhost:8080/v1",
});

// Pushed the moment a turn is cut short, rather than polled afterwards.
agent.on(AgentEvent.PARTIAL_TURN, (partial: PartialTurn) => {
  console.log(
    `\n  [partial] ${partial.reason}: ${partial.reasoning.length} chars of ` +
      `reasoning, ${partial.text.length} of text`
  );
});

/** The caller stops reading part-way through: reason is "abandoned". */
async function stopReadingMidTrail(): Promise<void> {
  console.log("\n1. Consumer stops iterating mid-reasoning");

  let seen = 0;
  for await (const chunk of agent.executeStream(
    "How many r's are in strawberry? Think it through."
  )) {
    if (chunk.type !== "reasoning") continue;
    seen += chunk.content.length;
    if (seen > 200) break;
  }

  const salvaged = agent.lastPartialTurn;
  console.log(`  kept ${salvaged?.reasoning.length ?? 0} chars:`);
  console.log(`  "${salvaged?.reasoning.slice(0, 120)}…"`);
}

/** The run is cancelled: reason is "aborted", and the trail survives. */
async function cancelMidTrail(): Promise<void> {
  console.log("\n2. Run cancelled mid-reasoning");

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 3_000);

  try {
    for await (const chunk of agent.executeStream(
      "Prove that the square root of 2 is irrational. Be rigorous.",
      { signal: controller.signal }
    )) {
      process.stdout.write(chunk.type === "reasoning" ? "." : chunk.content);
    }
  } catch (error) {
    // The same object is on the error, for callers that only have that
    const partial = (error as { partial?: PartialTurn }).partial;
    console.log(`\n  ${(error as Error).name}, trail recovered from the error:`);
    console.log(`  "${partial?.reasoning.slice(0, 120)}…"`);
  }

  // Nothing was written to history — the interrupted turn is not replayable
  const assistantTurns = agent
    .getHistoryEntries()
    .filter((entry) => entry.role === "assistant").length;
  console.log(`  assistant turns in history: ${assistantTurns}`);
}

/** A turn that finishes normally leaves nothing behind. */
async function completeTurn(): Promise<void> {
  console.log("\n3. A turn that completes");

  for await (const chunk of agent.executeStream("Say hi in five words.")) {
    if (chunk.type === "text") process.stdout.write(chunk.content);
  }

  console.log(`\n  lastPartialTurn: ${agent.lastPartialTurn ?? "undefined"}`);
}

async function main(): Promise<void> {
  await stopReadingMidTrail();
  await cancelMidTrail();
  await completeTurn();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
