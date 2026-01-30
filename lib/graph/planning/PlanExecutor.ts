import { BaseAgent } from "../../agents/BaseAgent";
import { BaseExecutor, MetricsTokenUsage } from "../BaseExecutor";
import { PlanStore } from "./PlanStore";
import { PlanStep } from "./types";

/**
 * Options for PlanExecutor
 */
export interface PlanExecutorOptions {
  /**
   * Maximum number of iterations (loops through the pipeline) to prevent infinite loops.
   * @default 10
   */
  maxIterations?: number;

  /**
   * Maximum total steps to execute across all iterations.
   * @default 50
   */
  maxTotalSteps?: number;

  /**
   * Whether to stop execution when a step fails.
   * @default true
   */
  stopOnFailure?: boolean;

  /**
   * Callback invoked after each step completes.
   */
  onStepComplete?: (step: PlanStep, result: string, iteration: number) => void;

  /**
   * Callback invoked at the start of each iteration.
   */
  onIterationStart?: (iteration: number, pendingSteps: number) => void;
}

/**
 * Executes a pipeline of agents in a loop until all plan steps are completed.
 *
 * The PlanExecutor runs agents sequentially, then checks if there are still
 * pending steps in the plan. If so, it loops back and runs the pipeline again.
 * This enables agents to dynamically add steps during execution.
 *
 * @example
 * ```typescript
 * const planStore = AgentGraph.createPlanStore();
 *
 * // Agent with planning tools can create and modify plans
 * const planner = new ClaudeAgent({
 *   tools: AgentGraph.createPlanningTools(planStore),
 *   description: 'Create a plan, then work through each step. Add more steps if needed.',
 * });
 *
 * const executor = new PlanExecutor(planStore, [planner], {
 *   maxIterations: 5,
 * });
 *
 * const result = await executor.execute('Research and summarize quantum computing');
 * ```
 */
export class PlanExecutor extends BaseExecutor<string, string> {
  private agents: BaseAgent[];
  private options: Required<
    Pick<
      PlanExecutorOptions,
      "maxIterations" | "maxTotalSteps" | "stopOnFailure"
    >
  > &
    PlanExecutorOptions;

  constructor(
    private planStore: PlanStore,
    agents: BaseAgent[],
    options: PlanExecutorOptions = {}
  ) {
    super();
    this.name = "PlanExecutor";
    this.nodeType = "pipeline";
    this.agents = agents;
    this.options = {
      maxIterations: options.maxIterations ?? 10,
      maxTotalSteps: options.maxTotalSteps ?? 50,
      stopOnFailure: options.stopOnFailure ?? true,
      onStepComplete: options.onStepComplete,
      onIterationStart: options.onIterationStart,
    };
  }

  /**
   * Execute the plan by running agents in a loop until no pending steps remain.
   */
  async execute(input: string): Promise<string> {
    const collector = this.getCollector();
    const execId = collector?.startExecution(this.name, "pipeline", input);

    let iteration = 0;
    let totalStepsExecuted = 0;
    let lastResult = input;
    const allResults: string[] = [];

    try {
      while (iteration < this.options.maxIterations) {
        // Check for pending steps before incrementing iteration
        const pendingStep = this.planStore.getNextStep();
        if (!pendingStep) {
          // No more pending steps - we're done
          break;
        }

        iteration++;

        // Callback for iteration start
        const plan = this.planStore.getActivePlan();
        const pendingCount =
          plan?.steps.filter((s) => s.status === "pending").length ?? 0;
        this.options.onIterationStart?.(iteration, pendingCount);

        // Track iteration
        const iterExecId = collector?.startExecution(
          `Iteration ${iteration}`,
          "sequential",
          lastResult
        );

        try {
          // Run all agents in sequence
          for (let i = 0; i < this.agents.length; i++) {
            const agent = this.agents[i];
            const agentName = agent.getName?.() ?? `Agent ${i + 1}`;

            // Check step limits
            if (totalStepsExecuted >= this.options.maxTotalSteps) {
              throw new Error(
                `Maximum total steps (${this.options.maxTotalSteps}) exceeded`
              );
            }

            const agentExecId = collector?.startExecution(
              agentName,
              "agent",
              lastResult
            );

            try {
              // Prepare input with plan context
              const agentInput = this.prepareAgentInput(lastResult, iteration);
              lastResult = (await agent.execute(agentInput)) as string;

              // Extract token usage
              const tokenUsage = this.extractTokenUsage(agent);
              if (agentExecId) {
                collector?.endExecution(
                  agentExecId,
                  true,
                  lastResult,
                  tokenUsage
                );
              }

              totalStepsExecuted++;

              // Check if any steps were completed and notify
              this.checkAndNotifyCompletedSteps(iteration);
            } catch (error) {
              if (agentExecId) {
                collector?.endExecution(
                  agentExecId,
                  false,
                  undefined,
                  undefined,
                  error instanceof Error ? error.message : String(error)
                );
              }

              if (this.options.stopOnFailure) {
                throw error;
              }
            }
          }

          allResults.push(lastResult);

          if (iterExecId) {
            collector?.endExecution(iterExecId, true, lastResult);
          }
        } catch (error) {
          if (iterExecId) {
            collector?.endExecution(
              iterExecId,
              false,
              undefined,
              undefined,
              error instanceof Error ? error.message : String(error)
            );
          }
          throw error;
        }
      }

      // Compile final result
      const finalResult = this.compileFinalResult(
        allResults,
        iteration,
        totalStepsExecuted
      );

      if (execId) {
        collector?.endExecution(execId, true, finalResult);
      }

      return finalResult;
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
   * Prepare input for an agent, including plan context.
   */
  private prepareAgentInput(input: string, iteration: number): string {
    const plan = this.planStore.getActivePlan();
    if (!plan) {
      return input;
    }

    const context = {
      input,
      iteration,
      plan: {
        goal: plan.goal,
        status: plan.status,
        summary: this.planStore.getSummary(),
      },
    };

    return JSON.stringify(context);
  }

  /**
   * Check for completed steps and invoke callback.
   */
  private checkAndNotifyCompletedSteps(iteration: number): void {
    if (!this.options.onStepComplete) return;

    const plan = this.planStore.getActivePlan();
    if (!plan) return;

    // Find recently completed steps (those with output but no notification yet)
    for (const step of plan.steps) {
      if (step.status === "completed" && step.output) {
        this.options.onStepComplete(step, step.output, iteration);
      }
    }
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
   * Compile the final result from all iterations.
   */
  private compileFinalResult(
    results: string[],
    iterations: number,
    totalSteps: number
  ): string {
    const plan = this.planStore.getActivePlan();

    return JSON.stringify({
      success: plan?.status === "completed",
      iterations,
      totalStepsExecuted: totalSteps,
      plan: plan
        ? {
            goal: plan.goal,
            status: plan.status,
            completedSteps: plan.steps.filter((s) => s.status === "completed")
              .length,
            totalSteps: plan.steps.length,
          }
        : null,
      summary: this.planStore.getSummary(),
      lastResult: results[results.length - 1],
    });
  }

  /**
   * Get the plan store.
   */
  getPlanStore(): PlanStore {
    return this.planStore;
  }
}
