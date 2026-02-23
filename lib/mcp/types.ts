/**
 * Configuration for connecting to an MCP server via stdio (local process).
 */
export interface MCPStdioConfig {
  /** The command to spawn (e.g. "node", "python", "npx") */
  command: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the spawned process */
  env?: Record<string, string>;
}

/**
 * Configuration for connecting to an MCP server via HTTP (remote URL).
 */
export interface MCPHttpConfig {
  /** Full URL to the MCP endpoint */
  url: string;
  /** Optional HTTP headers for static auth tokens or API keys */
  headers?: Record<string, string>;
  /**
   * Optional OAuth provider for dynamic authorization.
   * Implement the `OAuthClientProvider` interface from `@modelcontextprotocol/sdk`
   * and pass it here for OAuth 2.0 + PKCE flows.
   *
   * @example
   * ```typescript
   * import { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
   *
   * const mcp = MCPClient.fromUrl("https://my-server.com/mcp", {
   *   authProvider: myOAuthProvider,
   * });
   * ```
   */
  authProvider?: unknown;
}

/**
 * Options shared by all MCPClient connection types.
 */
export interface MCPClientOptions {
  /**
   * Name to identify this MCP client (sent during SDK handshake).
   * @default "agention-mcp-client"
   */
  clientName?: string;
  /**
   * Version string for the MCP client.
   * @default "1.0.0"
   */
  clientVersion?: string;
}
