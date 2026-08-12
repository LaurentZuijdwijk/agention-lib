/**
 * Cancel an agent run with an `AbortSignal`.
 *
 * Every agent's `execute()` and `executeStream()` takes an optional
 * `{ signal }`. Aborting it cancels the provider request in flight, stops the
 * tool loop, and rejects with an `AbortError` — on every provider.
 *
 * Three cases are shown: a timeout on a plain call, a stream the caller stops
 * part-way through, and a tool that cancels its own work along with the run.
 *
 * Run with:
 *   ANTHROPIC_API_KEY=... npx tsx examples/cancellation.ts
 */
import { ClaudeAgent } from "../lib/agents/anthropic/ClaudeAgent";
import { AbortError } from "../lib/agents/errors/AgentError";
import { Tool } from "../lib/tools/Tool";

const identity = {
  id: "1",
  name: "Assistant",
  description: "A helpful assistant",
};

const apiKey = process.env.ANTHROPIC_API_KEY ?? "";

/** A tool that takes its time, and gives up when the run is cancelled. */
const slowTool = new Tool<string>({
  name: "slow_lookup",
  description: "Looks something up. Takes a while.",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string", description: "What to look up" } },
    required: ["query"],
  },
  // The third argument carries the run's signal
  execute: async (input, _context, options) => {
    console.log(`  [tool] looking up "${input.query}"…`);
    await sleep(30_000, options?.signal);
    return "…the answer";
  },
});

async function timeoutOnAPlainCall(): Promise<void> {
  console.log("\n1. Timeout on a plain call");

  const agent = new ClaudeAgent({ ...identity, apiKey, maxTokens: 4096 });
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error("took too long")), 1_500);

  try {
    await agent.execute("Write a 2000 word essay about the sea.", {
      signal: controller.signal,
    });
    console.log("  finished before the timeout");
  } catch (error) {
    if (error instanceof AbortError) {
      // `reason` is whatever was passed to abort()
      console.log(`  cancelled: ${(error.reason as Error).message}`);
    } else {
      throw error;
    }
  }
}

async function stoppingAStreamPartWay(): Promise<void> {
  console.log("\n2. Stopping a stream once it has said enough");

  const agent = new ClaudeAgent({ ...identity, apiKey, maxTokens: 4096 });
  const controller = new AbortController();
  let received = 0;

  try {
    for await (const chunk of agent.executeStream("Count from 1 to 500.", {
      signal: controller.signal,
    })) {
      received += chunk.content.length;
      if (received > 200) controller.abort();
    }
  } catch (error) {
    if (!(error instanceof AbortError)) throw error;
    console.log(`  stopped after ${received} characters`);
  }
}

async function cancellingAToolMidRun(): Promise<void> {
  console.log("\n3. Cancelling while a tool is running");

  const agent = new ClaudeAgent({
    ...identity,
    description: "Use slow_lookup to answer questions.",
    apiKey,
    tools: [slowTool],
  });
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 4_000);

  try {
    await agent.execute("Look up the capital of France.", {
      signal: controller.signal,
    });
  } catch (error) {
    if (!(error instanceof AbortError)) throw error;
    console.log("  cancelled — the tool gave up with the run");
  }

  // A cancelled run never leaves a tool call unanswered — here the tool had
  // already started, so its failure was recorded as the tool's result before
  // the run stopped. Either way the history can be executed against again.
  console.log(`  history entries left: ${agent.getHistoryEntries().length}`);
}

/** `setTimeout` that rejects as soon as the signal fires. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

async function main(): Promise<void> {
  if (!apiKey) {
    console.error("Set ANTHROPIC_API_KEY to run this example.");
    process.exit(1);
  }

  await timeoutOnAPlainCall();
  await stoppingAStreamPartWay();
  await cancellingAToolMidRun();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
