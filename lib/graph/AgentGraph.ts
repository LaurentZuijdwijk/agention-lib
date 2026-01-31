import { BaseAgent } from "../agents/BaseAgent";
import { Tool } from "../tools/Tool";
import { GraphNode } from "./BaseExecutor";
import { MapExecutor, MapExecutorOptions } from "./MapExecutor";
import { ParallelExecutor, ParallelExecutorOptions } from "./ParallelExecutor";
import { Pipeline } from "./Pipeline";
import { RouterExecutor, RouterExecutorOptions, Route } from "./RouterExecutor";
import {
  SequentialExecutor,
  SequentialExecutorOptions,
} from "./SequentialExecutor";
import { VotingSystem, VotingSystemOptions } from "./VotingSystem";
import {
  ContextStore,
  createContextGetTool,
  createContextSetTool,
  createContextListTool,
  createContextDeleteTool,
} from "./context";
import {
  PlanStore,
  createPlanTool,
  createViewPlanTool,
  createUpdateStepTool,
  createGetNextStepTool,
  createAddStepTool,
  PlanExecutor,
  PlanExecutorOptions,
} from "./planning";

// Re-export types for convenience
export { GraphNode } from "./BaseExecutor";
export {
  SequentialExecutor,
  SequentialExecutorOptions,
} from "./SequentialExecutor";
export { ParallelExecutor, ParallelExecutorOptions } from "./ParallelExecutor";
export { Pipeline } from "./Pipeline";
export { MapExecutor, MapExecutorOptions } from "./MapExecutor";
export { VotingSystem, VotingSystemOptions, VotingInput } from "./VotingSystem";
export { RouterExecutor, RouterExecutorOptions, Route } from "./RouterExecutor";
export {
  BaseExecutor,
  PipelineContext,
  ContextualInput,
  NodeInput,
  NodeOutput,
  MetricsCollector,
  NodeExecutionMetrics,
  MetricsTokenUsage,
  GraphNodeType,
} from "./BaseExecutor";
export {
  PipelineMetrics,
  PipelineStructure,
  getMetricsCollector,
  setMetricsCollector,
  createMetricsCollector,
} from "./GraphMetrics";

// Context exports
export {
  ContextStore,
  createContextGetTool,
  createContextSetTool,
  createContextListTool,
  createContextDeleteTool,
} from "./context";

// Planning exports
export {
  Plan,
  PlanStep,
  PlanStepStatus,
  PlanStatus,
  PlanStore,
  createPlanTool,
  createViewPlanTool,
  createUpdateStepTool,
  createGetNextStepTool,
  createAddStepTool,
  PlanExecutor,
  PlanExecutorOptions,
} from "./planning";

/**
 * Factory class for building agent graphs and workflows.
 * Provides static methods to create various execution patterns.
 *
 * @example
 * ```typescript
 * // Simple sequential workflow
 * const workflow = AgentGraph.sequential(researchAgent, summaryAgent);
 *
 * // Parallel experts with voting
 * const pipeline = AgentGraph.pipeline(
 *   AgentGraph.parallel({}, expertA, expertB, expertC),
 *   { execute: async (results) => ({ originalInput: query, solutions: results }) },
 *   AgentGraph.votingSystem(judgeAgent)
 * );
 * ```
 */
export class AgentGraph {
  /**
   * Creates a sequential executor that chains agents together.
   * Output of each agent becomes input to the next.
   *
   * @param agents - Agents to execute in sequence
   * @returns SequentialExecutor instance
   */
  static sequential(...agents: BaseAgent[]): SequentialExecutor;
  static sequential(
    options: SequentialExecutorOptions,
    ...agents: BaseAgent[]
  ): SequentialExecutor;
  static sequential(
    ...args: [...BaseAgent[]] | [SequentialExecutorOptions, ...BaseAgent[]]
  ): SequentialExecutor {
    return new SequentialExecutor(...args);
  }

  /**
   * Creates a parallel executor that runs agents concurrently.
   * All agents receive the same input and results are collected.
   *
   * @param options - Configuration options
   * @param agents - Agents to execute in parallel
   * @returns ParallelExecutor instance
   */
  static parallel(
    options: ParallelExecutorOptions = {},
    ...agents: BaseAgent[]
  ): ParallelExecutor {
    return new ParallelExecutor(options, ...agents);
  }

  /**
   * Creates a voting system with a judge agent.
   * Used to select or synthesize the best answer from multiple solutions.
   *
   * @param judge - Agent that will evaluate and select the best answer
   * @param options - Configuration options
   * @returns VotingSystem instance
   */
  static votingSystem(
    judge: BaseAgent,
    options: VotingSystemOptions = {}
  ): VotingSystem {
    return new VotingSystem(judge, options);
  }

  /**
   * Creates a map executor that applies a processor to each item in an array.
   *
   * @param processor - GraphNode to apply to each item
   * @param options - Configuration options
   * @returns MapExecutor instance
   */
  static map<TItem = string, TResult = string>(
    processor: GraphNode<TItem, TResult>,
    options: MapExecutorOptions = {}
  ): MapExecutor<TItem, TResult> {
    return new MapExecutor(processor, options);
  }

  /**
   * Creates a pipeline that chains multiple graph nodes together.
   * Output of each stage becomes input to the next.
   *
   * @param stages - GraphNodes to execute in sequence
   * @returns Pipeline instance
   */
  static pipeline<TInput = unknown, TOutput = unknown>(
    ...stages: GraphNode<unknown, unknown>[]
  ): Pipeline<TInput, TOutput> {
    return new Pipeline<TInput, TOutput>(...stages);
  }

  /**
   * Creates a router executor that routes input to one of several handlers.
   * A router agent analyzes the input and selects the most appropriate route.
   *
   * @param router - Agent that decides which route to select
   * @param routes - Array of available routes with names, descriptions, and handlers
   * @param options - Configuration options
   * @returns RouterExecutor instance
   *
   * @example
   * ```typescript
   * const router = AgentGraph.router(routerAgent, [
   *   { name: "technical", description: "Technical questions", handler: techAgent },
   *   { name: "general", description: "General questions", handler: generalAgent },
   * ]);
   * const result = await router.execute("How do I fix this bug?");
   * ```
   */
  static router(
    router: BaseAgent,
    routes: Route[],
    options: RouterExecutorOptions = {}
  ): RouterExecutor {
    return new RouterExecutor(router, routes, options);
  }

  /**
   * Creates a shared context store for passing data between agents.
   *
   * @param initial - Optional initial key-value pairs
   * @returns ContextStore instance
   *
   * @example
   * ```typescript
   * const context = AgentGraph.createContextStore({ userId: '123' });
   * const tools = AgentGraph.createContextTools(context);
   * const agent = Agent.create({ ..., tools });
   * ```
   */
  static createContextStore(initial?: Record<string, unknown>): ContextStore {
    return new ContextStore(initial);
  }

  /**
   * Creates context tools for an agent to read/write shared context.
   * Includes: context_get, context_set, list_context_keys, context_delete
   *
   * @param store - The ContextStore to interact with
   * @returns Array of context tools
   */
  static createContextTools(store: ContextStore): Tool<string>[] {
    return [
      createContextGetTool(store),
      createContextSetTool(store),
      createContextListTool(store),
      createContextDeleteTool(store),
    ];
  }

  /**
   * Creates a plan store for managing execution plans.
   *
   * @returns PlanStore instance
   *
   * @example
   * ```typescript
   * const planStore = AgentGraph.createPlanStore();
   * const tools = AgentGraph.createPlanningTools(planStore);
   * const agent = Agent.create({ ..., tools });
   * ```
   */
  static createPlanStore(): PlanStore {
    return new PlanStore();
  }

  /**
   * Creates planning tools for an agent to create and manage plans.
   * Includes: create_plan, view_plan, update_step, get_next_step, add_step
   *
   * @param store - The PlanStore to interact with
   * @returns Array of planning tools
   */
  static createPlanningTools(store: PlanStore): Tool<string>[] {
    return [
      createPlanTool(store),
      createViewPlanTool(store),
      createUpdateStepTool(store),
      createGetNextStepTool(store),
      createAddStepTool(store),
    ];
  }

  /**
   * Creates a plan executor with separation of planning and execution.
   *
   * @param planStore - The PlanStore to track plan progress
   * @param planningAgent - Agent responsible for creating the plan
   * @param worker - Agent or GraphNode that executes individual steps
   * @param options - Configuration options
   * @returns PlanExecutor instance
   *
   * @example
   * ```typescript
   * const planStore = AgentGraph.createPlanStore();
   * const contextStore = AgentGraph.createContextStore();
   *
   * const planner = new ClaudeAgent({
   *   tools: AgentGraph.createPlanningTools(planStore),
   *   description: 'Create a detailed plan.',
   * });
   *
   * const worker = new ClaudeAgent({
   *   tools: AgentGraph.createContextTools(contextStore),
   *   description: 'Execute individual steps.',
   * });
   *
   * const executor = AgentGraph.planExecutor(planStore, planner, worker);
   * const result = await executor.execute('Research quantum computing');
   * ```
   */
  static planExecutor(
    planStore: PlanStore,
    planningAgent: BaseAgent,
    worker: GraphNode<string, string> | BaseAgent,
    options: PlanExecutorOptions = {}
  ): PlanExecutor {
    return new PlanExecutor(planStore, planningAgent, worker, options);
  }
}
