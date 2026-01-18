/**
 * Metrics and Observability Example
 *
 * Demonstrates how to track timing, token usage, and pipeline structure
 * for analysis and visualization.
 */
import "dotenv/config";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";
import {
  AgentGraph,
  createMetricsCollector,
  VotingInput,
  GraphNode,
} from "../../lib/graph/AgentGraph";

const apiKey = process.env.ANTHROPIC_API_KEY as string;

// Create some agents for demonstration
const researchAgent = new ClaudeAgent({
  id: "researcher",
  name: "Researcher",
  description:
    "Research the given topic briefly. Keep response under 50 words.",
  apiKey,
  maxTokens: 128,
});

const optimistAgent = new ClaudeAgent({
  id: "optimist",
  name: "Optimist",
  description: "Give a brief optimistic perspective. Under 30 words.",
  apiKey,
  maxTokens: 64,
});

const pessimistAgent = new ClaudeAgent({
  id: "pessimist",
  name: "Pessimist",
  description: "Give a brief pessimistic perspective. Under 30 words.",
  apiKey,
  maxTokens: 64,
});

const judgeAgent = new ClaudeAgent({
  id: "judge",
  name: "Judge",
  description:
    "Pick the better perspective. Say 'Optimist' or 'Pessimist' only.",
  apiKey,
  maxTokens: 16,
});

async function runMetricsExample() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║     Graph Metrics & Observability Demo       ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Create a metrics collector
  const metrics = createMetricsCollector();

  // Build a pipeline with metrics enabled
  const pipeline = AgentGraph.pipeline<string, string>(
    // Stage 1: Research
    AgentGraph.sequential({ wrapInput: false }, researchAgent),

    // Stage 2: Parallel perspectives
    AgentGraph.parallel({ wrapInput: false }, optimistAgent, pessimistAgent),

    // Stage 3: Transform for voting
    {
      name: "TransformForVoting",
      execute: async (results: string[]) => ({
        originalInput: "Which perspective is better?",
        solutions: results,
      }),
    } as GraphNode<string[], VotingInput>,

    // Stage 4: Judge votes
    AgentGraph.votingSystem(judgeAgent)
  ).withMetrics(metrics);

  console.log("Running pipeline with metrics collection...\n");
  const startTime = Date.now();

  try {
    const result = await pipeline.execute("The future of renewable energy");
    const totalTime = Date.now() - startTime;

    console.log("\n════════════════════════════════════════════════");
    console.log("RESULT:", result);
    console.log("════════════════════════════════════════════════\n");

    // Display metrics
    console.log("📊 EXECUTION METRICS\n");
    console.log(metrics.toTextVisualization());

    // Get aggregate metrics
    const aggregate = metrics.getAggregateMetrics();

    console.log("\n────────────────────────────────────────────────");
    console.log("📈 AGGREGATE STATISTICS\n");
    console.log(`Total Duration:    ${aggregate.totalDurationMs}ms`);
    console.log(`Nodes Executed:    ${aggregate.nodeCount}`);
    console.log(`Successful:        ${aggregate.successCount}`);
    console.log(`Failed:            ${aggregate.failureCount}`);
    console.log(`Total Tokens:      ${aggregate.totalTokens.totalTokens}`);
    console.log(`  - Input Tokens:  ${aggregate.totalTokens.inputTokens}`);
    console.log(`  - Output Tokens: ${aggregate.totalTokens.outputTokens}`);

    // Display pipeline structure
    console.log("\n────────────────────────────────────────────────");
    console.log("🏗️  PIPELINE STRUCTURE\n");
    displayStructure(aggregate.structure);

    // Show JSON output (for external tools)
    console.log("\n────────────────────────────────────────────────");
    console.log("📄 JSON OUTPUT (for visualization tools)\n");
    console.log(metrics.toJSON());
  } catch (error) {
    console.error("Pipeline failed:", error);

    // Even on failure, we can see what executed
    console.log("\n📊 PARTIAL EXECUTION METRICS\n");
    console.log(metrics.toTextVisualization());
  }
}

/**
 * Display pipeline structure as ASCII tree
 */
function displayStructure(
  structure: { type: string; name: string; children?: any[] },
  indent = 0
): void {
  const prefix = indent === 0 ? "" : "  ".repeat(indent - 1) + "├─ ";
  console.log(`${prefix}[${structure.type}] ${structure.name}`);

  if (structure.children) {
    for (const child of structure.children) {
      displayStructure(child, indent + 1);
    }
  }
}

/**
 * Example: Comparing execution times
 */
async function runTimingComparison() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║         Timing Comparison Example            ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const quickAgent = new ClaudeAgent({
    id: "quick",
    name: "Quick Agent",
    description: "Say 'Hello' only.",
    apiKey,
    maxTokens: 8,
  });

  // Sequential execution
  const seqMetrics = createMetricsCollector();
  const sequential = AgentGraph.sequential(
    { wrapInput: false },
    quickAgent,
    quickAgent,
    quickAgent
  ).withMetrics(seqMetrics);

  console.log("Running 3 agents SEQUENTIALLY...");
  await sequential.execute("test");
  const seqAggregate = seqMetrics.getAggregateMetrics();
  console.log(`Sequential time: ${seqAggregate.totalDurationMs}ms\n`);

  // Parallel execution
  const parMetrics = createMetricsCollector();
  const parallel = AgentGraph.parallel(
    { wrapInput: false },
    quickAgent,
    quickAgent,
    quickAgent
  ).withMetrics(parMetrics);

  console.log("Running 3 agents in PARALLEL...");
  await parallel.execute("test");
  const parAggregate = parMetrics.getAggregateMetrics();
  console.log(`Parallel time: ${parAggregate.totalDurationMs}ms\n`);

  const speedup = seqAggregate.totalDurationMs / parAggregate.totalDurationMs;
  console.log(`Speedup: ${speedup.toFixed(2)}x faster with parallel execution`);
}

/**
 * Example: Error tracking
 */
async function runErrorTrackingExample() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║           Error Tracking Example             ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const failingNode: GraphNode<string, string> = {
    name: "FailingNode",
    execute: async () => {
      throw new Error("Simulated failure!");
    },
  };

  const metrics = createMetricsCollector();
  const pipeline = AgentGraph.pipeline(
    AgentGraph.sequential({ wrapInput: false }, researchAgent),
    failingNode
  ).withMetrics(metrics);

  console.log("Running pipeline with a failing stage...\n");

  try {
    await pipeline.execute("test topic");
  } catch (error) {
    console.log("Pipeline failed as expected.\n");
  }

  console.log("📊 METRICS (showing failure):\n");
  console.log(metrics.toTextVisualization());

  const aggregate = metrics.getAggregateMetrics();
  console.log(
    `\nSuccess rate: ${aggregate.successCount}/${aggregate.nodeCount}`
  );
}

// Run all examples
async function main() {
  await runMetricsExample();
  await runTimingComparison();
  await runErrorTrackingExample();
}

main().catch(console.error);
