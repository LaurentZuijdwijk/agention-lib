// @ts-nocheck
import { BaseAgent, BaseAgentConfig, HistoryEntry } from "./BaseAgent";
import { Tool, ToolDefinition } from "../tools/Tool";

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
});
