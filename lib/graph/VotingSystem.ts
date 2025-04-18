import { BaseAgent } from "../agents/BaseAgent";

/**
 * Options for the VotingSystem
 */
export interface VotingOptions {
  // Optional prompt template for the judge
  promptTemplate?: string;
}

export class VotingSystem {
  private judge: BaseAgent;
  private options: VotingOptions;

  /**
   * @param judge The agent responsible for making the selection
   * @param options Configuration options for the voting process
   */
  constructor(judge: BaseAgent, options: VotingOptions = {}) {
    this.judge = judge;
    this.options = options;
  }

  /**
   * Have the judge select the best solution from the provided options
   * @param originalInput The original question or problem statement
   * @param solutions Array of potential solutions to vote on
   * @returns The selected solution
   */
  async vote(originalInput: string, solutions: string[]): Promise<string> {
    // Default prompt if none provided
    const defaultPromptTemplate = `You are a judge who must select the best answer from multiple experts.

       Original question: {originalQuestion}

       Expert answers:
       {expertAnswers}

       Select the best answer, or synthesize a better answer from the experts' inputs.
       Your response should be the final answer without explanation or preamble.`;

    // Format the voting prompt
    const template = this.options.promptTemplate || defaultPromptTemplate;
    const formattedAnswers = solutions
      .map((solution, index) => `Expert ${index + 1}: ${solution}`)
      .join("\n\n");

    const votingPrompt = template
      .replace("{originalQuestion}", originalInput)
      .replace("{expertAnswers}", formattedAnswers);

    // Ask the judge to decide
    const decision = (await this.judge.execute(votingPrompt)) as string;
    return decision;
  }
}
