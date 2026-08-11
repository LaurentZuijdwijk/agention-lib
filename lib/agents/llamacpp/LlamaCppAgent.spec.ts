// @ts-nocheck
import OpenAI from "openai";
import { LlamaCppAgent } from "./LlamaCppAgent";
import { AgentEvent } from "../AgentEvent";
import { ExecutionError } from "../errors/AgentError";

// Mock the openai SDK
jest.mock("openai");

describe("LlamaCppAgent", () => {
  let mockClient: any;
  let agent: LlamaCppAgent;

  beforeEach(() => {
    jest.resetAllMocks();

    mockClient = {
      chat: { completions: { create: jest.fn() } },
      models: { list: jest.fn() },
    };

    (OpenAI as unknown as jest.Mock).mockImplementation(() => mockClient);

    agent = new LlamaCppAgent({
      apiKey: "",
      id: "1",
      name: "TestAgent",
      description: "Test Description",
    });

    // Node's EventEmitter throws on an unhandled "error" event; register a
    // no-op listener so the agent's own error-path emits don't blow up here.
    agent.on(AgentEvent.ERROR, () => {});
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      expect(agent).toBeInstanceOf(LlamaCppAgent);
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: "not-needed",
        baseURL: "http://localhost:8080/v1",
      });
      expect(agent["config"]).toMatchObject({
        model: "default",
        baseURL: "http://localhost:8080/v1",
      });
    });

    it("should accept a custom baseURL via flat config", () => {
      const customAgent = new LlamaCppAgent({
        apiKey: "",
        id: "2",
        name: "Custom",
        description: "d",
        baseURL: "http://my-host:9090/v1",
        model: "qwen2.5-7b-instruct",
      });

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: "not-needed",
        baseURL: "http://my-host:9090/v1",
      });
      expect(customAgent["config"]).toMatchObject({
        model: "qwen2.5-7b-instruct",
        baseURL: "http://my-host:9090/v1",
      });
    });

    it("should accept a custom baseURL via vendorConfig.llamacpp", () => {
      new LlamaCppAgent({
        apiKey: "",
        id: "3",
        name: "Custom",
        description: "d",
        vendorConfig: { llamacpp: { baseURL: "http://vendor-host:1234/v1" } },
      });

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: "not-needed",
        baseURL: "http://vendor-host:1234/v1",
      });
    });

    it("should pass through a real apiKey when provided", () => {
      new LlamaCppAgent({
        apiKey: "sk-local-key",
        id: "4",
        name: "Custom",
        description: "d",
      });

      expect(OpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: "sk-local-key" })
      );
    });
  });

  describe("listModels", () => {
    it("should return the models reported by the server", async () => {
      const models = [{ id: "model-a" }, { id: "model-b" }];
      mockClient.models.list.mockResolvedValue({ data: models });

      const result = await agent.listModels();

      expect(result.map((m) => m.id)).toEqual(["model-a", "model-b"]);
      expect(result.map((m) => m.raw)).toEqual(models);
      expect(mockClient.models.list).toHaveBeenCalled();
    });

    it("should report which models the router has loaded", async () => {
      // Shape verified against llama.cpp b10148 in model-router mode
      const models = [
        {
          id: "Qwen3.6-35B-A3B-Q6_K_P",
          object: "model",
          created: 1786434402,
          owned_by: "llamacpp",
          aliases: ["Qwen3.6-35B-Q6_K_P"],
          tags: [],
          status: {
            value: "loaded",
            args: ["--ctx-size", "120000"],
            preset: "[Qwen3.6-35B-A3B-Q6_K_P]\nctx-size = 120000\n",
          },
          architecture: {
            input_modalities: ["text", "image"],
            output_modalities: ["text"],
          },
          source: "preset",
          can_remove: false,
          meta: {
            n_ctx: 120064,
            n_ctx_train: 262144,
            n_params: 34660610688,
            size: 30638328320,
            ftype: "Q6_K",
          },
        },
        {
          id: "Gemma-4-31B-it-i1-Q4_K_M",
          object: "model",
          created: 1786434402,
          owned_by: "llamacpp",
          // An unloaded model carries no meta — nothing is in memory to describe
          status: { value: "unloaded", args: [], preset: "" },
          source: "preset",
          can_remove: false,
        },
      ];
      mockClient.models.list.mockResolvedValue({ data: models });

      const result = await agent.listModels();

      expect(result[0]).toMatchObject({
        id: "Qwen3.6-35B-A3B-Q6_K_P",
        loaded: true,
        // n_ctx (as loaded) wins over n_ctx_train (the trained ceiling)
        contextLength: 120064,
        ownedBy: "llamacpp",
      });
      expect(result[1]).toMatchObject({
        id: "Gemma-4-31B-it-i1-Q4_K_M",
        loaded: false,
        contextLength: undefined,
      });
      // Vision follows from the declared modalities; tool support is not
      // reported by the server, so it stays unset
      expect(result[0].capabilities).toEqual({ vision: true });
      expect(result[1].capabilities).toEqual({ vision: undefined });
      // Launch args, presets and modalities stay on raw
      expect(result[0].raw.status.args).toEqual(["--ctx-size", "120000"]);
      expect(result[0].raw.architecture.input_modalities).toEqual([
        "text",
        "image",
      ]);
    });

    it("should fall back to the trained context when the model is not loaded with one", async () => {
      mockClient.models.list.mockResolvedValue({
        data: [{ id: "m", meta: { n_ctx_train: 131072 } }],
      });

      const [model] = await agent.listModels();

      expect(model.contextLength).toBe(131072);
    });

    it("should leave loaded undefined on a single-model server", async () => {
      // A plain llama-server reports no status: the one model it lists is the
      // loaded one, so `false` would be actively wrong here.
      mockClient.models.list.mockResolvedValue({ data: [{ id: "default" }] });

      const [model] = await agent.listModels();

      expect(model.loaded).toBeUndefined();
    });

    it("should wrap failures in an ExecutionError", async () => {
      mockClient.models.list.mockRejectedValue(new Error("connection refused"));

      await expect(agent.listModels()).rejects.toThrow(ExecutionError);
      await expect(agent.listModels()).rejects.toThrow(/Failed to list llama\.cpp models/);
    });
  });

  describe("getToolDefinitions", () => {
    it("should format tools as Chat Completions function tools", () => {
      const mockTool = {
        getPrompt: jest.fn().mockReturnValue({
          name: "get_weather",
          description: "Look up the weather",
          input_schema: {
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
          },
        }),
      };

      agent["tools"].set("get_weather", mockTool as any);

      expect(agent["getToolDefinitions"]()).toEqual([
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Look up the weather",
            parameters: {
              type: "object",
              properties: { city: { type: "string" } },
              required: ["city"],
            },
          },
        },
      ]);
    });
  });

  describe("execute", () => {
    it("should call chat.completions.create and return the response text", async () => {
      const mockResponse = {
        choices: [
          {
            finish_reason: "stop",
            message: { role: "assistant", content: "Hello there" },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const eventSpy = jest.spyOn(agent, "emit");

      const result = await agent.execute("Hi");

      expect(result).toBe("Hello there");
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "default",
          stream: false,
          messages: expect.any(Array),
        })
      );
      expect(eventSpy).toHaveBeenCalledWith(AgentEvent.BEFORE_EXECUTE, "Hi");
      expect(eventSpy).toHaveBeenCalledWith(AgentEvent.DONE, mockResponse.choices[0].message, expect.anything());
      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      });
    });

    it("should use llama-server's own timings when the response carries them", async () => {
      // Shape taken from a real llama-server /v1/chat/completions response.
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            finish_reason: "stop",
            message: { role: "assistant", content: "Hey there friend" },
          },
        ],
        usage: { prompt_tokens: 17, completion_tokens: 64, total_tokens: 81 },
        timings: {
          cache_n: 0,
          prompt_n: 17,
          prompt_ms: 400,
          prompt_per_second: 42.5,
          predicted_n: 64,
          predicted_ms: 1000,
          predicted_per_second: 64,
        },
      });

      await agent.execute("Hi");

      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 17,
        output_tokens: 64,
        total_tokens: 81,
        timeToFirstTokenMs: 400,
        generationMs: 1000,
        totalMs: 1400,
        inputTokensPerSecond: 42.5,
        outputTokensPerSecond: 64,
      });
    });

    it("should execute tool calls and continue the conversation with the results", async () => {
      const toolCallResponse = {
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "get_weather", arguments: '{"city":"Paris"}' },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      };
      const finalResponse = {
        choices: [
          {
            finish_reason: "stop",
            message: { role: "assistant", content: "It's sunny in Paris." },
          },
        ],
        usage: { prompt_tokens: 25, completion_tokens: 8, total_tokens: 33 },
      };

      mockClient.chat.completions.create
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(finalResponse);

      const mockTool = {
        execute: jest.fn().mockResolvedValue({ tempC: 22 }),
        getPrompt: jest.fn().mockReturnValue({
          name: "get_weather",
          description: "Look up the weather",
          input_schema: { type: "object", properties: { city: { type: "string" } } },
        }),
      };
      agent["tools"].set("get_weather", mockTool as any);

      const result = await agent.execute("What's the weather in Paris?");

      expect(result).toBe("It's sunny in Paris.");
      expect(mockTool.execute).toHaveBeenCalledWith(
        "1",
        "TestAgent",
        { city: "Paris" },
        "call_1",
        "default",
        "llamacpp"
      );
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);

      // Token usage accumulates across both calls
      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 45,
        output_tokens: 18,
        total_tokens: 63,
      });
    });

    it("should throw MaxTokensExceededError when finish_reason is 'length'", async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [
          { finish_reason: "length", message: { role: "assistant", content: "truncated..." } },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 1024, total_tokens: 1029 },
      });

      await expect(agent.execute("Write a long essay")).rejects.toThrow(
        /maximum token limit/i
      );
    });

    it("should wrap unknown errors in an ExecutionError", async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error("socket hang up"));

      await expect(agent.execute("Hi")).rejects.toThrow(ExecutionError);
      await expect(agent.execute("Hi")).rejects.toThrow(/llama\.cpp error: socket hang up/);
    });
  });
});
