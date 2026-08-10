// @ts-nocheck
import { Anthropic } from "@anthropic-ai/sdk";
import { ClaudeAgent } from "./ClaudeAgent"; // Adjust the import path as needed
import { MaxTokensExceededError } from "../errors/AgentError";
import { AgentEvent } from "../AgentEvent";

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
    // Prevent EventEmitter from throwing on emit("error") when a test path
    // emits an error without registering a listener.
    agent.on(AgentEvent.ERROR, () => {});
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      expect(agent).toBeInstanceOf(ClaudeAgent);
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: "test-api-key" });
      expect(agent["config"]).toEqual({
        apiKey: "test-api-key",
        model: "claude-haiku-4-5",
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
        model: "claude-haiku-4-5",
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

  // ---------------------------------------------------------------------------
  // executeStream
  // ---------------------------------------------------------------------------

  describe("executeStream", () => {
    // Build a mock Anthropic event stream from an array of events
    function makeStream(events) {
      return (async function* () {
        for (const event of events) yield event;
      })();
    }

    async function collectStream(gen) {
      const results = [];
      for await (const chunk of gen) results.push(chunk);
      return results;
    }

    it("yields text chunks and emits CHUNK events", async () => {
      mockClient.messages.create.mockResolvedValue(
        makeStream([
          { type: "message_start", message: { usage: { input_tokens: 8, output_tokens: 0 } } },
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: " world" } },
          { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 3 } },
        ])
      );

      const spy = jest.spyOn(agent, "emit");
      const chunks = await collectStream(agent.executeStream("Hi"));

      expect(chunks).toEqual([
        { type: "text", content: "Hello" },
        { type: "text", content: " world" },
      ]);
      expect(spy).toHaveBeenCalledWith("chunk", "Hello");
      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 8,
        output_tokens: 3,
        total_tokens: 11,
      });
    });

    it("yields reasoning chunks for thinking deltas", async () => {
      mockClient.messages.create.mockResolvedValue(
        makeStream([
          { type: "message_start", message: { usage: { input_tokens: 5, output_tokens: 0 } } },
          { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Let me think" } },
          { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig-1" } },
          { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Answer" } },
          { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 4 } },
        ])
      );

      const spy = jest.spyOn(agent, "emit");
      const chunks = await collectStream(agent.executeStream("Hi"));

      expect(chunks).toEqual([
        { type: "reasoning", content: "Let me think" },
        { type: "text", content: "Answer" },
      ]);
      expect(spy).toHaveBeenCalledWith("reasoning_chunk", "Let me think");
    });

    it("preserves thinking blocks (with signature) in the follow-up tool request", async () => {
      const toolStream = makeStream([
        { type: "message_start", message: { usage: { input_tokens: 10, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Need weather" } },
        { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig-abc" } },
        { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "tool_1", name: "get_weather", input: {} } },
        { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"city":"Paris"}' } },
        { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 6 } },
      ]);

      const finalStream = makeStream([
        { type: "message_start", message: { usage: { input_tokens: 12, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Sunny in Paris." } },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 5 } },
      ]);

      mockClient.messages.create
        .mockResolvedValueOnce(toolStream)
        .mockResolvedValueOnce(finalStream);

      agent["tools"].set("get_weather", {
        execute: jest.fn().mockResolvedValue({ tempC: 22 }),
        getPrompt: jest.fn().mockReturnValue({ name: "get_weather", description: "", input_schema: {} }),
      } as any);

      const chunks = await collectStream(agent.executeStream("Weather in Paris?"));

      expect(chunks).toEqual([
        { type: "reasoning", content: "Need weather" },
        { type: "text", content: "Sunny in Paris." },
      ]);
      expect(mockClient.messages.create).toHaveBeenCalledTimes(2);

      // The follow-up request must echo back the thinking block (with signature)
      // ahead of the tool_use block, or Anthropic rejects the turn.
      const followUpMessages = mockClient.messages.create.mock.calls[1][0].messages;
      const assistantMsg = followUpMessages.find((m) => m.role === "assistant");
      const types = assistantMsg.content.map((b) => b.type);
      expect(types.indexOf("thinking")).toBeGreaterThanOrEqual(0);
      expect(types.indexOf("thinking")).toBeLessThan(types.indexOf("tool_use"));
      expect(assistantMsg.content.find((b) => b.type === "thinking")).toEqual({
        type: "thinking",
        thinking: "Need weather",
        signature: "sig-abc",
      });
    });

    it("sends thinking config and omits sampling params when thinkingBudgetTokens is set", async () => {
      const thinkingAgent = new ClaudeAgent({
        apiKey: "test-api-key",
        id: "1",
        name: "TestAgent",
        description: "Test Description",
        temperature: 0.7,
        maxTokens: 4096,
        thinkingBudgetTokens: 2048,
      });

      mockClient.messages.create.mockResolvedValue(
        makeStream([
          { type: "message_start", message: { usage: { input_tokens: 5, output_tokens: 0 } } },
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } },
          { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
        ])
      );

      await collectStream(thinkingAgent.executeStream("Hi"));

      const params = mockClient.messages.create.mock.calls[0][0];
      expect(params.thinking).toEqual({ type: "enabled", budget_tokens: 2048 });
      expect(params.temperature).toBeUndefined();
      expect(params.top_p).toBeUndefined();
      expect(params.top_k).toBeUndefined();
      expect(params.stream).toBe(true);
    });

    it("throws MaxTokensExceededError when stop_reason is 'max_tokens'", async () => {
      mockClient.messages.create.mockResolvedValue(
        makeStream([
          { type: "message_start", message: { usage: { input_tokens: 5, output_tokens: 0 } } },
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "trunc" } },
          { type: "message_delta", delta: { stop_reason: "max_tokens" }, usage: { output_tokens: 1 } },
        ])
      );

      await expect(collectStream(agent.executeStream("long"))).rejects.toThrow(
        MaxTokensExceededError
      );
    });
  });
});
