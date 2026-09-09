import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import {
  CODEX_CLIENT_ID,
  CODEX_TOKEN_URL,
  codexAuthFilePath,
  createCodexTokenProvider,
  decodeJwtClaims,
  jwtExpiry,
  loadCodexCredentials,
  refreshCodexCredentials,
} from "./codex-auth";

/** Build an unsigned JWT with the given payload — only the payload is read. */
function jwt(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.sig`;
}

const idToken = (over: Record<string, unknown> = {}) =>
  jwt({
    email: "user@example.com",
    "https://api.openai.com/auth": {
      chatgpt_account_id: "acct-123",
      chatgpt_plan_type: "pro",
    },
    ...over,
  });

/** Access token expiring `seconds` from now. */
const accessToken = (seconds: number) =>
  jwt({ exp: Math.floor(Date.now() / 1000) + seconds });

describe("decodeJwtClaims", () => {
  it("decodes a base64url payload", () => {
    expect(decodeJwtClaims(jwt({ sub: "abc" }))).toEqual({ sub: "abc" });
  });

  it("returns undefined for a token that is not a JWT", () => {
    expect(decodeJwtClaims("not-a-jwt")).toBeUndefined();
    expect(decodeJwtClaims("a.!!!not-base64!!!.c")).toBeUndefined();
  });
});

describe("jwtExpiry", () => {
  it("reads the exp claim", () => {
    expect(jwtExpiry(jwt({ exp: 1700000000 }))).toBe(1700000000);
  });

  it("returns undefined when there is no exp", () => {
    expect(jwtExpiry(jwt({}))).toBeUndefined();
    expect(jwtExpiry("opaque-token")).toBeUndefined();
  });
});

describe("codexAuthFilePath", () => {
  const original = process.env.CODEX_HOME;

  afterEach(() => {
    if (original === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = original;
  });

  it("defaults to ~/.codex/auth.json", () => {
    delete process.env.CODEX_HOME;
    expect(codexAuthFilePath()).toBe(
      path.join(os.homedir(), ".codex", "auth.json")
    );
  });

  it("honours CODEX_HOME", () => {
    process.env.CODEX_HOME = "/custom/codex";
    expect(codexAuthFilePath()).toBe(path.join("/custom/codex", "auth.json"));
  });

  it("honours an explicit home over the environment", () => {
    process.env.CODEX_HOME = "/custom/codex";
    expect(codexAuthFilePath("/explicit")).toBe(
      path.join("/explicit", "auth.json")
    );
  });
});

describe("loadCodexCredentials", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-auth-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const write = (contents: unknown) =>
    fs.writeFile(
      path.join(dir, "auth.json"),
      typeof contents === "string" ? contents : JSON.stringify(contents)
    );

  it("reads tokens and derives account id from auth.json", async () => {
    await write({
      tokens: {
        id_token: idToken(),
        access_token: "at-1",
        refresh_token: "rt-1",
        account_id: "acct-from-file",
      },
    });

    await expect(loadCodexCredentials(dir)).resolves.toEqual({
      accessToken: "at-1",
      refreshToken: "rt-1",
      accountId: "acct-from-file",
      email: "user@example.com",
      planType: "pro",
    });
  });

  it("falls back to the id_token claim when account_id is absent", async () => {
    await write({
      tokens: { id_token: idToken(), access_token: "at-1", refresh_token: "rt-1" },
    });

    const creds = await loadCodexCredentials(dir);
    expect(creds.accountId).toBe("acct-123");
  });

  it("throws a login hint when the file is missing", async () => {
    await expect(loadCodexCredentials(dir)).rejects.toThrow(/codex login/);
  });

  it("throws when the file is not JSON", async () => {
    await write("{{{");
    await expect(loadCodexCredentials(dir)).rejects.toThrow(/not valid JSON/);
  });

  it("points at authType apiKey when the file holds a platform key", async () => {
    await write({ OPENAI_API_KEY: "sk-platform" });
    await expect(loadCodexCredentials(dir)).rejects.toThrow(
      /platform API key/
    );
  });
});

describe("refreshCodexCredentials", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("posts a refresh_token grant and returns the new credentials", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "at-2",
        refresh_token: "rt-2",
        id_token: idToken(),
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const creds = await refreshCodexCredentials("rt-1");

    expect(fetchMock).toHaveBeenCalledWith(
      CODEX_TOKEN_URL,
      expect.objectContaining({ method: "POST" })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      grant_type: "refresh_token",
      refresh_token: "rt-1",
      client_id: CODEX_CLIENT_ID,
    });
    expect(creds).toMatchObject({
      accessToken: "at-2",
      refreshToken: "rt-2",
      accountId: "acct-123",
    });
  });

  it("keeps the current refresh token when the server does not rotate it", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "at-2" }),
    }) as unknown as typeof fetch;

    const creds = await refreshCodexCredentials("rt-1");
    expect(creds.refreshToken).toBe("rt-1");
  });

  it("throws with the response body on a non-2xx", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => '{"error":"invalid_grant"}',
    }) as unknown as typeof fetch;

    await expect(refreshCodexCredentials("rt-1")).rejects.toThrow(
      /400 Bad Request.*invalid_grant/
    );
  });
});

describe("createCodexTokenProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the current token while it is still fresh", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = createCodexTokenProvider({
      accessToken: accessToken(3600),
      refreshToken: "rt-1",
    });

    await provider.getToken();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes once the token is inside the skew window", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: accessToken(3600),
        refresh_token: "rt-2",
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = createCodexTokenProvider(
      { accessToken: accessToken(60), refreshToken: "rt-1", accountId: "acct-1" },
      { refreshSkewSeconds: 300 }
    );

    const token = await provider.getToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(token).toBe(provider.current().accessToken);
    // The refresh response carried no id_token, so the account id must survive.
    expect(provider.current().accountId).toBe("acct-1");
    expect(provider.current().refreshToken).toBe("rt-2");
  });

  it("shares a single in-flight refresh between concurrent callers", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: accessToken(3600) }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = createCodexTokenProvider({
      accessToken: accessToken(0),
      refreshToken: "rt-1",
    });

    const [a, b, c] = await Promise.all([
      provider.getToken(),
      provider.getToken(),
      provider.getToken(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("reports rotated credentials through onRefresh", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: accessToken(3600), refresh_token: "rt-2" }),
    }) as unknown as typeof fetch;

    const onRefresh = jest.fn();
    const provider = createCodexTokenProvider(
      { accessToken: accessToken(0), refreshToken: "rt-1" },
      { onRefresh }
    );

    await provider.getToken();
    expect(onRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "rt-2" })
    );
  });

  it("does not fail the request when onRefresh throws", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: accessToken(3600) }),
    }) as unknown as typeof fetch;

    const provider = createCodexTokenProvider(
      { accessToken: accessToken(0), refreshToken: "rt-1" },
      {
        onRefresh: () => {
          throw new Error("disk full");
        },
      }
    );

    await expect(provider.getToken()).resolves.toBeTruthy();
  });

  it("treats a token with no exp as always fresh", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = createCodexTokenProvider({
      accessToken: "opaque",
      refreshToken: "rt-1",
    });

    await expect(provider.getToken()).resolves.toBe("opaque");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains itself when an expired token has no refresh token", async () => {
    const provider = createCodexTokenProvider({ accessToken: accessToken(0) });
    await expect(provider.getToken()).rejects.toThrow(/codex login/);
  });

  it("retries the refresh after a failure rather than caching the rejection", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: accessToken(3600) }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = createCodexTokenProvider({
      accessToken: accessToken(0),
      refreshToken: "rt-1",
    });

    await expect(provider.getToken()).rejects.toThrow("network down");
    await expect(provider.getToken()).resolves.toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
