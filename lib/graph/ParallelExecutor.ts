import { BaseAgent } from "../agents/BaseAgent";

export class ParallelExecutor {
  private agents: BaseAgent[];

  constructor(...agents: BaseAgent[]) {
    this.agents = agents;
  }

  /**
   * Executes all agents in parallel and returns an array of their results
   * @param input The input string to provide to each agent
   * @returns Promise resolving to an array of results from each agent
   */
  async execute(input: string): Promise<string[]> {
    // Create an array of promises, each representing an agent execution
    const executionPromises = this.agents.map((agent) =>
      agent.execute(
        JSON.stringify({
          originalQuestion: input,
          // Each agent gets the original input, not results from previous agents
        })
      )
    );

    // Wait for all promises to resolve
    const results = await Promise.all(executionPromises);

    // Convert results to strings if needed and return
    return results.map((result) => result as string);
  }
}
