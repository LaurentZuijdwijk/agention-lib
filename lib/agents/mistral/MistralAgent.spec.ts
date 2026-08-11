// @ts-nocheck
import { Mistral } from "@mistralai/mistralai";
import { MistralAgent, defaultHeadersHook } from "./MistralAgent";
import { ExecutionError } from "../errors/AgentError";

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
          raw: cards[0],
        },
        {
          id: "ft:open-mistral-7b:my-org:custom",
          // `name` comes back as null on a fine-tuned model without one
          displayName: undefined,
          created: undefined,
          ownedBy: "my-org",
          contextLength: 32768,
          raw: cards[1],
        },
      ]);
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
});
