import {
  combineSignals,
  isAbortError,
  throwIfAborted,
} from "./cancellation";
import { AbortError, ExecutionError } from "./errors/AgentError";

describe("isAbortError", () => {
  it("treats any error as an abort once the signal has fired", () => {
    const controller = new AbortController();
    controller.abort();

    // Agents wrap provider failures on the way out, so by the time the
    // top-level handler sees one it may no longer look like an abort.
    expect(
      isAbortError(new ExecutionError("something went wrong"), controller.signal)
    ).toBe(true);
  });

  it("does not treat an ordinary failure as an abort", () => {
    const controller = new AbortController();

    expect(isAbortError(new Error("boom"), controller.signal)).toBe(false);
    expect(isAbortError(new Error("boom"))).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError("not an error")).toBe(false);
  });

  it("recognises each provider SDK's cancellation error without a signal", () => {
    const named = (name: string) => Object.assign(new Error("cancelled"), { name });

    expect(isAbortError(named("AbortError"))).toBe(true);
    expect(isAbortError(named("APIUserAbortError"))).toBe(true);
    expect(isAbortError(named("RequestAbortedError"))).toBe(true);
    expect(isAbortError(named("GoogleGenerativeAIAbortError"))).toBe(true);
    expect(isAbortError(named("APIConnectionError"))).toBe(false);
  });

  it("recognises our own AbortError", () => {
    expect(isAbortError(new AbortError("aborted"))).toBe(true);
  });
});

describe("throwIfAborted", () => {
  it("does nothing when there is no signal, or the signal has not fired", () => {
    expect(() => throwIfAborted(undefined, "ctx")).not.toThrow();
    expect(() => throwIfAborted(new AbortController().signal, "ctx")).not.toThrow();
  });

  it("throws an AbortError carrying the signal's reason", () => {
    const controller = new AbortController();
    const reason = new Error("user cancelled");
    controller.abort(reason);

    try {
      throwIfAborted(controller.signal, "Execution of agent TestAgent");
      fail("expected throwIfAborted to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AbortError);
      expect((error as AbortError).message).toBe(
        "Execution of agent TestAgent was aborted"
      );
      expect((error as AbortError).reason).toBe(reason);
      // Platform convention, so `err.name === "AbortError"` checks keep working
      expect((error as AbortError).name).toBe("AbortError");
    }
  });
});

describe("combineSignals", () => {
  it("returns whichever side is present when only one is", () => {
    const { signal } = new AbortController();

    expect(combineSignals(signal, undefined)).toBe(signal);
    expect(combineSignals(undefined, signal)).toBe(signal);
    expect(combineSignals(undefined, undefined)).toBeUndefined();
  });

  it("returns an already-aborted input as-is", () => {
    const aborted = new AbortController();
    aborted.abort();
    const live = new AbortController();

    expect(combineSignals(aborted.signal, live.signal)).toBe(aborted.signal);
    expect(combineSignals(live.signal, aborted.signal)).toBe(aborted.signal);
  });

  it("fires when either input fires, propagating the reason", () => {
    const a = new AbortController();
    const b = new AbortController();
    const combined = combineSignals(a.signal, b.signal)!;

    expect(combined.aborted).toBe(false);

    const reason = new Error("b won");
    b.abort(reason);

    expect(combined.aborted).toBe(true);
    expect(combined.reason).toBe(reason);
  });

  it("stops listening on the inputs once it has fired", () => {
    const a = new AbortController();
    const b = new AbortController();
    const removeFromA = jest.spyOn(a.signal, "removeEventListener");
    const removeFromB = jest.spyOn(b.signal, "removeEventListener");

    combineSignals(a.signal, b.signal);
    a.abort();

    expect(removeFromA).toHaveBeenCalled();
    expect(removeFromB).toHaveBeenCalled();
  });
});
