/**
 * Map Executor Example
 *
 * Demonstrates processing arrays of items in parallel using a processor agent.
 *
 * Use case: Batch processing documents, summarizing multiple articles, etc.
 */
import "dotenv/config";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";
import { AgentGraph, GraphNode } from "../../lib/graph/AgentGraph";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("Please set ANTHROPIC_API_KEY environment variable");
  process.exit(1);
}

// Summarization agent for processing individual documents
const summarizerAgent = new ClaudeAgent({
  id: "summarizer",
  name: "Summarizer",
  description: `You are a summarization agent. Given a text, provide a one-sentence summary.
Be concise and capture the main point. Output only the summary sentence.`,
  apiKey,
  maxTokens: 100,
});

// Sentiment analysis agent
const sentimentAgent = new ClaudeAgent({
  id: "sentiment",
  name: "Sentiment Analyzer",
  description: `Analyze the sentiment of the given text.
Output exactly one word: POSITIVE, NEGATIVE, or NEUTRAL`,
  apiKey,
  maxTokens: 10,
});

// Translation agent
const translatorAgent = new ClaudeAgent({
  id: "translator",
  name: "Translator",
  description: `Translate the given text to Spanish. Output only the translation.`,
  apiKey,
  maxTokens: 200,
});

async function runBatchSummarization() {
  console.log("=== Batch Summarization Example ===\n");

  const documents = [
    "Artificial intelligence is transforming healthcare by enabling faster diagnosis and personalized treatment plans. Machine learning algorithms can now detect diseases from medical images with accuracy matching or exceeding human experts.",
    "Climate change is causing unprecedented shifts in global weather patterns. Rising temperatures are leading to more frequent extreme weather events, including hurricanes, droughts, and wildfires.",
    "The global economy is increasingly driven by digital services and remote work. Companies are adapting to hybrid work models, reshaping urban centers and suburban communities alike.",
    "Space exploration has entered a new era with private companies launching missions alongside government agencies. Reusable rockets have dramatically reduced the cost of reaching orbit.",
  ];

  console.log(`Processing ${documents.length} documents in parallel...\n`);

  // Create map executor with the summarizer
  const batchSummarizer = AgentGraph.map(
    AgentGraph.sequential({ wrapInput: false }, summarizerAgent)
  );

  const startTime = Date.now();
  const summaries = await batchSummarizer.execute(documents);
  const elapsed = Date.now() - startTime;

  console.log("Summaries:");
  summaries.forEach((summary, index) => {
    console.log(`${index + 1}. ${summary}`);
  });

  console.log(`\nProcessed ${documents.length} documents in ${elapsed}ms`);
}

async function runBatchSentimentAnalysis() {
  console.log("\n=== Batch Sentiment Analysis Example ===\n");

  const reviews = [
    "This product exceeded all my expectations! Best purchase ever.",
    "Terrible quality. Broke after one day. Complete waste of money.",
    "It's okay. Does what it's supposed to do, nothing special.",
    "Absolutely love it! Would recommend to everyone.",
    "Not great, not terrible. Average product for average price.",
  ];

  console.log("Analyzing sentiment of customer reviews...\n");

  const sentimentAnalyzer = AgentGraph.map(
    AgentGraph.sequential({ wrapInput: false }, sentimentAgent)
  );

  const sentiments = await sentimentAnalyzer.execute(reviews);

  console.log("Results:");
  reviews.forEach((review, index) => {
    console.log(`"${review.substring(0, 50)}..." -> ${sentiments[index]}`);
  });

  // Count sentiments
  const counts = sentiments.reduce(
    (acc, s) => {
      const key = s.trim().toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log("\nSummary:", counts);
}

async function runBatchTranslation() {
  console.log("\n=== Batch Translation Example ===\n");

  const phrases = [
    "Hello, how are you?",
    "The weather is beautiful today.",
    "I love programming.",
  ];

  console.log("Translating phrases to Spanish...\n");

  const translator = AgentGraph.map(
    AgentGraph.sequential({ wrapInput: false }, translatorAgent)
  );

  const translations = await translator.execute(phrases);

  console.log("Translations:");
  phrases.forEach((phrase, index) => {
    console.log(`EN: "${phrase}"`);
    console.log(`ES: "${translations[index]}"`);
    console.log();
  });
}

// Custom processor example (non-agent)
async function runCustomProcessor() {
  console.log("=== Custom Processor Example ===\n");

  // Custom processor that doesn't use an agent
  const wordCounter: GraphNode<string, { text: string; wordCount: number }> = {
    execute: async (text: string) => ({
      text: text.substring(0, 30) + "...",
      wordCount: text.split(/\s+/).length,
    }),
  };

  const mapper = AgentGraph.map(wordCounter);

  const texts = [
    "This is a short sentence.",
    "This is a much longer sentence with many more words in it.",
    "One two three four five six seven eight nine ten eleven twelve.",
  ];

  const results = await mapper.execute(texts);

  console.log("Word counts:");
  results.forEach((result) => {
    console.log(`"${result.text}" -> ${result.wordCount} words`);
  });
}

// Pipeline with map example
async function runPipelineWithMap() {
  console.log("\n=== Pipeline with Map Example ===\n");

  const qualityChecker = new ClaudeAgent({
    id: "quality",
    name: "Quality Checker",
    description: `Given multiple summaries, identify which one is the best quality.
Output only the number (1, 2, 3, etc.) of the best summary.`,
    apiKey,
    maxTokens: 10,
  });

  // Pipeline: Split -> Summarize Each -> Select Best
  const pipeline = AgentGraph.pipeline(
    // Split input into paragraphs
    {
      execute: async (text: string) => text.split("\n\n").filter((p) => p.trim()),
    },

    // Summarize each paragraph
    AgentGraph.map(AgentGraph.sequential({ wrapInput: false }, summarizerAgent)),

    // Combine summaries and select best
    {
      execute: async (summaries: string[]) => {
        const numbered = summaries
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n");
        return `Select the best summary:\n${numbered}`;
      },
    },

    // Pick the best one
    AgentGraph.sequential({ wrapInput: false }, qualityChecker)
  );

  const document = `
The ocean covers over 70% of Earth's surface. It regulates climate, produces oxygen, and supports countless species. Marine ecosystems are vital for human survival.

Technology has revolutionized communication. Smartphones connect billions of people worldwide. Social media platforms have transformed how we share information and interact.

Education is the foundation of progress. Schools prepare young minds for the future. Lifelong learning enables adaptation in a rapidly changing world.
  `.trim();

  console.log("Document has 3 paragraphs. Finding best summary...\n");

  const result = await pipeline.execute(document);
  console.log("Best summary number:", result);
}

// Run all examples
async function main() {
  await runBatchSummarization();
  await runBatchSentimentAnalysis();
  await runBatchTranslation();
  await runCustomProcessor();
  await runPipelineWithMap();
}

main().catch(console.error);
