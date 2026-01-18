import { BaseExecutor, GraphNode } from "./BaseExecutor";

/**
 * Options for configuring map execution behavior.
 */
export interface MapExecutorOptions {
  /**
   * Maximum number of concurrent executions.
   * If undefined, all items are processed in parallel.
   * @default undefined (unlimited)
   */
  concurrency?: number;
}

/**
 * Maps a processor over each item in an array of inputs.
 * Similar to Array.map but for async GraphNode processing.
 *
 * @example
 * ```typescript
 * const mapper = new MapExecutor(summaryAgent);
 * const summaries = await mapper.execute(["doc1", "doc2", "doc3"]);
 * ```
 */
export class MapExecutor<TItem = string, TResult = string> extends BaseExecutor<
  TItem[],
  TResult[]
> {
  private processor: GraphNode<TItem, TResult>;
  private options: MapExecutorOptions;

  constructor(
    processor: GraphNode<TItem, TResult>,
    options: MapExecutorOptions = {}
  ) {
    super();
    this.name = "MapExecutor";
    this.nodeType = "map";
    this.processor = processor;
    this.options = options;
  }

  /**
   * Processes each item in the input array through the processor.
   * @param input - Array of items to process
   * @returns Array of processed results
   * @throws Error if input is not an array
   */
  async execute(input: TItem[]): Promise<TResult[]> {
    const collector = this.getCollector();
    const execId = collector?.startExecution(this.name, "map", input);

    if (!Array.isArray(input)) {
      const error = new Error("MapExecutor requires an array input");
      if (execId)
        collector?.endExecution(
          execId,
          false,
          undefined,
          undefined,
          error.message
        );
      throw error;
    }

    if (input.length === 0) {
      if (execId) collector?.endExecution(execId, true, []);
      return [];
    }

    try {
      let results: TResult[];

      if (this.options.concurrency !== undefined) {
        results = await this.executeWithConcurrency(
          input,
          this.options.concurrency
        );
      } else {
        // Process all items in parallel with metrics
        results = await Promise.all(
          input.map(async (item, index) => {
            const itemExecId = collector?.startExecution(
              `${this.processor.name ?? "Processor"} [${index}]`,
              "agent",
              item
            );

            try {
              const result = await this.processor.execute(item);
              if (itemExecId) collector?.endExecution(itemExecId, true, result);
              return result;
            } catch (error) {
              if (itemExecId) {
                collector?.endExecution(
                  itemExecId,
                  false,
                  undefined,
                  undefined,
                  error instanceof Error ? error.message : String(error)
                );
              }
              throw error;
            }
          })
        );
      }

      if (execId) collector?.endExecution(execId, true, results);
      return results;
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
   * Processes items with a concurrency limit.
   */
  private async executeWithConcurrency(
    items: TItem[],
    concurrency: number
  ): Promise<TResult[]> {
    const results: TResult[] = new Array(items.length);
    const executing: Promise<void>[] = [];
    const collector = this.getCollector();

    for (let i = 0; i < items.length; i++) {
      const index = i;
      const item = items[i];

      const promise = (async () => {
        const itemExecId = collector?.startExecution(
          `${this.processor.name ?? "Processor"} [${index}]`,
          "agent",
          item
        );

        try {
          const result = await this.processor.execute(item);
          results[index] = result;
          if (itemExecId) collector?.endExecution(itemExecId, true, result);
        } catch (error) {
          if (itemExecId) {
            collector?.endExecution(
              itemExecId,
              false,
              undefined,
              undefined,
              error instanceof Error ? error.message : String(error)
            );
          }
          throw error;
        }
      })();

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        // Remove completed promises
        for (let j = executing.length - 1; j >= 0; j--) {
          // Check if promise is settled by racing with an immediate resolve
          const isSettled = await Promise.race([
            executing[j].then(() => true).catch(() => true),
            Promise.resolve(false),
          ]);
          if (isSettled) {
            executing.splice(j, 1);
          }
        }
      }
    }

    await Promise.all(executing);
    return results;
  }
}
