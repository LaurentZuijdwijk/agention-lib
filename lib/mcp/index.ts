/**
 * MCP (Model Context Protocol) support for agention-lib.
 *
 * Connects to any MCP server — local stdio processes or remote HTTP endpoints —
 * and exposes their tools as agention-lib {@link Tool} instances compatible with
 * all agent types (ClaudeAgent, OpenAiAgent, MistralAgent, GeminiAgent).
 *
 * @requires @modelcontextprotocol/sdk - Optional peer dependency, install when needed:
 * ```
 * npm install @modelcontextprotocol/sdk
 * ```
 *
 * @example Stdio (local process)
 * ```typescript
 * import { MCPClient, ClaudeAgent } from "@agentionai/agents";
 *
 * const mcp = MCPClient.fromStdio({
 *   command: "npx",
 *   args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
 * });
 *
 * await mcp.connect();
 *
 * const agent = new ClaudeAgent({
 *   id: "file-agent",
 *   name: "File Agent",
 *   description: "An agent that can work with files",
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
 *   tools: mcp.getTools(),
 * });
 *
 * const result = await agent.execute("List the files in /tmp");
 * await mcp.disconnect();
 * ```
 *
 * @example HTTP with static API key
 * ```typescript
 * import { MCPClient } from "@agentionai/agents";
 *
 * const mcp = MCPClient.fromUrl("https://my-mcp-server.com/mcp", {
 *   headers: { Authorization: "Bearer my-api-key" },
 * });
 *
 * await mcp.connect();
 * agent.addTools(mcp.getTools());
 * await mcp.disconnect();
 * ```
 *
 * @example HTTP with OAuth
 * ```typescript
 * import { MCPClient } from "@agentionai/agents";
 * import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
 *
 * // Implement OAuthClientProvider from the MCP SDK
 * const myOAuthProvider: OAuthClientProvider = { ... };
 *
 * const mcp = MCPClient.fromUrl("https://my-mcp-server.com/mcp", {
 *   authProvider: myOAuthProvider,
 * });
 * ```
 *
 * @example Cancellation, timeouts and a connection that drops
 * ```typescript
 * import { MCPClient, MCPClientEvent } from "@agentionai/agents";
 *
 * const turn = new AbortController();
 * const mcp = MCPClient.fromUrl("https://my-mcp-server.com/mcp", {
 *   callOptions: () => ({ signal: turn.signal, timeout: 20_000 }),
 *   reconnect: { enabled: true, maxRetries: 10 },
 * });
 *
 * mcp.on(MCPClientEvent.DISCONNECTED, ({ willReconnect }) => {
 *   console.warn("MCP connection lost", { willReconnect });
 * });
 * mcp.on(MCPClientEvent.TOOLS_CHANGED, ({ tools }) => agent.addTools(tools));
 * ```
 */

export { MCPClient, MCPClientEvent } from "./MCPClient";
export { MCPError, MCPCallError, MCPNotConnectedError, MCPToolError } from "./errors";
export { renderContentBlock, renderToolResult } from "./content";
export type {
  MCPStdioConfig,
  MCPHttpConfig,
  MCPClientOptions,
  MCPOAuthClientProvider,
  MCPCallOptionsSource,
  MCPToolCallOptions,
  MCPToolCallContext,
  MCPToolResultFormatter,
  MCPReconnectOptions,
  MCPConnectionState,
  MCPProgress,
  MCPCallToolResult,
  MCPContentBlock,
  MCPTextContent,
  MCPImageContent,
  MCPAudioContent,
  MCPEmbeddedResourceContent,
  MCPResourceLinkContent,
  MCPClientEventMap,
  MCPConnectedEvent,
  MCPDisconnectedEvent,
  MCPReconnectingEvent,
  MCPToolsChangedEvent,
} from "./types";
