/**
 * Metrics and observability for graph execution.
 * Tracks timing, token usage, and pipeline structure for analysis and visualization.
 */

/**
 * Token usage statistics from an LLM call.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Metrics for a single node execution.
 */
export interface NodeExecutionMetrics {
  /** Unique identifier for this execution */
  id: string;
  /** Name of the node/agent */
  name: string;
  /** Type of executor (sequential, parallel, pipeline, map, voting, router, agent) */
  type:
    | "sequential"
    | "parallel"
    | "pipeline"
    | "map"
    | "voting"
    | "router"
    | "agent"
    | "custom";
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Token usage if applicable */
  tokenUsage?: TokenUsage;
  /** Whether execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Input summary (truncated for large inputs) */
  inputSummary?: string;
  /** Output summary (truncated for large outputs) */
  outputSummary?: string;
  /** Child node metrics (for composite executors) */
  children?: NodeExecutionMetrics[];
  /** Execution order within parent (for sequential/parallel) */
  order?: number;
}

/**
 * Aggregate metrics for a complete pipeline execution.
 */
export interface PipelineMetrics {
  /** Total execution time in milliseconds */
  totalDurationMs: number;
  /** Total tokens used across all nodes */
  totalTokens: TokenUsage;
  /** Number of nodes executed */
  nodeCount: number;
  /** Number of successful executions */
  successCount: number;
  /** Number of failed executions */
  failureCount: number;
  /** Detailed metrics for each stage */
  stages: NodeExecutionMetrics[];
  /** Pipeline structure for visualization */
  structure: PipelineStructure;
}

/**
 * Represents the structure of a pipeline for visualization.
 */
export interface PipelineStructure {
  /** Type of this node */
  type:
    | "sequential"
    | "parallel"
    | "pipeline"
    | "map"
    | "voting"
    | "router"
    | "agent"
    | "custom";
  /** Display name */
  name: string;
  /** Child nodes */
  children?: PipelineStructure[];
}

/**
 * Collector for gathering metrics during graph execution.
 */
export class MetricsCollector {
  private executions: NodeExecutionMetrics[] = [];
  private currentExecution: NodeExecutionMetrics | null = null;
  private executionStack: NodeExecutionMetrics[] = [];
  private idCounter = 0;

  /**
   * Generate a unique execution ID.
   */
  private generateId(): string {
    return `exec_${++this.idCounter}_${Date.now()}`;
  }

  /**
   * Truncate a string for summary display.
   */
  private truncate(value: unknown, maxLength = 100): string {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + "...";
  }

  /**
   * Start tracking a node execution.
   */
  startExecution(
    name: string,
    type: NodeExecutionMetrics["type"],
    input?: unknown
  ): string {
    const id = this.generateId();
    const metrics: NodeExecutionMetrics = {
      id,
      name,
      type,
      startTime: Date.now(),
      endTime: 0,
      durationMs: 0,
      success: false,
      inputSummary: input !== undefined ? this.truncate(input) : undefined,
      children: [],
    };

    if (this.executionStack.length > 0) {
      // Nested execution - add as child
      const parent = this.executionStack[this.executionStack.length - 1];
      metrics.order = parent.children?.length ?? 0;
      parent.children?.push(metrics);
    } else {
      // Top-level execution
      this.executions.push(metrics);
    }

    this.executionStack.push(metrics);
    this.currentExecution = metrics;

    return id;
  }

  /**
   * Complete a node execution.
   */
  endExecution(
    id: string,
    success: boolean,
    output?: unknown,
    tokenUsage?: TokenUsage,
    error?: string
  ): void {
    const metrics = this.findExecution(id);
    if (!metrics) return;

    metrics.endTime = Date.now();
    metrics.durationMs = metrics.endTime - metrics.startTime;
    metrics.success = success;
    metrics.outputSummary =
      output !== undefined ? this.truncate(output) : undefined;
    metrics.tokenUsage = tokenUsage;
    metrics.error = error;

    // Pop from stack
    const index = this.executionStack.findIndex((e) => e.id === id);
    if (index !== -1) {
      this.executionStack.splice(index, 1);
    }
    this.currentExecution =
      this.executionStack[this.executionStack.length - 1] ?? null;
  }

  /**
   * Find an execution by ID.
   */
  private findExecution(id: string): NodeExecutionMetrics | null {
    const search = (
      metrics: NodeExecutionMetrics[]
    ): NodeExecutionMetrics | null => {
      for (const m of metrics) {
        if (m.id === id) return m;
        if (m.children) {
          const found = search(m.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.executions);
  }

  /**
   * Add token usage to the current execution.
   */
  addTokenUsage(usage: TokenUsage): void {
    if (this.currentExecution) {
      if (this.currentExecution.tokenUsage) {
        this.currentExecution.tokenUsage.inputTokens += usage.inputTokens;
        this.currentExecution.tokenUsage.outputTokens += usage.outputTokens;
        this.currentExecution.tokenUsage.totalTokens += usage.totalTokens;
      } else {
        this.currentExecution.tokenUsage = { ...usage };
      }
    }
  }

  /**
   * Get all collected metrics.
   */
  getExecutions(): NodeExecutionMetrics[] {
    return this.executions;
  }

  /**
   * Calculate aggregate metrics.
   */
  getAggregateMetrics(): PipelineMetrics {
    const totalTokens: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };

    let nodeCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let totalDurationMs = 0;

    const aggregate = (metrics: NodeExecutionMetrics[]): void => {
      for (const m of metrics) {
        nodeCount++;
        if (m.success) successCount++;
        else failureCount++;

        if (m.tokenUsage) {
          totalTokens.inputTokens += m.tokenUsage.inputTokens;
          totalTokens.outputTokens += m.tokenUsage.outputTokens;
          totalTokens.totalTokens += m.tokenUsage.totalTokens;
        }

        if (m.children) {
          aggregate(m.children);
        }
      }
    };

    aggregate(this.executions);

    // Total duration is from first start to last end
    if (this.executions.length > 0) {
      const firstStart = Math.min(...this.executions.map((e) => e.startTime));
      const lastEnd = Math.max(...this.executions.map((e) => e.endTime));
      totalDurationMs = lastEnd - firstStart;
    }

    return {
      totalDurationMs,
      totalTokens,
      nodeCount,
      successCount,
      failureCount,
      stages: this.executions,
      structure: this.buildStructure(),
    };
  }

  /**
   * Build pipeline structure for visualization.
   */
  private buildStructure(): PipelineStructure {
    const buildNode = (metrics: NodeExecutionMetrics): PipelineStructure => {
      const node: PipelineStructure = {
        type: metrics.type,
        name: metrics.name,
      };

      if (metrics.children && metrics.children.length > 0) {
        node.children = metrics.children.map(buildNode);
      }

      return node;
    };

    if (this.executions.length === 1) {
      return buildNode(this.executions[0]);
    }

    return {
      type: "pipeline",
      name: "root",
      children: this.executions.map(buildNode),
    };
  }

  /**
   * Reset all collected metrics.
   */
  reset(): void {
    this.executions = [];
    this.currentExecution = null;
    this.executionStack = [];
    this.idCounter = 0;
  }

  /**
   * Generate a simple text-based visualization of the pipeline.
   */
  toTextVisualization(): string {
    const lines: string[] = [];

    const render = (metrics: NodeExecutionMetrics, indent = 0): void => {
      const prefix = "  ".repeat(indent);
      const status = metrics.success ? "✓" : "✗";
      const duration = `${metrics.durationMs}ms`;
      const tokens = metrics.tokenUsage
        ? ` [${metrics.tokenUsage.totalTokens} tokens]`
        : "";

      lines.push(
        `${prefix}${status} ${metrics.name} (${metrics.type}) - ${duration}${tokens}`
      );

      if (metrics.children) {
        for (const child of metrics.children) {
          render(child, indent + 1);
        }
      }
    };

    for (const execution of this.executions) {
      render(execution);
    }

    return lines.join("\n");
  }

  /**
   * Generate a JSON representation suitable for external visualization tools.
   */
  toJSON(): string {
    return JSON.stringify(this.getAggregateMetrics(), null, 2);
  }
}

/**
 * Global metrics collector instance.
 * Can be replaced with a custom instance if needed.
 */
let globalCollector: MetricsCollector | null = null;

/**
 * Get or create the global metrics collector.
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalCollector) {
    globalCollector = new MetricsCollector();
  }
  return globalCollector;
}

/**
 * Set a custom global metrics collector.
 */
export function setMetricsCollector(collector: MetricsCollector): void {
  globalCollector = collector;
}

/**
 * Create a new metrics collector (for isolated tracking).
 */
export function createMetricsCollector(): MetricsCollector {
  return new MetricsCollector();
}
