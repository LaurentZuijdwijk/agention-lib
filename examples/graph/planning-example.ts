/**
 * Planning and Execution Example
 *
 * This example demonstrates the refactored PlanExecutor with clear separation:
 * 1. Planning Agent: Creates the execution plan
 * 2. Worker Agent: Executes individual steps
 * 3. Executor: Orchestrates the workflow and tracks progress
 *
 * Run with: npx ts-node examples/graph/planning-example.ts
 */
import "dotenv/config";

import { AgentGraph } from "../../lib/graph/AgentGraph";
import { ClaudeAgent } from "../../lib/agents/anthropic/ClaudeAgent";

async function main() {
  console.log("=== Plan-Based Execution Example ===\n");

  // Create stores for planning and context
  const planStore = AgentGraph.createPlanStore();
  const contextStore = AgentGraph.createContextStore({
    project_name: "LLM Research 2024",
  });

  // Planning Agent: Responsible ONLY for creating plans
  const planningAgent = new ClaudeAgent({
    id: "planner",
    name: "Planning Agent",
    description: `You are a planning agent. Your ONLY job is to create execution plans.

When given a task:
1. Analyze the task requirements
2. Use create_plan to create a plan with clear, actionable steps
3. Each step should be specific and focused on a single subtask
4. Order steps logically (handle dependencies first)
5. Tasks should be small and focused. Ask for concise answers

After creating the plan, confirm with: "Plan created with X steps."

Do NOT execute the steps yourself - that's the worker's job.`,
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-haiku-4-5",
    maxTokens: 4048,
    tools: AgentGraph.createPlanningTools(planStore),
  });

  // Worker Agent: Executes individual steps
  const workerAgent = new ClaudeAgent({
    id: "worker",
    name: "Worker Agent",
    description: `You are a worker agent. You execute ONE specific step at a time.

You will receive:
- The current step to execute
- Previous steps and their results
- The overall plan goal

Your job:
1. Execute ONLY the current step
2. Store important results using context_set with descriptive keys
3. Return a summary of what you accomplished

Context keys to use:
- "step_X_result" - Result of step X
- "findings" - Key findings or data
- "sources" - Sources consulted
- "analysis" - Analysis results

Be focused on the current step. Keep answers VERY concise (1-2 sentences max).`,
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-haiku-4-5",
    maxTokens: 512,
    tools: AgentGraph.createContextTools(contextStore),
  });

  // Create the executor with callbacks for visibility
  const executor = AgentGraph.planExecutor(
    planStore,
    planningAgent,
    workerAgent,
    {
      maxSteps: 3,
      concurrency: 1,
      onPlanCreated: (goal, steps) => {
        console.log(`\n📋 Plan Created: ${goal}`);
        console.log(`   Steps: ${steps.length}\n`);
        steps.forEach((step, i) => {
          console.log(`   ${i + 1}. ${step.description}`);
        });
        console.log("");
      },
      onStepStart: (step, num, total) => {
        console.log(`\n🔄 Step ${num}/${total}: ${step.description}`);
      },
      onStepComplete: (_step, result, num) => {
        const summary =
          result.length > 100 ? result.substring(0, 100) + "..." : result;
        console.log(`✅ Step ${num} Complete: ${summary}`);
      },
      onStepFailed: (_step, error, num) => {
        console.log(`❌ Step ${num} Failed: ${error.message}`);
      },
    }
  );

  try {
    // Execute a simple task
    const finalOutput = await executor.execute(
      "List 3 major programming paradigms (OOP, Functional, Procedural) " +
        "and provide one key characteristic of each. Keep it brief."
    );

    // Get detailed results
    const result = executor.getLastResult()!;

    // Display results
    console.log("\n\n=== Execution Complete ===");
    console.log(`Success: ${result.success}`);
    console.log(`Goal: ${result.goal}`);
    console.log(
      `Steps: ${result.completedSteps}/${result.totalSteps} completed`
    );
    if (result.failedSteps > 0) {
      console.log(`Failed: ${result.failedSteps}`);
    }

    console.log(`\n${result.summary}`);

    // Display the finalOutput (clean output ready for chaining to next graph node)
    console.log("\n\n=== Final Output (for graph chaining) ===");
    console.log(finalOutput);

    // Display context store contents
    console.log("\n\n=== Context Store Contents ===");
    const contextKeys = contextStore.keys();
    if (contextKeys.length === 0) {
      console.log("(empty)");
    } else {
      for (const key of contextKeys) {
        const value = contextStore.get(key);
        const displayValue =
          typeof value === "string"
            ? value.substring(0, 150) + (value.length > 150 ? "..." : "")
            : JSON.stringify(value, null, 2).substring(0, 150);
        console.log(`\n[${key}]:`);
        console.log(displayValue);
      }
    }

    // Display step-by-step results
    console.log("\n\n=== Step Results ===");
    result.stepResults.forEach((sr, i) => {
      console.log(`\n${i + 1}. ${sr.step.description}`);
      console.log(`   Status: ${sr.step.status}`);
      if (sr.result) {
        const summary =
          sr.result.length > 100
            ? sr.result.substring(0, 100) + "..."
            : sr.result;
        console.log(`   Result: ${summary}`);
      }
      if (sr.error) {
        console.log(`   Error: ${sr.error}`);
      }
    });
  } catch (error) {
    console.error("\n❌ Execution failed:", error);
  }
}

/**
 * Example using a GraphNode worker instead of an agent
 */
async function graphNodeWorkerExample() {
  console.log("\n\n=== GraphNode Worker Example ===\n");

  const planStore = AgentGraph.createPlanStore();
  const contextStore = AgentGraph.createContextStore();

  // Planning agent
  const planningAgent = new ClaudeAgent({
    id: "planner",
    name: "Planner",
    description: "Create a plan for the given task using create_plan.",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-sonnet-4-20250514",
    maxTokens: 2048,
    tools: AgentGraph.createPlanningTools(planStore),
  });

  // Worker agent
  const workerAgent = new ClaudeAgent({
    id: "worker",
    name: "Worker",
    description: "Execute the given step and store results in context.",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-sonnet-4-20250514",
    maxTokens: 2048,
    tools: AgentGraph.createContextTools(contextStore),
  });

  // Could also use a Pipeline or other GraphNode as the worker:
  // const workerPipeline = AgentGraph.pipeline([
  //   analyzeAgent,
  //   processAgent,
  //   storeAgent,
  // ]);

  const executor = AgentGraph.planExecutor(
    planStore,
    planningAgent,
    workerAgent, // Could be workerPipeline or any GraphNode
    {
      onPlanCreated: (goal, steps) => {
        console.log(`Plan: ${goal} (${steps.length} steps)`);
      },
      onStepComplete: (step, _result, num) => {
        console.log(`  ✓ Step ${num}: ${step.description}`);
      },
    }
  );

  try {
    const finalOutput = await executor.execute(
      "Analyze the components of a microservices architecture. " +
        "List: API Gateway, Service Mesh, and Container Orchestration."
    );

    const result = executor.getLastResult()!;
    console.log(
      `\n✅ Complete: ${result.completedSteps}/${result.totalSteps} steps`
    );
    console.log(`\nFinal Output:\n${finalOutput}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example using concurrent execution
 */
async function concurrentExecutionExample() {
  console.log("\n\n=== Concurrent Execution Example ===\n");

  const planStore = AgentGraph.createPlanStore();
  const contextStore = AgentGraph.createContextStore();

  // Planning agent
  const planningAgent = new ClaudeAgent({
    id: "concurrent-planner",
    name: "Concurrent Planner",
    description: `Create a plan with independent steps that can run in parallel.

When given a task, break it into independent subtasks that don't depend on each other.
Use create_plan to create the plan.`,
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-haiku-4-5",
    maxTokens: 4048,
    tools: AgentGraph.createPlanningTools(planStore),
  });

  // Worker agent
  const workerAgent = new ClaudeAgent({
    id: "concurrent-worker",
    name: "Concurrent Worker",
    description: "Execute a single step independently and store results.",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-haiku-4-5",
    maxTokens: 4048,
    tools: AgentGraph.createContextTools(contextStore),
  });

  const executor = AgentGraph.planExecutor(
    planStore,
    planningAgent,
    workerAgent,
    {
      maxSteps: 20,
      concurrency: 3, // Run up to 3 steps concurrently
      onPlanCreated: (goal, steps) => {
        console.log(`📋 Plan: ${goal}`);
        console.log(`   Steps: ${steps.length}`);
        console.log(`   Concurrency: 3 (up to 3 steps run in parallel)\n`);
      },
      onStepStart: (step, num, total) => {
        console.log(`🚀 [${num}/${total}] Starting: ${step.description}`);
      },
      onStepComplete: (_step, _result, num) => {
        console.log(`✅ [${num}] Completed`);
      },
      onStepFailed: (_step, error, num) => {
        console.log(`❌ [${num}] Failed: ${error.message}`);
      },
    }
  );

  try {
    const startTime = Date.now();

    const finalOutput = await executor.execute(
      "Research three different programming languages: Python, Rust, and Go. " +
        "For each language, summarize its main use cases and key features. " +
        "These research tasks are independent and can be done in parallel."
    );

    const result = executor.getLastResult()!;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n\n⏱️  Total time: ${duration}s`);
    console.log(`✅ Success: ${result.success}`);
    console.log(
      `📊 Steps: ${result.completedSteps}/${result.totalSteps} completed`
    );
    if (result.failedSteps > 0) {
      console.log(`❌ Failed: ${result.failedSteps}`);
    }

    console.log(`\nFinal Output:\n${finalOutput}`);

    console.log(
      "\n💡 Note: With concurrency=3, independent steps ran in parallel,"
    );
    console.log(
      "    reducing total execution time compared to sequential execution."
    );
  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

/**
 * Example showing PlanExecutor chained in a pipeline
 */
async function pipelineChainExample() {
  console.log("\n\n=== Pipeline Chain Example ===\n");

  const planStore = AgentGraph.createPlanStore();
  const contextStore = AgentGraph.createContextStore();

  // Step 1: Planning executor that generates research
  const planner = new ClaudeAgent({
    id: "research-planner",
    name: "Research Planner",
    description: "Create and execute a research plan. Keep output concise.",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-haiku-4-5",
    maxTokens: 1024,
    tools: AgentGraph.createPlanningTools(planStore),
  });

  const worker = new ClaudeAgent({
    id: "research-worker",
    name: "Research Worker",
    description: "Execute research steps. Keep responses to 1-2 sentences.",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-haiku-4-5",
    maxTokens: 512,
    tools: AgentGraph.createContextTools(contextStore),
  });

  const planExecutor = AgentGraph.planExecutor(planStore, planner, worker, {
    maxSteps: 3,
  });

  // Step 2: Summarizer agent that processes the plan output
  const summarizer = new ClaudeAgent({
    id: "summarizer",
    name: "Summarizer",
    description: "Create a summary from the provided results.",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-haiku-4-5",
    maxTokens: 256,
  });

  // Create a sequential chain: PlanExecutor → Summarizer
  // Note: We need to wrap PlanExecutor since sequential expects BaseAgent
  // For true pipeline chaining, PlanExecutor can be used standalone and its
  // finalOutput can be passed to the next node manually
  const pipeline = AgentGraph.pipeline(
    planExecutor,
    AgentGraph.sequential(summarizer)
  );

  try {
    console.log("Pipeline: [PlanExecutor] → [Summarizer]\n");

    const result = await pipeline.execute(
      "List 3 benefits of TypeScript. Keep each benefit to one sentence."
    );

    console.log("\n=== Pipeline Result ===");
    console.log(result);
    console.log(
      "\n💡 The PlanExecutor's finalOutput was automatically passed to the Summarizer!"
    );
  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

// Run examples
main()
  .then(() => graphNodeWorkerExample())
  .then(() => concurrentExecutionExample())
  .then(() => pipelineChainExample())
  .catch(console.error);
