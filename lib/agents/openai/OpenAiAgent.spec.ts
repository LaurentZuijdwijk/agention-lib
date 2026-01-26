// @ts-nocheck
import OpenAI from "openai";
import { OpenAiAgent } from "./OpenAiAgent";
import { AgentEvent } from "../AgentEvent";
import {
  ApiError,
  ExecutionError,
  ToolExecutionError,
} from "../errors/AgentError";
import { ResponseFunctionToolCall } from "openai/resources/responses/responses";

// Mock OpenAI SDK
jest.mock("openai");

describe("OpenAiAgent", () => {
  let mockClient: any;
  let agent: OpenAiAgent;

  beforeEach(() => {
    // Reset mocks and create a new agent instance
    jest.resetAllMocks();

    mockClient = {
      responses: {
        create: jest.fn(),
      },
    };

    (OpenAI as jest.Mock).mockImplementation(() => mockClient);

    agent = new OpenAiAgent({
      apiKey: "test-api-key",
      id: "1",
      name: "TestAgent",
      description: "Test Description",
    });
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      expect(agent).toBeInstanceOf(OpenAiAgent);
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: "test-api-key" });
      expect(agent["config"]).toMatchObject({
        apiKey: "test-api-key",
        model: "gpt-4.1-mini",
        maxTokens: 1024,
        disableParallelToolUse: false,
        disableReasoning: false,
      });
    });

    it("should accept custom config values", () => {
      const customAgent = new OpenAiAgent({
        apiKey: "custom-key",
        model: "gpt-4",
        maxTokens: 2048,
        disableParallelToolUse: true,
        id: "custom-id",
        name: "Custom Agent",
        description: "Custom description",
      });

      expect(customAgent["config"]).toMatchObject({
        apiKey: "custom-key",
        model: "gpt-4",
        maxTokens: 2048,
        disableParallelToolUse: true,
        disableReasoning: false,
      });
      expect(customAgent.getId()).toBe("custom-id");
      expect(customAgent.getName()).toBe("Custom Agent");
      expect(customAgent.getDescription()).toBe("Custom description");
    });
  });

  describe("getToolDefinitions", () => {
    it("should return formatted tool definitions for OpenAI", () => {
      const mockTool = {
        getPrompt: jest.fn().mockReturnValue({
          name: "test_tool",
          description: "Test tool description",
          input_schema: {
            type: "object",
            properties: {
              param1: { type: "string" },
              param2: { type: "number" },
            },
            required: ["param1"],
          },
        }),
      };

      agent["tools"].set("test_tool", mockTool as any);

      const toolDefinitions = agent["getToolDefinitions"]();

      expect(toolDefinitions).toEqual([
        {
          type: "function",
          name: "test_tool",
          description: "Test tool description",
          parameters: {
            type: "object",
            properties: {
              param1: { type: "string" },
              param2: { type: "number" },
            },
            required: ["param1"],
            additionalProperties: false,
          },
          strict: true,
        },
      ]);

      expect(mockTool.getPrompt).toHaveBeenCalled();
    });

    it("should return empty array when no tools", () => {
      const definitions = agent["getToolDefinitions"]();
      expect(definitions).toEqual([]);
    });
  });

  describe("execute", () => {
    it("should call client.responses.create with correct parameters", async () => {
      const mockResponse = {
        output: [
          {
            type: "message",
            status: "completed",
            content: "Hello there",
          },
        ],
        output_text: "Hello there",
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
        },
      };

      mockClient.responses.create.mockResolvedValue(mockResponse);

      const eventSpy = jest.spyOn(agent, "emit");
      const historyAddSpy = jest.spyOn(agent as any, "addToHistory");

      const result = await agent.execute("test input");

      expect(result).toBe("Hello there");
      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4.1-mini",
          max_output_tokens: 1024,
          input: expect.any(Array),
          tools: [],
          store: false,
        })
      );

      expect(eventSpy).toHaveBeenCalledWith(
        AgentEvent.BEFORE_EXECUTE,
        "test input"
      );
      expect(eventSpy).toHaveBeenCalledWith(
        AgentEvent.AFTER_EXECUTE,
        mockResponse
      );
      // History uses normalized format now
      expect(historyAddSpy).toHaveBeenCalled();

      // Verify token usage tracking
      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      });
    });

    it("should handle OpenAI API errors", async () => {
      const mockError = {
        error: {
          message: "API error message",
          code: "api_error",
        },
        status: 400,
      };

      mockClient.responses.create.mockRejectedValue(mockError);

      const eventSpy = jest.spyOn(agent, "emit");

      try {
        await agent.execute("test input");
        fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).toContain("OpenAI API error: API error message");
      }

      expect(eventSpy).toHaveBeenCalledWith(
        AgentEvent.ERROR,
        expect.anything()
      );
    });

    it("should handle quota exceeded error specifically", async () => {
      const mockError = {
        error: {
          message: "You exceeded your quota",
          code: "insufficient_quota",
        },
        status: 429,
      };

      mockClient.responses.create.mockRejectedValue(mockError);

      try {
        await agent.execute("test input");
        fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).toContain(
          "OpenAI API quota exceeded. Please check your billing details."
        );
      }
    });

    it("should reset token usage on each execution", async () => {
      const mockResponse1 = {
        output: [
          {
            type: "message",
            status: "completed",
            content: "First response",
          },
        ],
        output_text: "First response",
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
        },
      };

      const mockResponse2 = {
        output: [
          {
            type: "message",
            status: "completed",
            content: "Second response",
          },
        ],
        output_text: "Second response",
        usage: {
          input_tokens: 15,
          output_tokens: 25,
          total_tokens: 40,
        },
      };

      mockClient.responses.create
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      await agent.execute("first input");
      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      });

      await agent.execute("second input");
      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 15,
        output_tokens: 25,
        total_tokens: 40,
      });
    });
  });

  describe("handleResponse", () => {
    it("should handle normal text response", async () => {
      const textResponse = {
        output: [
          {
            type: "message",
            status: "completed",
            content: "Text response",
          },
        ],
        output_text: "Text response",
        usage: {
          input_tokens: 5,
          output_tokens: 10,
          total_tokens: 15,
        },
      };

      const result = await agent["handleResponse"](textResponse);

      expect(result).toBe("Text response");
      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 5,
        output_tokens: 10,
        total_tokens: 15,
      });
    });
  });

  describe("handleToolUse", () => {
    it("should throw error for invalid tool calls content", async () => {
      await expect(agent["handleToolUse"](null)).rejects.toThrow(
        "Invalid tool calls content"
      );
      await expect(agent["handleToolUse"]([])).rejects.toThrow(
        "Invalid tool calls content"
      );
    });

    it("should return error for unknown tool", async () => {
      const toolCall = [
        {
          name: "unknown_tool",
          arguments: JSON.stringify({ param: "value" }),
          call_id: "call_123",
        },
      ] as ResponseFunctionToolCall[];

      const result = await agent["handleToolUse"](toolCall);

      expect(result[0].output).toContain("Tool 'unknown_tool' not found");
    });

    it("should handle successful tool execution", async () => {
      const toolCall = [
        {
          name: "test_tool",
          arguments: JSON.stringify({ param: "value" }),
          call_id: "call_123",
          id: "123",
        },
      ] as ResponseFunctionToolCall[];

      const mockToolResult = "Tool execution result";

      const mockTool = {
        execute: jest.fn().mockResolvedValue(mockToolResult),
        getPrompt: jest.fn(),
      };

      agent["tools"].set("test_tool", mockTool as any);

      const result = await agent["handleToolUse"](toolCall);

      expect(result[0].output).toBe(JSON.stringify(mockToolResult));

      expect(mockTool.execute).toHaveBeenCalledWith(
        "1",
        "TestAgent",
        { param: "value" },
        "123",
        "gpt-4.1-mini",
        "openai"
      );
    });

    it("should handle tool execution errors", async () => {
      const toolCall = [
        {
          name: "test_tool",
          arguments: JSON.stringify({ param: "value" }),
          call_id: "call_123",
        },
      ] as ResponseFunctionToolCall[];

      const mockError = new Error("Tool execution error");
      const mockTool = {
        execute: jest.fn().mockRejectedValue(mockError),
        getPrompt: jest.fn(),
      };

      agent["tools"].set("test_tool", mockTool as any);

      const eventSpy = jest.spyOn(agent, "emit");

      const result = await agent["handleToolUse"](toolCall);

      expect(result[0].output).toContain(
        "Error executing tool 'test_tool': Tool execution error"
      );
      expect(eventSpy).toHaveBeenCalledWith(
        AgentEvent.TOOL_ERROR,
        expect.anything()
      );
    });
  });
});
