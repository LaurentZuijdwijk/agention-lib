import { AbortError } from "./errors/AgentError";

/**
 * Options accepted by every agent's `execute()` and `executeStream()`.
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 5_000);
 *
 * try {
 *   await agent.execute("Write an essay", { signal: controller.signal });
 * } catch (error) {
 *   if (error instanceof AbortError) console.log("cancelled");
 * }
 * ```
 */
export interface ExecuteOptions {
  /**
   * Cancels the run. The in-flight provider request is aborted, no further
   * requests or tools are started, and the call rejects with an
   * {@link AbortError}. History already written by the run is left in place, so
   * a non-transient agent keeps whatever turns completed before the abort.
   */
  signal?: AbortSignal;
}

/** Options passed to a tool's `execute`, carrying the current run's signal. */
export interface ToolExecuteOptions {
  /** The `AbortSignal` of the agent run this tool call belongs to. */
  signal?: AbortSignal;
}

/**
 * The `name` each provider SDK gives its cancellation error. Checked as a
 * fallback for the case where the caller's own signal is not the one that
 * fired — a client-level timeout, for instance.
 */
const ABORT_ERROR_NAMES = new Set([
  "AbortError", // fetch / DOMException, ollama, and our own AbortError
  "APIUserAbortError", // @anthropic-ai/sdk, openai
  "RequestAbortedError", // @mistralai/mistralai
  "GoogleGenerativeAIAbortError", // @google/generative-ai
]);

/**
 * Whether an error represents a cancellation rather than a genuine failure.
 *
 * The signal is authoritative: once it has fired, whatever the provider threw
 * on the way out is a consequence of the abort — including errors an agent
 * wrapped in `ExecutionError` before it reached the top-level handler. The
 * error's own `name` is only consulted when no aborted signal was supplied.
 */
export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;

  const name = (error as { name?: unknown } | null | undefined)?.name;
  return typeof name === "string" && ABORT_ERROR_NAMES.has(name);
}

/**
 * Throw an {@link AbortError} if the signal has already fired.
 *
 * Used at the points between provider calls where nothing would otherwise
 * notice the cancellation — before starting tool execution in particular, so a
 * cancelled run does not fire off side effects it will never use.
 */
export function throwIfAborted(
  signal: AbortSignal | undefined,
  context: string
): void {
  if (!signal?.aborted) return;
  throw new AbortError(`${context} was aborted`, signal.reason);
}

/**
 * Combine two optional signals into one that fires as soon as either does.
 *
 * Returns the other signal unchanged when only one is present, and `undefined`
 * when neither is. Written by hand rather than with `AbortSignal.any`, which
 * needs Node 20.
 */
export function combineSignals(
  a?: AbortSignal,
  b?: AbortSignal
): AbortSignal | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.aborted) return a;
  if (b.aborted) return b;

  const controller = new AbortController();
  const abort = (source: AbortSignal) => () => controller.abort(source.reason);
  const onA = abort(a);
  const onB = abort(b);

  a.addEventListener("abort", onA, { once: true });
  b.addEventListener("abort", onB, { once: true });
  controller.signal.addEventListener(
    "abort",
    () => {
      a.removeEventListener("abort", onA);
      b.removeEventListener("abort", onB);
    },
    { once: true }
  );

  return controller.signal;
}
