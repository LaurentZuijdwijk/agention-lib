import { BaseExecutor, GraphNode } from "./BaseExecutor";

/**
 * Maps a function over each item in an array of inputs
 */
export class MapExecutor extends BaseExecutor {
  private processor: GraphNode;

  constructor(processor: GraphNode) {
    super();
    this.processor = processor;
  }

  async execute(input: string[]): Promise<string[]> {
    if (!Array.isArray(input)) {
      throw new Error("MapExecutor requires an array input");
    }

    const results = await Promise.all(
      input.map((item) => this.processor.execute(item))
    );

    // Flatten any nested arrays that might come from processors returning arrays
    return results.flat().map((result) => result as string);
  }
}
