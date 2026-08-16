// @ts-nocheck
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiAgent } from "./GeminiAgent";
import { AbortError, ExecutionError } from "../errors/AgentError";
import { AgentEvent } from "../AgentEvent";

/** Minimal tool prompt, enough for the agents' tool-definition builders. */
const toolPrompt = {
  name: "test_tool",
  description: "A test tool",
  input_schema: {
    type: "object",
    properties: { param: { type: "string" } },
    required: ["param"],
  },
};

// Mock the Google Generative AI SDK
jest.mock("@google/generative-ai");

describe("GeminiAgent", () => {
  let mockClient: jest.Mocked<GoogleGenerativeAI>;
  let mockModel: any;
  let agent: GeminiAgent;

  beforeEach(() => {
    // Reset mocks and create a new agent instance
    jest.resetAllMocks();

    mockModel = {
      generateContent: jest.fn(),
    };

    mockClient = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    } as any;

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => mockClient);

    agent = new GeminiAgent({
      apiKey: "test-api-key",
      id: "1",
      name: "TestAgent",
      description: "Test Description",
      temperature: 0,
    });
  });

  describe("constructor", () => {
    it("should pass defaultHeaders as customHeaders request options", () => {
      new GeminiAgent({
        id: "h",
        name: "H",
        description: "d",
        apiKey: "test-api-key",
        defaultHeaders: { "X-Trace-Id": "abc123" },
      });

      // Gemini has no client-level header option; they ride on requestOptions
      expect(mockClient.getGenerativeModel).toHaveBeenLastCalledWith(
        expect.anything(),
        { customHeaders: { "X-Trace-Id": "abc123" } }
      );
    });

    it("should initialize with default values", () => {
      expect(agent).toBeInstanceOf(GeminiAgent);
      expect(GoogleGenerativeAI).toHaveBeenCalledWith("test-api-key");
      expect(mockClient.getGenerativeModel).toHaveBeenCalledWith(
        { model: "gemini-flash-latest" },
        // No defaultHeaders configured, so no requestOptions are passed
        undefined
      );
      // `maxTokens` is deliberately left unset — `maxOutputTokens` is optional
      // on Gemini, and defaulting it silently truncated every response.
      expect(agent["config"]).toMatchObject({
        apiKey: "test-api-key",
        model: "gemini-flash-latest",
        temperature: 0,
      });
      expect(agent["config"].maxTokens).toBeUndefined();
    });

    it("should accept custom config values", () => {
      const customAgent = new GeminiAgent({
        apiKey: "custom-key",
        id: "2",
        name: "CustomAgent",
        description: "Custom Description",
        model: "gemini-1.5-pro",
        maxTokens: 2048,
        temperature: 0.5,
      });
      expect(customAgent["config"]).toEqual({
        apiKey: "custom-key",
        model: "gemini-1.5-pro",
        maxTokens: 2048,
        temperature: 0.5,
      });
    });
  });

  describe("listModels", () => {
    // The SDK has no models endpoint, so the agent calls the REST API directly
    const okResponse = (body: unknown) => ({
      ok: true,
      json: async () => body,
    });

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it("should normalize the models the API reports", async () => {
      const cards = [
        {
          name: "models/gemini-flash-latest",
          displayName: "Gemini Flash Latest",
          inputTokenLimit: 1048576,
          outputTokenLimit: 65536,
          supportedGenerationMethods: ["generateContent", "countTokens"],
          thinking: true,
        },
        {
          name: "models/text-embedding-004",
          displayName: "Text Embedding 004",
          inputTokenLimit: 2048,
          outputTokenLimit: 1,
          supportedGenerationMethods: ["embedContent"],
        },
      ];
      (global.fetch as jest.Mock).mockResolvedValue(
        okResponse({ models: cards })
      );

      const result = await agent.listModels();

      expect(result).toEqual([
        {
          // The "models/" prefix is stripped so the id can be passed back as `model`
          id: "gemini-flash-latest",
          displayName: "Gemini Flash Latest",
          contextLength: 1048576,
          maxOutputTokens: 65536,
          capabilities: { chat: true, thinking: true },
          raw: cards[0],
        },
        {
          id: "text-embedding-004",
          displayName: "Text Embedding 004",
          contextLength: 2048,
          maxOutputTokens: 1,
          // An embedding model: listed, but nothing an agent can drive
          capabilities: { chat: false, thinking: undefined },
          raw: cards[1],
        },
      ]);

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url.toString()).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"
      );
      expect(init.headers).toEqual({ "x-goog-api-key": "test-api-key" });
    });

    it("should drop models the API lists but no longer serves", async () => {
      // Google keeps retired models in the listing, fully described and
      // claiming generateContent; calling one 404s
      (global.fetch as jest.Mock).mockResolvedValue(
        okResponse({
          models: [
            {
              name: "models/gemini-2.5-flash",
              displayName: "Gemini 2.5 Flash",
              supportedGenerationMethods: ["generateContent"],
            },
            { name: "models/gemini-3.6-flash", displayName: "Gemini 3.6 Flash" },
          ],
        })
      );

      const result = await agent.listModels();

      expect(result.map((m) => m.id)).toEqual(["gemini-3.6-flash"]);
    });

    it("should keep retired models when asked for them", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        okResponse({
          models: [
            { name: "models/gemini-2.5-flash" },
            { name: "models/gemini-3.6-flash" },
          ],
        })
      );

      const result = await agent.listModels({ includeRetired: true });

      expect(result.map((m) => m.id)).toEqual([
        "gemini-2.5-flash",
        "gemini-3.6-flash",
      ]);
    });

    it("should only retire the exact ids listed, not whole families", async () => {
      // gemini-2.5-flash is gone, but its image and TTS siblings still answer —
      // which is why the denylist matches ids rather than a prefix
      (global.fetch as jest.Mock).mockResolvedValue(
        okResponse({
          models: [
            { name: "models/gemini-2.5-flash" },
            { name: "models/gemini-2.5-flash-image" },
            { name: "models/gemini-2.5-flash-preview-tts" },
            { name: "models/gemini-2.5-computer-use-preview-10-2025" },
          ],
        })
      );

      const result = await agent.listModels();

      expect(result.map((m) => m.id)).toEqual([
        "gemini-2.5-flash-image",
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-computer-use-preview-10-2025",
      ]);
    });

    it("should follow nextPageToken until the last page", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          okResponse({
            models: [{ name: "models/a" }],
            nextPageToken: "token-2",
          })
        )
        .mockResolvedValueOnce(okResponse({ models: [{ name: "models/b" }] }));

      const result = await agent.listModels();

      expect(result.map((m) => m.id)).toEqual(["a", "b"]);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const [secondUrl] = (global.fetch as jest.Mock).mock.calls[1];
      expect(secondUrl.searchParams.get("pageToken")).toBe("token-2");
    });

    it("should send configured defaultHeaders", async () => {
      const headerAgent = new GeminiAgent({
        id: "h",
        name: "H",
        description: "d",
        apiKey: "test-api-key",
        defaultHeaders: { "X-Trace-Id": "abc123" },
      });
      (global.fetch as jest.Mock).mockResolvedValue(okResponse({ models: [] }));

      await headerAgent.listModels();

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.headers).toEqual({
        "x-goog-api-key": "test-api-key",
        "X-Trace-Id": "abc123",
      });
    });

    it("should wrap a non-2xx response in an ExecutionError", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "API key not valid",
      });

      await expect(agent.listModels()).rejects.toThrow(ExecutionError);
      await expect(agent.listModels()).rejects.toThrow(
        /Failed to list Gemini models: 403 Forbidden: API key not valid/
      );
    });
  });

  describe("execute", () => {
    it("should call model.generateContent with correct parameters", async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: "Hello" }],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 100,
            totalTokenCount: 110,
          },
        },
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      await agent.execute("test input");

      expect(mockModel.generateContent).toHaveBeenCalledWith(
        {
          contents: [{ role: "user", parts: [{ text: "test input" }] }],
          systemInstruction:
            "You are an agent called TestAgent and should follow these instructions: Test Description",
          tools: undefined,
          generationConfig: expect.objectContaining({
            // Unset, so Gemini uses the model's own output budget.
            maxOutputTokens: undefined,
            temperature: 0,
          }),
        },
        { signal: undefined }
      );
    });

    it("should call history.setSessionAnchor() once per execute()", async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: { parts: [{ text: "Hello" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 5,
            totalTokenCount: 10,
          },
        },
      };
      mockModel.generateContent.mockResolvedValue(mockResponse);

      const anchorSpy = jest.spyOn(agent["history"], "setSessionAnchor");
      await agent.execute("test input");

      expect(anchorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleResponse", () => {
    it("should return text content when no function calls", async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: "Test response" }],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 100,
            totalTokenCount: 110,
          },
        },
      };

      const result = await agent["handleResponse"](mockResponse, []);

      expect(result).toBe("Test response");
    });

    it("should track token usage", async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: "Test response" }],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 100,
            totalTokenCount: 110,
          },
        },
      };

      await agent["handleResponse"](mockResponse, []);

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 10,
        output_tokens: 100,
        total_tokens: 110,
      });
    });

    it("should fold thought tokens into output tokens", async () => {
      // Gemini keeps thoughts out of candidatesTokenCount but inside
      // totalTokenCount, so output_tokens has to absorb them for
      // input + output === total to hold.
      const mockResponse = {
        response: {
          candidates: [
            {
              content: { parts: [{ text: "Test response" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 100,
            thoughtsTokenCount: 40,
            totalTokenCount: 150,
          },
        },
      };

      await agent["handleResponse"](mockResponse, []);

      expect(agent.lastTokenUsage).toMatchObject({
        input_tokens: 10,
        output_tokens: 140,
        total_tokens: 150,
        reasoning_tokens: 40,
      });
    });

    it("should handle function calls and make subsequent request", async () => {
      const initialResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: "test_tool",
                      args: { param: "value" },
                    },
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 50,
            totalTokenCount: 60,
          },
        },
      };

      const finalResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: "Final response" }],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 20,
            candidatesTokenCount: 100,
            totalTokenCount: 120,
          },
        },
      };

      // Mock the tool execution with proper getPrompt
      agent["tools"].set("test_tool", {
        execute: jest.fn().mockResolvedValue({ result: "Tool output" }),
        getPrompt: jest.fn().mockReturnValue({
          name: "test_tool",
          description: "A test tool",
          input_schema: {
            type: "object",
            properties: {
              param: { type: "string" },
            },
          },
        }),
      } as any);

      mockModel.generateContent.mockResolvedValueOnce(finalResponse);

      const result = await agent["handleResponse"](initialResponse);

      expect(result).toBe("Final response");
      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
    });

    it("should throw MaxTokensExceededError when finish reason is MAX_TOKENS", async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [{ text: "Partial response" }],
              },
              finishReason: "MAX_TOKENS",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 1024,
            totalTokenCount: 1034,
          },
        },
      };

      await expect(agent["handleResponse"](mockResponse, [])).rejects.toThrow(
        "Response exceeded maximum token limit"
      );
    });
  });

  describe("cancellation", () => {
    const textResponse = {
      response: {
        candidates: [
          { content: { parts: [{ text: "Hello" }] }, finishReason: "STOP" },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 5,
          totalTokenCount: 10,
        },
      },
    };

    const functionCallResponse = {
      response: {
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: "test_tool", args: { param: "value" } } },
              ],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 5,
          totalTokenCount: 10,
        },
      },
    };

    it("forwards the signal to the API call", async () => {
      const controller = new AbortController();
      mockModel.generateContent.mockResolvedValue(textResponse);

      await agent.execute("test input", { signal: controller.signal });

      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.any(Object),
        { signal: controller.signal }
      );
    });

    it("throws an AbortError when the SDK reports the request was aborted", async () => {
      const controller = new AbortController();
      agent.on(AgentEvent.ERROR, () => {});
      mockModel.generateContent.mockImplementation(async () => {
        controller.abort();
        throw Object.assign(new Error("Request aborted."), {
          name: "GoogleGenerativeAIAbortError",
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

      mockModel.generateContent.mockImplementation(async () => {
        controller.abort();
        return functionCallResponse;
      });

      await expect(
        agent.execute("test input", { signal: controller.signal })
      ).rejects.toBeInstanceOf(AbortError);

      expect(toolExecute).not.toHaveBeenCalled();
      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
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

      mockModel.generateContent
        .mockResolvedValueOnce(functionCallResponse)
        .mockResolvedValueOnce(textResponse);

      await agent.execute("test input", { signal: controller.signal });

      expect(toolExecute).toHaveBeenCalledWith(
        "1",
        "TestAgent",
        { param: "value" },
        "test_tool",
        "gemini-flash-latest",
        "gemini",
        { signal: controller.signal }
      );
    });
  });

  describe("handleFunctionCalls", () => {
    it("should process function call parts", async () => {
      const functionCalls = [
        {
          functionCall: {
            name: "test_tool",
            args: { param: "value" },
          },
        },
      ] as any;

      const mockToolResult = { output: "Tool output" };

      agent["tools"].set("test_tool", {
        execute: jest.fn().mockResolvedValue(mockToolResult),
        getPrompt: jest.fn(),
      } as any);

      const result = await agent["handleFunctionCalls"](functionCalls);

      expect(result).toEqual([
        {
          name: "test_tool",
          response: JSON.stringify(mockToolResult),
        },
      ]);
    });

    it("should handle unknown tools", async () => {
      const functionCalls = [
        {
          functionCall: {
            name: "unknown_tool",
            args: { param: "value" },
          },
        },
      ] as any;

      const result = await agent["handleFunctionCalls"](functionCalls);

      expect(result).toEqual([
        {
          name: "unknown_tool",
          response: JSON.stringify({ error: "Tool 'unknown_tool' not found" }),
        },
      ]);
    });

    it("should handle tool execution errors", async () => {
      const functionCalls = [
        {
          functionCall: {
            name: "test_tool",
            args: { param: "value" },
          },
        },
      ] as any;

      agent["tools"].set("test_tool", {
        execute: jest.fn().mockRejectedValue(new Error("Tool error")),
        getPrompt: jest.fn(),
      } as any);

      const result = await agent["handleFunctionCalls"](functionCalls);

      expect(result).toEqual([
        {
          name: "test_tool",
          response: JSON.stringify({
            error: "Error executing tool 'test_tool': Tool error",
          }),
        },
      ]);
    });
  });

  describe("parseUsage", () => {
    it("should correctly parse Gemini usage metadata", () => {
      const usage = agent["parseUsage"]({
        promptTokenCount: 100,
        candidatesTokenCount: 200,
        totalTokenCount: 300,
      });

      expect(usage).toEqual({
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      });
    });

    it("should handle missing usage fields", () => {
      const usage = agent["parseUsage"]({});

      expect(usage).toEqual({
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      });
    });
  });

  describe("getToolDefinitionsForGemini", () => {
    it("should return undefined when no tools are registered", () => {
      const tools = agent["getToolDefinitionsForGemini"]();
      expect(tools).toBeUndefined();
    });

    it("should convert tools to Gemini format", () => {
      agent["tools"].set("test_tool", {
        getPrompt: jest.fn().mockReturnValue({
          name: "test_tool",
          description: "A test tool",
          input_schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "A message" },
            },
            required: ["message"],
          },
        }),
      } as any);

      const tools = agent["getToolDefinitionsForGemini"]();

      expect(tools).toEqual({
        functionDeclarations: [
          {
            name: "test_tool",
            description: "A test tool",
            parameters: {
              type: "object",
              description: undefined,
              properties: {
                message: { type: "string", description: "A message" },
              },
              required: ["message"],
            },
          },
        ],
      });
    });
  });
});
