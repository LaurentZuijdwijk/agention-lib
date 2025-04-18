import { BaseAgent } from "../agents/BaseAgent";
import { BaseExecutor } from "./BaseExecutor";

/**
 * Executes agents in parallel
 */
export class ParallelExecutor extends BaseExecutor {
  private agents: BaseAgent[];
  private isolatedExecution: boolean;

  constructor({ isolatedExecution = true } = {}, ...agents: BaseAgent[]) {
    super();
    this.agents = agents;
    this.isolatedExecution = isolatedExecution;
  }

  async execute(input: string): Promise<string[]> {
    const executionPromises = this.agents.map((agent) =>
      agent.execute(
        JSON.stringify({
          originalQuestion: input,
          ...(this.isolatedExecution
            ? {}
            : { resultFromPreviousAgents: input }),
        })
      )
    );

    const results = await Promise.all(executionPromises);
    return results.map((result) => result as string);
  }
}
