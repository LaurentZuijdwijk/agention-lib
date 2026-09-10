import { BaseAgent } from "./BaseAgent";

export class AgentEvent {
  public static BEFORE_EXECUTE = "before_execute";
  public static AFTER_EXECUTE = "after_execute";
  public static DONE = "done";
  public static TOOL_USE = "toolUse";
  public static ERROR = "error";
  public static RETRY = "retry";
  public static MAX_RETRIES_EXCEEDED = "max_retries_exceeded";
  public static MAX_TOKENS_EXCEEDED = "max_tokens_exceeded";
  public static TOOL_ERROR = "tool_error";
  public static CHUNK = "chunk";
  public static REASONING_CHUNK = "reasoning_chunk";
  /**
   * A streamed turn was cut short before its assistant message could be written
   * to history. The listener receives the `PartialTurn` that was salvaged.
   */
  public static PARTIAL_TURN = "partial_turn";
  /**
   * The provider reported how much of the account's allowance is left. Emitted
   * by `CodexAgent`, whose backend returns rate-limit and credit headers on
   * every response; the listener receives a `CodexUsageLimits`.
   */
  public static USAGE_LIMITS = "usage_limits";

  private defaultPrevented = false;

  constructor(public target: BaseAgent<any>) {}

  preventDefault() {
    this.defaultPrevented = true;
  }

  get isDefaultPrevented() {
    return this.defaultPrevented;
  }
}
