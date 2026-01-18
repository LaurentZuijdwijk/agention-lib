import { GraphNode, BaseExecutor, MetricsCollector } from "./BaseExecutor";

/**
 * Builds a pipeline of graph nodes that execute in sequence,
 * where the output of each stage becomes the input of the next.
 *
 * Unlike SequentialExecutor which is specific to agents,
 * Pipeline can chain any GraphNode implementations together.
 *
 * @example
 * ```typescript
 * const pipeline = new Pipeline(
 *   AgentGraph.sequential(researchAgent, factChecker),
 *   AgentGraph.parallel({}, expertA, expertB),
 *   customTransformer,
 *   AgentGraph.votingSystem(judgeAgent)
 * );
 * const result = await pipeline.execute("Research topic X");
 * ```
 */
export class Pipeline<TInput = unknown, TOutput = unknown>
  extends BaseExecutor<TInput, TOutput>
  implements GraphNode<TInput, TOutput>
{
  private stages: GraphNode<unknown, unknown>[] = [];

  constructor(...stages: GraphNode<unknown, unknown>[]) {
    super();
    this.name = "Pipeline";
    this.nodeType = "pipeline";
    this.stages = stages;
  }

  /**
   * Adds a stage to the end of the pipeline.
   * @param stage - The GraphNode to add
   * @returns The pipeline instance for chaining
   */
  addStage<TStageOutput>(
    stage: GraphNode<TOutput, TStageOutput>
  ): Pipeline<TInput, TStageOutput> {
    this.stages.push(stage as GraphNode<unknown, unknown>);
    return this as unknown as Pipeline<TInput, TStageOutput>;
  }

  /**
   * Executes all stages in sequence.
   * @param input - The initial input
   * @returns The output from the final stage
   */
  async execute(input: TInput): Promise<TOutput> {
    const collector = this.getCollector();
    const execId = collector?.startExecution(this.name, "pipeline", input);

    if (this.stages.length === 0) {
      if (execId) collector?.endExecution(execId, true, input);
      return input as unknown as TOutput;
    }

    let result: unknown = input;

    try {
      for (let i = 0; i < this.stages.length; i++) {
        const stage = this.stages[i];
        const stageName = stage.name ?? `Stage ${i + 1}`;

        // Get stage type from the node's nodeType property, or default to "custom"
        const stageType = stage.nodeType ?? "custom";

        // Only track non-executor stages directly
        // Executors will track themselves when they have the collector
        const isExecutor = stage instanceof BaseExecutor;
        const stageExecId = !isExecutor
          ? collector?.startExecution(stageName, stageType, result)
          : undefined;

        // Pass metrics collector to child executors
        if (collector && isExecutor) {
          (stage as BaseExecutor).withMetrics(collector);
        }

        try {
          result = await stage.execute(result);
          if (stageExecId) {
            collector?.endExecution(stageExecId, true, result);
          }
        } catch (error) {
          if (stageExecId) {
            collector?.endExecution(
              stageExecId,
              false,
              undefined,
              undefined,
              error instanceof Error ? error.message : String(error)
            );
          }
          throw error;
        }
      }

      if (execId) collector?.endExecution(execId, true, result);
      return result as TOutput;
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
   * Returns the number of stages in the pipeline.
   */
  get length(): number {
    return this.stages.length;
  }

  /**
   * Enable metrics collection and return the pipeline for chaining.
   */
  override withMetrics(collector?: MetricsCollector): this {
    super.withMetrics(collector);
    return this;
  }
}
