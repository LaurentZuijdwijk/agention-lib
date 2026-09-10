import { observeHeadersFetch, parseCodexUsageLimits } from "./codex-usage";

/** The full `x-codex-*` set, exactly as observed live on 2026-09-10. */
const liveHeaders = () =>
  new Headers({
    "x-codex-active-limit": "premium",
    "x-codex-credits-balance": "0",
    "x-codex-credits-has-credits": "False",
    "x-codex-credits-unlimited": "False",
    "x-codex-plan-type": "plus",
    "x-codex-primary-over-secondary-limit-percent": "0",
    "x-codex-primary-reset-after-seconds": "11431",
    "x-codex-primary-reset-at": "1789062879",
    "x-codex-primary-used-percent": "1",
    "x-codex-primary-window-minutes": "300",
    "x-codex-secondary-reset-after-seconds": "419169",
    "x-codex-secondary-reset-at": "1789470617",
    "x-codex-secondary-used-percent": "49",
    "x-codex-secondary-window-minutes": "10080",
    "x-codex-turn-state": "gAAAAAB-opaque-blob",
  });

describe("parseCodexUsageLimits", () => {
  it("reads both rolling windows, the plan and the credit balance", () => {
    const limits = parseCodexUsageLimits(liveHeaders());

    expect(limits).toMatchObject({
      primary: {
        usedPercent: 1,
        windowMinutes: 300,
        resetAfterSeconds: 11431,
      },
      secondary: {
        usedPercent: 49,
        windowMinutes: 10080,
        resetAfterSeconds: 419169,
      },
      planType: "plus",
      activeLimit: "premium",
      credits: { balance: 0, hasCredits: false, unlimited: false },
      primaryOverSecondaryLimitPercent: 0,
    });
  });

  it("turns the epoch-seconds reset headers into Dates", () => {
    const limits = parseCodexUsageLimits(liveHeaders());

    expect(limits?.primary?.resetAt?.getTime()).toBe(1789062879 * 1000);
    expect(limits?.secondary?.resetAt?.getTime()).toBe(1789470617 * 1000);
  });

  // The backend writes these Python-style, so a plain === "true" check reads
  // every one of them as false.
  it("accepts the backend's capitalized booleans", () => {
    const limits = parseCodexUsageLimits(
      new Headers({
        "x-codex-primary-used-percent": "5",
        "x-codex-credits-has-credits": "True",
        "x-codex-credits-unlimited": "False",
      })
    );

    expect(limits?.credits).toEqual({
      balance: undefined,
      hasCredits: true,
      unlimited: false,
    });
  });

  it("returns undefined when the response carried no quota headers", () => {
    // What /models and every Cloudflare-served error answer with.
    expect(
      parseCodexUsageLimits(new Headers({ "content-type": "application/json" }))
    ).toBeUndefined();
  });

  it("reports a window only when its used-percent is present", () => {
    const limits = parseCodexUsageLimits(
      new Headers({
        "x-codex-plan-type": "pro",
        // A reset time with no percentage describes nothing usable.
        "x-codex-secondary-reset-after-seconds": "600",
      })
    );

    expect(limits?.planType).toBe("pro");
    expect(limits?.primary).toBeUndefined();
    expect(limits?.secondary).toBeUndefined();
  });

  it("drops values that are not numbers rather than reporting NaN", () => {
    const limits = parseCodexUsageLimits(
      new Headers({
        "x-codex-primary-used-percent": "12",
        "x-codex-primary-window-minutes": "soon",
        "x-codex-credits-balance": "",
      })
    );

    expect(limits?.primary).toMatchObject({
      usedPercent: 12,
      windowMinutes: undefined,
    });
    expect(limits?.credits).toBeUndefined();
  });

  it("keeps a zeroed window, which means the allowance is untouched", () => {
    const limits = parseCodexUsageLimits(
      new Headers({ "x-codex-primary-used-percent": "0" })
    );

    expect(limits?.primary?.usedPercent).toBe(0);
  });
});

describe("observeHeadersFetch", () => {
  it("hands the headers to the observer and returns the response untouched", async () => {
    const response = new Response("body", { headers: liveHeaders() });
    const seen: Headers[] = [];
    const wrapped = observeHeadersFetch(
      (headers) => seen.push(headers),
      async () => response
    );

    const result = await wrapped(
      "https://chatgpt.com/backend-api/codex/responses"
    );

    expect(result).toBe(response);
    expect(await result.text()).toBe("body");
    expect(seen[0].get("x-codex-plan-type")).toBe("plus");
  });

  it("observes failed responses too, since quota headers ride on those as well", async () => {
    const seen: Headers[] = [];
    const wrapped = observeHeadersFetch(
      (headers) => seen.push(headers),
      async () => new Response("nope", { status: 429, headers: liveHeaders() })
    );

    await wrapped("https://example.test");

    expect(seen).toHaveLength(1);
  });

  it("never lets a throwing observer fail the request", async () => {
    const wrapped = observeHeadersFetch(
      () => {
        throw new Error("bookkeeping blew up");
      },
      async () => new Response("ok")
    );

    await expect(wrapped("https://example.test")).resolves.toMatchObject({
      status: 200,
    });
  });

  it("propagates a transport failure from the wrapped fetch", async () => {
    const wrapped = observeHeadersFetch(
      () => undefined,
      async () => {
        throw new Error("socket hang up");
      }
    );

    await expect(wrapped("https://example.test")).rejects.toThrow(
      "socket hang up"
    );
  });
});
