/**
 * Router Executor Example
 *
 * Demonstrates intelligent routing of user input to specialized handlers.
 * The router agent analyzes each query and selects the most appropriate
 * expert to handle it.
 *
 * Use case: Customer support, multi-domain assistants, specialized agents
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { OpenAiAgent } from "../../lib/agents/openai/OpenAiAgent";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";
import { AgentGraph } from "../../lib/graph/AgentGraph";

const apiKey = process.env.ANTHROPIC_API_KEY as string;
const openAiApiKey = process.env.OPENAI_API_KEY as string;

// ============================================================================
// Specialized Handler Agents
// ============================================================================

const technicalAgent = new OpenAiAgent({
  id: "technical",
  name: "Technical Expert",
  description: `You are a technical support expert specializing in programming, software, and technology.
You help with:
- Code debugging and best practices
- Software installation and configuration
- Technical concepts and explanations
- Architecture and design patterns

Be precise and include code examples when relevant. Keep responses focused and actionable.`,
  apiKey: openAiApiKey,
  maxTokens: 1024,
});

const creativeAgent = new OpenAiAgent({
  id: "creative",
  name: "Creative Writer",
  description: `You are a creative writing assistant specializing in storytelling and content creation.
You help with:
- Story ideas and plot development
- Character creation and dialogue
- Poetry and creative prose
- Marketing copy and taglines

Be imaginative and inspiring. Offer multiple options when brainstorming.`,
  apiKey: openAiApiKey,
  maxTokens: 1024,
});

const analyticsAgent = new ClaudeAgent({
  id: "analytics",
  name: "Data Analyst",
  description: `You are a data analytics expert specializing in analysis and insights.
You help with:
- Data interpretation and visualization advice
- Statistical concepts and methods
- Business metrics and KPIs
- Research methodology

Be analytical and data-driven. Explain your reasoning clearly.`,
  apiKey,
  maxTokens: 1024,
});

const generalAgent = new ClaudeAgent({
  id: "general",
  name: "General Assistant",
  description: `You are a helpful general assistant for everyday questions.
You help with:
- General knowledge questions
- Recommendations and advice
- Explanations of concepts
- Day-to-day problem solving

Be friendly, clear, and helpful. Ask clarifying questions if needed.`,
  apiKey,
  maxTokens: 1024,
});

// ============================================================================
// Router Agent
// ============================================================================

const routerAgent = new ClaudeAgent({
  id: "router",
  name: "Query Router",
  description: `You are a routing agent that classifies user queries.
Analyze the user's question and determine which expert should handle it.
Consider the main topic, required expertise, and user intent.
Output ONLY the route name, nothing else.`,
  apiKey,
  maxTokens: 50,
});

// ============================================================================
// Router Setup
// ============================================================================

const supportRouter = AgentGraph.router(
  routerAgent,
  [
    {
      name: "technical",
      description:
        "Programming, software, debugging, code, APIs, databases, DevOps, technical concepts",
      handler: technicalAgent,
    },
    {
      name: "creative",
      description:
        "Writing, storytelling, poetry, content creation, brainstorming, marketing copy",
      handler: creativeAgent,
    },
    {
      name: "analytics",
      description:
        "Data analysis, statistics, metrics, research, charts, business intelligence",
      handler: analyticsAgent,
    },
    {
      name: "general",
      description:
        "General questions, everyday advice, recommendations, explanations",
      handler: generalAgent,
    },
  ],
  {
    fallbackRoute: "general",
    includeRouterContext: false, // Pass raw input to handlers
  }
);

// ============================================================================
// Interactive Session
// ============================================================================

async function runInteractiveSession() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n=== Intelligent Router Example ===\n");
  console.log("This demo routes your questions to specialized experts:");
  console.log("  - Technical: code, software, programming");
  console.log("  - Creative: writing, stories, content");
  console.log("  - Analytics: data, statistics, metrics");
  console.log("  - General: everything else");
  console.log('\nType "exit" to quit.\n');
  console.log("─".repeat(50));

  while (true) {
    const input = await rl.question("\nYou: ");

    if (input.toLowerCase() === "exit") {
      console.log("\nGoodbye!\n");
      console.log(supportRouter.getMetrics());
      break;
    }

    if (!input.trim()) {
      continue;
    }

    try {
      console.log("\nRouting query...");
      const response = await supportRouter.execute(input);
      console.log("\n" + "─".repeat(50));
      console.log(response);
      console.log("─".repeat(50));
    } catch (error) {
      console.error("\nError:", error instanceof Error ? error.message : error);
    }
  }

  rl.close();
}

// ============================================================================
// Demo with Pre-defined Queries
// ============================================================================

async function runDemoQueries() {
  console.log("\n=== Router Demo with Sample Queries ===\n");

  const queries = [
    "How do I fix a memory leak in my Node.js application?",
    "Write me a haiku about programming",
    "What metrics should I track for my e-commerce site?",
    "What's a good recipe for chocolate chip cookies?",
  ];

  for (const query of queries) {
    console.log("─".repeat(50));
    console.log(`\nQuery: "${query}"\n`);

    try {
      const response = await supportRouter.execute(query);
      console.log("Response:\n");
      console.log(response);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
    }

    console.log();
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--demo")) {
    await runDemoQueries();
  } else {
    await runInteractiveSession();
  }
}

main().catch(console.error);
