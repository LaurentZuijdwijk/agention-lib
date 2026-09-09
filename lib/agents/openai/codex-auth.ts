import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

/**
 * OAuth against a ChatGPT subscription, as used by OpenAI's Codex CLI.
 *
 * This is a different product surface from the platform API: the credentials are
 * a ChatGPT login rather than a `sk-...` platform key, and requests are billed
 * against the subscription instead of an API account. The endpoint differs too —
 * see {@link CODEX_BASE_URL}.
 *
 * None of it is a documented public API. The values here were cross-checked
 * against the Codex CLI's own behaviour and several independent
 * reimplementations, but OpenAI can change them without notice.
 */

/**
 * Base URL for the ChatGPT-backed Codex Responses API.
 *
 * The SDK appends `/responses`, giving
 * `https://chatgpt.com/backend-api/codex/responses`.
 */
export const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";

/** Public OAuth client id the Codex CLI uses. Not a secret. */
export const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

/** Token endpoint used to exchange a refresh token for a fresh access token. */
export const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";

/**
 * Default `originator` header value.
 *
 * OpenAI gates parts of the model catalog on this, so an unrecognised value can
 * quietly change which models an account may reach.
 */
export const CODEX_ORIGINATOR = "codex_cli_rs";

/**
 * `client_version` for the Codex models endpoint, which 400s without one.
 *
 * Each model also carries a `minimal_client_version`; the backend hides models
 * newer than the version claimed here, so an old value quietly shortens the
 * list rather than erroring.
 */
export const CODEX_CLIENT_VERSION = "0.153.4";

/**
 * One entry from the Codex `/models` response.
 *
 * Nothing like the platform API's `/v1/models` — richer, and shaped for the
 * Codex client. Only the fields worth relying on are named; the rest come
 * through on `ModelInfo.raw`.
 */
export interface CodexModelCard {
  slug: string;
  display_name?: string;
  description?: string;
  /** Default context window for this account's plan. */
  context_window?: number;
  /** Largest window the model can be driven at. */
  max_context_window?: number;
  input_modalities?: string[];
  supported_reasoning_levels?: { effort: string; description?: string }[];
  default_reasoning_level?: string;
  /** Subscription plans that may select this model. */
  available_in_plans?: string[];
  /** `"list"` for models meant to be shown in a picker. */
  visibility?: string;
  supported_in_api?: boolean;
  minimal_client_version?: string;
  supports_parallel_tool_calls?: boolean;
  [key: string]: unknown;
}

/**
 * Credentials for the ChatGPT/Codex backend.
 */
export interface CodexCredentials {
  /** Bearer token sent as `Authorization`. */
  accessToken: string;
  /** Used to mint a new access token once the current one expires. */
  refreshToken?: string;
  /**
   * Workspace/account the request is billed to, sent as the
   * `chatgpt-account-id` header. Read from `auth.json`, or decoded from the
   * `id_token` when absent.
   */
  accountId?: string;
  /** Account e-mail, when the `id_token` carried one. Informational. */
  email?: string;
  /** Subscription tier (`plus`, `pro`, …), when present. Informational. */
  planType?: string;
}

/** Shape of the `tokens` object inside Codex's `auth.json`. */
interface CodexAuthFileTokens {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  account_id?: string;
}

/** Shape of Codex's `auth.json`. Extra fields are ignored. */
interface CodexAuthFile {
  OPENAI_API_KEY?: string | null;
  tokens?: CodexAuthFileTokens;
  last_refresh?: string;
}

/** Claims we care about inside the OAuth `id_token`. */
interface CodexIdTokenClaims {
  email?: string;
  exp?: number;
  "https://api.openai.com/auth"?: {
    chatgpt_account_id?: string;
    chatgpt_plan_type?: string;
  };
  "https://api.openai.com/profile"?: {
    email?: string;
  };
}

/**
 * Decode a JWT's payload without verifying its signature.
 *
 * Verification is the token endpoint's job — we are only reading claims out of a
 * token we were just handed over TLS, never making a trust decision on it.
 * Returns `undefined` for anything that does not parse, so a malformed or
 * opaque token degrades to "no claims" rather than throwing.
 */
export function decodeJwtClaims<T = Record<string, unknown>>(
  token: string
): T | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const claims = JSON.parse(json);
    return typeof claims === "object" && claims !== null
      ? (claims as T)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Seconds-since-epoch expiry of a JWT, or `undefined` if it has no `exp`.
 */
export function jwtExpiry(token: string): number | undefined {
  const exp = decodeJwtClaims<{ exp?: number }>(token)?.exp;
  return typeof exp === "number" ? exp : undefined;
}

/** Default location of Codex's credential file. */
export function codexAuthFilePath(codexHome?: string): string {
  const home =
    codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  return path.join(home, "auth.json");
}

/**
 * Read the credentials the Codex CLI stored at `$CODEX_HOME/auth.json`
 * (`~/.codex/auth.json` by default).
 *
 * Sign in with `codex login` first — this only reads what that wrote, it does
 * not run the OAuth flow itself.
 *
 * @throws if the file is missing, unreadable, not JSON, or holds no access token.
 */
export async function loadCodexCredentials(
  codexHome?: string
): Promise<CodexCredentials> {
  const file = codexAuthFilePath(codexHome);

  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error: unknown) {
    const reason =
      (error as NodeJS.ErrnoException)?.code === "ENOENT"
        ? "no such file — run `codex login` to sign in with your ChatGPT account"
        : error instanceof Error
          ? error.message
          : "unknown error";
    throw new Error(`Could not read Codex credentials from ${file}: ${reason}`);
  }

  let parsed: CodexAuthFile;
  try {
    parsed = JSON.parse(raw) as CodexAuthFile;
  } catch {
    throw new Error(`Codex credentials at ${file} are not valid JSON`);
  }

  const tokens = parsed.tokens;
  if (!tokens?.access_token) {
    throw new Error(
      `Codex credentials at ${file} contain no OAuth access token` +
        (parsed.OPENAI_API_KEY
          ? " — that file holds a platform API key instead, which belongs in `apiKey` with the default `authType: \"apiKey\"`"
          : " — run `codex login` to sign in with your ChatGPT account")
    );
  }

  return credentialsFromTokens(tokens);
}

/** Build {@link CodexCredentials} from an `auth.json` `tokens` object. */
function credentialsFromTokens(
  tokens: CodexAuthFileTokens
): CodexCredentials {
  const claims = tokens.id_token
    ? decodeJwtClaims<CodexIdTokenClaims>(tokens.id_token)
    : undefined;
  const auth = claims?.["https://api.openai.com/auth"];

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token,
    // `auth.json` usually carries `account_id`, but not always; the same value
    // is a claim on the id_token, so fall back to that before giving up.
    accountId: tokens.account_id ?? auth?.chatgpt_account_id,
    email: claims?.email ?? claims?.["https://api.openai.com/profile"]?.email,
    planType: auth?.chatgpt_plan_type,
  };
}

/** Response body of a successful token refresh. */
interface CodexTokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

/**
 * Exchange a refresh token for a fresh access token.
 *
 * The returned credentials carry the new `refresh_token` when the server
 * rotated it, and the previous one otherwise.
 */
export async function refreshCodexCredentials(
  refreshToken: string,
  options: { clientId?: string; tokenUrl?: string; signal?: AbortSignal } = {}
): Promise<CodexCredentials> {
  const res = await fetch(options.tokenUrl ?? CODEX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: options.clientId ?? CODEX_CLIENT_ID,
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Codex token refresh failed (${res.status} ${res.statusText})${
        body ? `: ${body.slice(0, 500)}` : ""
      }`
    );
  }

  const data = (await res.json()) as CodexTokenResponse;
  if (!data.access_token) {
    throw new Error("Codex token refresh returned no access_token");
  }

  return credentialsFromTokens({
    access_token: data.access_token,
    // The endpoint only returns a refresh token when it rotates one; reuse the
    // current one otherwise, or the next refresh has nothing to present.
    refresh_token: data.refresh_token ?? refreshToken,
    id_token: data.id_token,
  });
}

/** Options for {@link createCodexTokenProvider}. */
export interface CodexTokenProviderOptions {
  /** OAuth client id. Defaults to {@link CODEX_CLIENT_ID}. */
  clientId?: string;
  /** Token endpoint. Defaults to {@link CODEX_TOKEN_URL}. */
  tokenUrl?: string;
  /**
   * Refresh this many seconds before the access token actually expires, so a
   * request is never sent with a token that dies in flight.
   *
   * @default 300
   */
  refreshSkewSeconds?: number;
  /**
   * Called after every successful refresh, e.g. to persist the rotated refresh
   * token. Errors thrown here are ignored — a failed write must not fail the
   * request the token was minted for.
   */
  onRefresh?: (credentials: CodexCredentials) => void | Promise<void>;
}

/**
 * A token source that hands out an access token and silently refreshes it.
 *
 * The `getToken` function is shaped for the OpenAI SDK's `apiKey` option, which
 * accepts an async function and calls it before *every* request — so a
 * long-running agent keeps working past the ~1h life of an access token without
 * anyone reaching for the credential file again.
 */
export interface CodexTokenProvider {
  /** Current access token, refreshed on demand. Pass as the SDK's `apiKey`. */
  getToken: () => Promise<string>;
  /** Latest known credentials, including `accountId`. */
  current: () => CodexCredentials;
}

/**
 * Wrap credentials in a self-refreshing token provider.
 *
 * Refreshes lazily — only when a token is actually asked for and the current
 * one is within `refreshSkewSeconds` of expiry. Concurrent callers share a
 * single in-flight refresh rather than each starting their own.
 */
export function createCodexTokenProvider(
  credentials: CodexCredentials,
  options: CodexTokenProviderOptions = {}
): CodexTokenProvider {
  const skew = options.refreshSkewSeconds ?? 300;

  let current = credentials;
  let expiresAt = jwtExpiry(credentials.accessToken);
  let inFlight: Promise<string> | undefined;

  const isFresh = (): boolean => {
    // An opaque token with no readable `exp` is assumed good: refreshing on
    // every call would be worse than letting a 401 surface.
    if (expiresAt === undefined) return true;
    return Date.now() / 1000 < expiresAt - skew;
  };

  const refresh = async (): Promise<string> => {
    if (!current.refreshToken) {
      throw new Error(
        "Codex access token has expired and no refresh token is available — run `codex login` again"
      );
    }

    const next = await refreshCodexCredentials(current.refreshToken, {
      clientId: options.clientId,
      tokenUrl: options.tokenUrl,
    });

    current = {
      ...next,
      // A refresh response carries no id_token in some cases, which would drop
      // the account id the `chatgpt-account-id` header needs.
      accountId: next.accountId ?? current.accountId,
      email: next.email ?? current.email,
      planType: next.planType ?? current.planType,
    };
    expiresAt = jwtExpiry(current.accessToken);

    try {
      await options.onRefresh?.(current);
    } catch {
      // Persisting is best-effort; the token in hand is still valid.
    }

    return current.accessToken;
  };

  return {
    getToken: async () => {
      if (isFresh()) return current.accessToken;
      // Collapse concurrent refreshes: the second caller awaits the first.
      inFlight ??= refresh().finally(() => {
        inFlight = undefined;
      });
      return inFlight;
    },
    current: () => current,
  };
}
