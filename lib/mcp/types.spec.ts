import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { MCPOAuthClientProvider } from "./types";

/**
 * `MCPOAuthClientProvider` is declared locally rather than imported from the MCP
 * SDK, because the SDK is an optional peer dependency and a type-only import
 * would still have to be resolved by every consumer's `tsc`.
 *
 * These are compile-time assertions rather than runtime checks: if the SDK's
 * `OAuthClientProvider` stops being assignable to our declaration, `ts-jest`
 * fails this suite and the drift is caught by the test run.
 */
describe("MCPOAuthClientProvider", () => {
  it("accepts an OAuthClientProvider from the MCP SDK", () => {
    const accept = (provider: MCPOAuthClientProvider) => provider;
    const sdkProvider = null as unknown as OAuthClientProvider;

    expect(accept(sdkProvider)).toBeNull();
  });

  it("accepts a hand-rolled provider that implements the same surface", () => {
    const provider: MCPOAuthClientProvider = {
      redirectUrl: "https://example.com/callback",
      clientMetadata: { redirect_uris: ["https://example.com/callback"] },
      clientInformation: () => undefined,
      tokens: () => undefined,
      saveTokens: () => undefined,
      redirectToAuthorization: () => undefined,
      saveCodeVerifier: () => undefined,
      codeVerifier: () => "verifier",
    };

    expect(provider.codeVerifier()).toBe("verifier");
  });
});
