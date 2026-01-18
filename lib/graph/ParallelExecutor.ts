import { BaseAgent } from "../agents/BaseAgent";
import { BaseExecutor, TokenUsage } from "./BaseExecutor";

/**
 * Options for configuring parallel execution behavior.
 */
export interface ParallelExecutorOptions {
  /**
   * If true, each agent receives only the original input.
   * If false, agents receive the input with shared context.
   * @default true
   */
  isolatedExecution?: boolean;

  /**
   * If true, wraps the input in a JSON object with originalQuestion.
   * If false, passes the raw input to each agent.
   * @default true
   */
  wrapInput?: boolean;
}

/**
 * Executes multiple agents in parallel on the same input.
 * Returns an array of results from all agents.
 *
 * @example
 * ```typescript
 * const executor = new ParallelExecutor({}, expertA, expertB, expertC);
 * const results = await executor.execute("Analyze this data");
 * // results is string[] with each expert's response
 * ```
 */
export class ParallelExecutor extends BaseExecutor<string, string[]> {
  private agents: BaseAgent[];
  private options: Required<ParallelExecutorOptions>;

  constructor(options: ParallelExecutorOptions = {}, ...agents: BaseAgent[]) {
    super();
    this.name = "ParallelExecutor";
    this.nodeType = "parallel";
    this.agents = agents;
    this.options = {
      isolatedExecution: options.isolatedExecution ?? true,
      wrapInput: options.wrapInput ?? true,
    };
  }

  /**
   * Executes all agents in parallel with the same input.
   * @param input - The input string to send to all agents
   * @returns Array of results from each agent
   */
  async execute(input: string): Promise<string[]> {
    const collector = this.getCollector();
    const execId = collector?.startExecution(this.name, "parallel", input);

    if (this.agents.length === 0) {
      if (execId) collector?.endExecution(execId, true, []);
      return [];
    }

    try {
      const executionPromises = this.agents.map(async (agent, index) => {
        const agentName = agent.getName?.() ?? `Agent ${index + 1}`;
        const agentExecId = collector?.startExecution(
          agentName,
          "agent",
          input
        );

        const agentInput = this.options.wrapInput
          ? JSON.stringify({
              originalQuestion: input,
              ...(this.options.isolatedExecution
                ? {}
                : { sharedContext: true }),
            })
          : input;

        try {
          const result = await agent.execute(agentInput);

          // Try to get token usage from agent
          const tokenUsage = this.extractTokenUsage(agent);

          if (agentExecId) {
            collector?.endExecution(agentExecId, true, result, tokenUsage);
          }
          return result as string;
        } catch (error) {
          if (agentExecId) {
            collector?.endExecution(
              agentExecId,
              false,
              undefined,
              undefined,
              error instanceof Error ? error.message : String(error)
            );
          }
          throw error;
        }
      });

      const results = await Promise.all(executionPromises);

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
   * Attempt to extract token usage from an agent.
   * Converts from agent's snake_case format to metrics camelCase format.
   */
  private extractTokenUsage(agent: BaseAgent): TokenUsage | undefined {
    const agentWithUsage = agent as BaseAgent & {
      lastTokenUsage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
    };

    if (!agentWithUsage.lastTokenUsage) return undefined;

    // Convert from snake_case to camelCase
    return {
      inputTokens: agentWithUsage.lastTokenUsage.input_tokens,
      outputTokens: agentWithUsage.lastTokenUsage.output_tokens,
      totalTokens: agentWithUsage.lastTokenUsage.total_tokens,
    };
  }

  /**
   * Returns the number of agents that will execute in parallel.
   */
  get length(): number {
    return this.agents.length;
  }
}
