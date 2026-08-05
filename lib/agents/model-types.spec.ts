import { OpenAiAgent } from "./openai/OpenAiAgent";
import { OPENAI_REASONING_SUPPORT } from "./model-types";
import type { ReasoningEffort, ReasoningEffortFor } from "./model-types";

jest.mock("openai");

/**
 * Compile-time assertions for the per-model reasoning-effort types.
 *
 * `OpenAiAgent.spec.ts` carries `@ts-nocheck`, so the narrowing has to be proven
 * here: this file is type-checked by ts-jest, which fails the suite on any error.
 * `@ts-expect-error` is doubly useful — an *unused* directive is itself an error,
 * so these cases fail if the narrowing ever stops rejecting them.
 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

describe("ReasoningEffortFor", () => {
  it("resolves the exact effort set per model family", () => {
    const oSeries: Exact<ReasoningEffortFor<"o4-mini">, "low" | "medium" | "high"> = true;
    const gpt5: Exact<
      ReasoningEffortFor<"gpt-5-nano">,
      "minimal" | "low" | "medium" | "high"
    > = true;
    const gpt51: Exact<
      ReasoningEffortFor<"gpt-5.1">,
      "none" | "low" | "medium" | "high"
    > = true;
    const xhigh: Exact<
      ReasoningEffortFor<"gpt-5.5">,
      "none" | "low" | "medium" | "high" | "xhigh"
    > = true;
    const max: Exact<
      ReasoningEffortFor<"gpt-5.6-sol">,
      "none" | "low" | "medium" | "high" | "xhigh" | "max"
    > = true;

    expect([oSeries, gpt5, gpt51, xhigh, max]).toEqual([true, true, true, true, true]);
  });

  it("narrows pro variants, which drop the low end rather than extending it", () => {
    const pro: Exact<ReasoningEffortFor<"gpt-5-pro">, "high"> = true;
    const proXhigh: Exact<
      ReasoningEffortFor<"gpt-5.4-pro">,
      "medium" | "high" | "xhigh"
    > = true;

    expect([pro, proXhigh]).toEqual([true, true]);
  });

  it("resolves a dated snapshot like its alias", () => {
    const snapshot: Exact<
      ReasoningEffortFor<"gpt-5-nano-2025-08-07">,
      ReasoningEffortFor<"gpt-5-nano">
    > = true;

    // `gpt-5-mini` must not be mistaken for a snapshot of `gpt-5`
    const notASnapshot: Exact<
      ReasoningEffortFor<"gpt-5-mini">,
      "minimal" | "low" | "medium" | "high"
    > = true;

    expect([snapshot, notASnapshot]).toEqual([true, true]);
  });

  it("stays permissive for models the table does not know", () => {
    // A stale table must not block a newer model
    const unknown: Exact<ReasoningEffortFor<"gpt-9-something">, ReasoningEffort> = true;

    expect(unknown).toBe(true);
  });
});

describe("OpenAiAgent reasoningEffort narrowing", () => {
  const base = { id: "1", name: "A", description: "d", apiKey: "k" };

  it("accepts efforts the configured model supports", () => {
    expect(
      new OpenAiAgent({ ...base, model: "gpt-5-nano", reasoningEffort: "minimal" })
    ).toBeInstanceOf(OpenAiAgent);
    expect(
      new OpenAiAgent({ ...base, model: "gpt-5.6-sol", reasoningEffort: "max" })
    ).toBeInstanceOf(OpenAiAgent);
    expect(
      new OpenAiAgent({ ...base, model: "gpt-5-pro", reasoningEffort: "high" })
    ).toBeInstanceOf(OpenAiAgent);
  });

  it("stays backward compatible when no model or an unknown model is given", () => {
    expect(new OpenAiAgent({ ...base })).toBeInstanceOf(OpenAiAgent);
    expect(new OpenAiAgent({ ...base, reasoningEffort: "high" })).toBeInstanceOf(
      OpenAiAgent
    );
    expect(
      new OpenAiAgent({ ...base, model: "gpt-9", reasoningEffort: "max" })
    ).toBeInstanceOf(OpenAiAgent);

    // The bare class name still resolves via the default type argument
    const legacy: OpenAiAgent = new OpenAiAgent({ ...base });
    expect(legacy).toBeInstanceOf(OpenAiAgent);
  });

  it("rejects efforts the configured model does not support", () => {
    // @ts-expect-error gpt-5-nano takes "minimal"; "none" arrived with gpt-5.1
    new OpenAiAgent({ ...base, model: "gpt-5-nano", reasoningEffort: "none" });
    // @ts-expect-error gpt-5.6 dropped "minimal" in favour of "none"
    new OpenAiAgent({ ...base, model: "gpt-5.6-sol", reasoningEffort: "minimal" });
    // @ts-expect-error gpt-5-pro only supports "high"
    new OpenAiAgent({ ...base, model: "gpt-5-pro", reasoningEffort: "low" });
    // @ts-expect-error o-series takes neither "none" nor "minimal"
    new OpenAiAgent({ ...base, model: "o4-mini", reasoningEffort: "minimal" });
    // @ts-expect-error gpt-5.1 predates xhigh
    new OpenAiAgent({ ...base, model: "gpt-5.1", reasoningEffort: "xhigh" });
    // @ts-expect-error not a reasoning effort at all
    new OpenAiAgent({ ...base, model: "gpt-5.6-sol", reasoningEffort: "extreme" });

    expect(true).toBe(true);
  });
});

describe("OPENAI_REASONING_SUPPORT", () => {
  it("lists each model in exactly one group", () => {
    const seen = OPENAI_REASONING_SUPPORT.flatMap((group) => [...group.models]);
    expect(seen).toEqual([...new Set(seen)]);
  });

  it("gives every group at least one effort", () => {
    for (const group of OPENAI_REASONING_SUPPORT) {
      expect(group.efforts.length).toBeGreaterThan(0);
    }
  });
});
