import { BaseAgent } from "../../agents/BaseAgent";
import { BaseExecutor, MetricsTokenUsage, GraphNode } from "../BaseExecutor";
import { MetricsCollector } from "../GraphMetrics";
import { PlanStore } from "./PlanStore";
import { PlanStep } from "./types";

/**
 * Options for PlanExecutor
 */
export interface PlanExecutorOptions {
  /**
   * Maximum number of steps to execute.
   * @default 50
   */
  maxSteps?: number;

  /**
   * Maximum number of steps to execute concurrently.
   * Set to 1 for sequential execution (default).
   * Set to higher values to execute independent steps in parallel.
   * @default 1
   */
  concurrency?: number;

  /**
   * Whether to stop execution when a step fails.
   * @default true
   */
  stopOnFailure?: boolean;

  /**
   * Callback invoked when planning phase completes.
   */
  onPlanCreated?: (goal: string, steps: PlanStep[]) => void;

  /**
   * Callback invoked before each step starts.
   */
  onStepStart?: (
    step: PlanStep,
    stepNumber: number,
    totalSteps: number
  ) => void;

  /**
   * Callback invoked after each step completes.
   */
  onStepComplete?: (step: PlanStep, result: string, stepNumber: number) => void;

  /**
   * Callback invoked when a step fails.
   */
  onStepFailed?: (step: PlanStep, error: Error, stepNumber: number) => void;
}

/**
 * Result of a plan execution.
 */
export interface PlanExecutionResult {
  success: boolean;
  goal: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  summary: string;
  /**
   * Clean, consolidated output for chaining to next graph node.
   * Contains a rollup of all step results in a format ready for downstream processing.
   */
  finalOutput: string;
  /**
   * Detailed results for each step (useful for debugging/inspection).
   */
  stepResults: Array<{
    step: PlanStep;
    result?: string;
    error?: string;
  }>;
}

/**
 * Orchestrates plan-based execution with clear separation of concerns:
 * 1. Planning Phase: Uses a planning agent to create a plan
 * 2. Execution Phase: Assigns workers (agents or graph nodes) to execute each step
 * 3. Completion: Compiles results and returns summary
 *
 * The PlanExecutor acts as the orchestrator, tracking progress and delegating
 * work to specialized workers. Planning and execution are separate phases.
 *
 * @example
 * ```typescript
 * const planStore = AgentGraph.createPlanStore();
 * const contextStore = AgentGraph.createContextStore();
 *
 * // Planning agent creates the plan
 * const planner = new ClaudeAgent({
 *   tools: AgentGraph.createPlanningTools(planStore),
 *   description: 'You are a planning agent. Create a detailed plan with clear steps.',
 * });
 *
 * // Worker agent executes individual steps
 * const worker = new ClaudeAgent({
 *   tools: AgentGraph.createContextTools(contextStore),
 *   description: 'You execute a single step. Store results in context.',
 * });
 *
 * const executor = new PlanExecutor(planStore, planner, worker, {
 *   onStepComplete: (step, result, num) => {
 *     console.log(`Completed step ${num}: ${step.description}`);
 *   },
 * });
 *
 * const result = await executor.execute('Research and summarize quantum computing');
 * ```
 */
export class PlanExecutor extends BaseExecutor<string, string> {
  private planningAgent: BaseAgent;
  private worker: GraphNode<string, string> | BaseAgent;
  private lastResult?: PlanExecutionResult;
  private options: Required<
    Pick<PlanExecutorOptions, "maxSteps" | "stopOnFailure" | "concurrency">
  > &
    PlanExecutorOptions;

  /**
   * Create a new PlanExecutor.
   *
   * @param planStore - The plan store to track plan state
   * @param planningAgent - Agent responsible for creating the plan
   * @param worker - Agent or GraphNode that executes individual steps
   * @param options - Configuration options
   */
  constructor(
    private planStore: PlanStore,
    planningAgent: BaseAgent,
    worker: GraphNode<string, string> | BaseAgent,
    options: PlanExecutorOptions = {}
  ) {
    super();
    this.name = "PlanExecutor";
    this.nodeType = "pipeline";
    this.planningAgent = planningAgent;
    this.worker = worker;
    this.options = {
      maxSteps: options.maxSteps ?? 50,
      concurrency: options.concurrency ?? 1,
      stopOnFailure: options.stopOnFailure ?? true,
      onPlanCreated: options.onPlanCreated,
      onStepStart: options.onStepStart,
      onStepComplete: options.onStepComplete,
      onStepFailed: options.onStepFailed,
    };
  }

  /**
   * Execute the plan:
   * 1. Planning Phase: Ask planning agent to create a plan
   * 2. Execution Phase: Execute each step with the worker
   * 3. Completion: Return finalOutput (for chaining)
   *
   * Returns the finalOutput string for easy chaining in pipelines.
   * Use getLastResult() to access the full PlanExecutionResult with details.
   */
  async execute(input: string): Promise<string> {
    const collector = this.getCollector();
    const execId = collector?.startExecution(this.name, "pipeline", input);

    try {
      // Phase 1: Planning
      await this.planningPhase(input, collector);

      // Phase 2: Execution
      const stepResults = await this.executionPhase(collector);

      // Phase 3: Compile results
      const result = this.compileResult(stepResults);

      // Store for getLastResult()
      this.lastResult = result;

      if (execId) {
        collector?.endExecution(execId, result.success, result.finalOutput);
      }

      // Return finalOutput for chaining
      return result.finalOutput;
    } catch (error) {
      if (execId) {
        collector?.endExecution(
          execId,
          false,
          undefined,
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
      throw error;
    }
  }

  /**
   * Get the detailed result from the last execution.
   * Contains full plan details, step results, and metadata.
   */
  getLastResult(): PlanExecutionResult | undefined {
    return this.lastResult;
  }

  /**
   * Phase 1: Planning
   * Instructs the planning agent to create a plan based on the task.
   */
  private async planningPhase(
    task: string,
    collector?: MetricsCollector
  ): Promise<void> {
    const planExecId = collector?.startExecution(
      "Planning Phase",
      "agent",
      task
    );

    try {
      const planningPrompt = this.createPlanningPrompt(task);
      const planningResult = (await this.planningAgent.execute(
        planningPrompt
      )) as string;

      // Extract token usage
      const tokenUsage = this.extractTokenUsage(this.planningAgent);
      if (planExecId) {
        collector?.endExecution(planExecId, true, planningResult, tokenUsage);
      }

      // Verify plan was created
      const plan = this.planStore.getActivePlan();
      if (!plan || plan.steps.length === 0) {
        throw new Error(
          "Planning agent failed to create a plan. Please ensure the agent has planning tools."
        );
      }

      // Enforce maxSteps limit
      if (plan.steps.length > this.options.maxSteps) {
        throw new Error(
          `Planning agent created ${plan.steps.length} steps, which exceeds the maximum of ${this.options.maxSteps}. ` +
            `Please reduce the plan size or increase maxSteps option.`
        );
      }

      // Notify plan creation
      this.options.onPlanCreated?.(plan.goal, plan.steps);
    } catch (error) {
      if (planExecId) {
        collector?.endExecution(
          planExecId,
          false,
          undefined,
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
      throw error;
    }
  }

  /**
   * Phase 2: Execution
   * Executes each step in the plan using the worker.
   */
  private async executionPhase(collector?: MetricsCollector): Promise<
    Array<{
      step: PlanStep;
      result?: string;
      error?: string;
    }>
  > {
    const plan = this.planStore.getActivePlan();
    if (!plan) {
      throw new Error("No active plan found");
    }

    const results: Array<{
      step: PlanStep;
      result?: string;
      error?: string;
    }> = [];

    let stepNumber = 0;
    const activePromises = new Map<string, Promise<void>>();

    while (stepNumber < this.options.maxSteps) {
      // Wait if we've reached concurrency limit
      if (activePromises.size >= this.options.concurrency) {
        await Promise.race(activePromises.values());
      }

      const nextStep = this.planStore.getNextStep();
      if (!nextStep) {
        // No more pending steps
        break;
      }

      stepNumber++;

      // Notify step start
      this.options.onStepStart?.(nextStep, stepNumber, plan.steps.length);

      // Mark step as in_progress
      this.planStore.updateStep(nextStep.id, "in_progress");

      const stepExecId = collector?.startExecution(
        `Step ${stepNumber}: ${nextStep.description}`,
        this.isAgent(this.worker) ? "agent" : "custom",
        nextStep.description
      );

      // Wrap step execution in an async function
      const executeStep = async (): Promise<void> => {
        try {
          // Execute the step with the worker
          const stepInput = this.createStepInput(nextStep, stepNumber);
          const rawResult = await this.worker.execute(stepInput);
          const stepResult = String(rawResult);

          // Extract token usage if worker is an agent
          const tokenUsage = this.isAgent(this.worker)
            ? this.extractTokenUsage(this.worker)
            : undefined;

          if (stepExecId) {
            collector?.endExecution(stepExecId, true, stepResult, tokenUsage);
          }

          // Mark step as completed
          this.planStore.updateStep(nextStep.id, "completed", stepResult);

          results.push({
            step: nextStep,
            result: stepResult,
          });

          // Notify step completion
          this.options.onStepComplete?.(nextStep, stepResult, stepNumber);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          if (stepExecId) {
            collector?.endExecution(
              stepExecId,
              false,
              undefined,
              undefined,
              errorMessage
            );
          }

          // Mark step as failed
          this.planStore.updateStep(nextStep.id, "failed", errorMessage);

          results.push({
            step: nextStep,
            error: errorMessage,
          });

          // Notify step failure
          this.options.onStepFailed?.(
            nextStep,
            error instanceof Error ? error : new Error(errorMessage),
            stepNumber
          );

          // Stop if configured to do so
          if (this.options.stopOnFailure) {
            throw new Error(`Step ${stepNumber} failed: ${errorMessage}`);
          }
        } finally {
          // Remove from active promises when complete
          activePromises.delete(nextStep.id);
        }
      };

      // Store the promise in activePromises
      const promise = executeStep();
      activePromises.set(nextStep.id, promise);

      // For sequential execution (concurrency=1), await immediately
      if (this.options.concurrency === 1) {
        await promise;
      }
    }

    // Wait for all remaining promises to complete
    if (activePromises.size > 0) {
      await Promise.all(activePromises.values());
    }

    if (stepNumber >= this.options.maxSteps) {
      const plan = this.planStore.getActivePlan();
      const remainingSteps = plan?.steps.filter(
        (s) => s.status === "pending"
      ).length;
      if (remainingSteps && remainingSteps > 0) {
        throw new Error(
          `Maximum steps (${this.options.maxSteps}) reached with ${remainingSteps} steps remaining`
        );
      }
    }

    return results;
  }

  /**
   * Create a prompt for the planning agent.
   */
  private createPlanningPrompt(task: string): string {
    return `You are a planning agent. Your job is to create a detailed execution plan for the following task.

Task: ${task}

IMPORTANT: You can create a maximum of ${this.options.maxSteps} steps. Plan accordingly and prioritize the most important subtasks.

Use the create_plan tool to create a plan with clear, actionable steps. Each step should be:
- Specific and focused on a single subtask
- Ordered logically (dependencies should be addressed)
- Achievable by a worker agent

After creating the plan, respond with a brief confirmation.`;
  }

  /**
   * Create input for a step execution.
   */
  private createStepInput(step: PlanStep, stepNumber: number): string {
    const plan = this.planStore.getActivePlan();
    const completedSteps =
      plan?.steps.filter((s) => s.status === "completed") || [];

    return JSON.stringify({
      stepNumber,
      totalSteps: plan?.steps.length,
      currentStep: {
        id: step.id,
        description: step.description,
      },
      previousSteps: completedSteps.map((s) => ({
        description: s.description,
        output: s.output,
      })),
      planGoal: plan?.goal,
    });
  }

  /**
   * Compile the final result from step results.
   */
  private compileResult(
    stepResults: Array<{
      step: PlanStep;
      result?: string;
      error?: string;
    }>
  ): PlanExecutionResult {
    const plan = this.planStore.getActivePlan();
    if (!plan) {
      throw new Error("No active plan found");
    }

    const completedSteps = stepResults.filter((r) => r.result).length;
    const failedSteps = stepResults.filter((r) => r.error).length;

    // Create consolidated output for chaining
    const finalOutput = this.createFinalOutput(plan.goal, stepResults);

    return {
      success: plan.status === "completed",
      goal: plan.goal,
      totalSteps: plan.steps.length,
      completedSteps,
      failedSteps,
      summary: this.planStore.getSummary(),
      finalOutput,
      stepResults,
    };
  }

  /**
   * Create a clean, consolidated output from all step results.
   * This output is designed for chaining to the next graph node.
   */
  private createFinalOutput(
    goal: string,
    stepResults: Array<{
      step: PlanStep;
      result?: string;
      error?: string;
    }>
  ): string {
    const completedResults = stepResults
      .filter((r) => r.result)
      .map((r) => r.result)
      .join("\n\n");

    // If there are any failures, include them
    const failures = stepResults.filter((r) => r.error);
    const failureText =
      failures.length > 0
        ? `\n\nFailed steps (${failures.length}):\n${failures
            .map((f) => `- ${f.step.description}: ${f.error}`)
            .join("\n")}`
        : "";

    return `Goal: ${goal}\n\nResults:\n${completedResults}${failureText}`;
  }

  /**
   * Check if a worker is a BaseAgent.
   */
  private isAgent(worker: GraphNode | BaseAgent): worker is BaseAgent {
    return "getName" in worker;
  }

  /**
   * Extract token usage from an agent if available.
   */
  private extractTokenUsage(agent: BaseAgent): MetricsTokenUsage | undefined {
    const agentWithUsage = agent as BaseAgent & {
      lastTokenUsage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
    };

    if (!agentWithUsage.lastTokenUsage) return undefined;

    return {
      inputTokens: agentWithUsage.lastTokenUsage.input_tokens,
      outputTokens: agentWithUsage.lastTokenUsage.output_tokens,
      totalTokens: agentWithUsage.lastTokenUsage.total_tokens,
    };
  }

  /**
   * Get the plan store.
   */
  getPlanStore(): PlanStore {
    return this.planStore;
  }
}
