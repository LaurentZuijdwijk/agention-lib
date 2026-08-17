// @ts-nocheck
import OpenAI from "openai";
import { OpenAICompatibleAgent } from "./OpenAICompatibleAgent";
import { AgentEvent } from "../AgentEvent";
import {
  AbortError,
  ExecutionError,
  MaxTokensExceededError,
} from "../errors/AgentError";

jest.mock("openai");

// Minimal concrete subclass used across all tests
class TestAgent extends OpenAICompatibleAgent {
  constructor(config: object = {}) {
    super({
      id: "1",
      name: "TestAgent",
      description: "Test Description",
      baseURL: "http://localhost:9999/v1",
      vendor: "llamacpp",
      ...config,
    } as any);
  }

  protected getVendorName(): string {
    return "test-vendor";
  }
}

// Subclass that injects extra request params
class ExtendedAgent extends TestAgent {
  protected buildExtraRequestParams() {
    return { extra_param: true };
  }
}

describe("OpenAICompatibleAgent", () => {
  let mockClient: any;
  let agent: TestAgent;

  beforeEach(() => {
    jest.resetAllMocks();

    mockClient = {
      chat: { completions: { create: jest.fn() } },
      models: { list: jest.fn() },
    };

    (OpenAI as unknown as jest.Mock).mockImplementation(() => mockClient);

    agent = new TestAgent();
    agent.on(AgentEvent.ERROR, () => {});
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  describe("constructor", () => {
    it("passes defaultHeaders through to the OpenAI client", () => {
      new TestAgent({
        defaultHeaders: { "HTTP-Referer": "https://myapp.example" },
      });

      expect(OpenAI).toHaveBeenLastCalledWith(
        expect.objectContaining({
          defaultHeaders: { "HTTP-Referer": "https://myapp.example" },
        })
      );
    });

    it("initialises the OpenAI client with the provided baseURL and apiKey", () => {
      new TestAgent({ apiKey: "sk-test", baseURL: "http://my-server/v1" });

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: "sk-test",
        baseURL: "http://my-server/v1",
      });
    });

    it("falls back to 'not-needed' when apiKey is empty", () => {
      new TestAgent({ apiKey: "" });

      expect(OpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: "not-needed" })
      );
    });

    it("stores config fields correctly", () => {
      const a = new TestAgent({
        baseURL: "http://x/v1",
        model: "my-model",
        maxTokens: 512,
        temperature: 0.5,
      });

      expect(a["config"]).toMatchObject({
        baseURL: "http://x/v1",
        model: "my-model",
        maxTokens: 512,
        temperature: 0.5,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // listModels
  // ---------------------------------------------------------------------------

  describe("listModels", () => {
    it("normalizes the data array from the models endpoint", async () => {
      const models = [
        { id: "model-a", created: 1700000000, owned_by: "local" },
        { id: "model-b" },
      ];
      mockClient.models.list.mockResolvedValue({ data: models });

      const result = await agent.listModels();

      expect(result).toEqual([
        {
          id: "model-a",
          created: new Date(1700000000 * 1000),
          ownedBy: "local",
          raw: models[0],
        },
        // Local servers often report nothing but the id
        { id: "model-b", created: undefined, ownedBy: undefined, raw: models[1] },
      ]);
      expect(mockClient.models.list).toHaveBeenCalled();
    });

    it("wraps failures in ExecutionError with the vendor name", async () => {
      mockClient.models.list.mockRejectedValue(new Error("connection refused"));

      await expect(agent.listModels()).rejects.toThrow(ExecutionError);
      await expect(agent.listModels()).rejects.toThrow(
        /Failed to list test-vendor models/
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getToolDefinitions
  // ---------------------------------------------------------------------------

  describe("getToolDefinitions", () => {
    it("formats tools as Chat Completions function tools", () => {
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

    it("returns an empty array when no tools are registered", () => {
      expect(agent["getToolDefinitions"]()).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // execute — happy paths
  // ---------------------------------------------------------------------------

  describe("execute", () => {
    const textResponse = (content: string) => ({
      choices: [
        { finish_reason: "stop", message: { role: "assistant", content } },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    it("calls chat.completions.create and returns text content", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        textResponse("Hello there")
      );

      const result = await agent.execute("Hi");

      expect(result).toBe("Hello there");
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ stream: false, messages: expect.any(Array) }),
        { signal: undefined }
      );
    });

    it("accumulates token usage into lastTokenUsage", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        textResponse("ok")
      );

      await agent.execute("Hi");

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      });
    });

    it("resets lastTokenUsage at the start of each execution", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        textResponse("first")
      );
      await agent.execute("first");

      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: "second" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
      await agent.execute("second");

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 1,
        output_tokens: 1,
        total_tokens: 2,
      });
    });

    it("emits BEFORE_EXECUTE and DONE events", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        textResponse("ok")
      );
      const spy = jest.spyOn(agent, "emit");

      await agent.execute("Hi");

      expect(spy).toHaveBeenCalledWith(AgentEvent.BEFORE_EXECUTE, "Hi");
      expect(spy).toHaveBeenCalledWith(
        AgentEvent.DONE,
        expect.objectContaining({ content: "ok" }),
        expect.any(Object)
      );
    });

    it("accepts MessageContent[] as input", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        textResponse("ok")
      );

      const result = await agent.execute([{ type: "text", text: "hello" }]);

      expect(result).toBe("ok");
    });

    it("merges buildExtraRequestParams into the API call", async () => {
      const extended = new ExtendedAgent();
      extended.on(AgentEvent.ERROR, () => {});
      mockClient.chat.completions.create.mockResolvedValue(textResponse("ok"));

      await extended.execute("Hi");

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ extra_param: true }),
        { signal: undefined }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // execute — tool calls
  // ---------------------------------------------------------------------------

  describe("execute with tool calls", () => {
    it("executes tool calls and continues conversation with results", async () => {
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
        undefined, // model not set on this agent
        "llamacpp", // this.vendor
        { signal: undefined }
      );
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 45,
        output_tokens: 18,
        total_tokens: 63,
      });
    });

    it("replays non-streamed reasoning_content on the follow-up request", async () => {
      const toolCallResponse = {
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              reasoning_content: "The user wants Paris weather.",
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
      };
      const finalResponse = {
        choices: [
          { finish_reason: "stop", message: { role: "assistant", content: "It's sunny in Paris." } },
        ],
      };

      mockClient.chat.completions.create
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(finalResponse);

      agent["tools"].set("get_weather", {
        execute: jest.fn().mockResolvedValue({ tempC: 22 }),
        getPrompt: jest.fn().mockReturnValue({
          name: "get_weather",
          description: "Look up the weather",
          input_schema: { type: "object", properties: { city: { type: "string" } } },
        }),
      } as any);

      await agent.execute("What's the weather in Paris?");

      const followUp = mockClient.chat.completions.create.mock.calls[1][0];
      const assistantMessage = followUp.messages.find((m: any) => m.role === "assistant");

      expect(assistantMessage.reasoning_content).toBe("The user wants Paris weather.");
    });

    it("returns a tool-not-found error message for unknown tools", async () => {
      const toolCallResponse = {
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_x",
                  type: "function",
                  function: { name: "unknown_tool", arguments: "{}" },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      };
      const finalResponse = {
        choices: [
          { finish_reason: "stop", message: { role: "assistant", content: "Sorry." } },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      };

      mockClient.chat.completions.create
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(finalResponse);

      const spy = jest.spyOn(agent, "emit");
      await agent.execute("Use unknown tool");

      expect(spy).toHaveBeenCalledWith(
        AgentEvent.TOOL_ERROR,
        expect.objectContaining({ message: expect.stringContaining("unknown_tool") })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // reasoning replay fallback
  //
  // Some OpenAI-compatible servers (Cerebras, verified live 2026-08-17) 400 on
  // any message carrying a replayed `reasoning_content` field, while others
  // (DeepSeek, llama.cpp) require it. These use the same tool-call round trip
  // as "replays non-streamed reasoning_content on the follow-up request" above
  // to get a reasoning-bearing assistant turn into history within one
  // execute() call, since the default TestAgent's history is transient.
  // ---------------------------------------------------------------------------

  describe("reasoning replay fallback", () => {
    const toolCallResponse = {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            reasoning_content: "The user wants Paris weather.",
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
    };
    const finalResponse = {
      choices: [
        { finish_reason: "stop", message: { role: "assistant", content: "It's sunny in Paris." } },
      ],
    };

    beforeEach(() => {
      agent["tools"].set("get_weather", {
        execute: jest.fn().mockResolvedValue({ tempC: 22 }),
        getPrompt: jest.fn().mockReturnValue({
          name: "get_weather",
          description: "Look up the weather",
          input_schema: { type: "object", properties: { city: { type: "string" } } },
        }),
      } as any);
    });

    it("retries without reasoning_content when the provider 400s on the replay, and remembers it", async () => {
      const reasoningRejected = Object.assign(
        new OpenAI.APIError(
          400,
          { message: "messages.2.assistant.reasoning_content: unsupported" },
          "unsupported field",
          {}
        ),
        { status: 400 } // jest.mock("openai") automocks the constructor body away
      );

      mockClient.chat.completions.create
        .mockResolvedValueOnce(toolCallResponse) // initial turn — produces the reasoning
        .mockRejectedValueOnce(reasoningRejected) // follow-up, replays reasoning_content — 400
        .mockResolvedValueOnce(finalResponse); // retry without it — succeeds

      const result = await agent.execute("What's the weather in Paris?");

      expect(result).toBe("It's sunny in Paris.");
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(3);

      const failedAttempt = mockClient.chat.completions.create.mock.calls[1][0];
      const retryAttempt = mockClient.chat.completions.create.mock.calls[2][0];
      const failedAssistantMsg = failedAttempt.messages.find((m: any) => m.role === "assistant");
      const retryAssistantMsg = retryAttempt.messages.find((m: any) => m.role === "assistant");

      expect(failedAssistantMsg.reasoning_content).toBe("The user wants Paris weather.");
      expect(retryAssistantMsg).not.toHaveProperty("reasoning_content");
      expect(agent["reasoningReplaySupported"]).toBe(false);
    });

    it("does not retry a 400 when there is no reasoning in history to replay", async () => {
      const plainRejection = Object.assign(
        new OpenAI.APIError(400, { message: "bad request" }, "bad request", {}),
        { status: 400 }
      );
      mockClient.chat.completions.create.mockRejectedValue(plainRejection);

      const { ApiError } = await import("../errors/AgentError");
      await expect(agent.execute("Hi")).rejects.toThrow(ApiError);
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it("surfaces the original error when the retry fails too", async () => {
      const reasoningRejected = Object.assign(
        new OpenAI.APIError(
          400,
          { message: "messages.2.assistant.reasoning_content: unsupported" },
          "unsupported field",
          {}
        ),
        { status: 400 }
      );
      const unrelatedRejection = Object.assign(
        new OpenAI.APIError(400, { message: "still broken" }, "still broken", {}),
        { status: 400 }
      );

      mockClient.chat.completions.create
        .mockResolvedValueOnce(toolCallResponse)
        .mockRejectedValueOnce(reasoningRejected)
        .mockRejectedValueOnce(unrelatedRejection);

      // The tool-follow-up path always wraps its error in ExecutionError (see
      // handleResponse's second try/catch), so the wrapper type can't
      // distinguish which of the two 400s propagated. What this asserts is
      // that both attempts actually happened (the initial call plus one
      // retry, not more) and that failing the retry did not leave the agent
      // thinking reasoning replay is supported.
      await expect(agent.execute("What's the weather in Paris?")).rejects.toThrow(
        ExecutionError
      );
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(3);
      expect(agent["reasoningReplaySupported"]).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // cancellation
  // ---------------------------------------------------------------------------

  describe("cancellation", () => {
    const textResponse = (content: string) => ({
      choices: [
        { finish_reason: "stop", message: { role: "assistant", content } },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const toolPrompt = {
      name: "get_weather",
      description: "Look up the weather",
      input_schema: {
        type: "object",
        properties: { city: { type: "string" } },
      },
    };

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

    it("forwards the signal to the API call", async () => {
      const controller = new AbortController();
      mockClient.chat.completions.create.mockResolvedValue(
        textResponse("Hello")
      );

      await agent.execute("Hi", { signal: controller.signal });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.any(Object),
        { signal: controller.signal }
      );
    });

    it("throws an AbortError when the SDK reports the request was aborted", async () => {
      const controller = new AbortController();
      mockClient.chat.completions.create.mockImplementation(async () => {
        controller.abort();
        throw Object.assign(new Error("Request was aborted."), {
          name: "APIUserAbortError",
        });
      });

      const error = await agent
        .execute("Hi", { signal: controller.signal })
        .catch((e) => e);

      expect(error).toBeInstanceOf(AbortError);
      expect(error.message).toBe("Execution of agent TestAgent was aborted");
    });

    it("does not run tools, or write an unanswered call, when aborted mid-turn", async () => {
      const controller = new AbortController();
      const toolExecute = jest.fn().mockResolvedValue("never called");
      agent["tools"].set("get_weather", {
        execute: toolExecute,
        getPrompt: jest.fn().mockReturnValue(toolPrompt),
      } as any);

      mockClient.chat.completions.create.mockImplementation(async () => {
        controller.abort();
        return toolCallResponse;
      });

      await expect(
        agent.execute("Weather in Paris?", { signal: controller.signal })
      ).rejects.toBeInstanceOf(AbortError);

      expect(toolExecute).not.toHaveBeenCalled();
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
      const entries = agent.getHistoryEntries();
      expect(
        entries.some((entry) =>
          entry.content.some((block: any) => block.type === "tool_use")
        )
      ).toBe(false);
    });

    it("passes the signal on to the tools it runs", async () => {
      const controller = new AbortController();
      const toolExecute = jest.fn().mockResolvedValue({ tempC: 22 });
      agent["tools"].set("get_weather", {
        execute: toolExecute,
        getPrompt: jest.fn().mockReturnValue(toolPrompt),
      } as any);

      mockClient.chat.completions.create
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(textResponse("It's sunny in Paris."));

      await agent.execute("Weather in Paris?", { signal: controller.signal });

      expect(toolExecute).toHaveBeenCalledWith(
        "1",
        "TestAgent",
        { city: "Paris" },
        "call_1",
        undefined,
        "llamacpp",
        { signal: controller.signal }
      );
    });

    it("aborts a stream in flight", async () => {
      // The SDK's stream iterator swallows the abort and just stops yielding,
      // so the agent has to notice the signal itself — otherwise this reads as
      // a complete (if short) turn.
      const controller = new AbortController();
      mockClient.chat.completions.create.mockImplementation(async () => ({
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ finish_reason: null, delta: { content: "Hel" } }] };
          controller.abort();
        },
      }));

      const chunks: string[] = [];
      const error = await (async () => {
        try {
          for await (const chunk of agent.executeStream("Hi", {
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
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true }),
        { signal: controller.signal }
      );
      // The partial text is not passed off as a finished assistant turn
      expect(
        agent.getHistoryEntries().some((entry) => entry.role === "assistant")
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // execute — error paths
  // ---------------------------------------------------------------------------

  describe("execute error handling", () => {
    it("throws MaxTokensExceededError when finish_reason is 'length'", async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [
          {
            finish_reason: "length",
            message: { role: "assistant", content: "truncated..." },
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 1024, total_tokens: 1029 },
      });

      await expect(agent.execute("Write a long essay")).rejects.toThrow(
        MaxTokensExceededError
      );
      await expect(agent.execute("Write a long essay")).rejects.toThrow(
        /maximum token limit/i
      );
    });

    it("wraps OpenAI.APIError in ApiError", async () => {
      const apiError = new OpenAI.APIError(429, { message: "rate limited" }, "rate limited", {});
      mockClient.chat.completions.create.mockRejectedValue(apiError);

      const { ApiError } = await import("../errors/AgentError");
      await expect(agent.execute("Hi")).rejects.toThrow(ApiError);
    });

    it("wraps unknown errors in ExecutionError with vendor name", async () => {
      mockClient.chat.completions.create.mockRejectedValue(
        new Error("socket hang up")
      );

      await expect(agent.execute("Hi")).rejects.toThrow(ExecutionError);
      await expect(agent.execute("Hi")).rejects.toThrow(
        /test-vendor error: socket hang up/
      );
    });

    it("re-throws existing ExecutionError without double-wrapping", async () => {
      const original = new ExecutionError("already wrapped");
      mockClient.chat.completions.create.mockRejectedValue(original);

      await expect(agent.execute("Hi")).rejects.toThrow("already wrapped");
    });
  });

  // ---------------------------------------------------------------------------
  // parseUsage
  // ---------------------------------------------------------------------------

  describe("parseUsage", () => {
    it("maps OpenAI usage fields to the normalized TokenUsage shape", () => {
      const response = {
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      } as any;

      expect(agent["parseUsage"](response)).toEqual({
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      });
    });

    it("returns zeros when usage is absent", () => {
      expect(agent["parseUsage"]({ usage: undefined } as any)).toEqual({
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // buildExtraRequestParams default
  // ---------------------------------------------------------------------------

  describe("buildExtraRequestParams", () => {
    it("returns an empty object by default", () => {
      expect(agent["buildExtraRequestParams"]()).toEqual({});
    });
  });

  // ---------------------------------------------------------------------------
  // executeStream
  // ---------------------------------------------------------------------------

  describe("executeStream", () => {
    // Helper: build a mock async iterable from an array of chunks
    function makeStream(chunks: object[]) {
      return (async function* () {
        for (const chunk of chunks) yield chunk;
      })();
    }

    // Helper: collect all chunks from the generator
    async function collectStream(gen: AsyncGenerator<any>): Promise<any[]> {
      const results: any[] = [];
      for await (const chunk of gen) results.push(chunk);
      return results;
    }

    it("yields text chunks and emits CHUNK events", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          { choices: [{ finish_reason: null, delta: { content: "Hello" } }] },
          { choices: [{ finish_reason: null, delta: { content: " world" } }] },
          { choices: [{ finish_reason: "stop", delta: {} }] },
          { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
        ])
      );

      const spy = jest.spyOn(agent, "emit");
      const chunks = await collectStream(agent.executeStream("Hi"));

      expect(chunks).toEqual([
        { type: "text", content: "Hello" },
        { type: "text", content: " world" },
      ]);
      expect(spy).toHaveBeenCalledWith(AgentEvent.CHUNK, "Hello");
      expect(spy).toHaveBeenCalledWith(AgentEvent.CHUNK, " world");
    });

    it("accumulates token usage from the final usage chunk", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          { choices: [{ finish_reason: "stop", delta: { content: "ok" } }] },
          { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
        ])
      );

      await collectStream(agent.executeStream("Hi"));

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      });
    });

    it("times the stream, splitting first token from generation", async () => {
      let now = 1000;
      jest.spyOn(Date, "now").mockImplementation(() => now);

      mockClient.chat.completions.create.mockImplementation(async () => {
        now += 300; // request round trip, before any token arrives
        return makeStream([
          { choices: [{ finish_reason: null, delta: { content: "ok" } }] },
          { choices: [{ finish_reason: "stop", delta: { content: "!" } }] },
          {
            choices: [],
            usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
          },
        ]);
      });

      const stream = agent.executeStream("Hi");
      // Advance the clock between chunks so generation takes measurable time.
      for await (const _chunk of stream) {
        now += 100;
      }

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 30,
        output_tokens: 10,
        timeToFirstTokenMs: 300,
        generationMs: 200,
        totalMs: 500,
        inputTokensPerSecond: 100,
        outputTokensPerSecond: 50,
      });

      jest.restoreAllMocks();
    });

    it("accumulates usage attached to the final content chunk (OpenRouter)", async () => {
      // OpenRouter does not send a separate choice-less usage chunk — it hangs
      // usage off the last content chunk, alongside finish_reason. Shape taken
      // from a real openrouter.ai/api/v1 stream.
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          { choices: [{ finish_reason: null, delta: { content: "Hi" } }] },
          {
            choices: [
              { index: 0, delta: { content: "", role: "assistant" }, finish_reason: "stop" },
            ],
            usage: {
              prompt_tokens: 14,
              completion_tokens: 7,
              total_tokens: 21,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
          },
        ])
      );

      await collectStream(agent.executeStream("Hi"));

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 14,
        output_tokens: 7,
        total_tokens: 21,
      });
    });

    it("counts usage once when a provider sends it on both chunk shapes", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          {
            choices: [{ finish_reason: "stop", delta: { content: "ok" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          },
          {
            choices: [],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          },
        ])
      );

      await collectStream(agent.executeStream("Hi"));

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      });
    });

    it("records reasoning tokens from completion_tokens_details", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          { choices: [{ finish_reason: "stop", delta: { content: "ok" } }] },
          {
            choices: [],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 50,
              total_tokens: 60,
              completion_tokens_details: { reasoning_tokens: 42 },
            },
          },
        ])
      );

      await collectStream(agent.executeStream("Hi"));

      expect(agent.lastTokenUsage).toMatchObject({
        output_tokens: 50,
        reasoning_tokens: 42,
      });
    });

    it("yields reasoning chunks and emits REASONING_CHUNK events", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          { choices: [{ finish_reason: null, delta: { reasoning_content: "Let me think..." } }] },
          { choices: [{ finish_reason: null, delta: { content: "Answer." } }] },
          { choices: [{ finish_reason: "stop", delta: {} }] },
          { choices: [] },
        ])
      );

      const spy = jest.spyOn(agent, "emit");
      const chunks = await collectStream(agent.executeStream("Hi"));

      expect(chunks).toEqual([
        { type: "reasoning", content: "Let me think..." },
        { type: "text", content: "Answer." },
      ]);
      expect(spy).toHaveBeenCalledWith(AgentEvent.REASONING_CHUNK, "Let me think...");
    });

    it("handles OpenRouter-style delta.reasoning chunks without leaking into text", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          { choices: [{ finish_reason: null, delta: { reasoning: "Thinking step." } }] },
          { choices: [{ finish_reason: null, delta: { content: "Final answer." } }] },
          { choices: [{ finish_reason: "stop", delta: {} }] },
          { choices: [] },
        ])
      );

      const spy = jest.spyOn(agent, "emit");
      const chunks = await collectStream(agent.executeStream("Hi"));

      expect(chunks).toEqual([
        { type: "reasoning", content: "Thinking step." },
        { type: "text", content: "Final answer." },
      ]);
      expect(spy).toHaveBeenCalledWith(AgentEvent.REASONING_CHUNK, "Thinking step.");

      // Reasoning must not leak into text chunks
      const textChunks = chunks.filter((c) => c.type === "text");
      expect(textChunks).toEqual([{ type: "text", content: "Final answer." }]);
      expect(spy).not.toHaveBeenCalledWith(AgentEvent.CHUNK, "Thinking step.");

      // Reasoning is kept in history as a thinking block, separate from the text
      const entries = agent["history"].getEntries();
      const assistantEntry = entries[entries.length - 1];
      expect(assistantEntry.role).toBe("assistant");
      expect(assistantEntry.content).toEqual([
        { type: "thinking", thinking: "Thinking step." },
        { type: "text", text: "Final answer." },
      ]);
    });

    it("prefers delta.reasoning over delta.reasoning_content when both are present", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          {
            choices: [{
              finish_reason: null,
              delta: { reasoning: "OpenRouter", reasoning_content: "DeepSeek" },
            }],
          },
          { choices: [{ finish_reason: "stop", delta: {} }] },
          { choices: [] },
        ])
      );

      const chunks = await collectStream(agent.executeStream("Hi"));

      expect(chunks).toEqual([{ type: "reasoning", content: "OpenRouter" }]);
    });

    it("handles tool calls: executes tools and continues streaming", async () => {
      const toolCallStream = makeStream([
        {
          choices: [{
            finish_reason: null,
            delta: {
              tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "get_weat", arguments: "" } }],
            },
          }],
        },
        {
          choices: [{
            finish_reason: null,
            delta: {
              tool_calls: [{ index: 0, function: { name: "her", arguments: '{"city":"Paris"}' } }],
            },
          }],
        },
        { choices: [{ finish_reason: "tool_calls", delta: {} }] },
        { choices: [] },
      ]);

      const finalStream = makeStream([
        { choices: [{ finish_reason: "stop", delta: { content: "Sunny in Paris." } }] },
        { choices: [] },
      ]);

      mockClient.chat.completions.create
        .mockResolvedValueOnce(toolCallStream)
        .mockResolvedValueOnce(finalStream);

      const mockTool = {
        execute: jest.fn().mockResolvedValue({ tempC: 22 }),
        getPrompt: jest.fn().mockReturnValue({
          name: "get_weather",
          description: "Weather",
          input_schema: { type: "object", properties: {} },
        }),
      };
      agent["tools"].set("get_weather", mockTool as any);

      const chunks = await collectStream(agent.executeStream("Weather in Paris?"));

      expect(chunks).toEqual([{ type: "text", content: "Sunny in Paris." }]);
      expect(mockTool.execute).toHaveBeenCalledWith(
        "1", "TestAgent", { city: "Paris" }, "call_1", undefined, "llamacpp", { signal: undefined }
      );
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    // DeepSeek's thinking mode rejects a follow-up request whose assistant turn
    // dropped its reasoning, which only bites once an agent loop makes a second
    // request — hence the round-trip assertions on the *next* call's messages.
    it("replays streamed reasoning as reasoning_content on the follow-up tool-call request", async () => {
      const toolCallStream = makeStream([
        { choices: [{ finish_reason: null, delta: { reasoning_content: "I should check the weather." } }] },
        {
          choices: [{
            finish_reason: null,
            delta: {
              tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"city":"Paris"}' } }],
            },
          }],
        },
        { choices: [{ finish_reason: "tool_calls", delta: {} }] },
        { choices: [] },
      ]);

      const finalStream = makeStream([
        { choices: [{ finish_reason: "stop", delta: { content: "Sunny in Paris." } }] },
        { choices: [] },
      ]);

      mockClient.chat.completions.create
        .mockResolvedValueOnce(toolCallStream)
        .mockResolvedValueOnce(finalStream);

      const mockTool = {
        execute: jest.fn().mockResolvedValue({ tempC: 22 }),
        getPrompt: jest.fn().mockReturnValue({
          name: "get_weather",
          description: "Weather",
          input_schema: { type: "object", properties: {} },
        }),
      };
      agent["tools"].set("get_weather", mockTool as any);

      await collectStream(agent.executeStream("Weather in Paris?"));

      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
      const followUp = mockClient.chat.completions.create.mock.calls[1][0];
      const assistantMessage = followUp.messages.find((m: any) => m.role === "assistant");

      expect(assistantMessage.reasoning_content).toBe("I should check the weather.");
      expect(assistantMessage.tool_calls).toHaveLength(1);
    });

    it("replays reasoning assembled from multiple deltas", async () => {
      const toolCallStream = makeStream([
        { choices: [{ finish_reason: null, delta: { reasoning: "First " } }] },
        { choices: [{ finish_reason: null, delta: { reasoning: "then second." } }] },
        {
          choices: [{
            finish_reason: null,
            delta: {
              tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "noop", arguments: "{}" } }],
            },
          }],
        },
        { choices: [{ finish_reason: "tool_calls", delta: {} }] },
        { choices: [] },
      ]);

      mockClient.chat.completions.create
        .mockResolvedValueOnce(toolCallStream)
        .mockResolvedValueOnce(makeStream([{ choices: [{ finish_reason: "stop", delta: { content: "done" } }] }]));

      agent["tools"].set("noop", {
        execute: jest.fn().mockResolvedValue("ok"),
        getPrompt: jest.fn().mockReturnValue({
          name: "noop",
          description: "noop",
          input_schema: { type: "object", properties: {} },
        }),
      } as any);

      await collectStream(agent.executeStream("go"));

      const followUp = mockClient.chat.completions.create.mock.calls[1][0];
      const assistantMessage = followUp.messages.find((m: any) => m.role === "assistant");

      expect(assistantMessage.reasoning_content).toBe("First then second.");
    });

    it("omits reasoning_content entirely when the model produced no reasoning", async () => {
      const toolCallStream = makeStream([
        {
          choices: [{
            finish_reason: null,
            delta: {
              tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "noop", arguments: "{}" } }],
            },
          }],
        },
        { choices: [{ finish_reason: "tool_calls", delta: {} }] },
        { choices: [] },
      ]);

      mockClient.chat.completions.create
        .mockResolvedValueOnce(toolCallStream)
        .mockResolvedValueOnce(makeStream([{ choices: [{ finish_reason: "stop", delta: { content: "done" } }] }]));

      agent["tools"].set("noop", {
        execute: jest.fn().mockResolvedValue("ok"),
        getPrompt: jest.fn().mockReturnValue({
          name: "noop",
          description: "noop",
          input_schema: { type: "object", properties: {} },
        }),
      } as any);

      await collectStream(agent.executeStream("go"));

      const followUp = mockClient.chat.completions.create.mock.calls[1][0];
      const assistantMessage = followUp.messages.find((m: any) => m.role === "assistant");

      expect(assistantMessage).not.toHaveProperty("reasoning_content");
    });

    it("emits BEFORE_EXECUTE and DONE events", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          { choices: [{ finish_reason: "stop", delta: { content: "hi" } }] },
          { choices: [], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } },
        ])
      );

      const spy = jest.spyOn(agent, "emit");
      await collectStream(agent.executeStream("test"));

      expect(spy).toHaveBeenCalledWith(AgentEvent.BEFORE_EXECUTE, "test");
      expect(spy).toHaveBeenCalledWith(AgentEvent.DONE, expect.any(Object), expect.objectContaining({ input_tokens: 5 }));
    });

    it("throws MaxTokensExceededError when finish_reason is 'length'", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          { choices: [{ finish_reason: null, delta: { content: "truncated" } }] },
          { choices: [{ finish_reason: "length", delta: {} }] },
          { choices: [] },
        ])
      );

      await expect(collectStream(agent.executeStream("long"))).rejects.toThrow(
        MaxTokensExceededError
      );
    });

    it("wraps unknown errors in ExecutionError with vendor name", async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error("connection reset"));

      await expect(collectStream(agent.executeStream("Hi"))).rejects.toThrow(ExecutionError);
      await expect(collectStream(agent.executeStream("Hi"))).rejects.toThrow(
        /test-vendor error: connection reset/
      );
    });

    it("passes stream: true and stream_options to the API call", async () => {
      mockClient.chat.completions.create.mockResolvedValue(
        makeStream([
          { choices: [{ finish_reason: "stop", delta: {} }] },
          { choices: [] },
        ])
      );

      await collectStream(agent.executeStream("Hi"));

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          stream_options: { include_usage: true },
        }),
        { signal: undefined }
      );
    });
  });
});
