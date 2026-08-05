import type { Tool } from "../tools/Tool";

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
 * Structural equivalent of the MCP SDK's `OAuthClientProvider`.
 *
 * `@modelcontextprotocol/sdk` is an optional peer dependency, so this type is
 * declared here rather than imported: a type-only import would still have to be
 * resolved by `tsc`, which would break the build of every consumer that does not
 * install the SDK. TypeScript's structural typing means an SDK
 * `OAuthClientProvider` satisfies this interface directly — `MCPClient.spec.ts`
 * asserts that at compile time so drift in the SDK is caught by the test run.
 *
 * @example
 * ```typescript
 * import { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
 *
 * const myOAuthProvider: OAuthClientProvider = { ... };
 * const mcp = MCPClient.fromUrl("https://my-server.com/mcp", {
 *   authProvider: myOAuthProvider,
 * });
 * ```
 */
export interface MCPOAuthClientProvider {
  /** URL the user agent is redirected to after authorization. */
  readonly redirectUrl: string | URL | undefined;
  /** Metadata describing this OAuth client. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly clientMetadata: any;
  /** Loads previously registered client information, if any. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientInformation(): any;
  /** Loads the OAuth tokens for the current session, if any. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokens(): any;
  /** Persists new OAuth tokens after a successful authorization. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveTokens(tokens: any): void | Promise<void>;
  /** Redirects the user agent to begin the authorization flow. */
  redirectToAuthorization(authorizationUrl: URL): void | Promise<void>;
  /** Persists the PKCE code verifier for the current session. */
  saveCodeVerifier(codeVerifier: string): void | Promise<void>;
  /** Loads the PKCE code verifier for the current session. */
  codeVerifier(): string | Promise<string>;
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
   * Pass an `OAuthClientProvider` from `@modelcontextprotocol/sdk/client/auth.js`
   * for OAuth 2.0 + PKCE flows.
   *
   * @see {@link MCPOAuthClientProvider}
   */
  authProvider?: MCPOAuthClientProvider;
}

/**
 * Progress notification emitted by an MCP server during a long-running tool call.
 */
export interface MCPProgress {
  /** Amount of work completed so far. */
  progress: number;
  /** Total amount of work, when the server knows it. */
  total?: number;
  /** Human-readable description of the current step. */
  message?: string;
}

/**
 * Per-request options forwarded to the MCP SDK's `Client.callTool()`.
 *
 * These map one-to-one onto the SDK's `RequestOptions`.
 */
export interface MCPToolCallOptions {
  /**
   * Cancels the in-flight call. The tool rejects with an abort error as soon as
   * the signal fires, which lets a host interrupt an agent turn that is blocked
   * on a hung server.
   */
  signal?: AbortSignal;
  /**
   * Timeout in milliseconds for this call.
   * @default 60000 (the MCP SDK's `DEFAULT_REQUEST_TIMEOUT_MSEC`)
   */
  timeout?: number;
  /** Reset the timeout every time a progress notification arrives. */
  resetTimeoutOnProgress?: boolean;
  /** Hard ceiling in milliseconds, regardless of progress notifications. */
  maxTotalTimeout?: number;
  /** Invoked for each progress notification the server sends. */
  onprogress?: (progress: MCPProgress) => void;
}

/**
 * Identifies the call that options or a formatter are being resolved for.
 */
export interface MCPToolCallContext {
  /** Name of the MCP tool being called. */
  toolName: string;
  /** Arguments the agent passed to the tool. */
  input: Record<string, unknown>;
}

/**
 * Default call options for an {@link MCPClient} — either a fixed object or a
 * function resolved fresh on every call.
 *
 * The function form is the one to reach for when the signal changes per agent
 * turn: return the current turn's `AbortController.signal` and every subsequent
 * tool call picks it up.
 */
export type MCPCallOptionsSource =
  | MCPToolCallOptions
  | ((context: MCPToolCallContext) => MCPToolCallOptions | undefined);

/** A text block in an MCP tool result. */
export interface MCPTextContent {
  type: "text";
  text: string;
}

/** An image block in an MCP tool result. `data` is base64-encoded. */
export interface MCPImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

/** An audio block in an MCP tool result. `data` is base64-encoded. */
export interface MCPAudioContent {
  type: "audio";
  data: string;
  mimeType: string;
}

/** A resource embedded directly in an MCP tool result. */
export interface MCPEmbeddedResourceContent {
  type: "resource";
  resource: {
    uri: string;
    mimeType?: string;
    /** Present for text resources. */
    text?: string;
    /** Present for binary resources, base64-encoded. */
    blob?: string;
  };
}

/** A reference to a resource the client can read separately. */
export interface MCPResourceLinkContent {
  type: "resource_link";
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  size?: number;
}

/**
 * A single block of an MCP tool result. The open-ended member keeps forward
 * compatibility with content types added to the protocol later.
 */
export type MCPContentBlock =
  | MCPTextContent
  | MCPImageContent
  | MCPAudioContent
  | MCPEmbeddedResourceContent
  | MCPResourceLinkContent
  | { type: string; [key: string]: unknown };

/**
 * The raw `CallToolResult` returned by an MCP server.
 */
export interface MCPCallToolResult {
  /** Content blocks produced by the tool. */
  content?: MCPContentBlock[];
  /** Structured output, when the tool declares an `outputSchema`. */
  structuredContent?: Record<string, unknown>;
  /** Set by the server when the tool itself failed. */
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Converts a raw MCP tool result into the value the agent receives.
 *
 * Supply one to take full control of how results reach the model — for example
 * to turn image blocks into multimodal content instead of text placeholders.
 * Returning from the formatter suppresses the built-in rendering entirely;
 * throwing surfaces as a tool error.
 */
export type MCPToolResultFormatter = (
  result: MCPCallToolResult,
  context: MCPToolCallContext
) => unknown;

/**
 * Automatic reconnection behaviour for a dropped transport.
 */
export interface MCPReconnectOptions {
  /**
   * Reconnect automatically when the transport closes unexpectedly.
   * @default false
   */
  enabled?: boolean;
  /**
   * Maximum number of consecutive reconnect attempts before giving up.
   * Pass `Infinity` to retry forever.
   * @default 5
   */
  maxRetries?: number;
  /**
   * Delay before the first retry, in milliseconds. Subsequent delays grow by
   * {@link MCPReconnectOptions.backoffFactor} up to
   * {@link MCPReconnectOptions.maxDelayMs}.
   * @default 500
   */
  initialDelayMs?: number;
  /**
   * Upper bound for the backoff delay, in milliseconds.
   * @default 30000
   */
  maxDelayMs?: number;
  /**
   * Multiplier applied to the delay after each failed attempt.
   * @default 2
   */
  backoffFactor?: number;
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
  /**
   * Default options applied to every tool call — most importantly `signal` and
   * `timeout`. Pass a function to resolve them per call.
   *
   * @see {@link MCPClient.setCallOptions} to change them after construction.
   */
  callOptions?: MCPCallOptionsSource;
  /**
   * Throw when a server marks a result with `isError: true`.
   *
   * Agents catch tool errors and hand the message back to the model as a failed
   * tool result, so leaving this on means a tool-level failure is never mistaken
   * for a successful one. Set to `false` to receive the rendered error content
   * as an ordinary return value instead.
   *
   * @default true
   */
  throwOnToolError?: boolean;
  /**
   * Override how a raw MCP result is converted into the agent-visible value.
   */
  formatResult?: MCPToolResultFormatter;
  /**
   * Automatic reconnection after an unexpected transport close.
   * @default { enabled: false }
   */
  reconnect?: MCPReconnectOptions;
  /**
   * Re-run tool discovery when the server sends `notifications/tools/list_changed`.
   * @default true
   */
  refreshToolsOnListChanged?: boolean;
}

/**
 * Lifecycle state of an {@link MCPClient}'s connection.
 *
 * - `disconnected` — never connected, or disconnected on purpose
 * - `connecting` — {@link MCPClient.connect} is in flight
 * - `connected` — usable
 * - `reconnecting` — the transport dropped and a retry is scheduled or running
 * - `failed` — the transport dropped and reconnection gave up
 */
export type MCPConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

/** Payload of {@link MCPClientEvent.CONNECTED}. */
export interface MCPConnectedEvent {
  tools: Tool<unknown>[];
}

/** Payload of {@link MCPClientEvent.DISCONNECTED}. */
export interface MCPDisconnectedEvent {
  /** The transport error, when the close was caused by one. */
  error?: Error;
  /** `true` when the close was requested via {@link MCPClient.disconnect}. */
  deliberate: boolean;
  /** `true` when a reconnect attempt has been scheduled. */
  willReconnect: boolean;
}

/** Payload of {@link MCPClientEvent.RECONNECTING}. */
export interface MCPReconnectingEvent {
  /** 1-based attempt counter. */
  attempt: number;
  /** Delay waited before this attempt, in milliseconds. */
  delayMs: number;
}

/** Payload of {@link MCPClientEvent.TOOLS_CHANGED}. */
export interface MCPToolsChangedEvent {
  /** The full, current tool list. */
  tools: Tool<unknown>[];
  /** Names present now that were not present before. */
  added: string[];
  /** Names present before that are gone now. */
  removed: string[];
}

/**
 * Maps each {@link MCPClientEvent} name to its listener payload.
 */
export interface MCPClientEventMap {
  connected: MCPConnectedEvent;
  disconnected: MCPDisconnectedEvent;
  reconnecting: MCPReconnectingEvent;
  reconnected: MCPConnectedEvent;
  toolsChanged: MCPToolsChangedEvent;
  error: Error;
}
