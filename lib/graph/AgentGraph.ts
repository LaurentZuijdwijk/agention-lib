import { BaseAgent } from "../agents/BaseAgent";
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
  TokenUsage,
  GraphNodeType,
} from "./BaseExecutor";
export {
  PipelineMetrics,
  PipelineStructure,
  getMetricsCollector,
  setMetricsCollector,
  createMetricsCollector,
} from "./GraphMetrics";

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
}
