// @ts-nocheck
import { defaultHeadersHook } from "./MistralAgent";

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
});
