/**
 * Sequential Executor Example
 *
 * Demonstrates chaining agents in sequence where each agent's output
 * becomes the input for the next agent.
 *
 * Use case: Research pipeline with fact-checking and summarization
 *
 * For data-fetching pipelines with factories, see: ./data-pipeline/
 */
import "dotenv/config";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";
import { AgentGraph } from "../../lib/graph/AgentGraph";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("Please set ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

// ============================================================================
// Agent Definitions
// ============================================================================

const researchAgent = new ClaudeAgent({
  id: "researcher",
  name: "Research Agent",
  description: `You are a research agent. Given a topic, provide detailed factual information.
Be thorough but concise. Focus on key facts, dates, and verifiable information.
Output your findings in a structured format.`,
  apiKey,
  maxTokens: 1024,
});

const factCheckerAgent = new ClaudeAgent({
  id: "fact-checker",
  name: "Fact Checker Agent",
  description: `You are a fact-checking agent. You receive research findings and verify their accuracy.
Mark any claims that seem questionable or need verification.
Add confidence levels (High/Medium/Low) to each fact.
Correct any obvious errors you find.`,
  apiKey,
  maxTokens: 1024,
});

const summaryAgent = new ClaudeAgent({
  id: "summarizer",
  name: "Summary Agent",
  description: `You are a summarization agent. You receive fact-checked research and create a clear,
concise summary suitable for a general audience.
Highlight the most important points.
Include a brief conclusion with key takeaways.
Keep the summary under 200 words.`,
  apiKey,
  maxTokens: 512,
});

// ============================================================================
// Example 1: Basic Sequential Pipeline
// ============================================================================

async function runSequentialExample() {
  console.log("=== Sequential Executor Example ===\n");
  console.log("Pipeline: Research -> Fact-Check -> Summarize\n");

  const researchPipeline = AgentGraph.sequential(
    researchAgent,
    factCheckerAgent,
    summaryAgent
  );

  const topic = "The discovery of penicillin and its impact on medicine";
  console.log(`Topic: "${topic}"\n`);

  try {
    const result = await researchPipeline.execute(topic);
    console.log("\n=== Final Summary ===\n");
    console.log(result);
  } catch (error) {
    console.error("Pipeline failed:", error);
  }
}

// ============================================================================
// Example 2: Raw Input Mode (no JSON wrapping)
// ============================================================================

async function runRawSequentialExample() {
  console.log("\n=== Sequential with Raw Input ===\n");

  const translator = new ClaudeAgent({
    id: "translator",
    name: "Translator",
    description: `Translate the input text to French. Output only the translation, nothing else.`,
    apiKey,
    maxTokens: 256,
  });

  const polisher = new ClaudeAgent({
    id: "polisher",
    name: "Polisher",
    description: `You receive French text. Make it more elegant and poetic while keeping the meaning.
Output only the polished French text.`,
    apiKey,
    maxTokens: 256,
  });

  // wrapInput: false passes raw output between agents
  const translationPipeline = AgentGraph.sequential(
    { wrapInput: false },
    translator,
    polisher
  );

  const englishText =
    "The sun sets slowly over the mountains, painting the sky in shades of orange and purple.";
  console.log(`English: "${englishText}"\n`);

  try {
    const result = await translationPipeline.execute(englishText);
    console.log(`Polished French: "${result}"`);
  } catch (error) {
    console.error("Translation failed:", error);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  await runSequentialExample();
  await runRawSequentialExample();

  console.log("\n---");
  console.log("For data-fetching pipelines with DB/API integration,");
  console.log("see: examples/graph/data-pipeline/");
}

main().catch(console.error);
