import { BaseAgent } from "../agents/BaseAgent";
import { BaseExecutor } from "./BaseExecutor";

/**
 * Executes agents in sequence
 */
export class SequentialExecutor extends BaseExecutor {
  private agents: BaseAgent[];

  constructor(...agents: BaseAgent[]) {
    super();
    this.agents = agents;
  }

  async execute(input: string): Promise<string> {
    let result = input;
    for (const agent of this.agents) {
      result = (await agent.execute(
        JSON.stringify({
          originalQuestion: input,
          resultFromPreviousAgent: result,
        })
      )) as string;
    }
    return result;
  }
}
