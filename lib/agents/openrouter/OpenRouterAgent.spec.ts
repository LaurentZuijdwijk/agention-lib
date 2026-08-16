// @ts-nocheck
import { OpenRouter } from "@openrouter/sdk";
import {
  OpenRouterAgent,
  defaultHeadersHook,
  parseRetryAfter,
  parseResetAt,
} from "./OpenRouterAgent";
import { ApiError, ExecutionError, RateLimitError } from "../errors/AgentError";

jest.mock("@openrouter/sdk", () => {
  const addHook = jest.fn();
  const HTTPClient = jest.fn().mockImplementation(() => ({ addHook }));
  HTTPClient._addHook = addHook;
  const OpenRouter = jest.fn().mockImplementation(() => ({
    chat: { send: jest.fn() },
    models: { list: jest.fn() },
  }));
  return { OpenRouter, HTTPClient };
});

const toolPrompt = {
  name: "test_tool",
  description: "A test tool",
  input_schema: {
    type: "object",
    properties: { param: { type: "string" } },
    required: ["param"],
  },
};

function makeAgent(config = {}) {
  return new OpenRouterAgent({
    apiKey: "test-api-key",
    id: "1",
    name: "TestAgent",
    description: "Test Description",
    model: "anthropic/claude-sonnet-4",
    ...config,
  });
}

function textResponse(content: string) {
  return {
    id: "gen-1",
    model: "anthropic/claude-sonnet-4",
    choices: [
      {
        finishReason: "stop",
        message: { role: "assistant", content },
      },
    ],
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      cost: 0.002,
    },
  };
}

describe("OpenRouterAgent", () => {
  describe("defaultHeadersHook", () => {
    it("adds configured headers to the outgoing request", () => {
      const hook = defaultHeadersHook({
        "X-Trace-Id": "abc123",
        Authorization: "Bearer gateway-key",
      });

      const request = new Request("https://openrouter.ai/api/v1/chat/completions");
      hook(request);

      expect(request.headers.get("X-Trace-Id")).toBe("abc123");
      expect(request.headers.get("Authorization")).toBe("Bearer gateway-key");
    });

    it("overrides headers the SDK already set", () => {
      const hook = defaultHeadersHook({ Authorization: "Bearer gateway-key" });

      const request = new Request("https://openrouter.ai/api/v1/chat/completions", {
        headers: { Authorization: "Bearer sdk-key" },
      });
      hook(request);

      expect(request.headers.get("Authorization")).toBe("Bearer gateway-key");
    });
  });

  describe("createClient", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("constructs the SDK client with apiKey and attribution fields", async () => {
      const agent = makeAgent({
        httpReferer: "https://myapp.example",
        appTitle: "My App",
        baseURL: "https://gateway.example/v1",
      });

      await agent["getClient"]();

      expect(OpenRouter).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "test-api-key",
          serverURL: "https://gateway.example/v1",
          httpReferer: "https://myapp.example",
          appTitle: "My App",
        })
      );
    });

    it("installs a beforeRequest hook when defaultHeaders is set", async () => {
      const { HTTPClient } = require("@openrouter/sdk");
      const agent = makeAgent({
        defaultHeaders: { "X-Trace-Id": "abc123" },
      });

      await agent["getClient"]();

      expect(HTTPClient).toHaveBeenCalled();
      expect(HTTPClient._addHook).toHaveBeenCalledWith(
        "beforeRequest",
        expect.any(Function)
      );
      expect(OpenRouter).toHaveBeenCalledWith(
        expect.objectContaining({ httpClient: expect.any(Object) })
      );
    });

    it("does not construct an HTTPClient when defaultHeaders is omitted", async () => {
      const { HTTPClient } = require("@openrouter/sdk");
      const agent = makeAgent();

      await agent["getClient"]();

      expect(HTTPClient).not.toHaveBeenCalled();
      const ctorArg = (OpenRouter as jest.Mock).mock.calls[0][0];
      expect(ctorArg.httpClient).toBeUndefined();
    });
  });

  describe("listModels", () => {
    it("reads models from page.result.data", async () => {
      const agent = makeAgent();
      const cards = [
        {
          id: "anthropic/claude-sonnet-4",
          name: "Claude Sonnet 4",
          created: 1700000000,
          contextLength: 200000,
          supportedParameters: ["tools", "reasoning"],
          architecture: { inputModalities: ["text", "image"] },
          topProvider: { maxCompletionTokens: 8192 },
        },
        { id: "openai/gpt-5.6" },
      ];

      agent["clientPromise"] = Promise.resolve({
        models: {
          list: jest.fn().mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              yield { result: { data: cards, totalCount: 2 } };
            },
          }),
        },
      });

      const result = await agent.listModels();

      expect(result).toEqual([
        {
          id: "anthropic/claude-sonnet-4",
          displayName: "Claude Sonnet 4",
          created: new Date(1700000000 * 1000),
          contextLength: 200000,
          maxOutputTokens: 8192,
          capabilities: {
            chat: true,
            tools: true,
            vision: true,
            thinking: true,
          },
          raw: cards[0],
        },
        {
          id: "openai/gpt-5.6",
          displayName: undefined,
          created: undefined,
          contextLength: undefined,
          maxOutputTokens: undefined,
          capabilities: {
            chat: true,
            tools: false,
            vision: false,
            thinking: false,
          },
          raw: cards[1],
        },
      ]);
    });

    it("returns an empty list when the page has no result.data", async () => {
      const agent = makeAgent();
      agent["clientPromise"] = Promise.resolve({
        models: {
          list: jest.fn().mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              yield { data: { data: [{ id: "should-not-appear" }] } };
            },
          }),
        },
      });

      await expect(agent.listModels()).resolves.toEqual([]);
    });

    it("wraps failures in ExecutionError", async () => {
      const agent = makeAgent();
      agent["clientPromise"] = Promise.resolve({
        models: { list: jest.fn().mockRejectedValue(new Error("boom")) },
      });

      await expect(agent.listModels()).rejects.toThrow(ExecutionError);
      await expect(agent.listModels()).rejects.toThrow(
        /Failed to list OpenRouter models/
      );
    });
  });

  describe("execute", () => {
    it("wraps the ChatRequest in the SDK envelope", async () => {
      const send = jest.fn().mockResolvedValue(textResponse("Hello"));
      const agent = makeAgent({
        httpReferer: "https://myapp.example",
        appTitle: "My App",
        models: ["openai/gpt-5.6"],
        temperature: 0.2,
      });
      agent["clientPromise"] = Promise.resolve({ chat: { send } });

      const answer = await agent.execute("Explain recursion");

      expect(answer).toBe("Hello");
      expect(send).toHaveBeenCalledTimes(1);
      const [envelope, options] = send.mock.calls[0];
      expect(envelope).toEqual(
        expect.objectContaining({
          httpReferer: "https://myapp.example",
          appTitle: "My App",
          chatRequest: expect.objectContaining({
            model: "anthropic/claude-sonnet-4",
            stream: false,
            models: ["openai/gpt-5.6"],
            temperature: 0.2,
          }),
        })
      );
      expect(envelope.chatRequest.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "user" }),
        ])
      );
      expect(options).toEqual(
        expect.objectContaining({
          retries: expect.any(Object),
          retryCodes: expect.arrayContaining(["429"]),
        })
      );
    });

    it("records lastGeneration from usage.cost", async () => {
      const agent = makeAgent();
      agent["clientPromise"] = Promise.resolve({
        chat: { send: jest.fn().mockResolvedValue(textResponse("ok")) },
      });

      await agent.execute("hi");

      expect(agent.lastGeneration).toEqual({
        id: "gen-1",
        model: "anthropic/claude-sonnet-4",
        cost: 0.002,
        isByok: undefined,
        attempts: undefined,
      });
      expect(agent.lastTokenUsage).toEqual(
        expect.objectContaining({
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
        })
      );
    });
  });

  describe("sendRequest", () => {
    it("does not put attribution fields on a bare body", () => {
      const agent = makeAgent({
        httpReferer: "https://myapp.example",
        appTitle: "My App",
      });

      const envelope = agent["sendRequest"](true);
      expect(envelope.chatRequest.stream).toBe(true);
      expect(envelope.chatRequest.httpReferer).toBeUndefined();
      expect(envelope.httpReferer).toBe("https://myapp.example");
      expect(envelope.appTitle).toBe("My App");
    });

    it("asks for usage on the streaming path", () => {
      const agent = makeAgent();
      expect(agent["sendRequest"](true).chatRequest.stream_options).toEqual({
        include_usage: true,
      });
      expect(
        agent["sendRequest"](false).chatRequest.stream_options
      ).toBeUndefined();
    });

    it("requests OpenRouter metadata on every call", () => {
      const agent = makeAgent();
      expect(agent["requestOptions"]({})).toMatchObject({
        headers: { "X-OpenRouter-Metadata": "1" },
      });
    });
  });

  describe("getToolDefinitions", () => {
    it("formats tools as Chat Completions function tools", () => {
      const agent = makeAgent();
      agent["tools"].set("test_tool", {
        getPrompt: () => toolPrompt,
      });

      expect(agent["getToolDefinitions"]()).toEqual([
        {
          type: "function",
          function: {
            name: "test_tool",
            description: "A test tool",
            parameters: toolPrompt.input_schema,
          },
        },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // Rate limit header parsing
  // ---------------------------------------------------------------------------

  describe("rateLimitError", () => {
    function errorWith(headers: Record<string, string>) {
      return { statusCode: 429, message: "Rate limit exceeded", headers: new Headers(headers) };
    }

    it("maps a 429 onto a RateLimitError carrying every header", () => {
      const agent = makeAgent();
      const mapped = agent["mapProviderError"](
        errorWith({
          "retry-after": "30",
          "x-ratelimit-limit": "20",
          "x-ratelimit-remaining": "0",
        })
      );

      expect(mapped).toBeInstanceOf(RateLimitError);
      expect(mapped.statusCode).toBe(429);
      expect(mapped.retryAfterMs).toBe(30_000);
      expect(mapped.limit).toBe(20);
      expect(mapped.remaining).toBe(0);
    });

    it("leaves every field undefined on an upstream 429, which sends no headers", () => {
      const agent = makeAgent();
      const mapped = agent["mapProviderError"](errorWith({}));

      expect(mapped).toBeInstanceOf(RateLimitError);
      expect(mapped.retryAfterMs).toBeUndefined();
      expect(mapped.limit).toBeUndefined();
      expect(mapped.resetAt).toBeUndefined();
    });

    it("stays an ApiError for non-429 statuses", () => {
      const agent = makeAgent();
      const mapped = agent["mapProviderError"]({ statusCode: 502, message: "Bad gateway" });

      expect(mapped).not.toBeInstanceOf(RateLimitError);
      expect(mapped.statusCode).toBe(502);
    });
  });

  // ---------------------------------------------------------------------------
  // Unwrapping the upstream provider's message out of OpenRouter's own
  // generic wrapper ("Provider returned error")
  // ---------------------------------------------------------------------------

  describe("mapProviderError message unwrapping", () => {
    /** Builds the same nested body shape `@openrouter/sdk` throws for a proxied provider error. */
    function bodyWith(rawMessage: string) {
      return JSON.stringify({
        error: {
          message: "Provider returned error",
          code: 400,
          metadata: {
            raw: JSON.stringify({
              error: { message: rawMessage, type: "invalid_request_error" },
            }),
            provider_name: "Azure",
          },
        },
      });
    }

    it("surfaces the upstream provider's message instead of the generic wrapper", () => {
      const agent = makeAgent();
      const mapped = agent["mapProviderError"]({
        statusCode: 400,
        message: "Provider returned error",
        body: bodyWith("No tool output found for function call call_real_id_123."),
      });

      expect(mapped).toBeInstanceOf(ApiError);
      expect(mapped.statusCode).toBe(400);
      expect(mapped.message).toBe(
        "OpenRouter API error: No tool output found for function call call_real_id_123."
      );
    });

    it("falls back to the top-level message when there is no body", () => {
      const agent = makeAgent();
      const mapped = agent["mapProviderError"]({
        statusCode: 400,
        message: "Bad request",
      });

      expect(mapped.message).toBe("OpenRouter API error: Bad request");
    });

    it("falls back to the top-level message when the body isn't JSON", () => {
      const agent = makeAgent();
      const mapped = agent["mapProviderError"]({
        statusCode: 400,
        message: "Bad request",
        body: "<html>not json</html>",
      });

      expect(mapped.message).toBe("OpenRouter API error: Bad request");
    });

    it("falls back to the top-level message when metadata.raw isn't JSON but is short", () => {
      const agent = makeAgent();
      const mapped = agent["mapProviderError"]({
        statusCode: 400,
        message: "Provider returned error",
        body: JSON.stringify({
          error: {
            message: "Provider returned error",
            metadata: { raw: "plain text upstream error" },
          },
        }),
      });

      expect(mapped.message).toBe("OpenRouter API error: plain text upstream error");
    });

    it("also unwraps the upstream message on a rate-limited (429) response", () => {
      const agent = makeAgent();
      const mapped = agent["mapProviderError"]({
        statusCode: 429,
        message: "Provider returned error",
        headers: new Headers({ "retry-after": "5" }),
        body: bodyWith("Rate limit exceeded for this model."),
      });

      expect(mapped).toBeInstanceOf(RateLimitError);
      expect(mapped.message).toBe(
        "OpenRouter rate limit: Rate limit exceeded for this model."
      );
    });
  });

  describe("parseRetryAfter", () => {
    it("reads the delay-seconds form", () => {
      expect(parseRetryAfter("120")).toBe(120_000);
    });

    it("reads the HTTP-date form as a delay from now", () => {
      const future = new Date(Date.now() + 60_000).toUTCString();
      // Whole-second precision in the header makes this accurate to ~1s.
      expect(parseRetryAfter(future)).toBeGreaterThan(58_000);
      expect(parseRetryAfter(future)).toBeLessThanOrEqual(60_000);
    });

    it("clamps a date already in the past to zero rather than going negative", () => {
      expect(parseRetryAfter(new Date(Date.now() - 60_000).toUTCString())).toBe(0);
    });

    it("returns undefined for a missing or unparseable header", () => {
      expect(parseRetryAfter(null)).toBeUndefined();
      expect(parseRetryAfter("")).toBeUndefined();
      expect(parseRetryAfter("soon")).toBeUndefined();
    });
  });

  describe("parseResetAt", () => {
    // OpenRouter documents that the header exists but not its unit, so all
    // three encodings in common use have to land on roughly "now".
    const now = Date.now();

    it("reads a small value as a duration in seconds from now", () => {
      const resetAt = parseResetAt(60)!;
      expect(resetAt.getTime()).toBeGreaterThanOrEqual(now + 59_000);
      expect(resetAt.getTime()).toBeLessThanOrEqual(now + 61_000);
    });

    it("reads a Unix-seconds timestamp", () => {
      const seconds = Math.floor(now / 1000) + 300;
      expect(parseResetAt(seconds)!.getTime()).toBe(seconds * 1000);
    });

    it("reads a Unix-milliseconds timestamp", () => {
      const ms = now + 300_000;
      expect(parseResetAt(ms)!.getTime()).toBe(ms);
    });

    it("never produces a 1970 date from a seconds timestamp", () => {
      // The bug this guards: `new Date(1786000000)` is 1970-01-21.
      expect(parseResetAt(1786000000)!.getFullYear()).toBeGreaterThan(2020);
    });

    it("returns undefined rather than an Invalid Date for missing or bad values", () => {
      expect(parseResetAt(undefined)).toBeUndefined();
      expect(parseResetAt(NaN)).toBeUndefined();
      expect(parseResetAt(-1)).toBeUndefined();
    });
  });
});
