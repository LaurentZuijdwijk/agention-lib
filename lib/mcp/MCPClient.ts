import { Tool, ToolInputSchema } from "../tools/Tool";
import { MCPStdioConfig, MCPHttpConfig, MCPClientOptions } from "./types";

type TransportConfig =
  | { type: "stdio"; config: MCPStdioConfig }
  | { type: "http"; config: MCPHttpConfig };

/**
 * MCPClient connects to an MCP (Model Context Protocol) server and converts its
 * tools into agention-lib {@link Tool} instances that can be passed to any agent.
 *
 * Supports two transport types:
 * - **stdio** — spawns a local process and communicates over stdin/stdout
 * - **http** — connects to a remote MCP server over Streamable HTTP
 *
 * @requires @modelcontextprotocol/sdk - Install as a peer dependency:
 * ```
 * npm install @modelcontextprotocol/sdk
 * ```
 *
 * @example Stdio (local process)
 * ```typescript
 * import { MCPClient } from "@agentionai/agents";
 * import { ClaudeAgent } from "@agentionai/agents/claude";
 *
 * const mcp = MCPClient.fromStdio({
 *   command: "npx",
 *   args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
 * });
 *
 * await mcp.connect();
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
 * const mcp = MCPClient.fromUrl("https://my-mcp-server.com/mcp", {
 *   headers: { Authorization: "Bearer my-api-key" },
 * });
 *
 * await mcp.connect();
 * agent.addTools(mcp.getTools());
 * ```
 *
 * @example HTTP with OAuth
 * ```typescript
 * import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
 *
 * const mcp = MCPClient.fromUrl("https://my-mcp-server.com/mcp", {
 *   authProvider: myOAuthProvider, // implements OAuthClientProvider
 * });
 * ```
 */
export class MCPClient {
  private readonly transportConfig: TransportConfig;
  private readonly options: Required<MCPClientOptions>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sdkClient: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sdkTransport: any = null;
  private _tools: Tool<unknown>[] = [];
  private connected = false;

  private constructor(transportConfig: TransportConfig, options: MCPClientOptions = {}) {
    this.transportConfig = transportConfig;
    this.options = {
      clientName: options.clientName ?? "agention-mcp-client",
      clientVersion: options.clientVersion ?? "1.0.0",
    };
  }

  /**
   * Create an MCPClient that connects to a local MCP server process via stdio.
   *
   * @param config - Command and arguments to spawn the MCP server process
   * @param options - Optional client identification options
   */
  static fromStdio(config: MCPStdioConfig, options?: MCPClientOptions): MCPClient {
    return new MCPClient({ type: "stdio", config }, options);
  }

  /**
   * Create an MCPClient that connects to a remote MCP server via HTTP.
   *
   * @param url - Full URL to the MCP endpoint
   * @param options - Optional client options including auth headers or OAuth provider
   */
  static fromUrl(
    url: string,
    options?: MCPClientOptions & Pick<MCPHttpConfig, "headers" | "authProvider">
  ): MCPClient {
    const config: MCPHttpConfig = {
      url,
      headers: options?.headers,
      authProvider: options?.authProvider,
    };
    return new MCPClient({ type: "http", config }, options);
  }

  /**
   * Connect to the MCP server and discover all available tools.
   *
   * This method is idempotent — calling it when already connected is a no-op.
   * Must be called before {@link getTools}.
   *
   * @throws If the MCP server cannot be reached or the SDK is not installed
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    // Build module paths at runtime so tsc does not attempt to resolve them at
    // compile time. @modelcontextprotocol/sdk is an optional peer dependency and
    // may not be installed on the build host.
    const pkg = "@modelcontextprotocol/sdk";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Client } = await import(/* @vite-ignore */ `${pkg}/client/index.js`) as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkClient: any = new Client(
      { name: this.options.clientName, version: this.options.clientVersion },
      { capabilities: {} }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let transport: any;

    if (this.transportConfig.type === "stdio") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { StdioClientTransport } = await import(/* @vite-ignore */ `${pkg}/client/stdio.js`) as any;
      transport = new StdioClientTransport({
        command: this.transportConfig.config.command,
        args: this.transportConfig.config.args ?? [],
        env: this.transportConfig.config.env,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { StreamableHTTPClientTransport } = await import(/* @vite-ignore */ `${pkg}/client/streamableHttp.js`) as any;
      const { url, headers, authProvider } = this.transportConfig.config;
      transport = new StreamableHTTPClientTransport(new URL(url), {
        ...(headers ? { requestInit: { headers } } : {}),
        ...(authProvider ? { authProvider } : {}),
      });
    }

    await sdkClient.connect(transport);

    this.sdkClient = sdkClient;
    this.sdkTransport = transport;
    this.connected = true;

    // Paginate through all tools
    const allMcpTools: Array<{
      name: string;
      description?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: any;
    }> = [];

    let cursor: string | undefined;
    do {
      const response = await sdkClient.listTools(cursor ? { cursor } : {});
      allMcpTools.push(...response.tools);
      cursor = response.nextCursor;
    } while (cursor);

    this._tools = allMcpTools.map((mcpTool) => this.wrapMcpTool(mcpTool));
  }

  /**
   * Return all tools discovered from the MCP server as agention-lib Tool instances.
   *
   * Returns an empty array if {@link connect} has not been called yet.
   * The returned tools can be passed directly to any agent via the `tools` config
   * option or {@link BaseAgent.addTools}.
   */
  getTools(): Tool<unknown>[] {
    return this._tools;
  }

  /**
   * Disconnect from the MCP server and release all resources.
   *
   * This method is idempotent — calling it when not connected is a no-op.
   * After disconnecting, {@link getTools} returns an empty array.
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      if (this.transportConfig.type === "http" && this.sdkTransport) {
        await this.sdkTransport.terminateSession?.();
      }
      if (this.sdkClient) {
        await this.sdkClient.close();
      }
    } finally {
      this.sdkClient = null;
      this.sdkTransport = null;
      this._tools = [];
      this.connected = false;
    }
  }

  private wrapMcpTool(mcpTool: {
    name: string;
    description?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputSchema: any;
  }): Tool<unknown> {
    const inputSchema: ToolInputSchema = {
      type: "object",
      properties: mcpTool.inputSchema?.properties ?? {},
      required: mcpTool.inputSchema?.required,
    };

    return new Tool<unknown>({
      name: mcpTool.name,
      description: mcpTool.description ?? mcpTool.name,
      inputSchema,
      execute: async (input: Record<string, unknown>) => {
        if (!this.connected || !this.sdkClient) {
          throw new Error(
            `MCPClient: Cannot execute tool "${mcpTool.name}" — client is not connected`
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let result: any;
        try {
          result = await this.sdkClient.callTool({
            name: mcpTool.name,
            arguments: input,
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(
            `MCPClient: Tool "${mcpTool.name}" execution failed: ${message}`
          );
        }

        // Extract text content items from MCP result
        if (result?.content && Array.isArray(result.content)) {
          const textItems: string[] = result.content
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((item: any) => item.type === "text")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((item: any) => item.text as string);

          if (textItems.length > 0) {
            return textItems.length === 1 ? textItems[0] : textItems.join("\n");
          }
        }

        // Fall back to structured content or full JSON serialization
        if (result?.structuredContent !== undefined) {
          return result.structuredContent;
        }

        return JSON.stringify(result ?? null);
      },
    });
  }
}
