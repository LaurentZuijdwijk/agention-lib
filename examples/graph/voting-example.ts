/**
 * Voting System Example
 *
 * Demonstrates using a judge agent to select the best answer
 * from multiple expert responses.
 *
 * Use case: Getting diverse opinions and synthesizing the best answer
 */
import "dotenv/config";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";
import { AgentGraph, VotingInput } from "../../lib/graph/AgentGraph";

const apiKey = process.env.ANTHROPIC_API_KEY as string;

if (!apiKey) {
  console.error("Please set ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

// Three experts with different approaches
const conservativeExpert = new ClaudeAgent({
  id: "conservative",
  name: "Conservative Expert",
  description: `You are a conservative, risk-averse advisor.
When answering questions, prioritize safety, proven methods, and caution.
Recommend established approaches over experimental ones.
Keep responses under 100 words.`,
  apiKey,
  maxTokens: 256,
});

const innovativeExpert = new ClaudeAgent({
  id: "innovative",
  name: "Innovative Expert",
  description: `You are an innovative, forward-thinking advisor.
When answering questions, prioritize new approaches, cutting-edge solutions, and bold ideas.
Recommend creative and unconventional methods.
Keep responses under 100 words.`,
  apiKey,
  maxTokens: 256,
});

const balancedExpert = new ClaudeAgent({
  id: "balanced",
  name: "Balanced Expert",
  description: `You are a balanced, pragmatic advisor.
When answering questions, weigh both traditional and innovative approaches.
Recommend solutions that balance risk and reward.
Keep responses under 100 words.`,
  apiKey,
  maxTokens: 256,
});

// Judge agent to evaluate and select the best answer
const judgeAgent = new ClaudeAgent({
  id: "judge",
  name: "Judge",
  description: `You are an impartial judge evaluating expert opinions.
Analyze each expert's response for:
- Practicality and feasibility
- Completeness of the answer
- Quality of reasoning

Select the best answer OR synthesize a superior answer combining the best elements.
Explain your choice briefly, then provide the final recommended answer.`,
  apiKey,
  maxTokens: 512,
});

async function runBasicVotingExample() {
  console.log("=== Basic Voting System Example ===\n");

  const question = "What's the best strategy for a small business to adopt AI?";
  console.log(`Question: "${question}"\n`);

  // Get opinions from all experts
  console.log("Gathering expert opinions...\n");

  const [conservative, innovative, balanced] = await Promise.all([
    conservativeExpert.execute(question),
    innovativeExpert.execute(question),
    balancedExpert.execute(question),
  ]);

  console.log("--- Conservative Expert ---");
  console.log(conservative);
  console.log("\n--- Innovative Expert ---");
  console.log(innovative);
  console.log("\n--- Balanced Expert ---");
  console.log(balanced);

  // Create voting system
  const votingSystem = AgentGraph.votingSystem(judgeAgent);

  // Submit for voting
  const votingInput: VotingInput = {
    originalInput: question,
    solutions: [
      conservative as string,
      innovative as string,
      balanced as string,
    ],
  };

  console.log("\n--- Judge's Verdict ---\n");
  const verdict = await votingSystem.execute(votingInput);
  console.log(verdict);
}

// Custom prompt template example
async function runCustomTemplateExample() {
  console.log("\n=== Custom Voting Template Example ===\n");

  const customJudge = new ClaudeAgent({
    id: "custom-judge",
    name: "Custom Judge",
    description: `You evaluate code solutions. Pick the best one based on:
- Code quality and readability
- Performance considerations
- Best practices

Output only the winning solution number and a brief explanation.`,
    apiKey,
    maxTokens: 256,
  });

  const votingSystem = AgentGraph.votingSystem(customJudge, {
    promptTemplate: `## Code Review Task

**Original Request:** {originalQuestion}

**Submitted Solutions:**
{expertAnswers}

Evaluate each solution and declare a winner.`,
  });

  const solutions = [
    "Solution using a for loop: for(let i=0; i<arr.length; i++) { sum += arr[i]; }",
    "Solution using reduce: arr.reduce((sum, val) => sum + val, 0)",
    "Solution using forEach: let sum=0; arr.forEach(x => sum += x);",
  ];

  const result = await votingSystem.execute({
    originalInput: "Sum all numbers in an array",
    solutions,
  });

  console.log("Judge's decision:");
  console.log(result);
}

// Run examples
async function main() {
  await runBasicVotingExample();
  await runCustomTemplateExample();
}

main().catch(console.error);
