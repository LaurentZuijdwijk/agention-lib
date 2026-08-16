/**
 * OpenRouter request-shaping types.
 *
 * Declared structurally rather than imported from `@openrouter/sdk` so that
 * consumers who have not installed the optional peer dependency still typecheck
 * — the same approach `lib/mcp/types.ts` takes for the MCP SDK. Assignability
 * against the SDK's own types is asserted in `types.spec.ts`, which fails the
 * build if OpenRouter's shapes drift away from these.
 *
 * Field names are camelCase because that is what the SDK accepts; it
 * zod-serializes them to the snake_case the HTTP API expects.
 */

/**
 * Provider sorting strategy applied when no explicit `order` is given.
 *
 * - `"price"` — cheapest endpoint first
 * - `"throughput"` — highest tokens/second first
 * - `"latency"` — lowest time-to-first-token first
 * - `"exacto"` — OpenRouter's accuracy-verified endpoints first
 *
 * Setting any of these disables load balancing.
 */
export type OpenRouterProviderSort = "price" | "throughput" | "latency" | "exacto";

/**
 * Maximum price to pay for a request, in USD per million tokens (per image or
 * per request for the corresponding fields). Values are strings, as the API
 * takes them.
 */
export type OpenRouterMaxPrice = {
  /** USD per million prompt tokens */
  prompt?: string;
  /** USD per million completion tokens */
  completion?: string;
  /** USD per image */
  image?: string;
  /** USD per request */
  request?: string;
  /** USD per audio unit */
  audio?: string;
};

/**
 * Where OpenRouter is allowed to route a request.
 *
 * Directly relevant to throttling: `order`/`only`/`ignore` decide which
 * upstream providers are in play, and `allowFallbacks` (default `true`) is what
 * lets OpenRouter move past one that is rate limited or down.
 *
 * @see https://openrouter.ai/docs/guides/features/provider-routing
 */
export type OpenRouterProviderPreferences = {
  /**
   * Ordered list of provider slugs. The router uses the first one in this list
   * that serves the requested model, falling back to the next when it is
   * unavailable.
   */
  order?: string[] | null;
  /** Provider slugs to allow, merged with your account-wide allow list. */
  only?: string[] | null;
  /** Provider slugs to skip, merged with your account-wide ignore list. */
  ignore?: string[] | null;
  /**
   * Whether backup providers may serve the request.
   *
   * `true` (default) moves to the next best provider when the primary is
   * unavailable — including when it rate limits you. `false` returns the
   * upstream error instead, which is what you want when `order` names the only
   * provider you will accept.
   */
  allowFallbacks?: boolean | null;
  /** Sorting strategy used when `order` is not set. Disables load balancing. */
  sort?: OpenRouterProviderSort | null;
  /** Cap on what the request may cost. */
  maxPrice?: OpenRouterMaxPrice;
  /**
   * Route only to providers that support every parameter sent. Off by default,
   * in which case providers silently drop parameters they do not understand.
   */
  requireParameters?: boolean | null;
  /**
   * `"deny"` restricts routing to providers that do not store prompts.
   * `"allow"` (default) permits providers that may retain and train on them.
   */
  dataCollection?: "allow" | "deny" | null;
  /** Restrict routing to Zero Data Retention endpoints. */
  zdr?: boolean | null;
  /** Quantization levels to accept (e.g. `"fp8"`, `"bf16"`). */
  quantizations?: OpenRouterQuantization[] | null;
  /** Deprioritize endpoints slower than this p50 latency, in seconds. */
  preferredMaxLatency?: number | null;
  /** Deprioritize endpoints below this p50 throughput, in tokens/second. */
  preferredMinThroughput?: number | null;
};

/**
 * How hard a reasoning model should think. `"none"` disables reasoning where
 * the model allows it; which values a given model accepts is model-dependent
 * and OpenRouter normalizes the rest per upstream provider.
 */
/**
 * Quantization levels accepted when filtering providers, e.g. `"fp8"`, `"bf16"`.
 *
 * Kept as an explicit string-literal union (rather than `string`) so a caller's
 * config is assignable to `@openrouter/sdk`'s branded `Quantization` enum —
 * see `types.spec.ts`. OpenRouter may add values over time; unknown ones are
 * rejected by the SDK at runtime.
 */
export type OpenRouterQuantization =
  | "int4"
  | "int8"
  | "fp4"
  | "mxfp4"
  | "nvfp4"
  | "fp6"
  | "fp8"
  | "mxfp8"
  | "fp16"
  | "bf16"
  | "fp32"
  | "unknown";

export type OpenRouterReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/** Reasoning configuration sent with the request. */
export type OpenRouterReasoningConfig = {
  effort?: OpenRouterReasoningEffort | null;
  /** Verbosity of the reasoning summary, on models that produce one. */
  summary?: string | null;
};

/**
 * Retry policy handed to the SDK per chat request.
 *
 * Mirrors the SDK's own `RetryConfig`. See
 * {@link OpenRouterSpecificConfig.retry} for why the agent does not simply take
 * the SDK's defaults.
 */
export type OpenRouterRetryConfig =
  | { strategy: "none" }
  | {
      strategy: "backoff";
      backoff?: {
        /** Base delay in ms; the nth retry waits `initialInterval * n ** exponent`. */
        initialInterval: number;
        /** Ceiling on a single wait, in ms — also caps a long `Retry-After`. */
        maxInterval: number;
        exponent: number;
        /** Total ms the retry loop may run before giving up. */
        maxElapsedTime: number;
      };
      /** Also retry timeouts and connection failures. */
      retryConnectionErrors?: boolean;
    };

/**
 * The cost and routing facts OpenRouter reports for a completed turn, which no
 * other provider in this library exposes.
 *
 * Populated after each `execute()` / `executeStream()` on
 * {@link OpenRouterAgent.lastGeneration}, summed across the turn's API calls
 * where the field is additive.
 */
export type OpenRouterGenerationInfo = {
  /** Generation id of the last API call, for lookups against `/generation`. */
  id?: string;
  /**
   * Model that actually answered. Differs from the configured model when a
   * fallback in `models` was used, or when routing through `openrouter/auto`.
   */
  model?: string;
  /**
   * Cost in USD credits, summed over every API call in the turn (a tool loop
   * bills once per hop). Undefined when OpenRouter does not report a cost —
   * BYOK requests being the usual case.
   */
  cost?: number;
  /** Whether the request was served through a Bring Your Own Key configuration. */
  isByok?: boolean;
  /** Number of provider attempts OpenRouter made before one succeeded. */
  attempts?: number;
};
