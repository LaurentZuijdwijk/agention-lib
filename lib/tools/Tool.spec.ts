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
    it("should successfully execute and return raw result", async () => {
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

      expect(result).toEqual({ result: "Processed test query" });
    });

    it("should handle execution errors by throwing", async () => {
      const config: ToolConfig<any> = {
        name: "ErrorTool",
        description: "A tool that throws an error",
        inputSchema: mockInputSchema,
        execute: mockErrorExecute,
      };

      const tool = new Tool(config);
      const input = { query: "error query" };

      await expect(
        tool.execute("agentId1", "agentNameJames", input, "error-id")
      ).rejects.toThrow("Test error");
    });

    it("should forward the run's signal to the tool's own execute", async () => {
      const controller = new AbortController();
      const execute = jest.fn(async () => "done");
      const tool = new Tool({
        name: "SignalTool",
        description: "Reads the signal it is given",
        inputSchema: mockInputSchema,
        execute,
        context: { some: "context" },
      });

      await tool.execute(
        "agentId1",
        "agentName1",
        { query: "q" },
        "id",
        "some-model",
        "anthropic",
        { signal: controller.signal }
      );

      expect(execute).toHaveBeenCalledWith(
        { query: "q" },
        { some: "context" },
        { signal: controller.signal }
      );
    });
  });

  describe("fromAgent", () => {
    const agentStub = (execute: jest.Mock) =>
      ({
        getName: () => "Sub Agent",
        getDescription: () => "A sub agent",
        execute,
      } as any);

    it("should pass the signal through to the wrapped agent", async () => {
      const controller = new AbortController();
      const execute = jest.fn().mockResolvedValue("sub-agent answer");
      const tool = Tool.fromAgent(agentStub(execute), "Delegate work");

      const result = await tool.execute(
        "agentId1",
        "agentName1",
        { instructions: "do the thing" },
        "id",
        undefined,
        undefined,
        { signal: controller.signal }
      );

      expect(result).toBe("sub-agent answer");
      expect(execute).toHaveBeenCalledWith("do the thing", {
        signal: controller.signal,
      });
    });

    it("should rethrow a cancellation instead of reporting it as a tool result", async () => {
      // Swallowing it would have the calling agent carry on with the very run
      // that was just cancelled.
      const controller = new AbortController();
      const execute = jest.fn().mockImplementation(async () => {
        controller.abort();
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      });
      const tool = Tool.fromAgent(agentStub(execute), "Delegate work");

      await expect(
        tool.execute(
          "agentId1",
          "agentName1",
          { instructions: "do the thing" },
          "id",
          undefined,
          undefined,
          { signal: controller.signal }
        )
      ).rejects.toThrow("aborted");
    });

    it("should still report ordinary sub-agent failures as a tool result", async () => {
      const execute = jest.fn().mockRejectedValue(new Error("model exploded"));
      const tool = Tool.fromAgent(agentStub(execute), "Delegate work");

      const result = await tool.execute(
        "agentId1",
        "agentName1",
        { instructions: "do the thing" },
        "id"
      );

      expect(JSON.parse(result).error).toContain("model exploded");
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
