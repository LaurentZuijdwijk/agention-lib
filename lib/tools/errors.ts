/**
 * Thrown by {@link Tool.execute} when a `ToolEvent.EXECUTE` listener or a
 * registered guard calls `event.preventDefault()`, blocking the call before
 * it runs.
 */
export class ToolExecutionBlockedError extends Error {
  constructor(
    /** The reason a guard gave for blocking the call, if any. */
    public reason: string | undefined,
    /** Name of the tool the call was blocked on. */
    public toolName: string
  ) {
    super(
      reason ??
        "Tool execution prevented, do not try this tool again with this input"
    );
    this.name = "ToolExecutionBlockedError";
  }
}
