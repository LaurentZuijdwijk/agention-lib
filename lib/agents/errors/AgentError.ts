/**
 * Base error class for all agent-related errors
 */
export class AgentError extends Error {
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
 * Error thrown when maximum token limit is exceeded
 */
export class MaxTokensExceededError extends AgentError {
  constructor(message: string, public tokenLimit: number) {
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
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends AgentError {
  constructor(message: string, public toolName: string, public input: any) {
    super(message);
    this.name = "ToolExecutionError";
  }
}
