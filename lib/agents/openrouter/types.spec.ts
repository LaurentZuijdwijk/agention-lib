import type {
  ProviderPreferences,
  ChatRequestEffort,
  ProviderSort,
} from "@openrouter/sdk/esm/models";
import type { RetryConfig } from "@openrouter/sdk/esm/lib/retries";
import type {
  OpenRouterProviderPreferences,
  OpenRouterProviderSort,
  OpenRouterReasoningEffort,
  OpenRouterRetryConfig,
} from "./types";

/**
 * The OpenRouter request types are declared locally in `./types` rather than
 * imported from `@openrouter/sdk`, because the SDK is an optional peer
 * dependency and even a type-only import would have to be resolved by every
 * consumer's `tsc`.
 *
 * These are compile-time assertions rather than runtime checks: if the SDK's
 * shapes drift away from the local declarations, `ts-jest` fails this suite and
 * the drift is caught by the test run. `expect` calls are only there to give
 * Jest something to execute.
 */
describe("OpenRouter type declarations", () => {
  it("accepts a ProviderPreferences built against the local type", () => {
    // Assignable in the direction that matters: what a caller configures has to
    // be something the SDK will take.
    const local: OpenRouterProviderPreferences = {
      order: ["anthropic", "google-vertex"],
      ignore: ["deepinfra"],
      allowFallbacks: true,
      sort: "throughput",
      maxPrice: { prompt: "1.5", completion: "3" },
      requireParameters: true,
      dataCollection: "deny",
      zdr: true,
      quantizations: ["fp8"],
    };
    const forSdk: ProviderPreferences = local;

    expect(forSdk.order).toEqual(["anthropic", "google-vertex"]);
  });

  it("keeps every documented sort strategy valid on the SDK's enum", () => {
    const sorts: OpenRouterProviderSort[] = [
      "price",
      "throughput",
      "latency",
      "exacto",
    ];
    const forSdk: ProviderSort[] = sorts;

    expect(forSdk).toHaveLength(4);
  });

  it("keeps every reasoning effort level valid on the SDK's enum", () => {
    const efforts: OpenRouterReasoningEffort[] = [
      "none",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ];
    const forSdk: ChatRequestEffort[] = efforts;

    expect(forSdk).toHaveLength(7);
  });

  it("keeps the local retry config assignable to the SDK's RetryConfig", () => {
    const backoff: OpenRouterRetryConfig = {
      strategy: "backoff",
      backoff: {
        initialInterval: 500,
        maxInterval: 30_000,
        exponent: 1.5,
        maxElapsedTime: 120_000,
      },
      retryConnectionErrors: true,
    };
    const none: OpenRouterRetryConfig = { strategy: "none" };

    const forSdk: RetryConfig[] = [backoff, none];

    expect(forSdk).toHaveLength(2);
  });
});
