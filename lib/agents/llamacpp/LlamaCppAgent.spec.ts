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

      expect(result).toEqual(models);
      expect(mockClient.models.list).toHaveBeenCalled();
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
      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
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
      expect(agent.lastTokenUsage).toEqual({
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
