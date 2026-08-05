import type { MCPCallToolResult } from "./types";

/**
 * Base error class for all MCP-related errors.
 */
export class MCPError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MCPError";
  }
}

/**
 * Thrown when a tool is executed while the client has no usable connection —
 * either because {@link MCPClient.connect} was never called, or because the
 * transport dropped and could not be restored.
 */
export class MCPNotConnectedError extends MCPError {
  constructor(
    message: string,
    /** Name of the tool that was called. */
    public toolName: string,
    /** Connection state at the time of the call. */
    public state: string
  ) {
    super(message);
    this.name = "MCPNotConnectedError";
  }
}

/**
 * Thrown when a `tools/call` request fails at the transport or protocol level —
 * a timeout, an aborted signal, or an error raised by the MCP SDK.
 *
 * The originating error is kept on {@link MCPCallError.cause}, which is how a host
 * tells a deliberate cancellation (`cause.name === "AbortError"`) apart from a
 * server-side failure.
 */
export class MCPCallError extends MCPError {
  constructor(
    message: string,
    /** Name of the tool that was called. */
    public toolName: string,
    /** The underlying error thrown by the MCP SDK, or the abort reason. */
    public cause?: unknown
  ) {
    super(message);
    this.name = "MCPCallError";
  }
}

/**
 * Thrown when an MCP server returns a result flagged with `isError: true`.
 *
 * This is a *tool-level* failure: the call itself succeeded at the protocol
 * level, but the tool reported that it could not do its job. Agents catch it and
 * pass the message back to the model as a failed tool result, which is what
 * distinguishes it from a result the model would otherwise read as success.
 */
export class MCPToolError extends MCPError {
  constructor(
    message: string,
    /** Name of the tool that reported the failure. */
    public toolName: string,
    /** The raw `CallToolResult`, including any non-text content blocks. */
    public result: MCPCallToolResult
  ) {
    super(message);
    this.name = "MCPToolError";
  }
}
