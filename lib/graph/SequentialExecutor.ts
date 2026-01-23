import { BaseAgent } from "../agents/BaseAgent";
import {
  BaseExecutor,
  MetricsCollector,
  MetricsTokenUsage,
} from "./BaseExecutor";

/**
 * Options for configuring sequential execution behavior.
 */
export interface SequentialExecutorOptions {
  /**
   * If true, wraps the input in a JSON object with originalQuestion and resultFromPreviousAgent.
   * If false, passes the raw result from one agent to the next.
   * @default true
   */
  wrapInput?: boolean;
}

/**
 * Executes agents in sequence, passing the output of each agent to the next.
 *
 * @example
 * ```typescript
 * const executor = new SequentialExecutor(researchAgent, summaryAgent);
 * const result = await executor.execute("What is quantum computing?");
 * ```
 */
export class SequentialExecutor extends BaseExecutor<string, string> {
  private agents: BaseAgent[];
  private options: Required<SequentialExecutorOptions>;

  constructor(
    ...args: [...BaseAgent[]] | [SequentialExecutorOptions, ...BaseAgent[]]
  ) {
    super();
    this.name = "SequentialExecutor";
    this.nodeType = "sequential";

    // Check if first argument is options object
    if (args.length > 0 && !this.isAgent(args[0])) {
      const [options, ...agents] = args as [
        SequentialExecutorOptions,
        ...BaseAgent[]
      ];
      this.options = {
        wrapInput: options.wrapInput ?? true,
      };
      this.agents = agents;
    } else {
      this.options = { wrapInput: true };
      this.agents = args as BaseAgent[];
    }
  }

  private isAgent(value: unknown): value is BaseAgent {
    // Check for duck-typing: an agent has an execute method and is not a plain options object
    return (
      typeof value === "object" &&
      value !== null &&
      "execute" in value &&
      typeof (value as BaseAgent).execute === "function"
    );
  }

  /**
   * Executes agents in sequence.
   * @param input - The initial input string
   * @returns The final output from the last agent in the sequence
   */
  async execute(input: string): Promise<string> {
    const collector = this.getCollector();
    const execId = collector?.startExecution(this.name, "sequential", input);

    if (this.agents.length === 0) {
      if (execId) collector?.endExecution(execId, true, input);
      return input;
    }

    let result: string = input;
    const originalInput = input;

    try {
      for (let i = 0; i < this.agents.length; i++) {
        const agent = this.agents[i];
        const agentName = agent.getName?.() ?? `Agent ${i + 1}`;
        const agentExecId = collector?.startExecution(
          agentName,
          "agent",
          result
        );

        const agentInput = this.options.wrapInput
          ? JSON.stringify({
              originalQuestion: originalInput,
              resultFromPreviousAgent: result,
            })
          : result;

        try {
          result = (await agent.execute(agentInput)) as string;

          // Try to get token usage from agent if available
          const tokenUsage = this.extractTokenUsage(agent);

          if (agentExecId) {
            collector?.endExecution(agentExecId, true, result, tokenUsage);
          }
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
      }

      if (execId) collector?.endExecution(execId, true, result);
      return result;
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
  private extractTokenUsage(agent: BaseAgent): MetricsTokenUsage | undefined {
    // Check if agent has lastTokenUsage property
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
   * Returns the number of agents in the sequence.
   */
  get length(): number {
    return this.agents.length;
  }
}
