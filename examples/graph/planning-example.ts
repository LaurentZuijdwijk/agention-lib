/**
 * Planning and Context Example
 *
 * This example demonstrates how to use planning tools and shared context
 * to create an agent that can:
 * 1. Create an execution plan with steps
 * 2. Work through each step sequentially
 * 3. Store intermediate results in shared context
 * 4. Loop until all steps are completed
 *
 * Run with: npx ts-node examples/graph/planning-example.ts
 */

import { AgentGraph } from "../../lib/graph/AgentGraph";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";

async function main() {
  // Create stores for context and planning
  const contextStore = AgentGraph.createContextStore({
    // Initial context values (optional)
    project_name: "AI Research Summary",
  });

  const planStore = AgentGraph.createPlanStore();

  // Create an agent with both context and planning tools
  const researchAgent = new ClaudeAgent({
    id: "research-agent",
    name: "Research Agent",
    description: `You are a research agent that creates and executes research plans.

Your workflow:
1. First, use create_plan to create a plan with clear steps
2. Use get_next_step to get the next pending step
3. Execute the step (do the research/analysis)
4. Store important findings using context_set with descriptive keys
5. Mark the step complete using update_step
6. Repeat until all steps are done

Available context keys you should use:
- "research_findings" - Main research results
- "key_points" - Bullet points of important information
- "sources" - List of sources consulted
- "final_summary" - The final summary

Always store your work in context so it persists between steps.`,
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
    tools: [
      ...AgentGraph.createContextTools(contextStore),
      ...AgentGraph.createPlanningTools(planStore),
    ],
  });

  // Create a plan executor that loops until all steps are done
  const executor = AgentGraph.planExecutor(planStore, [researchAgent], {
    maxIterations: 10,
    maxTotalSteps: 20,
    onIterationStart: (iteration, pendingSteps) => {
      console.log(`\n--- Iteration ${iteration} (${pendingSteps} steps pending) ---`);
    },
    onStepComplete: (step, _result, iteration) => {
      console.log(`  [Iteration ${iteration}] Completed: ${step.description}`);
    },
  });

  console.log("Starting research task...\n");

  try {
    // Execute the research task
    const result = await executor.execute(
      "Research the current state of large language models (LLMs) in 2024. " +
        "Focus on: major models, key capabilities, and limitations. " +
        "Create a comprehensive summary."
    );

    // Parse and display the result
    const parsedResult = JSON.parse(result);
    console.log("\n=== Execution Complete ===");
    console.log(`Success: ${parsedResult.success}`);
    console.log(`Iterations: ${parsedResult.iterations}`);
    console.log(`Total Steps Executed: ${parsedResult.totalStepsExecuted}`);
    console.log(`\nPlan Summary:\n${parsedResult.summary}`);

    // Display what's stored in context
    console.log("\n=== Context Store Contents ===");
    const contextKeys = contextStore.keys();
    for (const key of contextKeys) {
      const value = contextStore.get(key);
      const displayValue =
        typeof value === "string"
          ? value.substring(0, 200) + (value.length > 200 ? "..." : "")
          : JSON.stringify(value, null, 2).substring(0, 200);
      console.log(`\n[${key}]:`);
      console.log(displayValue);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Alternative: Manual execution without PlanExecutor
async function manualExample() {
  console.log("\n\n=== Manual Planning Example ===\n");

  const contextStore = AgentGraph.createContextStore();
  const planStore = AgentGraph.createPlanStore();

  // Manually create a plan
  const plan = planStore.createPlan("Analyze a code repository", [
    "Clone and explore the repository structure",
    "Identify main components and dependencies",
    "Analyze code quality and patterns",
    "Write a summary report",
  ]);

  console.log("Created plan:", plan.goal);
  console.log("Steps:");
  plan.steps.forEach((step) => {
    console.log(`  - [${step.id}] ${step.description}`);
  });

  // Simulate working through steps
  let nextStep = planStore.getNextStep();
  while (nextStep) {
    console.log(`\nWorking on: ${nextStep.description}`);

    // Simulate doing work and storing results
    contextStore.set(`result_${nextStep.id}`, {
      completed: true,
      findings: `Findings for ${nextStep.description}`,
    });

    // Mark step complete
    planStore.updateStep(nextStep.id, "completed", "Step completed successfully");

    // Get next step
    nextStep = planStore.getNextStep();
  }

  console.log("\nFinal plan status:");
  console.log(planStore.getSummary());

  console.log("\nContext contents:");
  console.log(contextStore.toObject());
}

// Run the examples
main()
  .then(() => manualExample())
  .catch(console.error);
