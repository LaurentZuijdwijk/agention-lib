// @ts-nocheck
import { SequentialExecutor } from "./SequentialExecutor";
import { BaseAgent } from "../agents/BaseAgent";

// Mock agent factory
const createMockAgent = (response: string) => {
  return {
    execute: jest.fn().mockResolvedValue(response),
  } as unknown as BaseAgent;
};

describe("SequentialExecutor", () => {
  describe("constructor", () => {
    it("should create executor with agents", () => {
      const agent1 = createMockAgent("result1");
      const agent2 = createMockAgent("result2");
      const executor = new SequentialExecutor(agent1, agent2);

      expect(executor.length).toBe(2);
    });

    it("should create executor with options and agents", () => {
      const agent1 = createMockAgent("result1");
      const executor = new SequentialExecutor({ wrapInput: false }, agent1);

      expect(executor.length).toBe(1);
    });

    it("should create empty executor", () => {
      const executor = new SequentialExecutor();
      expect(executor.length).toBe(0);
    });
  });

  describe("execute", () => {
    it("should return input when no agents", async () => {
      const executor = new SequentialExecutor();
      const result = await executor.execute("test input");

      expect(result).toBe("test input");
    });

    it("should execute single agent", async () => {
      const agent = createMockAgent("agent response");
      const executor = new SequentialExecutor(agent);

      const result = await executor.execute("test input");

      expect(result).toBe("agent response");
      expect(agent.execute).toHaveBeenCalledTimes(1);
    });

    it("should pass wrapped input by default", async () => {
      const agent = createMockAgent("result");
      const executor = new SequentialExecutor(agent);

      await executor.execute("test input");

      expect(agent.execute).toHaveBeenCalledWith(
        JSON.stringify({
          originalQuestion: "test input",
          resultFromPreviousAgent: "test input",
        })
      );
    });

    it("should pass raw input when wrapInput is false", async () => {
      const agent = createMockAgent("result");
      const executor = new SequentialExecutor({ wrapInput: false }, agent);

      await executor.execute("test input");

      expect(agent.execute).toHaveBeenCalledWith("test input");
    });

    it("should chain agents sequentially", async () => {
      const agent1 = createMockAgent("first result");
      const agent2 = createMockAgent("second result");
      const agent3 = createMockAgent("final result");
      const executor = new SequentialExecutor(agent1, agent2, agent3);

      const result = await executor.execute("initial input");

      expect(result).toBe("final result");
      expect(agent1.execute).toHaveBeenCalledTimes(1);
      expect(agent2.execute).toHaveBeenCalledTimes(1);
      expect(agent3.execute).toHaveBeenCalledTimes(1);
    });

    it("should pass previous result to next agent", async () => {
      const agent1 = createMockAgent("first result");
      const agent2 = createMockAgent("second result");
      const executor = new SequentialExecutor(agent1, agent2);

      await executor.execute("initial input");

      // Second agent should receive first agent's result
      expect(agent2.execute).toHaveBeenCalledWith(
        JSON.stringify({
          originalQuestion: "initial input",
          resultFromPreviousAgent: "first result",
        })
      );
    });

    it("should preserve original input through chain", async () => {
      const agent1 = createMockAgent("first result");
      const agent2 = createMockAgent("second result");
      const agent3 = createMockAgent("third result");
      const executor = new SequentialExecutor(agent1, agent2, agent3);

      await executor.execute("original question");

      // All agents should receive the original question
      const calls = [
        JSON.parse((agent1.execute as jest.Mock).mock.calls[0][0]),
        JSON.parse((agent2.execute as jest.Mock).mock.calls[0][0]),
        JSON.parse((agent3.execute as jest.Mock).mock.calls[0][0]),
      ];

      expect(calls[0].originalQuestion).toBe("original question");
      expect(calls[1].originalQuestion).toBe("original question");
      expect(calls[2].originalQuestion).toBe("original question");
    });

    it("should propagate errors from agents", async () => {
      const agent1 = createMockAgent("first result");
      const agent2 = {
        execute: jest.fn().mockRejectedValue(new Error("Agent failed")),
      } as unknown as BaseAgent;
      const executor = new SequentialExecutor(agent1, agent2);

      await expect(executor.execute("test")).rejects.toThrow("Agent failed");
    });
  });
});
