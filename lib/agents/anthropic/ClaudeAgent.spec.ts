// @ts-nocheck
import { Anthropic } from "@anthropic-ai/sdk";
import { ClaudeAgent } from "./ClaudeAgent"; // Adjust the import path as needed

// Mock the Anthropic SDK
jest.mock("@anthropic-ai/sdk");

describe("ClaudeAgent", () => {
  let mockClient: jest.Mocked<Anthropic>;
  let agent: ClaudeAgent;

  beforeEach(() => {
    // Reset mocks and create a new agent instance
    jest.resetAllMocks();
    mockClient = {
      messages: {
        create: jest.fn(),
      },
    } as any;
    (Anthropic as jest.Mock).mockImplementation(() => mockClient);

    agent = new ClaudeAgent({
      apiKey: "test-api-key",
      id: "1",
      name: "TestAgent",
      description: "Test Description",
      temperature: 0,
    });
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      expect(agent).toBeInstanceOf(ClaudeAgent);
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: "test-api-key" });
      expect(agent["config"]).toEqual({
        apiKey: "test-api-key",
        model: "claude-3-5-haiku-latest",
        temperature: 0,
        maxTokens: 1024,
        disableParallelToolUse: false,
      });
    });

    it("should accept custom config values", () => {
      const customAgent = new ClaudeAgent({
        apiKey: "custom-key",
        model: "custom-model",
        maxTokens: 2048,
        disableParallelToolUse: true,
      });
      expect(customAgent["config"]).toEqual({
        apiKey: "custom-key",
        model: "custom-model",
        maxTokens: 2048,
        disableParallelToolUse: true,
      });
    });
  });

  describe("execute", () => {
    it("should call client.messages.create with correct parameters", async () => {
      const mockResponse = {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Hello" }],
        usage: {
          input_tokens: 10,
          output_tokens: 100,
        },
      };
      (mockClient.messages.create as jest.Mock).mockResolvedValue(
        mockResponse as any
      );

      await agent.execute("test input");

      expect(mockClient.messages.create).toHaveBeenCalledWith({
        model: "claude-3-5-haiku-latest",
        system:
          "You are an agent called TestAgent and should follow these instructions: Test Description",
        max_tokens: 1024,
        messages: [
          { role: "user", content: [{ type: "text", text: "test input" }] },
        ],
        tools: [],
      });
    });
  });

  describe("handleResponse", () => {
    it("should return text content when no tool use", async () => {
      const response = {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Test response" }],
        usage: {
          input_tokens: 10,
          output_tokens: 100,
        },
      };
      const result = await agent["handleResponse"](response);

      expect(result).toBe("Test response");
    });

    it("should handle tool use and make subsequent request", async () => {
      const initialResponse = {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            name: "test_tool",
            id: "tool1",
            input: { param: "value" },
          },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 100,
        },
      };

      const toolResponse = [
        {
          type: "tool_result",
          tool_use_id: "tool1",
          content: "Tool result",
        },
      ];

      const finalResponse = {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Final response" }],
        usage: {
          input_tokens: 10,
          output_tokens: 100,
        },
      };

      // Mock the tool execution
      agent["tools"].set("test_tool", {
        execute: jest.fn().mockResolvedValue(toolResponse[0]),
        getPrompt: jest.fn(),
      } as any);

      mockClient.messages.create.mockResolvedValueOnce(finalResponse as any);

      const result = await agent["handleResponse"](initialResponse);

      expect(result).toBe("Final response");
      expect(mockClient.messages.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleToolUse", () => {
    it("should process tool use blocks", async () => {
      const content = [
        {
          type: "tool_use",
          name: "test_tool",
          id: "tool1",
          input: { param: "value" },
          usage: {
            input_tokens: 10,
            output_tokens: 100,
          },
        },
      ] as any;

      const mockToolResult = {
        type: "tool_result",
        tool_use_id: "tool1",
        content: "Tool output",
      };

      const expectedResult = {
        type: "tool_result",
        tool_use_id: "tool1",
        content: JSON.stringify(mockToolResult),
      };

      agent["tools"].set("test_tool", {
        execute: jest.fn().mockResolvedValue(mockToolResult),
        getPrompt: jest.fn(),
      } as any);

      const result = await agent["handleToolUse"](content);

      expect(result).toEqual([expectedResult]);
    });

    it("should handle unknown tools", async () => {
      const content = [
        {
          type: "tool_use",
          name: "unknown_tool",
          id: "tool1",
          input: { param: "value" },
        },
      ] as any;

      const result = await agent["handleToolUse"](content);

      expect(result).toEqual([
        {
          type: "tool_result",
          tool_use_id: "tool1",
          content: "Tool 'unknown_tool' not found",
          is_error: true,
        },
      ]);
    });
  });
});
