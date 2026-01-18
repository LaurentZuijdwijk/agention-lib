import {
  MetricsCollector,
  NodeExecutionMetrics,
  TokenUsage,
} from "./GraphMetrics";

/**
 * Type identifier for graph nodes.
 */
export type GraphNodeType =
  | "sequential"
  | "parallel"
  | "pipeline"
  | "map"
  | "voting"
  | "agent"
  | "custom";

/**
 * Represents a node in the agent graph that can process inputs and produce outputs.
 * Uses generics for type-safe input/output handling.
 */
export interface GraphNode<TInput = unknown, TOutput = unknown> {
  execute(input: TInput): Promise<TOutput>;
  /** Optional name for the node (used in metrics) */
  name?: string;
  /** Type of the node (used in metrics and visualization) */
  nodeType?: GraphNodeType;
}

/**
 * Options for executor execution with metrics tracking.
 */
export interface ExecutorOptions {
  /** Metrics collector for tracking execution data */
  metrics?: MetricsCollector;
  /** Whether to collect metrics (default: false) */
  collectMetrics?: boolean;
}

/**
 * Base class for executors that implement the GraphNode interface.
 * Provides a foundation for building type-safe graph executors with optional metrics.
 */
export abstract class BaseExecutor<TInput = unknown, TOutput = unknown>
  implements GraphNode<TInput, TOutput>
{
  /** Display name for this executor */
  public name: string = this.constructor.name;

  /** Type of this node for metrics and visualization */
  public nodeType: GraphNodeType = "custom";

  /** Metrics collector for this executor */
  protected metricsCollector?: MetricsCollector;

  /** Whether metrics collection is enabled */
  protected collectMetrics: boolean = false;

  /**
   * Enable metrics collection for this executor.
   */
  withMetrics(collector?: MetricsCollector): this {
    this.collectMetrics = true;
    this.metricsCollector = collector;
    return this;
  }

  /**
   * Set a custom name for this executor (used in metrics).
   */
  withName(name: string): this {
    this.name = name;
    return this;
  }

  /**
   * Get the metrics collector (creates one if needed and metrics enabled).
   */
  protected getCollector(): MetricsCollector | undefined {
    if (!this.collectMetrics) return undefined;
    if (!this.metricsCollector) {
      this.metricsCollector = new MetricsCollector();
    }
    return this.metricsCollector;
  }

  /**
   * Get collected metrics (if metrics collection is enabled).
   */
  getMetrics(): NodeExecutionMetrics[] | undefined {
    return this.metricsCollector?.getExecutions();
  }

  /**
   * Get the metrics collector instance.
   */
  getMetricsCollector(): MetricsCollector | undefined {
    return this.metricsCollector;
  }

  abstract execute(input: TInput): Promise<TOutput>;
}

/**
 * Configuration for passing context through pipeline stages.
 */
export interface PipelineContext {
  /** The original input that started the pipeline */
  originalInput?: unknown;
  /** Metadata that can be passed between stages */
  metadata?: Record<string, unknown>;
}

/**
 * Input wrapper that includes both the value and pipeline context.
 */
export interface ContextualInput<T = unknown> {
  value: T;
  context: PipelineContext;
}

/**
 * Helper type for extracting input type from a GraphNode
 */
export type NodeInput<T> = T extends GraphNode<infer I, unknown> ? I : never;

/**
 * Helper type for extracting output type from a GraphNode
 */
export type NodeOutput<T> = T extends GraphNode<unknown, infer O> ? O : never;

// Re-export metrics types for convenience
export {
  MetricsCollector,
  NodeExecutionMetrics,
  TokenUsage,
} from "./GraphMetrics";
