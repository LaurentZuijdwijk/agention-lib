// @ts-nocheck
import { AgentGraph } from "./AgentGraph";
import { SequentialExecutor } from "./SequentialExecutor";
import { ParallelExecutor } from "./ParallelExecutor";
import { Pipeline } from "./Pipeline";
import { MapExecutor } from "./MapExecutor";
import { VotingSystem } from "./VotingSystem";
import { BaseAgent } from "../agents/BaseAgent";
import { GraphNode } from "./BaseExecutor";

// Mock agent factory
const createMockAgent = (response: string) => {
  return {
    execute: jest.fn().mockResolvedValue(response),
  } as unknown as BaseAgent;
};

describe("AgentGraph", () => {
  describe("sequential", () => {
    it("should create SequentialExecutor with agents", () => {
      const agent1 = createMockAgent("result1");
      const agent2 = createMockAgent("result2");

      const executor = AgentGraph.sequential(agent1, agent2);

      expect(executor).toBeInstanceOf(SequentialExecutor);
      expect(executor.length).toBe(2);
    });

    it("should create SequentialExecutor with options", () => {
      const agent = createMockAgent("result");

      const executor = AgentGraph.sequential({ wrapInput: false }, agent);

      expect(executor).toBeInstanceOf(SequentialExecutor);
    });

    it("should create empty SequentialExecutor", () => {
      const executor = AgentGraph.sequential();

      expect(executor).toBeInstanceOf(SequentialExecutor);
      expect(executor.length).toBe(0);
    });
  });

  describe("parallel", () => {
    it("should create ParallelExecutor with agents", () => {
      const agent1 = createMockAgent("result1");
      const agent2 = createMockAgent("result2");

      const executor = AgentGraph.parallel({}, agent1, agent2);

      expect(executor).toBeInstanceOf(ParallelExecutor);
      expect(executor.length).toBe(2);
    });

    it("should create ParallelExecutor with options", () => {
      const agent = createMockAgent("result");

      const executor = AgentGraph.parallel({ isolatedExecution: false }, agent);

      expect(executor).toBeInstanceOf(ParallelExecutor);
    });

    it("should create empty ParallelExecutor", () => {
      const executor = AgentGraph.parallel({});

      expect(executor).toBeInstanceOf(ParallelExecutor);
      expect(executor.length).toBe(0);
    });
  });

  describe("votingSystem", () => {
    it("should create VotingSystem with judge", () => {
      const judge = createMockAgent("verdict");

      const voting = AgentGraph.votingSystem(judge);

      expect(voting).toBeInstanceOf(VotingSystem);
    });

    it("should create VotingSystem with options", () => {
      const judge = createMockAgent("verdict");

      const voting = AgentGraph.votingSystem(judge, {
        promptTemplate: "Custom: {originalQuestion} {expertAnswers}",
      });

      expect(voting).toBeInstanceOf(VotingSystem);
    });
  });

  describe("map", () => {
    it("should create MapExecutor with processor", () => {
      const processor: GraphNode<string, string> = {
        execute: jest.fn().mockResolvedValue("processed"),
      };

      const mapper = AgentGraph.map(processor);

      expect(mapper).toBeInstanceOf(MapExecutor);
    });

    it("should create MapExecutor with options", () => {
      const processor: GraphNode<string, string> = {
        execute: jest.fn().mockResolvedValue("processed"),
      };

      const mapper = AgentGraph.map(processor, { concurrency: 2 });

      expect(mapper).toBeInstanceOf(MapExecutor);
    });
  });

  describe("pipeline", () => {
    it("should create Pipeline with stages", () => {
      const stage1: GraphNode = { execute: jest.fn() };
      const stage2: GraphNode = { execute: jest.fn() };

      const pipeline = AgentGraph.pipeline(stage1, stage2);

      expect(pipeline).toBeInstanceOf(Pipeline);
      expect(pipeline.length).toBe(2);
    });

    it("should create empty Pipeline", () => {
      const pipeline = AgentGraph.pipeline();

      expect(pipeline).toBeInstanceOf(Pipeline);
      expect(pipeline.length).toBe(0);
    });
  });

  describe("integration", () => {
    it("should compose sequential and parallel executors", async () => {
      const agent1 = createMockAgent("from agent 1");
      const agent2 = createMockAgent("from agent 2");
      const agent3 = createMockAgent("from agent 3");

      const sequential = AgentGraph.sequential(agent1);
      const parallel = AgentGraph.parallel({}, agent2, agent3);

      expect(sequential).toBeInstanceOf(SequentialExecutor);
      expect(parallel).toBeInstanceOf(ParallelExecutor);
    });

    it("should work in a pipeline", async () => {
      const researchAgent = createMockAgent("research result");
      const expertA = createMockAgent("expert A opinion");
      const expertB = createMockAgent("expert B opinion");
      const judgeAgent = createMockAgent("final verdict");

      // Build a pipeline: research -> parallel experts -> transform -> voting
      const research = AgentGraph.sequential({ wrapInput: false }, researchAgent);
      const experts = AgentGraph.parallel({ wrapInput: false }, expertA, expertB);
      const transformer: GraphNode<string[], { originalInput: string; solutions: string[] }> = {
        execute: async (results) => ({
          originalInput: "test question",
          solutions: results,
        }),
      };
      const voting = AgentGraph.votingSystem(judgeAgent);

      const pipeline = AgentGraph.pipeline(research, experts, transformer, voting);

      const result = await pipeline.execute("initial question");

      expect(result).toBe("final verdict");
      expect(researchAgent.execute).toHaveBeenCalled();
      expect(expertA.execute).toHaveBeenCalled();
      expect(expertB.execute).toHaveBeenCalled();
      expect(judgeAgent.execute).toHaveBeenCalled();
    });

    it("should support map with sequential processor", async () => {
      const agent = createMockAgent("processed");
      const processor = AgentGraph.sequential({ wrapInput: false }, agent);
      const mapper = AgentGraph.map(processor);

      const results = await mapper.execute(["item1", "item2"]);

      expect(results).toEqual(["processed", "processed"]);
      expect(agent.execute).toHaveBeenCalledTimes(2);
    });
  });
});
