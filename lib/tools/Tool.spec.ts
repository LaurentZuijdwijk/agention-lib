import { Tool, ToolConfig, ToolInputSchema } from "./Tool";

describe("Tool", () => {
  const mockInputSchema: ToolInputSchema = {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
    },
    required: ["query"],
  };

  // Mock successful execution function
  const mockSuccessExecute = jest.fn(async (input) => {
    return { result: `Processed ${input.query}` };
  });

  // Mock error execution function
  const mockErrorExecute = jest.fn(async (_input) => {
    throw new Error("Test error");
  });

  describe("constructor", () => {
    it("should create a Tool instance with correct configuration", () => {
      const config: ToolConfig<any> = {
        name: "TestTool",
        description: "A test tool",
        inputSchema: mockInputSchema,
        execute: mockSuccessExecute,
      };

      const tool = new Tool(config);

      expect(tool.name).toBe("TestTool");
      expect(tool.getPrompt()).toEqual({
        name: "TestTool",
        description: "A test tool",
        input_schema: mockInputSchema,
      });
    });
  });

  describe("execute", () => {
    it("should successfully execute and return tool result", async () => {
      const config: ToolConfig<any> = {
        name: "TestTool",
        description: "A test tool",
        inputSchema: mockInputSchema,
        execute: mockSuccessExecute,
      };

      const tool = new Tool(config);
      const input = { query: "test query" };

      const result = await tool.execute(
        "agentId1",
        "agentName1",
        input,
        "test-id"
      );

      expect(result).toEqual({
        type: "tool_result",
        tool_use_id: "test-id",
        content: JSON.stringify({ result: "Processed test query" }),
      });
    });

    it("should handle execution errors", async () => {
      const config: ToolConfig<any> = {
        name: "ErrorTool",
        description: "A tool that throws an error",
        inputSchema: mockInputSchema,
        execute: mockErrorExecute,
      };

      const tool = new Tool(config);
      const input = { query: "error query" };

      const result = await tool.execute(
        "agentId1",
        "agentNameJames",
        input,
        "error-id"
      );

      expect(result).toEqual({
        type: "tool_result",
        agentId: "agentId1",
        tool_use_id: "error-id",
        content: "Test error",
        is_error: true,
      });
    });
  });

  describe("getPrompt", () => {
    it("should return tool configuration details", () => {
      const config: ToolConfig<any> = {
        name: "TestTool",
        description: "A test tool",
        inputSchema: mockInputSchema,
        execute: mockSuccessExecute,
      };

      const tool = new Tool(config);

      const prompt = tool.getPrompt();
      expect(prompt).toEqual({
        name: "TestTool",
        description: "A test tool",
        input_schema: mockInputSchema,
      });
    });

    it("should handle optional vendor parameter", () => {
      const config: ToolConfig<any> = {
        name: "TestTool",
        description: "A test tool",
        inputSchema: mockInputSchema,
        execute: mockSuccessExecute,
      };

      const tool = new Tool(config);

      const prompt = tool.getPrompt("someVendor");
      expect(prompt).toEqual({
        name: "TestTool",
        description: "A test tool",
        input_schema: mockInputSchema,
      });
    });
  });
});
