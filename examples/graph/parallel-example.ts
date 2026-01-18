/**
 * Parallel Executor Example
 *
 * Demonstrates running multiple agents concurrently on the same input.
 * Each agent provides their unique perspective simultaneously.
 *
 * Use case: Getting multiple expert opinions on a topic
 */
import "dotenv/config";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";
import { AgentGraph } from "../../lib/graph/AgentGraph";
import { AgentEvent } from "../../lib/agents/AgentEvent";

const apiKey = process.env.ANTHROPIC_API_KEY as string;
console.log("apiKey", apiKey);
if (!apiKey) {
  console.error("Please set ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

// Expert 1: Technical perspective
const technicalExpert = new ClaudeAgent({
  id: "tech-expert",
  name: "Technical Expert",
  description: `You are a technical expert specializing in technology and engineering.
Analyze topics from a technical feasibility and implementation perspective.
Focus on: technical challenges, solutions, innovations, and practical considerations.
Keep your analysis concise (under 150 words).`,
  apiKey,
  maxTokens: 512,
});

// Expert 2: Economic perspective
const economicExpert = new ClaudeAgent({
  id: "econ-expert",
  name: "Economic Expert",
  description: `You are an economic expert specializing in markets and business.
Analyze topics from an economic and business perspective.
Focus on: costs, benefits, market impact, investment potential, and economic trends.
Keep your analysis concise (under 150 words).`,
  apiKey,
  maxTokens: 512,
});

// Expert 3: Social perspective
const socialExpert = new ClaudeAgent({
  id: "social-expert",
  name: "Social Expert",
  description: `You are a social scientist specializing in societal impact.
Analyze topics from a social and human perspective.
Focus on: social implications, ethical considerations, human behavior, and cultural impact.
Keep your analysis concise (under 150 words).`,
  apiKey,
  maxTokens: 512,
});

// Expert 4: Environmental perspective
const environmentalExpert = new ClaudeAgent({
  id: "env-expert",
  name: "Environmental Expert",
  description: `You are an environmental scientist.
Analyze topics from an environmental and sustainability perspective.
Focus on: environmental impact, sustainability, resource usage, and ecological considerations.
Keep your analysis concise (under 150 words).`,
  apiKey,
  maxTokens: 512,
});

async function runParallelExample() {
  console.log("=== Parallel Executor Example ===\n");
  console.log("Running 4 experts in parallel to analyze a topic\n");

  // Create parallel executor with all experts
  const expertPanel = AgentGraph.parallel(
    { wrapInput: false }, // Pass raw input to each expert
    technicalExpert,
    economicExpert,
    socialExpert,
    environmentalExpert
  );

  // Track timing
  const experts = [
    technicalExpert,
    economicExpert,
    socialExpert,
    environmentalExpert,
  ];
  const startTimes: Record<string, number> = {};

  experts.forEach((expert) => {
    expert.addListener(AgentEvent.BEFORE_EXECUTE, () => {
      startTimes[expert.getId()] = Date.now();
      console.log(`>>> ${expert.getName()} starting analysis...`);
    });
    expert.addListener(AgentEvent.DONE, () => {
      const elapsed = Date.now() - startTimes[expert.getId()];
      console.log(`<<< ${expert.getName()} completed (${elapsed}ms)`);
    });
  });

  const topic = "The rise of electric vehicles and autonomous driving";
  console.log(`Topic: "${topic}"\n`);

  const overallStart = Date.now();

  try {
    const results = await expertPanel.execute(topic);
    const totalTime = Date.now() - overallStart;

    console.log("\n=== Expert Opinions ===\n");

    const expertNames = ["Technical", "Economic", "Social", "Environmental"];
    results.forEach((result, index) => {
      console.log(`--- ${expertNames[index]} Perspective ---`);
      console.log(result);
      console.log();
    });

    console.log(`Total time: ${totalTime}ms (parallel execution)`);
    console.log("Note: Sequential execution would take ~4x longer\n");
  } catch (error) {
    console.error("Expert panel failed:", error);
  }
}

// Demonstrate isolated vs shared execution
async function runIsolationExample() {
  console.log("\n=== Isolation Modes ===\n");

  const analyst1 = new ClaudeAgent({
    id: "analyst-1",
    name: "Analyst 1",
    description: `Provide a brief one-sentence analysis of the topic.`,
    apiKey,
    maxTokens: 100,
  });

  const analyst2 = new ClaudeAgent({
    id: "analyst-2",
    name: "Analyst 2",
    description: `Provide a brief one-sentence analysis of the topic.`,
    apiKey,
    maxTokens: 100,
  });

  // Isolated execution - each agent works independently
  const isolatedPanel = AgentGraph.parallel(
    { isolatedExecution: true, wrapInput: false },
    analyst1,
    analyst2
  );

  console.log("Running with isolated execution...");
  const results = await isolatedPanel.execute("Climate change");

  console.log("\nAnalyst 1:", results[0]);
  console.log("Analyst 2:", results[1]);
}

// Run examples
async function main() {
  await runParallelExample();
  await runIsolationExample();
}

main().catch(console.error);
