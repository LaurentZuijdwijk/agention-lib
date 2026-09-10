/**
 * Quota accounting for the ChatGPT-backed Codex backend.
 *
 * A ChatGPT subscription is not billed per request, so nothing on this path
 * reports a dollar cost — `TokenUsage.cost_usd` stays undefined here, as it
 * does on every provider that does not price a response itself. What a
 * subscription spends instead is *plan allowance*, and the backend reports that
 * on every `/responses` call as a set of `x-codex-*` headers: two rolling
 * windows (a 5-hour "primary" and a weekly "secondary"), the plan and limit
 * tier in force, and the pay-as-you-go credit balance that takes over once the
 * windows are exhausted.
 *
 * These headers are the only source: there is no usage endpoint (`/usage`,
 * `/rate_limits` and `/limits` all answer `403`), and `/models` returns none of
 * them — so quota state can only be refreshed by making a real call. Values
 * observed live against `chatgpt.com/backend-api/codex` on 2026-09-10; like the
 * rest of that surface they are undocumented and may change without notice,
 * which is why every field here is optional and an unparseable value is dropped
 * rather than guessed at.
 */

/** One rolling usage window, as the backend reports it. */
export interface CodexRateLimitWindow {
  /**
   * Percentage of the window's allowance already consumed, `0`–`100`. Requests
   * start failing once this reaches 100 and the other window has nothing left
   * either.
   */
  usedPercent: number;
  /**
   * Length of the rolling window in minutes — `300` (5 hours) for the primary
   * window and `10080` (7 days) for the secondary, on the plans seen so far.
   */
  windowMinutes?: number;
  /** Seconds until the window rolls over and the allowance is restored. */
  resetAfterSeconds?: number;
  /** Wall-clock time the window rolls over. */
  resetAt?: Date;
}

/** Pay-as-you-go credit balance, used once the plan windows are exhausted. */
export interface CodexCredits {
  /** Remaining credits. `0` on an account that has never bought any. */
  balance?: number;
  /** Whether any credits are available to spend. */
  hasCredits?: boolean;
  /** Whether the account's credits are uncapped. */
  unlimited?: boolean;
}

/**
 * What one Codex response said about the subscription's remaining allowance —
 * the closest thing this backend has to a cost figure.
 */
export interface CodexUsageLimits {
  /** Short rolling window; `300` minutes (5 hours) on the plans seen so far. */
  primary?: CodexRateLimitWindow;
  /** Long rolling window; `10080` minutes (7 days) on those same plans. */
  secondary?: CodexRateLimitWindow;
  /** Subscription tier the request was billed against, e.g. `"plus"`. */
  planType?: string;
  /** Limit tier in force for this request, e.g. `"premium"`. */
  activeLimit?: string;
  /** Credit balance backing the account once the windows run dry. */
  credits?: CodexCredits;
  /**
   * How far the primary window may run past the secondary window's pace, as a
   * percentage. `0` where the backend imposes no such allowance.
   */
  primaryOverSecondaryLimitPercent?: number;
  /** When these values were received. */
  at: Date;
}

/** Parse a header that should hold a number, dropping anything that does not. */
function num(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Parse a header holding a boolean. The backend writes these Python-style
 * (`True` / `False`), so match case-insensitively and accept the JSON spelling
 * too in case that ever changes.
 */
function bool(headers: Headers, name: string): boolean | undefined {
  const raw = headers.get(name)?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

/** Parse a `-reset-at` header, which carries seconds since the epoch. */
function resetAt(headers: Headers, name: string): Date | undefined {
  const seconds = num(headers, name);
  return seconds === undefined ? undefined : new Date(seconds * 1000);
}

/**
 * Parse one rolling window's headers.
 *
 * Returns `undefined` unless `used-percent` is present: without it there is no
 * window to speak of, only a reset time for one that was never reported.
 */
function window(
  headers: Headers,
  prefix: "primary" | "secondary"
): CodexRateLimitWindow | undefined {
  const usedPercent = num(headers, `x-codex-${prefix}-used-percent`);
  if (usedPercent === undefined) return undefined;

  return {
    usedPercent,
    windowMinutes: num(headers, `x-codex-${prefix}-window-minutes`),
    resetAfterSeconds: num(headers, `x-codex-${prefix}-reset-after-seconds`),
    resetAt: resetAt(headers, `x-codex-${prefix}-reset-at`),
  };
}

/**
 * Read the quota state out of a Codex response's headers.
 *
 * @returns the limits, or `undefined` when the response carried none — which is
 *          every response that is not a `/responses` call, including `/models`
 *          and anything Cloudflare answered on the backend's behalf.
 */
export function parseCodexUsageLimits(
  headers: Headers
): CodexUsageLimits | undefined {
  const primary = window(headers, "primary");
  const secondary = window(headers, "secondary");
  const planType = headers.get("x-codex-plan-type") ?? undefined;
  const activeLimit = headers.get("x-codex-active-limit") ?? undefined;
  const balance = num(headers, "x-codex-credits-balance");
  const hasCredits = bool(headers, "x-codex-credits-has-credits");
  const unlimited = bool(headers, "x-codex-credits-unlimited");
  const primaryOverSecondaryLimitPercent = num(
    headers,
    "x-codex-primary-over-secondary-limit-percent"
  );

  const credits =
    balance === undefined && hasCredits === undefined && unlimited === undefined
      ? undefined
      : { balance, hasCredits, unlimited };

  // Nothing recognised: report "no limits seen" rather than a shell of an
  // object timestamped as if it were an answer.
  if (
    !primary &&
    !secondary &&
    !planType &&
    !activeLimit &&
    !credits &&
    primaryOverSecondaryLimitPercent === undefined
  ) {
    return undefined;
  }

  return {
    primary,
    secondary,
    planType,
    activeLimit,
    credits,
    primaryOverSecondaryLimitPercent,
    at: new Date(),
  };
}

/**
 * `fetch` wrapper that hands every response's headers to `onHeaders` before
 * returning it untouched.
 *
 * The body is never read here — the SDK still consumes the stream itself — so
 * this is safe to stack under `wrapErrorBodyFetch`. A throwing observer
 * is swallowed: quota bookkeeping must never be able to fail a request.
 */
export function observeHeadersFetch(
  onHeaders: (headers: Headers) => void,
  baseFetch: typeof fetch = fetch
): typeof fetch {
  return async (input, init) => {
    const res = await baseFetch(input, init);
    try {
      onHeaders(res.headers);
    } catch {
      // Ignored on purpose: see above.
    }
    return res;
  };
}
