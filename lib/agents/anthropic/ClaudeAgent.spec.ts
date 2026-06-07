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
        authType: "apiKey",
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
        authType: "apiKey",
      });
    });

    it("should authenticate with an OAuth bearer token when authType is 'oauth'", () => {
      new ClaudeAgent({
        apiKey: "sk-ant-oat-some-token",
        id: "oauth-agent",
        name: "OAuthAgent",
        description: "Test Description",
        authType: "oauth",
      });

      expect(Anthropic).toHaveBeenCalledWith({ authToken: "sk-ant-oat-some-token" });
    });

    it("should support authType via vendorConfig.anthropic", () => {
      new ClaudeAgent({
        apiKey: "sk-ant-oat-some-token",
        id: "oauth-agent-vendor-config",
        name: "OAuthAgent",
        description: "Test Description",
        vendorConfig: { anthropic: { authType: "oauth" } },
      });

      expect(Anthropic).toHaveBeenCalledWith({ authToken: "sk-ant-oat-some-token" });
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
        temperature: 0,
      });
    });

    it("should call history.setSessionAnchor() once per execute()", async () => {
      const mockResponse = {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Hello" }],
        usage: { input_tokens: 5, output_tokens: 5 },
      };
      (mockClient.messages.create as jest.Mock).mockResolvedValue(mockResponse as any);

      const anchorSpy = jest.spyOn(agent["history"], "setSessionAnchor");
      await agent.execute("test input");

      expect(anchorSpy).toHaveBeenCalledTimes(1);
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

    it("should return an empty string for an empty text block instead of throwing", async () => {
      const response = {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "" }],
        usage: {
          input_tokens: 10,
          output_tokens: 0,
        },
      };
      const result = await agent["handleResponse"](response);

      expect(result).toBe("");
    });

    it("should collect trailing text after server-side tool blocks (web search, etc.)", async () => {
      const response = {
        stop_reason: "end_turn",
        content: [
          { type: "server_tool_use", id: "srvtool_1", name: "web_search", input: {} },
          { type: "web_search_tool_result", tool_use_id: "srvtool_1", content: [] },
          { type: "text", text: "Here is what I found." },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 50,
        },
      };
      const result = await agent["handleResponse"](response);

      expect(result).toBe("Here is what I found.");
    });

    it("should throw 'Unexpected response format' when no text block is present", async () => {
      const response = {
        stop_reason: "end_turn",
        content: [
          { type: "server_tool_use", id: "srvtool_1", name: "web_search", input: {} },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };

      await expect(agent["handleResponse"](response)).rejects.toThrow(
        /Unexpected response format/
      );
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
        data: "Tool output",
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
