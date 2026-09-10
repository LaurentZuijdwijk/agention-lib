// @ts-nocheck
import OpenAI from "openai";
import {
  OpenAiAgent,
  lowestReasoningEffort,
  describeOpenAIError,
  wrapErrorBodyFetch,
} from "./OpenAiAgent";
import { OPENAI_REASONING_SUPPORT } from "../model-types";
import { AgentEvent } from "../AgentEvent";
import {
  AbortError,
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
      models: {
        list: jest.fn(),
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
    it("should pass defaultHeaders to the OpenAI client", () => {
      new OpenAiAgent({
        id: "h",
        name: "H",
        description: "d",
        apiKey: "test-api-key",
        defaultHeaders: { "X-Trace-Id": "abc123" },
      });

      expect(OpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultHeaders: { "X-Trace-Id": "abc123" },
        })
      );
    });

    it("should initialize with default values", () => {
      expect(agent).toBeInstanceOf(OpenAiAgent);
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: "test-api-key" });
      expect(agent["config"]).toMatchObject({
        apiKey: "test-api-key",
        model: "gpt-4.1-mini",
        disableParallelToolUse: false,
        disableReasoning: false,
      });
    });

    it("leaves maxTokens unset so the model uses its full output budget", () => {
      // `max_output_tokens` is optional on the Responses API. Defaulting it
      // silently truncated every response, and on reasoning models a small cap
      // could be spent entirely on thinking, returning no text at all.
      expect(agent["config"].maxTokens).toBeUndefined();
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

  describe("listModels", () => {
    it("should normalize the models the API reports", async () => {
      const cards = [
        {
          id: "gpt-5.6-luna",
          object: "model",
          created: 1770000000,
          owned_by: "system",
        },
        {
          id: "text-embedding-3-small",
          object: "model",
          created: 1705948997,
          owned_by: "system",
        },
      ];
      mockClient.models.list.mockResolvedValue({ data: cards });

      const result = await agent.listModels();

      expect(result).toEqual([
        {
          id: "gpt-5.6-luna",
          // OpenAI reports seconds, not milliseconds
          created: new Date(1770000000 * 1000),
          ownedBy: "system",
          raw: cards[0],
        },
        {
          id: "text-embedding-3-small",
          created: new Date(1705948997 * 1000),
          ownedBy: "system",
          raw: cards[1],
        },
      ]);
    });

    it("should wrap failures in an ExecutionError", async () => {
      mockClient.models.list.mockRejectedValue(new Error("401 unauthorized"));

      await expect(agent.listModels()).rejects.toThrow(ExecutionError);
      await expect(agent.listModels()).rejects.toThrow(
        /Failed to list OpenAI models: 401 unauthorized/
      );
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
          // param2 is optional, and strict mode requires `required` to name
          // every property — sending strict:true here 400s the whole request
          strict: false,
        },
      ]);

      expect(mockTool.getPrompt).toHaveBeenCalled();
    });

    it("should keep strict mode for a tool whose parameters are all required", () => {
      const mockTool = {
        getPrompt: jest.fn().mockReturnValue({
          name: "strict_tool",
          description: "Every parameter is required",
          input_schema: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
          },
        }),
      };

      agent["tools"].set("strict_tool", mockTool as any);

      const [definition] = agent["getToolDefinitions"]();

      expect(definition.strict).toBe(true);
    });

    it("should drop strict mode for a tool with a nested object", () => {
      // Strict wants additionalProperties:false on nested objects too, and this
      // only sets it at the top level. MCP servers send these routinely.
      const mockTool = {
        getPrompt: jest.fn().mockReturnValue({
          name: "nested_tool",
          description: "Takes a filter object",
          input_schema: {
            type: "object",
            properties: { filter: { type: "object", properties: {} } },
            required: ["filter"],
          },
        }),
      };

      agent["tools"].set("nested_tool", mockTool as any);

      const [definition] = agent["getToolDefinitions"]();

      expect(definition.strict).toBe(false);
    });

    it("should return empty array when no tools", () => {
      const definitions = agent["getToolDefinitions"]();
      expect(definitions).toEqual([]);
    });
  });

  describe("getAllToolDefinitions", () => {
    it("appends built-in tools after function tools", () => {
      const mockTool = {
        getPrompt: jest.fn().mockReturnValue({
          name: "test_tool",
          description: "Test tool description",
          input_schema: {
            type: "object",
            properties: { param1: { type: "string" } },
            required: ["param1"],
          },
        }),
      };
      agent["tools"].set("test_tool", mockTool as any);
      agent["config"].builtInTools = [{ type: "web_search" }];

      const definitions = agent["getAllToolDefinitions"]();

      expect(definitions).toEqual([
        expect.objectContaining({ type: "function", name: "test_tool" }),
        { type: "web_search" },
      ]);
    });

    it("returns just the built-in tools when there are no function tools", () => {
      agent["config"].builtInTools = [
        { type: "file_search", vector_store_ids: ["vs_1"] },
      ];

      expect(agent["getAllToolDefinitions"]()).toEqual([
        { type: "file_search", vector_store_ids: ["vs_1"] },
      ]);
    });

    it("passes builtInTools from flat config into the request", () => {
      const customAgent = new OpenAiAgent({
        apiKey: "test-api-key",
        id: "2",
        name: "Agent",
        description: "d",
        builtInTools: [{ type: "web_search" }],
      });

      expect(customAgent["getAllToolDefinitions"]()).toEqual([
        { type: "web_search" },
      ]);
    });

    it("passes builtInTools from vendorConfig.openai into the request", () => {
      const customAgent = new OpenAiAgent({
        apiKey: "test-api-key",
        id: "3",
        name: "Agent",
        description: "d",
        vendorConfig: { openai: { builtInTools: [{ type: "web_search" }] } },
      });

      expect(customAgent["getAllToolDefinitions"]()).toEqual([
        { type: "web_search" },
      ]);
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
          max_output_tokens: undefined,
          input: expect.any(Array),
          tools: [],
          store: false,
        }),
        { signal: undefined }
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
      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      });
    });

    it("should call history.setSessionAnchor() once per execute()", async () => {
      const mockResponse = {
        output: [{ type: "message", status: "completed", content: "Hello" }],
        output_text: "Hello",
        usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
      };
      mockClient.responses.create.mockResolvedValue(mockResponse);

      const anchorSpy = jest.spyOn(agent["history"], "setSessionAnchor");
      await agent.execute("test input");

      expect(anchorSpy).toHaveBeenCalledTimes(1);
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
      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      });

      await agent.execute("second input");
      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 15,
        output_tokens: 25,
        total_tokens: 40,
      });
    });
  });

  // Each family rejects the others' minimum, so the mapping is the heart of the
  // fix. Every row was verified against the live Responses API on 2026-08-05.
  describe("lowestReasoningEffort", () => {
    it.each([
      ["o1", "low"],
      ["o1-pro", "low"],
      ["o3", "low"],
      ["o3-mini", "low"],
      ["o4-mini", "low"],
      ["gpt-5", "minimal"],
      ["gpt-5-mini", "minimal"],
      ["gpt-5-nano", "minimal"],
      // pro variants drop the low end rather than adding to it
      ["gpt-5-pro", "high"],
      ["gpt-5.2-pro", "medium"],
      ["gpt-5.4-pro", "medium"],
      ["gpt-5.5-pro", "medium"],
      ["gpt-5.1", "none"],
      ["gpt-5.2", "none"],
      ["gpt-5.4", "none"],
      ["gpt-5.4-mini", "none"],
      ["gpt-5.4-nano", "none"],
      ["gpt-5.5", "none"],
      ["gpt-5.6", "none"],
      ["gpt-5.6-sol", "none"],
      ["gpt-5.6-terra", "none"],
      ["gpt-5.6-luna", "none"],
      // Dated snapshots resolve like their alias
      ["gpt-5-nano-2025-08-07", "minimal"],
      ["gpt-5.6-sol-2026-06-23", "none"],
    ])("maps %s to %s", (model, expected) => {
      expect(lowestReasoningEffort(model)).toBe(expected);
    });

    it.each([
      ["gpt-4.1-mini"],
      ["gpt-4o"],
      // Chat variants carry a reasoning-model name but reject the parameter
      ["gpt-5.2-chat-latest"],
      // Codex variants are not reachable on the Responses API with this key, so
      // their support set is unverified — omitting beats guessing
      ["gpt-5-codex"],
      ["gpt-5.1-codex-max"],
      // Unknown/future families: omitting is safer than guessing a rejected value
      ["gpt-6"],
      [undefined],
    ])("returns undefined for %s", (model) => {
      expect(lowestReasoningEffort(model)).toBeUndefined();
    });

    it("keeps every group's efforts ordered lowest-first", () => {
      const rank = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

      for (const { models, efforts } of OPENAI_REASONING_SUPPORT) {
        const ranks = efforts.map((e) => rank.indexOf(e));
        expect({ models, ranks }).toEqual({
          models,
          ranks: [...ranks].sort((a, b) => a - b),
        });
      }
    });
  });

  describe("reasoning parameters", () => {
    const textResponse = {
      output: [{ type: "message", status: "completed", content: "ok" }],
      output_text: "ok",
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    };

    /** The `reasoning` field of the Nth call to responses.create (1-indexed). */
    const reasoningOfCall = (n = 1) => {
      const params = mockClient.responses.create.mock.calls[n - 1][0];
      return "reasoning" in params ? params.reasoning : undefined;
    };

    const makeAgent = (config: object) =>
      new OpenAiAgent({
        apiKey: "test-api-key",
        id: "1",
        name: "TestAgent",
        description: "Test Description",
        ...config,
      });

    it("omits reasoning entirely when neither option is set", async () => {
      mockClient.responses.create.mockResolvedValue(textResponse);

      await agent.execute("hi");

      expect(mockClient.responses.create.mock.calls[0][0]).not.toHaveProperty(
        "reasoning"
      );
    });

    // Regression: execute() used to spread the disable case and then overwrite it
    // with an unconditional `reasoning` key on the next line, so disableReasoning
    // silently did nothing on the very path its own error message recommends it for.
    it("sends the model's lowest effort in execute() when disableReasoning is set", async () => {
      mockClient.responses.create.mockResolvedValue(textResponse);

      await makeAgent({ disableReasoning: true, model: "gpt-5-nano" }).execute(
        "hi"
      );

      expect(reasoningOfCall()).toEqual({ effort: "minimal" });
    });

    // effort: null means "unset", so the model applies its own default (medium on
    // every family before gpt-5.1) — it never disabled anything.
    it("never sends effort: null", async () => {
      mockClient.responses.create.mockResolvedValue(textResponse);

      for (const model of [
        "gpt-5-nano",
        "gpt-5.6-sol",
        "o4-mini",
        "gpt-4.1-mini",
      ]) {
        mockClient.responses.create.mockClear();
        await makeAgent({ disableReasoning: true, model }).execute("hi");
        expect(reasoningOfCall()?.effort ?? "omitted").not.toBeNull();
      }
    });

    it("omits reasoning when disableReasoning is set on a non-reasoning model", async () => {
      mockClient.responses.create.mockResolvedValue(textResponse);

      // gpt-4.1-mini rejects `reasoning.effort` outright — sending one would 400
      await makeAgent({
        disableReasoning: true,
        model: "gpt-4.1-mini",
      }).execute("hi");

      expect(mockClient.responses.create.mock.calls[0][0]).not.toHaveProperty(
        "reasoning"
      );
    });

    it("passes through the widened effort range", async () => {
      mockClient.responses.create.mockResolvedValue(textResponse);

      await makeAgent({
        reasoningEffort: "xhigh",
        model: "gpt-5.6-sol",
      }).execute("hi");

      expect(reasoningOfCall()).toEqual({ effort: "xhigh" });
    });

    it("sends the configured effort in execute()", async () => {
      mockClient.responses.create.mockResolvedValue(textResponse);

      await makeAgent({ reasoningEffort: "high" }).execute("hi");

      expect(reasoningOfCall()).toEqual({ effort: "high" });
    });

    it("lets disableReasoning win over reasoningEffort", async () => {
      mockClient.responses.create.mockResolvedValue(textResponse);

      await makeAgent({
        disableReasoning: true,
        reasoningEffort: "high",
        model: "gpt-5.6-sol",
      }).execute("hi");

      expect(reasoningOfCall()).toEqual({ effort: "none" });
    });

    it("applies the same rules on the tool-continuation request", async () => {
      const toolCallResponse = {
        output: [
          {
            type: "function_call",
            call_id: "call_1",
            name: "noop",
            arguments: "{}",
          },
        ],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      };

      mockClient.responses.create
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(textResponse);

      const toolAgent = makeAgent({
        disableReasoning: true,
        model: "gpt-5-nano",
      });
      toolAgent["tools"].set("noop", {
        execute: jest.fn().mockResolvedValue("done"),
        getPrompt: jest.fn().mockReturnValue({
          name: "noop",
          description: "noop",
          input_schema: { type: "object", properties: {} },
        }),
      } as any);

      await toolAgent.execute("hi");

      expect(mockClient.responses.create).toHaveBeenCalledTimes(2);
      expect(reasoningOfCall(2)).toEqual({ effort: "minimal" });
    });

    it("adds summary: auto only when streaming with an effort", async () => {
      mockClient.responses.create.mockResolvedValue(
        (async function* () {
          yield { type: "response.output_text.delta", delta: "hi" };
          yield {
            type: "response.completed",
            response: {
              output: [],
              output_text: "hi",
              usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
            },
          };
        })()
      );

      const streamAgent = makeAgent({ reasoningEffort: "medium" });
      for await (const _chunk of streamAgent.executeStream("hi")) {
        /* drain */
      }

      expect(reasoningOfCall()).toEqual({ effort: "medium", summary: "auto" });
    });

    it("still requests a summary when streaming with reasoning disabled", async () => {
      mockClient.responses.create.mockResolvedValue(
        (async function* () {
          yield { type: "response.output_text.delta", delta: "hi" };
          yield {
            type: "response.completed",
            response: {
              output: [],
              output_text: "hi",
              usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
            },
          };
        })()
      );

      const streamAgent = makeAgent({
        disableReasoning: true,
        model: "gpt-5.6-sol",
      });
      for await (const _chunk of streamAgent.executeStream("hi")) {
        /* drain */
      }

      expect(reasoningOfCall()).toEqual({ effort: "none", summary: "auto" });
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
      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 5,
        output_tokens: 10,
        total_tokens: 15,
      });
    });

    it("should track reasoning tokens reported by reasoning models", async () => {
      const reasoningResponse = {
        output: [
          { type: "reasoning", summary: [] },
          { type: "message", status: "completed", content: "42" },
        ],
        output_text: "42",
        usage: {
          input_tokens: 5,
          output_tokens: 100,
          total_tokens: 105,
          output_tokens_details: { reasoning_tokens: 80 },
        },
      };

      await agent["handleResponse"](reasoningResponse);

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 5,
        // Reasoning tokens are counted inside output_tokens, not added to it
        output_tokens: 100,
        total_tokens: 105,
        reasoning_tokens: 80,
      });
    });
  });

  describe("prompt caching", () => {
    const textResponse = {
      output: [{ type: "message", status: "completed", content: "ok" }],
      output_text: "ok",
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    };

    const makeAgent = (config: object) =>
      new OpenAiAgent({
        apiKey: "test-api-key",
        id: "1",
        name: "TestAgent",
        description: "Test Description",
        ...config,
      });

    it("omits the cache parameters when unconfigured", async () => {
      mockClient.responses.create.mockResolvedValue(textResponse);

      await agent.execute("hi");

      const params = mockClient.responses.create.mock.calls[0][0];
      expect(params).not.toHaveProperty("prompt_cache_key");
      expect(params).not.toHaveProperty("prompt_cache_retention");
    });

    it("sends the configured cache key and retention", async () => {
      mockClient.responses.create.mockResolvedValue(textResponse);

      await makeAgent({
        promptCacheKey: "conversation-42",
        promptCacheRetention: "24h",
      }).execute("hi");

      expect(mockClient.responses.create.mock.calls[0][0]).toMatchObject({
        prompt_cache_key: "conversation-42",
        prompt_cache_retention: "24h",
      });
    });

    it("reads them from vendorConfig too", async () => {
      mockClient.responses.create.mockResolvedValue(textResponse);

      await makeAgent({
        vendorConfig: { openai: { promptCacheKey: "from-vendor-config" } },
      }).execute("hi");

      expect(mockClient.responses.create.mock.calls[0][0]).toMatchObject({
        prompt_cache_key: "from-vendor-config",
      });
    });

    it("keeps the key on the follow-up call of a tool loop, where the prefix repeats", async () => {
      const toolCall: ResponseFunctionToolCall = {
        type: "function_call",
        call_id: "call_1",
        name: "noop",
        arguments: "{}",
        id: "fc_1",
        status: "completed",
      };
      mockClient.responses.create
        .mockResolvedValueOnce({
          output: [toolCall],
          output_text: "",
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        })
        .mockResolvedValueOnce(textResponse);

      const toolAgent = makeAgent({ promptCacheKey: "conversation-42" });
      toolAgent["tools"].set("noop", {
        execute: jest.fn().mockResolvedValue("done"),
        getPrompt: () => ({
          name: "noop",
          description: "does nothing",
          input_schema: { type: "object", properties: {}, required: [] },
        }),
      } as any);

      await toolAgent.execute("hi");

      expect(mockClient.responses.create).toHaveBeenCalledTimes(2);
      expect(mockClient.responses.create.mock.calls[1][0]).toMatchObject({
        prompt_cache_key: "conversation-42",
      });
    });

    it("sends the key on the streaming path", async () => {
      mockClient.responses.create.mockReturnValue(
        (async function* () {
          yield { type: "response.output_text.delta", delta: "ok" };
          yield {
            type: "response.completed",
            response: {
              output: [{ type: "message", status: "completed", content: "ok" }],
              output_text: "ok",
              usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
            },
          };
        })()
      );

      const streamAgent = makeAgent({ promptCacheKey: "conversation-42" });
      for await (const _ of streamAgent.executeStream("hi")) {
        // drain
      }

      expect(mockClient.responses.create.mock.calls[0][0]).toMatchObject({
        prompt_cache_key: "conversation-42",
      });
    });

    it("reports the cached prompt tokens the API breaks out", async () => {
      await agent["handleResponse"]({
        output: [{ type: "message", status: "completed", content: "ok" }],
        output_text: "ok",
        usage: {
          input_tokens: 2048,
          output_tokens: 10,
          total_tokens: 2058,
          input_tokens_details: { cached_tokens: 1920 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      });

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 2048,
        // A subset of input_tokens — the totals stay as reported.
        cache_read_tokens: 1920,
        total_tokens: 2058,
      });
      // The platform API reports no write count, only the Codex backend does.
      expect(agent.lastTokenUsage?.cache_write_tokens).toBeUndefined();
    });

    it("leaves the cache counts undefined when a host reports no breakdown", async () => {
      await agent["handleResponse"]({
        output: [{ type: "message", status: "completed", content: "ok" }],
        output_text: "ok",
        usage: { input_tokens: 5, output_tokens: 10, total_tokens: 15 },
      });

      expect(agent.lastTokenUsage?.cache_read_tokens).toBeUndefined();
      expect(agent.lastTokenUsage?.cache_write_tokens).toBeUndefined();
    });
  });

  describe("encrypted reasoning round trip", () => {
    const reasoningItem = (id: string) => ({
      type: "reasoning",
      id,
      summary: [{ type: "summary_text", text: `thought ${id}` }],
      encrypted_content: "enc",
    });

    /** What the provider returns when `include` was not asked for. */
    const bareReasoningItem = (id: string) => ({
      type: "reasoning",
      id,
      summary: [{ type: "summary_text", text: `thought ${id}` }],
    });

    const responseWith = (output: object[], text = "ok") => ({
      output,
      output_text: text,
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    });

    const message = { type: "message", status: "completed", content: "ok" };

    const makeAgent = (config: object = {}) =>
      new OpenAiAgent({
        apiKey: "test-api-key",
        id: "1",
        name: "TestAgent",
        description: "Test Description",
        model: "gpt-5-nano",
        ...config,
      });

    it("asks for encrypted reasoning on a reasoning model", async () => {
      mockClient.responses.create.mockResolvedValue(responseWith([message]));

      await makeAgent().execute("hi");

      expect(mockClient.responses.create.mock.calls[0][0].include).toEqual([
        "reasoning.encrypted_content",
      ]);
    });

    it("stays off for a model that does not reason, keeping the request unchanged", async () => {
      mockClient.responses.create.mockResolvedValue(responseWith([message]));

      // gpt-4.1-mini rejects reasoning parameters outright.
      await makeAgent({ model: "gpt-4.1-mini" }).execute("hi");

      expect(mockClient.responses.create.mock.calls[0][0]).not.toHaveProperty(
        "include"
      );
    });

    it("can be forced on or off explicitly, flat or via vendorConfig", async () => {
      mockClient.responses.create.mockResolvedValue(responseWith([message]));

      await makeAgent({
        model: "gpt-4.1-mini",
        includeEncryptedReasoning: true,
      }).execute("hi");
      expect(mockClient.responses.create.mock.calls[0][0].include).toEqual([
        "reasoning.encrypted_content",
      ]);

      await makeAgent({
        vendorConfig: { openai: { includeEncryptedReasoning: false } },
      }).execute("hi");
      expect(mockClient.responses.create.mock.calls[1][0]).not.toHaveProperty(
        "include"
      );
    });

    it("stores the reasoning items and replays them on the next request", async () => {
      mockClient.responses.create
        .mockResolvedValueOnce(responseWith([reasoningItem("rs_1"), message]))
        .mockResolvedValueOnce(responseWith([message]));

      const agentWithHistory = makeAgent({ history: undefined });
      agentWithHistory["history"].transient = false;

      await agentWithHistory.execute("first");
      await agentWithHistory.execute("second");

      const replayed = mockClient.responses.create.mock.calls[1][0].input;
      expect(replayed).toContainEqual(
        expect.objectContaining({
          type: "reasoning",
          id: "rs_1",
          encrypted_content: "enc",
        })
      );
    });

    it("replays reasoning ahead of the tool call it produced", async () => {
      const toolCall: ResponseFunctionToolCall = {
        type: "function_call",
        call_id: "call_1",
        name: "noop",
        arguments: "{}",
        id: "fc_1",
        status: "completed",
      };
      mockClient.responses.create
        .mockResolvedValueOnce(
          responseWith([reasoningItem("rs_tool"), toolCall], "")
        )
        .mockResolvedValueOnce(responseWith([message]));

      const toolAgent = makeAgent();
      toolAgent["tools"].set("noop", {
        name: "noop",
        execute: jest.fn().mockResolvedValue("done"),
        getPrompt: () => ({
          name: "noop",
          description: "noop",
          input_schema: { type: "object", properties: {}, required: [] },
        }),
      } as any);

      await toolAgent.execute("use the tool");

      const types = mockClient.responses.create.mock.calls[1][0].input.map(
        (item: any) => item.type
      );
      // system + user, then the assistant turn: its reasoning ahead of the call
      // it produced, which is the order the API requires.
      expect(types).toEqual([
        "message",
        "message",
        "reasoning",
        "function_call",
        "function_call_output",
      ]);
    });

    it("drops a reasoning item with no encrypted content, which could not be replayed", async () => {
      mockClient.responses.create
        .mockResolvedValueOnce(
          responseWith([bareReasoningItem("rs_bare"), message])
        )
        .mockResolvedValueOnce(responseWith([message]));

      const agentWithHistory = makeAgent();
      agentWithHistory["history"].transient = false;

      await agentWithHistory.execute("first");
      await agentWithHistory.execute("second");

      const replayed = mockClient.responses.create.mock.calls[1][0].input;
      expect(replayed.some((item: any) => item.type === "reasoning")).toBe(
        false
      );
    });

    it("carries reasoning through a streamed turn as well", async () => {
      const events = (async function* () {
        yield { type: "response.output_text.delta", delta: "ok" };
        yield {
          type: "response.completed",
          response: responseWith([reasoningItem("rs_stream"), message]),
        };
      })();
      mockClient.responses.create
        .mockResolvedValueOnce(events)
        .mockResolvedValueOnce(
          (async function* () {
            yield {
              type: "response.completed",
              response: responseWith([message]),
            };
          })()
        );

      const streamAgent = makeAgent();
      streamAgent["history"].transient = false;

      for await (const _ of streamAgent.executeStream("first")) {
        // drain
      }
      for await (const _ of streamAgent.executeStream("second")) {
        // drain
      }

      expect(mockClient.responses.create.mock.calls[1][0].input).toContainEqual(
        expect.objectContaining({ type: "reasoning", id: "rs_stream" })
      );
    });

    it("stays off behind a custom baseURL, whatever the model is called", async () => {
      // A model name says nothing about the host serving it. An existing
      // gateway user on an OpenAI-shaped model must keep sending the request
      // they sent before this feature existed.
      mockClient.responses.create.mockResolvedValue(responseWith([message]));

      await makeAgent({ baseURL: "https://gateway.example/v1" }).execute("hi");

      expect(mockClient.responses.create.mock.calls[0][0]).not.toHaveProperty(
        "include"
      );
    });

    it("can still be turned on for a compatible host behind a baseURL", async () => {
      mockClient.responses.create.mockResolvedValue(responseWith([message]));

      await makeAgent({
        baseURL: "https://gateway.example/v1",
        includeEncryptedReasoning: true,
      }).execute("hi");

      expect(mockClient.responses.create.mock.calls[0][0].include).toEqual([
        "reasoning.encrypted_content",
      ]);
    });

    it("does not replay stored reasoning once the flag is turned off", async () => {
      // The documented way out of the model-switch rejection: blobs already in
      // the history have to stop going out too, not just new ones stop being
      // requested.
      mockClient.responses.create
        .mockResolvedValueOnce(responseWith([reasoningItem("rs_1"), message]))
        .mockResolvedValueOnce(responseWith([message]));

      const agentWithHistory = makeAgent();
      agentWithHistory["history"].transient = false;

      await agentWithHistory.execute("first");
      agentWithHistory["config"].includeEncryptedReasoning = false;
      await agentWithHistory.execute("second");

      const replayed = mockClient.responses.create.mock.calls[1][0].input;
      expect(replayed.some((item: any) => item.type === "reasoning")).toBe(
        false
      );
    });

    it("keeps reasoning from a turn that used a built-in tool", async () => {
      // `web_search_call` and friends are not stored, so the replay is
      // [reasoning, reasoning, message] where the model emitted
      // [reasoning, web_search_call, reasoning, message]. The API accepts that
      // on this flow (probed live 2026-09-10), so the reasoning is kept rather
      // than costing every builtInTools user their prompt-cache continuity.
      mockClient.responses.create
        .mockResolvedValueOnce(
          responseWith([
            reasoningItem("rs_1"),
            { type: "web_search_call", id: "ws_1", status: "completed" },
            reasoningItem("rs_2"),
            message,
          ])
        )
        .mockResolvedValueOnce(responseWith([message]));

      const agentWithHistory = makeAgent();
      agentWithHistory["history"].transient = false;

      await agentWithHistory.execute("first");
      await agentWithHistory.execute("second");

      const replayed = mockClient.responses.create.mock.calls[1][0].input;
      expect(
        replayed
          .filter((item: any) => item.type === "reasoning")
          .map((i: any) => i.id)
      ).toEqual(["rs_1", "rs_2"]);
      // The built-in tool call itself is not modelled by history.
      expect(
        replayed.some((item: any) => item.type === "web_search_call")
      ).toBe(false);
    });
  });

  describe("cancellation", () => {
    const toolPrompt = {
      name: "test_tool",
      description: "A test tool",
      input_schema: {
        type: "object",
        properties: { param: { type: "string" } },
        required: ["param"],
      },
    };

    const textResponse = {
      output: [{ type: "message", status: "completed", content: "Hello" }],
      output_text: "Hello",
      usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
    };

    const toolCallResponse = {
      output: [
        {
          type: "function_call",
          id: "fc_1",
          call_id: "call_1",
          name: "test_tool",
          arguments: JSON.stringify({ param: "value" }),
        },
      ],
      output_text: "",
      usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
    };

    it("forwards the signal to the API call", async () => {
      const controller = new AbortController();
      mockClient.responses.create.mockResolvedValue(textResponse);

      await agent.execute("test input", { signal: controller.signal });

      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.any(Object),
        { signal: controller.signal }
      );
    });

    it("throws an AbortError when the SDK reports the request was aborted", async () => {
      const controller = new AbortController();
      agent.on(AgentEvent.ERROR, () => {});
      mockClient.responses.create.mockImplementation(async () => {
        controller.abort();
        throw Object.assign(new Error("Request was aborted."), {
          name: "APIUserAbortError",
        });
      });

      const error = await agent
        .execute("test input", { signal: controller.signal })
        .catch((e) => e);

      expect(error).toBeInstanceOf(AbortError);
      expect(error.message).toBe("Execution of agent TestAgent was aborted");
    });

    it("does not run tools, or write an unanswered call, when aborted mid-turn", async () => {
      const controller = new AbortController();
      agent.on(AgentEvent.ERROR, () => {});
      const toolExecute = jest.fn().mockResolvedValue("never called");
      agent["tools"].set("test_tool", {
        execute: toolExecute,
        getPrompt: jest.fn().mockReturnValue(toolPrompt),
      } as any);

      mockClient.responses.create.mockImplementation(async () => {
        controller.abort();
        return toolCallResponse;
      });

      await expect(
        agent.execute("test input", { signal: controller.signal })
      ).rejects.toBeInstanceOf(AbortError);

      expect(toolExecute).not.toHaveBeenCalled();
      expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
      const entries = agent.getHistoryEntries();
      expect(
        entries.some((entry) =>
          entry.content.some((block: any) => block.type === "tool_use")
        )
      ).toBe(false);
    });

    it("passes the signal on to the tools it runs", async () => {
      const controller = new AbortController();
      const toolExecute = jest.fn().mockResolvedValue("sunny");
      agent["tools"].set("test_tool", {
        execute: toolExecute,
        getPrompt: jest.fn().mockReturnValue(toolPrompt),
      } as any);

      mockClient.responses.create
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(textResponse);

      await agent.execute("test input", { signal: controller.signal });

      expect(toolExecute).toHaveBeenCalledWith(
        "1",
        "TestAgent",
        { param: "value" },
        "fc_1",
        "gpt-4.1-mini",
        "openai",
        { signal: controller.signal }
      );
    });

    it("aborts a stream in flight", async () => {
      // The SDK's stream iterator swallows the abort and just stops yielding,
      // which without the agent's own check reads as a malformed stream rather
      // than a cancellation.
      const controller = new AbortController();
      agent.on(AgentEvent.ERROR, () => {});
      mockClient.responses.create.mockImplementation(async () => ({
        async *[Symbol.asyncIterator]() {
          yield { type: "response.output_text.delta", delta: "Hel" };
          controller.abort();
        },
      }));

      const chunks: string[] = [];
      const error = await (async () => {
        try {
          for await (const chunk of agent.executeStream("hi", {
            signal: controller.signal,
          })) {
            chunks.push(chunk.content);
          }
        } catch (e) {
          return e;
        }
      })();

      expect(chunks).toEqual(["Hel"]);
      expect(error).toBeInstanceOf(AbortError);
      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true }),
        { signal: controller.signal }
      );
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
        "openai",
        { signal: undefined }
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

  // ---------------------------------------------------------------------------
  // Partial turn capture
  // ---------------------------------------------------------------------------

  describe("partial turn capture", () => {
    // Node's EventEmitter rethrows an "error" event that nobody listens for,
    // which would mask the error the agent means to throw.
    beforeEach(() => agent.on(AgentEvent.ERROR, () => {}));

    async function collectStream(gen: AsyncGenerator<any>): Promise<any[]> {
      const results: any[] = [];
      for await (const chunk of gen) results.push(chunk);
      return results;
    }

    it("salvages the reasoning summary when the stream dies before response.completed", async () => {
      mockClient.responses.create.mockResolvedValue(
        (async function* () {
          yield {
            type: "response.reasoning_summary_text.delta",
            delta: "Weighing ",
          };
          yield {
            type: "response.reasoning_summary_text.delta",
            delta: "the options",
          };
          yield { type: "response.output_text.delta", delta: "The answer" };
          throw new Error("socket hang up");
        })()
      );

      const error = await collectStream(agent.executeStream("Hi")).catch(
        (e) => e
      );

      expect(agent.lastPartialTurn).toEqual(
        expect.objectContaining({
          text: "The answer",
          reasoning: "Weighing the options",
          toolCalls: [],
          reason: "error",
        })
      );
      expect(error.partial).toBe(agent.lastPartialTurn);
      expect(
        agent.getHistoryEntries().some((entry) => entry.role === "assistant")
      ).toBe(false);
    });

    it("keeps a half-streamed function call", async () => {
      mockClient.responses.create.mockResolvedValue(
        (async function* () {
          yield {
            type: "response.output_item.added",
            output_index: 0,
            item: { type: "function_call", call_id: "call_1", name: "search" },
          };
          yield {
            type: "response.function_call_arguments.delta",
            output_index: 0,
            delta: '{"q":"wea',
          };
          throw new Error("socket hang up");
        })()
      );

      await collectStream(agent.executeStream("Hi")).catch(() => undefined);

      expect(agent.lastPartialTurn?.toolCalls).toEqual([
        { id: "call_1", name: "search", arguments: '{"q":"wea' },
      ]);
    });

    it("leaves lastPartialTurn unset when the stream completes", async () => {
      mockClient.responses.create.mockResolvedValue(
        (async function* () {
          yield { type: "response.output_text.delta", delta: "Hello" };
          yield {
            type: "response.completed",
            response: {
              output: [],
              output_text: "Hello",
              usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7 },
            },
          };
        })()
      );

      await collectStream(agent.executeStream("Hi"));

      expect(agent.lastPartialTurn).toBeUndefined();
    });
  });
});

describe("describeOpenAIError", () => {
  it("reads the standard OpenAI error envelope", () => {
    expect(
      describeOpenAIError({
        status: 429,
        error: { message: "Rate limited", code: "rate_limit_exceeded" },
      })
    ).toMatchObject({
      message: "Rate limited",
      code: "rate_limit_exceeded",
      status: 429,
    });
  });

  it("reads a `detail` body, as the Codex backend sends", () => {
    expect(
      describeOpenAIError({
        status: 400,
        error: { detail: "Store must be set to false" },
      })
    ).toMatchObject({ message: "Store must be set to false", status: 400 });
  });

  it("falls back to the SDK message when there is no body", () => {
    expect(describeOpenAIError({ status: 500, message: "boom" }).message).toBe(
      "boom"
    );
  });

  it("does not throw on an error with no usable fields", () => {
    expect(describeOpenAIError({}).message).toBe("Unknown error");
    expect(describeOpenAIError(undefined).message).toBe("Unknown error");
  });

  it("handles a string error body", () => {
    expect(describeOpenAIError({ error: "plain text" }).message).toBe(
      "plain text"
    );
  });
});

describe("wrapErrorBodyFetch", () => {
  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Content-Length": "999" },
    });

  it("passes successful responses through untouched", async () => {
    const original = jsonResponse(200, { ok: true });
    const base = jest.fn().mockResolvedValue(original);

    const res = await wrapErrorBodyFetch(base as any)("http://x");

    expect(res).toBe(original);
  });

  it("nests a `detail` body under `error` so the SDK can read it", async () => {
    const base = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(400, { detail: "Instructions are required" })
      );

    const res = await wrapErrorBodyFetch(base as any)("http://x");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toBe("Instructions are required");
    // The stale length header must not survive the rewrite.
    expect(res.headers.get("content-length")).toBeNull();
  });

  it("leaves an already-OpenAI-shaped error alone", async () => {
    const base = jest
      .fn()
      .mockResolvedValue(jsonResponse(400, { error: { message: "Bad" } }));

    const body = await (
      await wrapErrorBodyFetch(base as any)("http://x")
    ).json();

    expect(body).toEqual({ error: { message: "Bad" } });
  });

  it("passes a non-JSON error body through as text", async () => {
    const base = jest
      .fn()
      .mockResolvedValue(new Response("<html>502</html>", { status: 502 }));

    const res = await wrapErrorBodyFetch(base as any)("http://x");

    expect(await res.text()).toBe("<html>502</html>");
    expect(res.status).toBe(502);
  });
});
