// @ts-nocheck
import { BaseAgent, BaseAgentConfig, HistoryEntry } from "./BaseAgent";
import { Tool, ToolDefinition } from "../tools/Tool";
import { ExecutionError } from "./errors/AgentError";

// Create a concrete implementation for testing
class TestAgent extends BaseAgent<string, string> {
  protected async process(input: string): Promise<string> {
    return `Processed: ${input}`;
  }

  protected async handleResponse(response: any): Promise<string> {
    return response;
  }

  async execute(input: string): Promise<string> {
    return this.process(input);
  }
}

// Mock Tool class
const mockTool = {
  name: "testTool",
  getPrompt: jest.fn(() => ({ name: "testTool" } as ToolDefinition)),
} as any;

describe("BaseAgent", () => {
  let config: BaseAgentConfig;
  let agent: TestAgent;

  beforeEach(() => {
    config = {
      id: "test-id",
      name: "Test Agent",
      description: "Test Description",
    };
    agent = new TestAgent(config);
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      expect(agent.getId()).toBe("test-id");
      expect(agent.getName()).toBe("Test Agent");
      expect(agent.getDescription()).toBe("Test Description");
      expect(agent["debug"]).toBe(false);
      expect(agent["maxHistoryLength"]).toBe(100);
      expect(agent.getTools()).toEqual([]);
    });

    it("should initialize with custom values", () => {
      const customConfig = {
        ...config,
        debug: true,
        maxHistoryLength: 50,
        tools: [mockTool],
      };
      const customAgent = new TestAgent(customConfig);

      expect(customAgent["debug"]).toBe(true);
      expect(customAgent["maxHistoryLength"]).toBe(50);
      expect(customAgent.getTools()).toHaveLength(1);
      expect(customAgent["tools"].get("testTool")).toBe(mockTool);
    });
  });

  describe("execute", () => {
    it("should process input and return output", async () => {
      const result = await agent.execute("test input");
      expect(result).toBe("Processed: test input");
    });

    it("should handle errors", async () => {
      const errorAgent = new TestAgent(config);
      errorAgent["process"] = jest
        .fn()
        .mockRejectedValue(new Error("Test error"));

      await expect(errorAgent.execute("test input")).rejects.toThrow(
        "Test error"
      );
    });

    xit("should add entry to history", async () => {
      const addToHistorySpy = jest.spyOn(agent as any, "addToHistory");
      await agent.execute("test input");

      expect(addToHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
          input: "test input",
          output: "Processed: test input",
          error: undefined,
        })
      );
    });
  });

  describe("getToolDefinitions", () => {
    it("should return tool definitions", () => {
      const configWithTools = {
        ...config,
        tools: [mockTool],
      };
      const agentWithTools = new TestAgent(configWithTools);

      const definitions = agentWithTools["getToolDefinitions"]();
      expect(definitions).toEqual([{ name: "testTool" }]);
      expect(mockTool.getPrompt).toHaveBeenCalled();
    });

    it("should return empty array when no tools", () => {
      const definitions = agent["getToolDefinitions"]();
      expect(definitions).toEqual([]);
    });
  });

  describe("listModels", () => {
    it("should throw for an agent that does not implement it", async () => {
      // Every built-in agent overrides this; a custom agent without a models
      // endpoint should fail loudly rather than return an empty list.
      const custom = new TestAgent({ ...config, vendor: "custom" });

      await expect(custom.listModels()).rejects.toThrow(ExecutionError);
      await expect(custom.listModels()).rejects.toThrow(
        /listModels\(\) is not implemented for the 'custom' agent/
      );
    });
  });

  describe("getters", () => {
    it("should return correct id", () => {
      expect(agent.getId()).toBe("test-id");
    });

    it("should return correct name", () => {
      expect(agent.getName()).toBe("Test Agent");
    });

    it("should return correct description", () => {
      expect(agent.getDescription()).toBe("Test Description");
    });

    it("should return tools array", () => {
      const configWithTools = {
        ...config,
        tools: [mockTool],
      };
      const agentWithTools = new TestAgent(configWithTools);
      expect(agentWithTools.getTools()).toEqual([mockTool]);
    });
  });

  describe.skip("addToHistory", () => {
    it.skip("should not throw error (placeholder implementation)", () => {
      const entry: HistoryEntry = {
        timestamp: new Date(),
        input: "test",
        output: "result",
      };
      expect(() => agent["addToHistory"](entry)).not.toThrow();
    });

    // Note: Full history management tests would be added once the implementation is complete
    // This would include testing maxHistoryLength enforcement and history trimming
  });

  describe("addSystemMessage", () => {
    it("should add system message to history", () => {
      const systemMessage = "You are a helpful assistant";
      agent["addSystemMessage"](systemMessage);

      const historySystemMessage = agent["history"].getSystemMessage();
      expect(historySystemMessage).toBe(systemMessage);
    });

    it("should not duplicate system message with same content", () => {
      const systemMessage = "You are a helpful assistant";

      // Add same message twice
      agent["addSystemMessage"](systemMessage);
      agent["addSystemMessage"](systemMessage);

      // Should only have one system entry
      const entries = agent["history"].entries;
      const systemEntries = entries.filter((e) => e.role === "system");
      expect(systemEntries).toHaveLength(1);
    });

    it("should add new system message if content differs", () => {
      const firstMessage = "You are assistant A";
      const secondMessage = "You are assistant B";

      agent["addSystemMessage"](firstMessage);
      agent["addSystemMessage"](secondMessage);

      // Should have two system entries
      const entries = agent["history"].entries;
      const systemEntries = entries.filter((e) => e.role === "system");
      expect(systemEntries).toHaveLength(2);
    });
  });

  describe("getSystemMessage", () => {
    it("should return formatted system message", () => {
      const systemMessage = agent["getSystemMessage"]();
      expect(systemMessage).toBe(
        "You are an agent called Test Agent and should follow these instructions: Test Description"
      );
    });
  });

  describe("token usage accounting", () => {
    /** Advance the clock deterministically instead of waiting on real time. */
    const at = (ms: number) => jest.spyOn(Date, "now").mockReturnValue(ms);

    afterEach(() => {
      jest.restoreAllMocks();
    });

    const usage = (input: number, output: number, extra = {}) => ({
      input_tokens: input,
      output_tokens: output,
      total_tokens: input + output,
      ...extra,
    });

    it("measures total duration around an unstreamed call", () => {
      at(1000);
      agent["startTurnTimer"]();
      at(1500);
      agent["accumulateUsage"](usage(10, 20));

      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
        totalMs: 500,
        // No first-token mark, so the rate spans the whole call
        outputTokensPerSecond: 40,
      });
    });

    it("splits time to first token from generation time when streaming", () => {
      at(1000);
      agent["startTurnTimer"]();
      at(1200);
      agent["markFirstToken"]();
      at(1700);
      agent["accumulateUsage"](usage(100, 50));

      expect(agent.lastTokenUsage).toMatchObject({
        timeToFirstTokenMs: 200,
        generationMs: 500,
        totalMs: 700,
        inputTokensPerSecond: 500,
        outputTokensPerSecond: 100,
      });
    });

    it("ignores repeated first-token marks within a turn", () => {
      at(1000);
      agent["startTurnTimer"]();
      at(1100);
      agent["markFirstToken"]();
      at(1400);
      agent["markFirstToken"]();
      at(1600);
      agent["accumulateUsage"](usage(10, 10));

      expect(agent.lastTokenUsage.timeToFirstTokenMs).toBe(100);
    });

    it("sums counts and durations across calls and recomputes rates", () => {
      at(0);
      agent["startTurnTimer"]();
      at(100);
      agent["markFirstToken"]();
      at(600);
      agent["accumulateUsage"](usage(10, 25, { reasoning_tokens: 5 }));

      at(1000);
      agent["startTurnTimer"]();
      at(1100);
      agent["markFirstToken"]();
      at(1600);
      agent["accumulateUsage"](usage(30, 75, { reasoning_tokens: 15 }));

      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 40,
        output_tokens: 100,
        total_tokens: 140,
        reasoning_tokens: 20,
        timeToFirstTokenMs: 200,
        generationMs: 1000,
        totalMs: 1200,
        inputTokensPerSecond: 200,
        outputTokensPerSecond: 100,
      });
    });

    it("sums cost_usd across calls, staying undefined until a call reports it", () => {
      agent["accumulateUsage"](usage(10, 25));
      expect(agent.lastTokenUsage?.cost_usd).toBeUndefined();

      agent["accumulateUsage"](usage(10, 25, { cost_usd: 0.002 }));
      expect(agent.lastTokenUsage?.cost_usd).toBeCloseTo(0.002);

      agent["accumulateUsage"](usage(10, 25, { cost_usd: 0.0015 }));
      expect(agent.lastTokenUsage?.cost_usd).toBeCloseTo(0.0035);
    });

    it("returns the single call's usage while lastTokenUsage keeps the total", () => {
      at(0);
      agent["startTurnTimer"]();
      at(500);
      agent["accumulateUsage"](usage(10, 10));

      at(1000);
      agent["startTurnTimer"]();
      at(1250);
      const second = agent["accumulateUsage"](usage(5, 5));

      expect(second).toMatchObject({ input_tokens: 5, totalMs: 250 });
      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 15,
        totalMs: 750,
      });
    });

    it("keeps provider-reported timings over measured ones", () => {
      at(1000);
      agent["startTurnTimer"]();
      at(9999);
      agent["accumulateUsage"](
        usage(20, 40, {
          timeToFirstTokenMs: 100,
          generationMs: 400,
          totalMs: 500,
        })
      );

      expect(agent.lastTokenUsage).toMatchObject({
        timeToFirstTokenMs: 100,
        generationMs: 400,
        totalMs: 500,
        inputTokensPerSecond: 200,
        outputTokensPerSecond: 100,
      });
    });

    it("omits fields that stayed unknown rather than emitting undefined", () => {
      agent["accumulateUsage"](usage(10, 20));

      expect(Object.keys(agent.lastTokenUsage).sort()).toEqual([
        "input_tokens",
        "output_tokens",
        "total_tokens",
      ]);
    });

    it("clears accumulated usage and any in-flight timer on reset", () => {
      at(1000);
      agent["startTurnTimer"]();
      agent["markFirstToken"]();
      agent["resetTokenUsage"]();

      at(5000);
      agent["accumulateUsage"](usage(1, 1));

      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 1,
        output_tokens: 1,
        total_tokens: 2,
      });
    });
  });
});
