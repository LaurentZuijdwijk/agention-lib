import { GraphNode } from "./BaseExecutor";

/**
 * Builds a pipeline of graph nodes that execute in sequence
 */
export class Pipeline implements GraphNode {
  private stages: GraphNode[] = [];

  constructor(...stages: GraphNode[]) {
    this.stages = stages;
  }

  addStage(stage: GraphNode): Pipeline {
    this.stages.push(stage);
    return this;
  }

  async execute(input: string | object): Promise<string | string[]> {
    let result: any = input;

    for (const stage of this.stages) {
      result = await stage.execute(result);
    }

    return result;
  }
}
