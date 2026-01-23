import { BaseAgent } from "../agents/BaseAgent";
import { BaseExecutor, MetricsTokenUsage } from "./BaseExecutor";

/**
 * Input format for the VotingSystem.
 */
export interface VotingInput {
  /** The original question or input that was posed */
  originalInput: string;
  /** Array of solutions/answers from different sources to vote on */
  solutions: string[];
}

/**
 * Options for configuring the voting system.
 */
export interface VotingSystemOptions {
  /**
   * Custom prompt template for the judge.
   * Use {originalQuestion} and {expertAnswers} as placeholders.
   */
  promptTemplate?: string;
}

const DEFAULT_PROMPT_TEMPLATE = `You are a judge who must select the best answer from multiple experts.

Original question: {originalQuestion}

Expert answers:
{expertAnswers}

Select the best answer, or synthesize a better answer from the experts' inputs.
Your response should be the final answer without explanation or preamble.`;

/**
 * A voting system that uses a judge agent to select or synthesize
 * the best answer from multiple solutions.
 *
 * Typically used after a ParallelExecutor to evaluate multiple expert opinions.
 *
 * @example
 * ```typescript
 * const voting = new VotingSystem(judgeAgent);
 * const result = await voting.execute({
 *   originalInput: "What is the best approach?",
 *   solutions: [expertA_answer, expertB_answer, expertC_answer]
 * });
 * ```
 */
export class VotingSystem extends BaseExecutor<VotingInput, string> {
  private judge: BaseAgent;
  private promptTemplate: string;

  constructor(judge: BaseAgent, options: VotingSystemOptions = {}) {
    super();
    this.name = "VotingSystem";
    this.nodeType = "voting";
    this.judge = judge;
    this.promptTemplate = options.promptTemplate || DEFAULT_PROMPT_TEMPLATE;
  }

  /**
   * Evaluates the solutions and returns the judge's verdict.
   * @param input - Object containing originalInput and solutions array
   * @returns The judge's selected or synthesized answer
   * @throws Error if input is a string (must be VotingInput object)
   */
  async execute(input: VotingInput | string): Promise<string> {
    const collector = this.getCollector();
    const execId = collector?.startExecution(this.name, "voting", input);

    if (typeof input === "string") {
      const error = new Error(
        "VotingSystem requires an object with originalInput and solutions properties. " +
          "Use as part of a pipeline after a parallel executor, or provide a VotingInput object."
      );
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

    const { originalInput, solutions } = input;

    if (!solutions || solutions.length === 0) {
      const error = new Error(
        "VotingSystem requires at least one solution to evaluate"
      );
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

    const formattedAnswers = solutions
      .map((solution, index) => `Expert ${index + 1}: ${solution}`)
      .join("\n\n");

    const votingPrompt = this.promptTemplate
      .replace("{originalQuestion}", originalInput || "")
      .replace("{expertAnswers}", formattedAnswers);

    // Track judge execution
    const judgeName = this.judge.getName?.() ?? "Judge";
    const judgeExecId = collector?.startExecution(
      judgeName,
      "agent",
      votingPrompt
    );

    try {
      const result = (await this.judge.execute(votingPrompt)) as string;

      // Extract token usage from judge
      const tokenUsage = this.extractTokenUsage(this.judge);

      if (judgeExecId)
        collector?.endExecution(judgeExecId, true, result, tokenUsage);
      if (execId) collector?.endExecution(execId, true, result, tokenUsage);

      return result;
    } catch (error) {
      if (judgeExecId) {
        collector?.endExecution(
          judgeExecId,
          false,
          undefined,
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
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
}
