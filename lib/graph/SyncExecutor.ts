import { BaseAgent } from "../agents/BaseAgent";

export class SyncExecutor {
  private agents: BaseAgent[];
  constructor(...agents: BaseAgent[]) {
    this.agents = agents;
  }

  async execute(input: string): Promise<string> {
    let agentIndex = 0;
    let result = input;
    while (agentIndex < this.agents.length) {
      result = (await this.agents[agentIndex].execute(
        JSON.stringify({
          originalQuestion: input,
          resultFromPreviousAgent: result,
        })
      )) as string;
      agentIndex++;
    }
    return result;
  }
}

export class ParalelExecutor {
  private agents: BaseAgent[];
  constructor(...agents: BaseAgent[]) {
    this.agents = agents;
  }

  async execute(input: string): Promise<string> {
    let agentIndex = 0;
    let result = input;
    while (agentIndex < this.agents.length) {
      result = (await this.agents[agentIndex].execute(
        JSON.stringify({
          originalQuestion: input,
          resultFromPreviousAgent: result,
        })
      )) as string;
      agentIndex++;
    }
    return result;
  }
}
