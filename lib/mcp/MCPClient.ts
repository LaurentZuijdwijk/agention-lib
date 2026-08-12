import EventEmitter from "events";
import { Tool, ToolInputSchema } from "../tools/Tool";
import { renderToolResult } from "./content";
import { MCPCallError, MCPNotConnectedError, MCPToolError } from "./errors";
import {
  MCPCallOptionsSource,
  MCPCallToolResult,
  MCPClientEventMap,
  MCPClientOptions,
  MCPConnectionState,
  MCPHttpConfig,
  MCPReconnectOptions,
  MCPStdioConfig,
  MCPToolCallContext,
  MCPToolCallOptions,
  MCPToolResultFormatter,
} from "./types";

type TransportConfig =
  | { type: "stdio"; config: MCPStdioConfig }
  | { type: "http"; config: MCPHttpConfig };

/** A tool definition as returned by an MCP server's `tools/list`. */
interface MCPToolDefinition {
  name: string;
  description?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any;
}

/**
 * Names of the events an {@link MCPClient} emits.
 *
 * @example
 * ```typescript
 * mcp.on(MCPClientEvent.DISCONNECTED, ({ willReconnect }) => {
 *   if (!willReconnect) scheduleManualReconnect();
 * });
 * ```
 */
export class MCPClientEvent {
  /** Emitted after a successful {@link MCPClient.connect}. */
  public static CONNECTED = "connected" as const;
  /** Emitted whenever the connection is lost, deliberately or not. */
  public static DISCONNECTED = "disconnected" as const;
  /** Emitted before each automatic reconnect attempt. */
  public static RECONNECTING = "reconnecting" as const;
  /** Emitted when an automatic reconnect succeeds. */
  public static RECONNECTED = "reconnected" as const;
  /** Emitted when the server's tool list changes. */
  public static TOOLS_CHANGED = "toolsChanged" as const;
  /**
   * Emitted for out-of-band transport errors and for failures inside background
   * work such as reconnection or tool refresh.
   */
  public static ERROR = "error" as const;
}

const DEFAULT_RECONNECT: Required<MCPReconnectOptions> = {
  enabled: false,
  maxRetries: 5,
  initialDelayMs: 500,
  maxDelayMs: 30_000,
  backoffFactor: 2,
};

/**
 * MCPClient connects to an MCP (Model Context Protocol) server and converts its
 * tools into agention-lib {@link Tool} instances that can be passed to any agent.
 *
 * Supports two transport types:
 * - **stdio** — spawns a local process and communicates over stdin/stdout
 * - **http** — connects to a remote MCP server over Streamable HTTP
 *
 * The client is an `EventEmitter`; see {@link MCPClientEvent} for the lifecycle
 * events a host can watch.
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
 * @example Cancellable, time-boxed tool calls
 * ```typescript
 * let turn = new AbortController();
 *
 * const mcp = MCPClient.fromUrl("https://my-mcp-server.com/mcp", {
 *   // Resolved per call, so each agent turn gets the current signal
 *   callOptions: () => ({ signal: turn.signal, timeout: 20_000 }),
 *   reconnect: { enabled: true },
 * });
 *
 * // Interrupting the turn now aborts any in-flight MCP call
 * turn.abort();
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
export class MCPClient extends EventEmitter {
  private readonly transportConfig: TransportConfig;
  private readonly clientName: string;
  private readonly clientVersion: string;
  private readonly throwOnToolError: boolean;
  private readonly refreshToolsOnListChanged: boolean;
  private readonly formatResult: MCPToolResultFormatter | undefined;
  private readonly reconnectOptions: Required<MCPReconnectOptions>;

  private callOptions: MCPCallOptionsSource | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sdkClient: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sdkTransport: any = null;
  private _tools: Tool<unknown>[] = [];
  /** Signature per tool name, used to keep Tool identity stable across refreshes. */
  private toolSignatures = new Map<string, string>();
  private _state: MCPConnectionState = "disconnected";

  private connectPromise: Promise<void> | null = null;
  private reconnectPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectWake: (() => void) | null = null;
  private closedByUser = false;
  private lastTransportError: Error | undefined;

  private constructor(transportConfig: TransportConfig, options: MCPClientOptions = {}) {
    super();
    this.transportConfig = transportConfig;
    this.clientName = options.clientName ?? "agention-mcp-client";
    this.clientVersion = options.clientVersion ?? "1.0.0";
    this.callOptions = options.callOptions;
    this.throwOnToolError = options.throwOnToolError ?? true;
    this.refreshToolsOnListChanged = options.refreshToolsOnListChanged ?? true;
    this.formatResult = options.formatResult;
    this.reconnectOptions = { ...DEFAULT_RECONNECT, ...options.reconnect };
  }

  /**
   * Create an MCPClient that connects to a local MCP server process via stdio.
   *
   * @param config - Command and arguments to spawn the MCP server process
   * @param options - Optional client identification and behaviour options
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
   * This method is idempotent — calling it when already connected is a no-op, and
   * concurrent calls share a single connection attempt.
   * Must be called before {@link getTools}.
   *
   * @throws If the MCP server cannot be reached or the SDK is not installed
   */
  async connect(): Promise<void> {
    if (this._state === "connected") return;
    if (this.connectPromise) return this.connectPromise;

    this.closedByUser = false;
    this._state = "connecting";

    this.connectPromise = this.establish()
      .then(() => {
        this._state = "connected";
        this.reconnectAttempts = 0;
        this.emitEvent(MCPClientEvent.CONNECTED, { tools: this._tools });
      })
      .catch((error: unknown) => {
        this._state = "disconnected";
        throw error;
      })
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  /**
   * Return all tools discovered from the MCP server as agention-lib Tool instances.
   *
   * Returns an empty array if {@link connect} has not been called yet.
   * The returned tools can be passed directly to any agent via the `tools` config
   * option or {@link BaseAgent.addTools}.
   *
   * Tool instances are stable across reconnects and tool-list refreshes: a tool
   * whose definition is unchanged keeps its identity, so agents already holding it
   * keep working. Listen for {@link MCPClientEvent.TOOLS_CHANGED} to learn when the
   * list itself changed.
   */
  getTools(): Tool<unknown>[] {
    return this._tools;
  }

  /**
   * Current connection state.
   *
   * @see {@link MCPConnectionState}
   */
  getState(): MCPConnectionState {
    return this._state;
  }

  /** Whether the client currently has a usable connection. */
  isConnected(): boolean {
    return this._state === "connected";
  }

  /**
   * Replace the default options applied to every tool call.
   *
   * Pass a function to have them resolved per call — the usual way to scope an
   * `AbortSignal` to the current agent turn.
   *
   * @example
   * ```typescript
   * mcp.setCallOptions(() => ({ signal: currentTurn.signal, timeout: 15_000 }));
   * ```
   */
  setCallOptions(options: MCPCallOptionsSource | undefined): void {
    this.callOptions = options;
  }

  /**
   * Call an MCP tool directly and receive the raw `CallToolResult`, including any
   * image, audio or resource blocks and the `isError` flag.
   *
   * Unlike the wrapped {@link Tool} instances from {@link getTools}, this does not
   * render the result or throw on `isError` — it is the escape hatch for hosts
   * that want to handle MCP content themselves.
   *
   * @param name - Name of the tool as advertised by the server
   * @param input - Arguments for the tool
   * @param options - Per-call options, merged over the client defaults
   */
  async callTool(
    name: string,
    input: Record<string, unknown> = {},
    options?: MCPToolCallOptions
  ): Promise<MCPCallToolResult> {
    return this.invokeTool(name, input, options);
  }

  /**
   * Re-run tool discovery against the connected server.
   *
   * Called automatically when the server sends `notifications/tools/list_changed`
   * (unless `refreshToolsOnListChanged` is disabled) and after a successful
   * reconnect. Emits {@link MCPClientEvent.TOOLS_CHANGED} when the list differs.
   *
   * @returns The refreshed tool list
   */
  async refreshTools(): Promise<Tool<unknown>[]> {
    const sdkClient = this.sdkClient;
    if (!sdkClient) {
      throw new MCPNotConnectedError(
        "MCPClient: Cannot refresh tools — client is not connected",
        "",
        this._state
      );
    }

    const definitions = await this.listAllTools(sdkClient);
    this.applyToolDefinitions(definitions);
    return this._tools;
  }

  /**
   * Disconnect from the MCP server and release all resources.
   *
   * This method is idempotent — calling it when not connected is a no-op. It also
   * cancels any pending automatic reconnect. After disconnecting, {@link getTools}
   * returns an empty array; call {@link connect} again to start over.
   */
  async disconnect(): Promise<void> {
    const wasActive = this._state !== "disconnected" || this.sdkClient !== null;

    this.closedByUser = true;
    this.cancelReconnectWait();

    if (this.reconnectPromise) {
      await this.reconnectPromise.catch(() => undefined);
    }

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
      this.toolSignatures.clear();
      this.reconnectAttempts = 0;
      this._state = "disconnected";
    }

    if (wasActive) {
      this.emitEvent(MCPClientEvent.DISCONNECTED, {
        deliberate: true,
        willReconnect: false,
      });
    }
  }

  /**
   * Subscribe to a client lifecycle event.
   *
   * @see {@link MCPClientEvent} for the available event names.
   */
  on<K extends keyof MCPClientEventMap>(
    event: K,
    listener: (payload: MCPClientEventMap[K]) => void
  ): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  /** Subscribe to a client lifecycle event for a single emission. */
  once<K extends keyof MCPClientEventMap>(
    event: K,
    listener: (payload: MCPClientEventMap[K]) => void
  ): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string | symbol, listener: (...args: any[]) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }

  /**
   * Open the SDK client and transport, wire up lifecycle handlers and discover
   * tools. Shared by {@link connect} and the reconnect loop.
   */
  private async establish(): Promise<void> {
    // Build module paths at runtime so tsc does not attempt to resolve them at
    // compile time. @modelcontextprotocol/sdk is an optional peer dependency and
    // may not be installed on the build host.
    const pkg = "@modelcontextprotocol/sdk";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Client } = await import(/* @vite-ignore */ `${pkg}/client/index.js`) as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkClient: any = new Client(
      { name: this.clientName, version: this.clientVersion },
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

    // Registered before connect() so a notification arriving immediately after the
    // handshake is not missed.
    await this.subscribeToToolListChanges(sdkClient, pkg);

    sdkClient.onclose = () => this.handleClose(sdkClient);
    sdkClient.onerror = (error: unknown) => this.handleTransportError(sdkClient, error);

    await sdkClient.connect(transport);

    this.sdkClient = sdkClient;
    this.sdkTransport = transport;

    const definitions = await this.listAllTools(sdkClient);
    this.applyToolDefinitions(definitions, { silent: this._tools.length === 0 });
  }

  /**
   * Ask the server to notify us about tool list changes. Failures here are not
   * fatal — an older SDK or a server without the capability simply means the
   * cached list stays as it was at connect time.
   */
  private async subscribeToToolListChanges(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sdkClient: any,
    pkg: string
  ): Promise<void> {
    if (!this.refreshToolsOnListChanged) return;

    try {
      const { ToolListChangedNotificationSchema } = (await import(
        /* @vite-ignore */ `${pkg}/types.js`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      )) as any;

      sdkClient.setNotificationHandler(ToolListChangedNotificationSchema, () => {
        void this.refreshTools().catch((error: unknown) => this.emitError(error));
      });
    } catch (error: unknown) {
      this.emitError(error);
    }
  }

  /** Page through `tools/list` until the server stops handing back a cursor. */
  private async listAllTools(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sdkClient: any
  ): Promise<MCPToolDefinition[]> {
    const definitions: MCPToolDefinition[] = [];

    let cursor: string | undefined;
    do {
      const response = await sdkClient.listTools(cursor ? { cursor } : {});
      definitions.push(...response.tools);
      cursor = response.nextCursor;
    } while (cursor);

    return definitions;
  }

  /**
   * Reconcile the cached tool list with a fresh set of definitions, reusing the
   * existing {@link Tool} instance for every definition that has not changed so
   * agents holding a reference keep working.
   */
  private applyToolDefinitions(
    definitions: MCPToolDefinition[],
    { silent = false }: { silent?: boolean } = {}
  ): void {
    const previous = new Map(this._tools.map((tool) => [tool.name, tool]));
    const previousSignatures = this.toolSignatures;

    const tools: Tool<unknown>[] = [];
    const signatures = new Map<string, string>();
    const added: string[] = [];
    let changed = false;

    for (const definition of definitions) {
      const signature = JSON.stringify({
        description: definition.description ?? null,
        inputSchema: definition.inputSchema ?? null,
      });
      const existing = previous.get(definition.name);

      if (existing && previousSignatures.get(definition.name) === signature) {
        tools.push(existing);
      } else {
        tools.push(this.wrapMcpTool(definition));
        changed = true;
        if (!existing) added.push(definition.name);
      }

      signatures.set(definition.name, signature);
      previous.delete(definition.name);
    }

    const removed = [...previous.keys()];

    this._tools = tools;
    this.toolSignatures = signatures;

    if (!silent && (changed || removed.length > 0)) {
      this.emitEvent(MCPClientEvent.TOOLS_CHANGED, { tools, added, removed });
    }
  }

  /**
   * Handle the transport closing. Deliberate closes are reported by
   * {@link disconnect} itself; everything else is an unexpected drop.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleClose(sdkClient: any): void {
    if (this.closedByUser) return;
    // A close from a client we have already replaced or abandoned is stale.
    if (this.sdkClient !== sdkClient) return;

    this.sdkClient = null;
    this.sdkTransport = null;

    const willReconnect =
      this.reconnectOptions.enabled && this.reconnectAttempts < this.reconnectOptions.maxRetries;

    // A transport that fails reports the cause through onerror just before it
    // closes, so the most recent one is the reason for this drop.
    const error = this.lastTransportError;
    this.lastTransportError = undefined;

    this._state = willReconnect ? "reconnecting" : "failed";
    this.emitEvent(MCPClientEvent.DISCONNECTED, {
      ...(error ? { error } : {}),
      deliberate: false,
      willReconnect,
    });

    if (willReconnect) this.startReconnectLoop();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleTransportError(sdkClient: any, error: unknown): void {
    if (this.sdkClient !== null && this.sdkClient !== sdkClient) return;
    this.lastTransportError = error instanceof Error ? error : new Error(String(error));
    this.emitError(error);
  }

  /**
   * Retry {@link establish} with exponential backoff until it succeeds, the retry
   * budget runs out, or {@link disconnect} is called.
   */
  private startReconnectLoop(): void {
    if (this.reconnectPromise) return;

    this.reconnectPromise = (async () => {
      while (!this.closedByUser) {
        const attempt = ++this.reconnectAttempts;
        const delayMs = Math.min(
          this.reconnectOptions.initialDelayMs *
            Math.pow(this.reconnectOptions.backoffFactor, attempt - 1),
          this.reconnectOptions.maxDelayMs
        );

        this.emitEvent(MCPClientEvent.RECONNECTING, { attempt, delayMs });
        await this.waitBeforeReconnect(delayMs);
        if (this.closedByUser) return;

        try {
          await this.establish();
          this._state = "connected";
          this.reconnectAttempts = 0;
          this.emitEvent(MCPClientEvent.RECONNECTED, { tools: this._tools });
          return;
        } catch (error: unknown) {
          this.emitError(error);
          if (attempt >= this.reconnectOptions.maxRetries) {
            this._state = "failed";
            return;
          }
        }
      }
    })().finally(() => {
      this.reconnectPromise = null;
    });
  }

  private waitBeforeReconnect(delayMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.reconnectWake = resolve;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.reconnectWake = null;
        resolve();
      }, delayMs);
    });
  }

  private cancelReconnectWait(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.reconnectWake) {
      const wake = this.reconnectWake;
      this.reconnectWake = null;
      wake();
    }
  }

  /**
   * `EventEmitter` throws when an `error` event has no listener, which would turn
   * a background transport hiccup into a process crash. Only emit when someone is
   * actually listening.
   */
  private emitError(error: unknown): void {
    if (this.listenerCount(MCPClientEvent.ERROR) === 0) return;
    this.emit(
      MCPClientEvent.ERROR,
      error instanceof Error ? error : new Error(String(error))
    );
  }

  private emitEvent<K extends keyof MCPClientEventMap>(
    event: K,
    payload: MCPClientEventMap[K]
  ): void {
    this.emit(event, payload);
  }

  /**
   * Resolve the effective request options for a call: client defaults (static or
   * per-call), with explicit per-call options layered on top.
   */
  private resolveCallOptions(
    context: MCPToolCallContext,
    overrides?: MCPToolCallOptions
  ): MCPToolCallOptions | undefined {
    const defaults =
      typeof this.callOptions === "function" ? this.callOptions(context) : this.callOptions;

    const merged: MCPToolCallOptions = { ...defaults, ...overrides };
    const hasOption = Object.values(merged).some((value) => value !== undefined);

    return hasOption ? merged : undefined;
  }

  /**
   * Wait for the client to become usable, then issue the call. Wrapping every
   * transport-level failure keeps the error surface stable, while `cause` lets a
   * host tell an abort apart from a server error.
   */
  private async invokeTool(
    name: string,
    input: Record<string, unknown>,
    overrides?: MCPToolCallOptions
  ): Promise<MCPCallToolResult> {
    const callOptions = this.resolveCallOptions({ toolName: name, input }, overrides);
    const sdkClient = await this.awaitUsableClient(name, callOptions?.signal);

    try {
      const params = { name, arguments: input };
      return callOptions
        ? await sdkClient.callTool(params, undefined, callOptions)
        : await sdkClient.callTool(params);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MCPCallError(
        `MCPClient: Tool "${name}" execution failed: ${message}`,
        name,
        error
      );
    }
  }

  /**
   * Return the SDK client once one is usable. While a reconnect is in flight the
   * call waits for it rather than failing outright, so a transient drop does not
   * surface as a tool error — but an aborted signal still wins immediately.
   */
  private async awaitUsableClient(
    toolName: string,
    signal?: AbortSignal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    if (signal?.aborted) {
      throw new MCPCallError(
        `MCPClient: Tool "${toolName}" execution failed: request was aborted`,
        toolName,
        signal.reason
      );
    }

    if (this._state === "reconnecting" && this.reconnectPromise) {
      await this.raceAbort(this.reconnectPromise, toolName, signal);
    }

    if (this._state !== "connected" || !this.sdkClient) {
      throw new MCPNotConnectedError(
        `MCPClient: Cannot execute tool "${toolName}" — client is not connected`,
        toolName,
        this._state
      );
    }

    return this.sdkClient;
  }

  private raceAbort(
    promise: Promise<void>,
    toolName: string,
    signal?: AbortSignal
  ): Promise<void> {
    if (!signal) return promise;

    return new Promise<void>((resolve, reject) => {
      const onAbort = () =>
        reject(
          new MCPCallError(
            `MCPClient: Tool "${toolName}" execution failed: request was aborted`,
            toolName,
            signal.reason
          )
        );

      signal.addEventListener("abort", onAbort, { once: true });
      promise
        .then(resolve, reject)
        .finally(() => signal.removeEventListener("abort", onAbort));
    });
  }

  private wrapMcpTool(mcpTool: MCPToolDefinition): Tool<unknown> {
    const inputSchema: ToolInputSchema = {
      type: "object",
      properties: mcpTool.inputSchema?.properties ?? {},
      required: mcpTool.inputSchema?.required,
    };

    return new Tool<unknown>({
      name: mcpTool.name,
      description: mcpTool.description ?? mcpTool.name,
      inputSchema,
      execute: async (
        input: Record<string, unknown>,
        _context,
        options
      ) => {
        // The agent run's signal, when it supplied one, overrides the client's
        // default `callOptions.signal` for this call.
        const result = await this.invokeTool(
          mcpTool.name,
          input ?? {},
          options?.signal ? { signal: options.signal } : undefined
        );
        const context: MCPToolCallContext = { toolName: mcpTool.name, input: input ?? {} };

        if (result?.isError && this.throwOnToolError) {
          const rendered = renderToolResult(result);
          const detail = typeof rendered === "string" ? rendered : JSON.stringify(rendered);
          throw new MCPToolError(
            `MCPClient: Tool "${mcpTool.name}" reported an error: ${detail}`,
            mcpTool.name,
            result
          );
        }

        return this.formatResult
          ? this.formatResult(result, context)
          : renderToolResult(result);
      },
    });
  }
}
