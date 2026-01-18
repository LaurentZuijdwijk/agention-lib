/**
 * Graph Examples Index
 *
 * Run individual examples:
 *   npx ts-node examples/graph/sequential-example.ts
 *   npx ts-node examples/graph/parallel-example.ts
 *   npx ts-node examples/graph/voting-example.ts
 *   npx ts-node examples/graph/pipeline-example.ts
 *   npx ts-node examples/graph/map-example.ts
 *
 * Or run this file for a quick demo:
 *   npx ts-node examples/graph/index.ts
 */
import "dotenv/config";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";
import { AgentGraph, VotingInput, GraphNode } from "../../lib/graph/AgentGraph";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("Please set ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

/**
 * Quick demo showcasing all graph executor types
 */
async function quickDemo() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║     Agention Graph System Quick Demo     ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Create some simple agents for demonstration
  const uppercaseAgent = new ClaudeAgent({
    id: "uppercase",
    name: "Uppercase Agent",
    description: "Convert the input to uppercase. Output only the uppercase text.",
    apiKey,
    maxTokens: 100,
  });

  const excitedAgent = new ClaudeAgent({
    id: "excited",
    name: "Excited Agent",
    description: "Add excitement to the text by adding exclamation marks and enthusiastic words. Keep it short.",
    apiKey,
    maxTokens: 100,
  });

  const calmAgent = new ClaudeAgent({
    id: "calm",
    name: "Calm Agent",
    description: "Make the text calmer and more relaxed. Use peaceful language. Keep it short.",
    apiKey,
    maxTokens: 100,
  });

  const judgeAgent = new ClaudeAgent({
    id: "judge",
    name: "Judge Agent",
    description: "You receive two versions of text. Pick the better one. Output only 'Version 1' or 'Version 2'.",
    apiKey,
    maxTokens: 20,
  });

  // 1. Sequential Example
  console.log("1. SEQUENTIAL EXECUTOR");
  console.log("   Chain: Input -> Uppercase -> Excited\n");

  const sequential = AgentGraph.sequential(
    { wrapInput: false },
    uppercaseAgent,
    excitedAgent
  );

  const seqResult = await sequential.execute("hello world");
  console.log(`   Input:  "hello world"`);
  console.log(`   Output: "${seqResult}"\n`);

  // 2. Parallel Example
  console.log("2. PARALLEL EXECUTOR");
  console.log("   Running Excited and Calm agents in parallel\n");

  const parallel = AgentGraph.parallel(
    { wrapInput: false },
    excitedAgent,
    calmAgent
  );

  const parResults = await parallel.execute("The sun is shining");
  console.log(`   Input: "The sun is shining"`);
  console.log(`   Excited: "${parResults[0]}"`);
  console.log(`   Calm:    "${parResults[1]}"\n`);

  // 3. Voting Example
  console.log("3. VOTING SYSTEM");
  console.log("   Judge picks between excited and calm versions\n");

  const voting = AgentGraph.votingSystem(judgeAgent);
  const votingInput: VotingInput = {
    originalInput: "Pick the better version",
    solutions: parResults,
  };

  const verdict = await voting.execute(votingInput);
  console.log(`   Verdict: ${verdict}\n`);

  // 4. Map Example
  console.log("4. MAP EXECUTOR");
  console.log("   Processing array of items in parallel\n");

  const mapper = AgentGraph.map(
    AgentGraph.sequential({ wrapInput: false }, uppercaseAgent)
  );

  const mapResults = await mapper.execute(["one", "two", "three"]);
  console.log(`   Input:  ["one", "two", "three"]`);
  console.log(`   Output: ${JSON.stringify(mapResults)}\n`);

  // 5. Pipeline Example
  console.log("5. PIPELINE");
  console.log("   Complex workflow combining multiple executor types\n");

  const pipeline = AgentGraph.pipeline<string, string>(
    // Stage 1: Get two versions in parallel
    AgentGraph.parallel({ wrapInput: false }, excitedAgent, calmAgent),

    // Stage 2: Transform for voting
    {
      execute: async (results: string[]) => ({
        originalInput: "Which version is better?",
        solutions: results,
      }),
    } as GraphNode<string[], VotingInput>,

    // Stage 3: Vote
    voting
  );

  const pipelineResult = await pipeline.execute("Good morning");
  console.log(`   Input:  "Good morning"`);
  console.log(`   Output: "${pipelineResult}"`);

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║            Demo Complete!                ║");
  console.log("╚══════════════════════════════════════════╝");
}

quickDemo().catch(console.error);
