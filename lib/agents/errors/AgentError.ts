import type { PartialTurn } from "../BaseAgent";

/**
 * Base error class for all agent-related errors
 */
export class AgentError extends Error {
  /**
   * What a streamed turn had generated when this error cut it short, where the
   * error came out of `executeStream()`. Streaming agents only write an
   * assistant turn to history once the stream ends cleanly, so without this the
   * text and the reasoning trail generated up to the failure would be lost —
   * cheap for a short answer, expensive for a local reasoning model.
   *
   * Also available as `agent.lastPartialTurn`. See {@link PartialTurn} for why
   * it is handed back rather than written to history.
   */
  public partial?: PartialTurn;

  /**
   * @param message Error message
   * @param options Additional error options
   */
  constructor(message: string) {
    super(message);
    this.name = "AgentError";
  }
}

/**
 * Error thrown when an agent's execution fails
 */
export class ExecutionError extends AgentError {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionError";
  }
}

/**
 * Error thrown when LLM API request fails
 */
export class ApiError extends AgentError {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Error thrown when the provider rate limits a request and the agent's retry
 * policy did not manage to get past it.
 *
 * Extends {@link ApiError}, so existing `catch (e) { if (e instanceof ApiError) }`
 * handling keeps working; the extra fields carry what the provider said about
 * when to come back.
 */
export class RateLimitError extends ApiError {
  /**
   * @param message      Error message
   * @param retryAfterMs How long the provider asked you to wait, in
   *                     milliseconds, from its `Retry-After` header. Undefined
   *                     when it sent no hint.
   * @param limit        Requests permitted in the window (`X-RateLimit-Limit`).
   * @param remaining    Requests left in the window (`X-RateLimit-Remaining`).
   * @param resetAt      When the window resets (`X-RateLimit-Reset`).
   * @param response     The underlying provider error.
   */
  constructor(
    message: string,
    public retryAfterMs?: number,
    public limit?: number,
    public remaining?: number,
    public resetAt?: Date,
    response?: unknown
  ) {
    super(message, 429, response);
    this.name = "RateLimitError";
  }
}

/**
 * Error thrown when maximum token limit is exceeded
 */
export class MaxTokensExceededError extends AgentError {
  /**
   * @param message    Error message
   * @param tokenLimit The configured `maxTokens` that was hit. Undefined when
   *                   no limit was configured and the model's own output cap
   *                   is what ended the response — reporting a number the
   *                   caller never set would just be misleading.
   */
  constructor(message: string, public tokenLimit?: number) {
    super(message);
    this.name = "MaxTokensExceededError";
  }
}

/**
 * Error thrown when maximum retries are exceeded
 */
export class MaxRetriesExceededError extends AgentError {
  constructor(message: string, public maxRetries: number) {
    super(message);
    this.name = "MaxRetriesExceededError";
  }
}

/**
 * Error thrown when an execution is cancelled through the `AbortSignal` passed
 * to `execute()` / `executeStream()`.
 *
 * `name` is `"AbortError"`, matching the platform convention, so callers that
 * already check `err.name === "AbortError"` keep working.
 */
export class AbortError extends AgentError {
  /**
   * @param message Error message
   * @param reason The signal's `reason`, or the underlying provider error when
   *               the signal did not carry one.
   */
  constructor(message: string, public reason?: unknown) {
    super(message);
    this.name = "AbortError";
  }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends AgentError {
  constructor(message: string, public toolName: string, public input: any) {
    super(message);
    this.name = "ToolExecutionError";
  }
}
