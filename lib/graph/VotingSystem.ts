import { BaseAgent } from "../agents/BaseAgent";
import { BaseExecutor } from "./BaseExecutor";

/**
 * Selects or synthesizes from multiple solutions
 */
export class VotingSystem extends BaseExecutor {
  private judge: BaseAgent;
  private promptTemplate?: string;

  constructor(
    judge: BaseAgent,
    { promptTemplate }: { promptTemplate?: string } = {}
  ) {
    super();
    this.judge = judge;
    this.promptTemplate = promptTemplate;
  }

  async execute(input: any): Promise<string> {
    // Handle both string inputs and objects with originalInput and solutions
    let originalInput: string;
    let solutions: string[];

    if (typeof input === "string") {
      throw new Error(
        "VotingSystem requires both originalInput and solutions. Use as part of a pipeline or provide an object."
      );
    } else {
      originalInput = input.originalInput || "";
      solutions = input.solutions || [];
    }

    const defaultPromptTemplate = `You are a judge who must select the best answer from multiple experts.

       Original question: {originalQuestion}

       Expert answers:
       {expertAnswers}

       Select the best answer, or synthesize a better answer from the experts' inputs.
       Your response should be the final answer without explanation or preamble.`;

    const template = this.promptTemplate || defaultPromptTemplate;
    const formattedAnswers = solutions
      .map((solution, index) => `Expert ${index + 1}: ${solution}`)
      .join("\n\n");

    const votingPrompt = template
      .replace("{originalQuestion}", originalInput)
      .replace("{expertAnswers}", formattedAnswers);

    return (await this.judge.execute(votingPrompt)) as string;
  }
}
