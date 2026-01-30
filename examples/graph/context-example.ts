/**
 * Shared Context Example
 *
 * This example demonstrates how multiple agents can share data
 * through a common context store using tools.
 *
 * Run with: npx ts-node examples/graph/context-example.ts
 */

import { AgentGraph } from "../../lib/graph/AgentGraph";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";

async function main() {
  // Create a shared context store with initial values
  const contextStore = AgentGraph.createContextStore({
    user_preferences: {
      language: "English",
      detail_level: "comprehensive",
    },
  });

  // Create context tools that all agents will share
  const contextTools = AgentGraph.createContextTools(contextStore);

  // Agent 1: Researcher - gathers information and stores in context
  const researcher = new ClaudeAgent({
    id: "researcher",
    name: "Research Agent",
    description: `You are a research agent. Your job is to:
1. Research the given topic
2. Store your findings in context using context_set with key "research_findings"
3. Store a list of key points using context_set with key "key_points"

Use clear, descriptive keys for all context values.`,
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-sonnet-4-20250514",
    maxTokens: 2048,
    tools: contextTools,
  });

  // Agent 2: Analyst - reads research and adds analysis
  const analyst = new ClaudeAgent({
    id: "analyst",
    name: "Analysis Agent",
    description: `You are an analysis agent. Your job is to:
1. First, use list_context_keys to see what data is available
2. Use context_get to retrieve "research_findings" and "key_points"
3. Analyze the research and identify patterns, insights, and implications
4. Store your analysis using context_set with key "analysis_results"

Build upon the research already in context.`,
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-sonnet-4-20250514",
    maxTokens: 2048,
    tools: contextTools,
  });

  // Agent 3: Writer - reads everything and creates final output
  const writer = new ClaudeAgent({
    id: "writer",
    name: "Writer Agent",
    description: `You are a writing agent. Your job is to:
1. Use list_context_keys to see all available data
2. Use context_get to retrieve research findings, key points, and analysis results
3. Also check user_preferences for language and detail level preferences
4. Write a well-structured report combining all the information
5. Store the final report using context_set with key "final_report"

Create a cohesive narrative from all the gathered information.`,
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-sonnet-4-20250514",
    maxTokens: 2048,
    tools: contextTools,
  });

  const topic = "The impact of artificial intelligence on software development workflows";

  console.log(`\n=== Shared Context Pipeline ===\n`);
  console.log(`Topic: ${topic}\n`);
  console.log("Initial context:", contextStore.toObject());

  try {
    // Step 1: Research
    console.log("\n--- Step 1: Research ---");
    await researcher.execute(
      `Research the following topic and store your findings in context: "${topic}"`
    );
    console.log("Context keys after research:", contextStore.keys());

    // Step 2: Analysis
    console.log("\n--- Step 2: Analysis ---");
    await analyst.execute(
      "Retrieve the research from context, analyze it, and store your analysis."
    );
    console.log("Context keys after analysis:", contextStore.keys());

    // Step 3: Writing
    console.log("\n--- Step 3: Writing ---");
    await writer.execute(
      "Retrieve all information from context and write a comprehensive report."
    );
    console.log("Context keys after writing:", contextStore.keys());

    // Display final results
    console.log("\n=== Final Context Contents ===\n");

    const allKeys = contextStore.keys();
    for (const key of allKeys) {
      const value = contextStore.get(key);
      console.log(`\n[${key}]:`);
      if (typeof value === "string") {
        // Truncate long strings for display
        console.log(value.length > 500 ? value.substring(0, 500) + "..." : value);
      } else {
        console.log(JSON.stringify(value, null, 2));
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Alternative: Using context in a pipeline
async function pipelineExample() {
  console.log("\n\n=== Context in Pipeline Example ===\n");

  const contextStore = AgentGraph.createContextStore();
  const contextTools = AgentGraph.createContextTools(contextStore);

  // Simple agents that use context
  const agent1 = new ClaudeAgent({
    id: "agent1",
    name: "Agent 1",
    description:
      "You receive input and store it in context with key 'stage1_output'. " +
      "Also add your own observations with key 'stage1_observations'.",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-sonnet-4-20250514",
    maxTokens: 1024,
    tools: contextTools,
  });

  const agent2 = new ClaudeAgent({
    id: "agent2",
    name: "Agent 2",
    description:
      "First retrieve 'stage1_output' and 'stage1_observations' from context. " +
      "Then process them and store result with key 'stage2_output'.",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-sonnet-4-20250514",
    maxTokens: 1024,
    tools: contextTools,
  });

  // Create a sequential pipeline
  const pipeline = AgentGraph.sequential({ wrapInput: false }, agent1, agent2);

  try {
    const result = await pipeline.execute("Process this: Hello, World!");

    console.log("Pipeline result:", result.substring(0, 200));
    console.log("\nContext after pipeline:");
    console.log(contextStore.toObject());
  } catch (error) {
    console.error("Error:", error);
  }
}

// Demonstration without API calls (using the store directly)
function storeDemo() {
  console.log("\n\n=== Context Store Demo (No API) ===\n");

  const store = AgentGraph.createContextStore({
    initial_value: "hello",
  });

  // Set various types of values
  store.set("string_value", "This is a string");
  store.set("number_value", 42);
  store.set("object_value", { nested: { data: [1, 2, 3] } });
  store.set("array_value", ["a", "b", "c"]);

  console.log("All keys:", store.keys());
  console.log("Has 'string_value':", store.has("string_value"));
  console.log("Get 'object_value':", store.get("object_value"));
  console.log("Size:", store.size);

  // Delete a key
  store.delete("number_value");
  console.log("\nAfter delete 'number_value':");
  console.log("All keys:", store.keys());

  // Clone the store
  const cloned = store.clone();
  store.set("new_key", "only in original");
  console.log("\nOriginal keys:", store.keys());
  console.log("Cloned keys:", cloned.keys());

  // Export to object
  console.log("\nExport to object:", store.toObject());
}

// Run examples
storeDemo();

// Uncomment to run with actual API calls:
// main()
//   .then(() => pipelineExample())
//   .catch(console.error);
