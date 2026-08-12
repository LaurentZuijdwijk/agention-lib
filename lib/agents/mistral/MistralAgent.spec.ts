// @ts-nocheck
import { Mistral } from "@mistralai/mistralai";
import { MistralAgent, defaultHeadersHook } from "./MistralAgent";
import { AbortError, ExecutionError } from "../errors/AgentError";

/** Minimal tool prompt, enough for the agent's tool-definition builder. */
const toolPrompt = {
  name: "test_tool",
  description: "A test tool",
  input_schema: {
    type: "object",
    properties: { param: { type: "string" } },
    required: ["param"],
  },
};

// Mock the Mistral SDK. `@mistralai/mistralai/lib/http` is a separate module
// and stays real, so `defaultHeadersHook` is still exercised against a real
// HTTPClient below.
jest.mock("@mistralai/mistralai");

describe("MistralAgent", () => {
  describe("defaultHeadersHook", () => {
    it("adds configured headers to the outgoing request", () => {
      const hook = defaultHeadersHook({
        "HTTP-Referer": "https://myapp.example",
        "X-Title": "My App",
      });

      const request = new Request("https://api.mistral.ai/v1/chat/completions");
      hook(request);

      expect(request.headers.get("HTTP-Referer")).toBe("https://myapp.example");
      expect(request.headers.get("X-Title")).toBe("My App");
    });

    it("overrides headers the SDK already set", () => {
      // Matches the Anthropic and OpenAI SDKs, whose defaultHeaders win over
      // the client's own auth — verified on the wire. Keeping Mistral
      // consistent means defaultHeaders behaves the same on every provider.
      const hook = defaultHeadersHook({ Authorization: "Bearer gateway-key" });

      const request = new Request("https://api.mistral.ai/v1/chat/completions", {
        headers: { Authorization: "Bearer sdk-key" },
      });
      hook(request);

      expect(request.headers.get("Authorization")).toBe("Bearer gateway-key");
    });

    it("matches header names case-insensitively, as HTTP does", () => {
      const hook = defaultHeadersHook({ "content-type": "text/plain" });

      const request = new Request("https://api.mistral.ai/v1/chat/completions", {
        headers: { "Content-Type": "application/json" },
      });
      hook(request);

      expect(request.headers.get("Content-Type")).toBe("text/plain");
    });
  });

  describe("listModels", () => {
    let mockClient: any;
    let agent: MistralAgent;

    beforeEach(() => {
      mockClient = { models: { list: jest.fn() } };
      (Mistral as jest.Mock).mockImplementation(() => mockClient);

      agent = new MistralAgent({
        apiKey: "test-api-key",
        id: "1",
        name: "TestAgent",
        description: "Test Description",
      });
    });

    it("normalizes the models the API reports", async () => {
      const cards = [
        {
          id: "mistral-large-latest",
          object: "model",
          created: 1731000000,
          ownedBy: "mistralai",
          name: "Mistral Large",
          maxContextLength: 131072,
          capabilities: { completionChat: true, functionCalling: true },
          type: "base",
        },
        {
          id: "ft:open-mistral-7b:my-org:custom",
          object: "model",
          ownedBy: "my-org",
          name: null,
          maxContextLength: 32768,
          capabilities: { completionChat: true },
          type: "fine-tuned",
        },
      ];
      mockClient.models.list.mockResolvedValue({ data: cards });

      const result = await agent.listModels();

      expect(result).toEqual([
        {
          id: "mistral-large-latest",
          displayName: "Mistral Large",
          // Mistral reports seconds, not milliseconds
          created: new Date(1731000000 * 1000),
          ownedBy: "mistralai",
          contextLength: 131072,
          capabilities: { chat: true, tools: true, vision: undefined },
          deprecatedAt: undefined,
          replacedBy: undefined,
          raw: cards[0],
        },
        {
          id: "ft:open-mistral-7b:my-org:custom",
          // `name` comes back as null on a fine-tuned model without one
          displayName: undefined,
          created: undefined,
          ownedBy: "my-org",
          contextLength: 32768,
          capabilities: { chat: true, tools: undefined, vision: undefined },
          deprecatedAt: undefined,
          replacedBy: undefined,
          raw: cards[1],
        },
      ]);
    });

    it("maps the retirement date and its replacement", async () => {
      // Mistral is the only provider that publishes this
      mockClient.models.list.mockResolvedValue({
        data: [
          {
            id: "mistral-medium-2505",
            capabilities: { completionChat: true, functionCalling: true, vision: true },
            maxContextLength: 131072,
            deprecation: new Date("2026-08-31T12:00:00Z"),
            deprecationReplacementModel: "mistral-medium-3-5",
          },
        ],
      });

      const [model] = await agent.listModels();

      expect(model.deprecatedAt).toEqual(new Date("2026-08-31T12:00:00Z"));
      expect(model.replacedBy).toBe("mistral-medium-3-5");
      expect(model.capabilities).toEqual({ chat: true, tools: true, vision: true });
    });

    it("returns an empty list when the response carries no data", async () => {
      mockClient.models.list.mockResolvedValue({ object: "list" });

      await expect(agent.listModels()).resolves.toEqual([]);
    });

    it("wraps failures in an ExecutionError", async () => {
      mockClient.models.list.mockRejectedValue(new Error("401 unauthorized"));

      await expect(agent.listModels()).rejects.toThrow(ExecutionError);
      await expect(agent.listModels()).rejects.toThrow(
        /Failed to list Mistral models: 401 unauthorized/
      );
    });
  });

  describe("cancellation", () => {
    let mockClient: any;
    let agent: MistralAgent;

    const textResponse = {
      choices: [
        {
          finishReason: "stop",
          message: { role: "assistant", content: "Hello" },
        },
      ],
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    };

    const toolCallResponse = {
      choices: [
        {
          finishReason: "tool_calls",
          message: {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call_1",
                function: {
                  name: "test_tool",
                  arguments: JSON.stringify({ param: "value" }),
                },
              },
            ],
          },
        },
      ],
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    };

    beforeEach(() => {
      mockClient = { chat: { complete: jest.fn() } };
      (Mistral as jest.Mock).mockImplementation(() => mockClient);

      agent = new MistralAgent({
        apiKey: "test-api-key",
        id: "1",
        name: "TestAgent",
        description: "Test Description",
        // Keeps the tool round-trip's rate-limit wait out of the test. Note 0
        // would not: the agent reads it as `rateLimitDelay || 1500`.
        rateLimitDelay: 1,
      });
      agent.on("error", () => {});
    });

    it("forwards the signal to the API call", async () => {
      const controller = new AbortController();
      mockClient.chat.complete.mockResolvedValue(textResponse);

      await agent.execute("test input", { signal: controller.signal });

      expect(mockClient.chat.complete).toHaveBeenCalledWith(
        expect.any(Object),
        { signal: controller.signal }
      );
    });

    it("throws an AbortError when the SDK reports the request was aborted", async () => {
      const controller = new AbortController();
      mockClient.chat.complete.mockImplementation(async () => {
        controller.abort();
        throw Object.assign(new Error("request aborted"), {
          name: "RequestAbortedError",
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
      const toolExecute = jest.fn().mockResolvedValue("never called");
      agent["tools"].set("test_tool", {
        execute: toolExecute,
        getPrompt: jest.fn().mockReturnValue(toolPrompt),
      } as any);

      mockClient.chat.complete.mockImplementation(async () => {
        controller.abort();
        return toolCallResponse;
      });

      await expect(
        agent.execute("test input", { signal: controller.signal })
      ).rejects.toBeInstanceOf(AbortError);

      expect(toolExecute).not.toHaveBeenCalled();
      expect(mockClient.chat.complete).toHaveBeenCalledTimes(1);
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

      mockClient.chat.complete
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(textResponse);

      await agent.execute("test input", { signal: controller.signal });

      expect(toolExecute).toHaveBeenCalledWith(
        "1",
        "TestAgent",
        { param: "value" },
        "call_1",
        "mistral-small-latest",
        "mistral",
        { signal: controller.signal }
      );
    });

    it("rejects during the inter-call rate-limit wait rather than sitting it out", async () => {
      const controller = new AbortController();
      const slowAgent = new MistralAgent({
        apiKey: "test-api-key",
        id: "1",
        name: "TestAgent",
        description: "Test Description",
        rateLimitDelay: 60_000,
      });
      slowAgent.on("error", () => {});
      slowAgent["tools"].set("test_tool", {
        // Aborts while the tool runs, so the wait is what gets interrupted
        execute: jest.fn().mockImplementation(async () => {
          controller.abort();
          return "sunny";
        }),
        getPrompt: jest.fn().mockReturnValue(toolPrompt),
      } as any);
      mockClient.chat.complete.mockResolvedValue(toolCallResponse);

      const started = Date.now();
      await expect(
        slowAgent.execute("test input", { signal: controller.signal })
      ).rejects.toBeInstanceOf(AbortError);

      expect(Date.now() - started).toBeLessThan(1_000);
      expect(mockClient.chat.complete).toHaveBeenCalledTimes(1);
    });
  });
});
