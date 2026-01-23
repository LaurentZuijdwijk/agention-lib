// @ts-nocheck
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiAgent } from "./GeminiAgent";

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
    it("should initialize with default values", () => {
      expect(agent).toBeInstanceOf(GeminiAgent);
      expect(GoogleGenerativeAI).toHaveBeenCalledWith("test-api-key");
      expect(mockClient.getGenerativeModel).toHaveBeenCalledWith({
        model: "gemini-2.0-flash",
      });
      expect(agent["config"]).toEqual({
        apiKey: "test-api-key",
        model: "gemini-2.0-flash",
        temperature: 0,
        maxTokens: 1024,
      });
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

      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: [{ role: "user", parts: [{ text: "test input" }] }],
        systemInstruction:
          "You are an agent called TestAgent and should follow these instructions: Test Description",
        tools: undefined,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0,
        },
      });
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

      expect(agent.lastTokenUsage).toEqual({
        input_tokens: 10,
        output_tokens: 100,
        total_tokens: 110,
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
