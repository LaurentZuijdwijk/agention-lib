// @ts-nocheck
import { VotingSystem, VotingInput } from "./VotingSystem";
import { BaseAgent } from "../agents/BaseAgent";

// Mock agent factory
const createMockJudge = (response: string) => {
  return {
    execute: jest.fn().mockResolvedValue(response),
  } as unknown as BaseAgent;
};

describe("VotingSystem", () => {
  describe("constructor", () => {
    it("should create voting system with judge", () => {
      const judge = createMockJudge("verdict");
      const votingSystem = new VotingSystem(judge);

      expect(votingSystem).toBeInstanceOf(VotingSystem);
    });

    it("should accept custom prompt template", () => {
      const judge = createMockJudge("verdict");
      const votingSystem = new VotingSystem(judge, {
        promptTemplate: "Custom template: {originalQuestion} - {expertAnswers}",
      });

      expect(votingSystem).toBeInstanceOf(VotingSystem);
    });
  });

  describe("execute", () => {
    it("should throw error for string input", async () => {
      const judge = createMockJudge("verdict");
      const votingSystem = new VotingSystem(judge);

      await expect(votingSystem.execute("string input")).rejects.toThrow(
        "VotingSystem requires an object with originalInput and solutions properties"
      );
    });

    it("should throw error for empty solutions", async () => {
      const judge = createMockJudge("verdict");
      const votingSystem = new VotingSystem(judge);

      const input: VotingInput = {
        originalInput: "question",
        solutions: [],
      };

      await expect(votingSystem.execute(input)).rejects.toThrow(
        "VotingSystem requires at least one solution to evaluate"
      );
    });

    it("should execute with single solution", async () => {
      const judge = createMockJudge("The answer is correct");
      const votingSystem = new VotingSystem(judge);

      const input: VotingInput = {
        originalInput: "What is 2+2?",
        solutions: ["4"],
      };

      const result = await votingSystem.execute(input);

      expect(result).toBe("The answer is correct");
      expect(judge.execute).toHaveBeenCalledTimes(1);
    });

    it("should format multiple solutions correctly", async () => {
      const judge = createMockJudge("Expert 2 is correct");
      const votingSystem = new VotingSystem(judge);

      const input: VotingInput = {
        originalInput: "Best programming language?",
        solutions: ["Python", "JavaScript", "Rust"],
      };

      await votingSystem.execute(input);

      const prompt = (judge.execute as jest.Mock).mock.calls[0][0];

      expect(prompt).toContain("Best programming language?");
      expect(prompt).toContain("Expert 1: Python");
      expect(prompt).toContain("Expert 2: JavaScript");
      expect(prompt).toContain("Expert 3: Rust");
    });

    it("should use default prompt template", async () => {
      const judge = createMockJudge("verdict");
      const votingSystem = new VotingSystem(judge);

      const input: VotingInput = {
        originalInput: "Test question",
        solutions: ["Answer A", "Answer B"],
      };

      await votingSystem.execute(input);

      const prompt = (judge.execute as jest.Mock).mock.calls[0][0];

      expect(prompt).toContain("You are a judge");
      expect(prompt).toContain("Original question: Test question");
      expect(prompt).toContain("Expert answers:");
      expect(prompt).toContain("Select the best answer");
    });

    it("should use custom prompt template", async () => {
      const judge = createMockJudge("verdict");
      const votingSystem = new VotingSystem(judge, {
        promptTemplate:
          "Question: {originalQuestion}\nOptions:\n{expertAnswers}\nPick one.",
      });

      const input: VotingInput = {
        originalInput: "Favorite color?",
        solutions: ["Red", "Blue"],
      };

      await votingSystem.execute(input);

      const prompt = (judge.execute as jest.Mock).mock.calls[0][0];

      expect(prompt).toBe(
        "Question: Favorite color?\nOptions:\nExpert 1: Red\n\nExpert 2: Blue\nPick one."
      );
    });

    it("should handle empty originalInput", async () => {
      const judge = createMockJudge("verdict");
      const votingSystem = new VotingSystem(judge);

      const input: VotingInput = {
        originalInput: "",
        solutions: ["Solution"],
      };

      const result = await votingSystem.execute(input);

      expect(result).toBe("verdict");
    });

    it("should handle solutions with special characters", async () => {
      const judge = createMockJudge("verdict");
      const votingSystem = new VotingSystem(judge);

      const input: VotingInput = {
        originalInput: "Test",
        solutions: [
          'Solution with "quotes"',
          "Solution with\nnewlines",
          "Solution with {braces}",
        ],
      };

      await votingSystem.execute(input);

      const prompt = (judge.execute as jest.Mock).mock.calls[0][0];

      expect(prompt).toContain('Expert 1: Solution with "quotes"');
      expect(prompt).toContain("Expert 2: Solution with\nnewlines");
      expect(prompt).toContain("Expert 3: Solution with {braces}");
    });

    it("should propagate errors from judge", async () => {
      const judge = {
        execute: jest.fn().mockRejectedValue(new Error("Judge failed")),
      } as unknown as BaseAgent;
      const votingSystem = new VotingSystem(judge);

      const input: VotingInput = {
        originalInput: "question",
        solutions: ["answer"],
      };

      await expect(votingSystem.execute(input)).rejects.toThrow("Judge failed");
    });

    it("should handle long solutions", async () => {
      const judge = createMockJudge("verdict");
      const votingSystem = new VotingSystem(judge);

      const longSolution = "A".repeat(10000);
      const input: VotingInput = {
        originalInput: "question",
        solutions: [longSolution],
      };

      const result = await votingSystem.execute(input);

      expect(result).toBe("verdict");
      const prompt = (judge.execute as jest.Mock).mock.calls[0][0];
      expect(prompt).toContain(longSolution);
    });

    it("should handle many solutions", async () => {
      const judge = createMockJudge("Expert 5 wins");
      const votingSystem = new VotingSystem(judge);

      const solutions = Array.from({ length: 10 }, (_, i) => `Solution ${i + 1}`);
      const input: VotingInput = {
        originalInput: "question",
        solutions,
      };

      const result = await votingSystem.execute(input);

      expect(result).toBe("Expert 5 wins");
      const prompt = (judge.execute as jest.Mock).mock.calls[0][0];
      expect(prompt).toContain("Expert 10: Solution 10");
    });
  });
});
