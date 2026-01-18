/**
 * Pipeline Example
 *
 * Demonstrates building complex multi-stage workflows by composing
 * different executor types together.
 *
 * Use case: Complete research workflow with parallel experts and voting
 */
import "dotenv/config";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";
import { AgentGraph, GraphNode, VotingInput } from "../../lib/graph/AgentGraph";
import { AgentEvent } from "../../lib/agents/AgentEvent";

const apiKey = process.env.ANTHROPIC_API_KEY as string;

if (!apiKey) {
  console.error("Please set ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

// Stage 1: Research Agent
const researchAgent = new ClaudeAgent({
  id: "researcher",
  name: "Researcher",
  description: `You are a research assistant. Given a topic, provide a clear, factual overview.
Focus on the most important and interesting aspects.
Keep your response under 200 words.`,
  apiKey,
  maxTokens: 512,
});

// Stage 2: Parallel Experts
const optimistExpert = new ClaudeAgent({
  id: "optimist",
  name: "Optimist",
  description: `You analyze research findings with an optimistic lens.
Highlight opportunities, positive developments, and potential benefits.
Keep your analysis under 100 words.`,
  apiKey,
  maxTokens: 256,
});

const pessimistExpert = new ClaudeAgent({
  id: "pessimist",
  name: "Pessimist",
  description: `You analyze research findings with a critical lens.
Highlight risks, challenges, and potential problems.
Keep your analysis under 100 words.`,
  apiKey,
  maxTokens: 256,
});

const realistExpert = new ClaudeAgent({
  id: "realist",
  name: "Realist",
  description: `You analyze research findings with a balanced, realistic lens.
Present both opportunities and challenges objectively.
Keep your analysis under 100 words.`,
  apiKey,
  maxTokens: 256,
});

// Stage 3: Judge
const judgeAgent = new ClaudeAgent({
  id: "judge",
  name: "Judge",
  description: `You synthesize multiple expert perspectives into a final, balanced conclusion.
Combine the best insights from each perspective.
Provide actionable takeaways.
Keep your synthesis under 150 words.`,
  apiKey,
  maxTokens: 384,
});

// Custom transformer node to prepare data for voting
const prepareForVoting: GraphNode<string[], VotingInput> = {
  execute: async (expertResults: string[]) => {
    // Store the original question for later (in real use, you'd pass this through context)
    return {
      originalInput:
        "Synthesize these expert analyses into a balanced conclusion",
      solutions: expertResults,
    };
  },
};

async function runFullPipelineExample() {
  console.log("=== Full Pipeline Example ===\n");
  console.log(
    "Pipeline: Research -> Parallel Experts -> Transform -> Voting\n"
  );

  // Build the complete pipeline
  const analysisPipeline = AgentGraph.pipeline(
    // Stage 1: Initial research (sequential with single agent)
    AgentGraph.sequential({ wrapInput: false }, researchAgent),

    // Stage 2: Parallel expert analysis
    AgentGraph.parallel(
      { wrapInput: false },
      optimistExpert,
      pessimistExpert,
      realistExpert
    ),

    // Stage 3: Transform results for voting
    prepareForVoting,

    // Stage 4: Judge synthesizes final answer
    AgentGraph.votingSystem(judgeAgent)
  );

  // Add logging
  const allAgents = [
    researchAgent,
    optimistExpert,
    pessimistExpert,
    realistExpert,
    judgeAgent,
  ];
  allAgents.forEach((agent) => {
    agent.addListener(AgentEvent.BEFORE_EXECUTE, () => {
      console.log(`  > ${agent.getName()} working...`);
    });
  });

  const topic = "The future of remote work";
  console.log(`Topic: "${topic}"\n`);
  console.log("Running pipeline...\n");

  const startTime = Date.now();

  try {
    const result = await analysisPipeline.execute(topic);
    const elapsed = Date.now() - startTime;

    console.log("\n=== Final Synthesized Analysis ===\n");
    console.log(result);
    console.log(`\nCompleted in ${elapsed}ms`);
  } catch (error) {
    console.error("Pipeline failed:", error);
  }
}

// Demonstrate pipeline with custom intermediate stages
async function runCustomStagesPipeline() {
  console.log("\n=== Pipeline with Custom Stages ===\n");

  const writer = new ClaudeAgent({
    id: "writer",
    name: "Writer",
    description: `Write a short paragraph about the given topic. Keep it under 50 words.`,
    apiKey,
    maxTokens: 128,
  });

  // Build pipeline with custom transformation stages
  const textPipeline = AgentGraph.pipeline<string, string>(
    // Stage 1: Write initial content
    AgentGraph.sequential({ wrapInput: false }, writer),

    // Stage 2: Custom transformation - convert to uppercase
    {
      execute: async (text: string) => {
        console.log("  > Transforming to uppercase...");
        return text.toUpperCase();
      },
    },

    // Stage 3: Custom transformation - add decoration
    {
      execute: async (text: string) => {
        console.log("  > Adding decoration...");
        return `✨ ${text} ✨`;
      },
    }
  );

  const result = await textPipeline.execute("The beauty of nature");
  console.log("\nResult:");
  console.log(result);
}

// Demonstrate building pipeline incrementally
async function runIncrementalPipeline() {
  console.log("\n=== Incremental Pipeline Building ===\n");

  // Build pipeline with explicit stages using AgentGraph.pipeline
  // Each stage transforms the data: number -> number -> number -> string
  const pipeline = AgentGraph.pipeline<number, string>(
    {
      execute: async (n: number) => {
        console.log(`  > Doubling ${n}...`);
        return n * 2;
      },
    },
    {
      execute: async (n: number) => {
        console.log(`  > Adding 10 to ${n}...`);
        return n + 10;
      },
    },
    {
      execute: async (n: number) => {
        console.log(`  > Converting ${n} to string...`);
        return `The result is: ${n}`;
      },
    }
  );

  console.log("Pipeline stages:", pipeline.length);
  console.log("Input: 5\n");

  const result = await pipeline.execute(5);
  console.log("\nOutput:", result);
}

// Run all examples
async function main() {
  await runFullPipelineExample();
  await runCustomStagesPipeline();
  await runIncrementalPipeline();
}

main().catch(console.error);
