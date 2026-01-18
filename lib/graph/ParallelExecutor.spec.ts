// @ts-nocheck
import { ParallelExecutor } from "./ParallelExecutor";
import { BaseAgent } from "../agents/BaseAgent";

// Mock agent factory
const createMockAgent = (response: string, delay = 0) => {
  return {
    execute: jest.fn().mockImplementation(async () => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return response;
    }),
  } as unknown as BaseAgent;
};

describe("ParallelExecutor", () => {
  describe("constructor", () => {
    it("should create executor with default options", () => {
      const agent1 = createMockAgent("result1");
      const agent2 = createMockAgent("result2");
      const executor = new ParallelExecutor({}, agent1, agent2);

      expect(executor.length).toBe(2);
    });

    it("should create executor with custom options", () => {
      const agent = createMockAgent("result");
      const executor = new ParallelExecutor(
        { isolatedExecution: false, wrapInput: false },
        agent
      );

      expect(executor.length).toBe(1);
    });

    it("should create empty executor", () => {
      const executor = new ParallelExecutor({});
      expect(executor.length).toBe(0);
    });
  });

  describe("execute", () => {
    it("should return empty array when no agents", async () => {
      const executor = new ParallelExecutor({});
      const results = await executor.execute("test input");

      expect(results).toEqual([]);
    });

    it("should execute single agent", async () => {
      const agent = createMockAgent("agent response");
      const executor = new ParallelExecutor({}, agent);

      const results = await executor.execute("test input");

      expect(results).toEqual(["agent response"]);
      expect(agent.execute).toHaveBeenCalledTimes(1);
    });

    it("should execute multiple agents in parallel", async () => {
      const agent1 = createMockAgent("result1");
      const agent2 = createMockAgent("result2");
      const agent3 = createMockAgent("result3");
      const executor = new ParallelExecutor({}, agent1, agent2, agent3);

      const results = await executor.execute("test input");

      expect(results).toEqual(["result1", "result2", "result3"]);
      expect(agent1.execute).toHaveBeenCalledTimes(1);
      expect(agent2.execute).toHaveBeenCalledTimes(1);
      expect(agent3.execute).toHaveBeenCalledTimes(1);
    });

    it("should pass wrapped input by default", async () => {
      const agent = createMockAgent("result");
      const executor = new ParallelExecutor({}, agent);

      await executor.execute("test input");

      expect(agent.execute).toHaveBeenCalledWith(
        JSON.stringify({
          originalQuestion: "test input",
        })
      );
    });

    it("should pass raw input when wrapInput is false", async () => {
      const agent = createMockAgent("result");
      const executor = new ParallelExecutor({ wrapInput: false }, agent);

      await executor.execute("test input");

      expect(agent.execute).toHaveBeenCalledWith("test input");
    });

    it("should include sharedContext when isolatedExecution is false", async () => {
      const agent = createMockAgent("result");
      const executor = new ParallelExecutor({ isolatedExecution: false }, agent);

      await executor.execute("test input");

      expect(agent.execute).toHaveBeenCalledWith(
        JSON.stringify({
          originalQuestion: "test input",
          sharedContext: true,
        })
      );
    });

    it("should execute agents truly in parallel", async () => {
      // Create agents with delays to verify parallel execution
      const agent1 = createMockAgent("result1", 50);
      const agent2 = createMockAgent("result2", 50);
      const agent3 = createMockAgent("result3", 50);
      const executor = new ParallelExecutor({}, agent1, agent2, agent3);

      const startTime = Date.now();
      await executor.execute("test");
      const elapsed = Date.now() - startTime;

      // If executed in parallel, should take ~50ms, not ~150ms
      // Using 100ms as threshold to account for test overhead
      expect(elapsed).toBeLessThan(100);
    });

    it("should return results in agent order", async () => {
      // Agent 1 is slow, agent 2 is fast - results should still be in order
      const agent1 = createMockAgent("slow result", 30);
      const agent2 = createMockAgent("fast result", 5);
      const executor = new ParallelExecutor({}, agent1, agent2);

      const results = await executor.execute("test");

      expect(results).toEqual(["slow result", "fast result"]);
    });

    it("should propagate errors from agents", async () => {
      const agent1 = createMockAgent("result1");
      const agent2 = {
        execute: jest.fn().mockRejectedValue(new Error("Agent failed")),
      } as unknown as BaseAgent;
      const executor = new ParallelExecutor({}, agent1, agent2);

      await expect(executor.execute("test")).rejects.toThrow("Agent failed");
    });

    it("should fail if any agent fails", async () => {
      const agent1 = createMockAgent("result1", 100);
      const agent2 = {
        execute: jest.fn().mockRejectedValue(new Error("Fast failure")),
      } as unknown as BaseAgent;
      const executor = new ParallelExecutor({}, agent1, agent2);

      await expect(executor.execute("test")).rejects.toThrow("Fast failure");
    });
  });
});
