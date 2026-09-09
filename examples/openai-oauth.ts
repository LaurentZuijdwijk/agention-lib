/**
 * Drive `OpenAiAgent` with a ChatGPT subscription instead of a platform API key.
 *
 * Requests go to the ChatGPT-backed Codex endpoint
 * (`https://chatgpt.com/backend-api/codex`) and are billed against the
 * subscription, not an API account.
 *
 * ── Setup ────────────────────────────────────────────────────────────────────
 * Sign in with OpenAI's Codex CLI first. This example reads the credentials it
 * stores; it does not run the OAuth flow itself:
 *
 *   npx @openai/codex login
 *
 * Then:
 *
 *   npx tsx examples/openai-oauth.ts
 *
 * Alternatively, supply a token directly and skip the CLI entirely:
 *
 *   CODEX_ACCESS_TOKEN=... CODEX_ACCOUNT_ID=... npx tsx examples/openai-oauth.ts
 *
 * Options:
 *   CODEX_MODEL=gpt-5.6   pick a different model
 *   CODEX_HOME=/path      read auth.json from somewhere other than ~/.codex
 *   CODEX_BASE_URL=...    route through a Codex proxy instead of chatgpt.com
 *
 * No ChatGPT account? `examples/mock-codex-backend.ts` is a local stand-in that
 * enforces the same request validations:
 *
 *   npx tsx examples/mock-codex-backend.ts
 *   CODEX_ACCESS_TOKEN=mock CODEX_ACCOUNT_ID=acct-1 \
 *     CODEX_BASE_URL=http://localhost:8123 npx tsx examples/openai-oauth.ts
 *
 * ── Caveat ───────────────────────────────────────────────────────────────────
 * None of this is a documented public OpenAI API. The endpoint, headers and
 * body constraints can change without notice; platform API keys remain the
 * supported path.
 */
import { CodexAgent } from "../lib/agents/openai/CodexAgent";
import {
  CodexCredentials,
  codexAuthFilePath,
  loadCodexCredentials,
} from "../lib/agents/openai/codex-auth";
import { Tool } from "../lib/tools/Tool";
import { History } from "../lib/history/History";

const MODEL = process.env.CODEX_MODEL ?? "gpt-5.6-luna";

/**
 * Credentials from the environment if present, otherwise from the file the
 * Codex CLI wrote. Exits with instructions rather than a stack trace when
 * neither is available — being signed out is the expected first run, not a bug.
 */
async function resolveCredentials(): Promise<CodexCredentials> {
  if (process.env.CODEX_ACCESS_TOKEN) {
    console.log("Using CODEX_ACCESS_TOKEN from the environment.");
    return {
      accessToken: process.env.CODEX_ACCESS_TOKEN,
      refreshToken: process.env.CODEX_REFRESH_TOKEN,
      accountId: process.env.CODEX_ACCOUNT_ID,
    };
  }

  try {
    return await loadCodexCredentials();
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : error}\n`);
    console.error("To sign in with your ChatGPT account:");
    console.error("  npx @openai/codex login\n");
    console.error(`That writes ${codexAuthFilePath()}, which this example reads.`);
    console.error(
      "Or set CODEX_ACCESS_TOKEN (and CODEX_ACCOUNT_ID) to supply a token directly.\n"
    );
    process.exit(1);
  }
}

/**
 * Report an error usefully.
 *
 * The Codex backend rejects a malformed request with a bare 400 whose `detail`
 * names the offending field, so print the response body rather than just the
 * SDK's summary line.
 */
function describeError(error: unknown): string {
  const err = error as {
    status?: number;
    message?: string;
    error?: { detail?: string; message?: string };
  };

  const detail = err?.error?.detail ?? err?.error?.message;
  const parts = [
    err?.status ? `HTTP ${err.status}` : undefined,
    detail,
    !detail ? err?.message : undefined,
  ].filter(Boolean);

  const summary = parts.join(" — ") || String(error);

  // The failures worth recognising on sight.
  if (err?.status === 401) {
    return `${summary}\n  → token rejected. Run \`npx @openai/codex login\` again.`;
  }
  if (err?.status === 403) {
    return `${summary}\n  → account may not have Codex access, or the wrong chatgpt-account-id was sent.`;
  }
  if (err?.status === 404 && detail === undefined) {
    return `${summary}\n  → model "${MODEL}" may not exist on this backend. Try CODEX_MODEL=gpt-5.1-codex`;
  }
  if (err?.status === 429) {
    return `${summary}\n  → subscription rate limit. Wait and retry.`;
  }
  return summary;
}

async function main() {
  const credentials = await resolveCredentials();

  console.log(
    `Signed in as ${credentials.email ?? "(unknown)"}` +
      (credentials.planType ? ` · plan: ${credentials.planType}` : "") +
      (credentials.accountId ? ` · account: ${credentials.accountId}` : "")
  );
  if (!credentials.accountId) {
    console.warn(
      "! No account id found — the chatgpt-account-id header will be omitted, which the backend may reject."
    );
  }

  // fromCredentials() wraps the token so it is refreshed underneath a long
  // run — access tokens live about an hour. CodexAgent.fromCodexCli() does the
  // loading and wrapping in one call when you do not need the credentials
  // yourself.
  const agent = CodexAgent.fromCredentials(
    credentials,
    {
      id: "1",
      name: "CodexAgent",
      description: "A helpful assistant running on a ChatGPT subscription",
      model: MODEL,
      // Only set when routing through a proxy.
      baseURL: process.env.CODEX_BASE_URL,
      tokenOptions: {
        onRefresh: () => console.log("[auth] access token refreshed"),
      },
    },
    // Agent history is transient by default — cleared before every execute(),
    // so each turn starts fresh. Passing a History keeps the conversation,
    // which the follow-up turns below rely on.
    new History()
  );

  console.log(
    `Model: ${MODEL} · endpoint: ${
      process.env.CODEX_BASE_URL ?? "chatgpt.com/backend-api/codex"
    }\n`
  );

  console.log("Models available to this account:");
  for (const m of await agent.listModels()) {
    console.log(
      `  ${m.id.padEnd(18)} ${String(m.contextLength ?? "?").padStart(7)} ctx  ${
        m.displayName ?? ""
      }`
    );
  }
  console.log();

  // 1. A plain turn. The Codex backend only answers streaming requests, so
  //    execute() streams internally and hands back the finished text.
  console.log("--- execute ---");
  console.log(await agent.execute("In one sentence: what is a monad?"));

  // 2. Streaming, where you see tokens as they arrive.
  console.log("\n--- executeStream ---");
  for await (const chunk of agent.executeStream(
    "Now compress that same answer into a haiku."
  )) {
    if (chunk.type === "text") process.stdout.write(chunk.content);
    // Reasoning models emit these first; show progress without the noise.
    if (chunk.type === "reasoning") process.stdout.write("\x1b[2m·\x1b[0m");
  }
  console.log();

  // 3. Tool use, which exercises the multi-hop path (each follow-up request
  //    has to satisfy the same body constraints as the first).
  console.log("\n--- tool use ---");
  agent.addTools([
    new Tool({
      name: "get_time",
      description: "Get the current time in ISO 8601 format",
      inputSchema: { type: "object", properties: {}, required: [] },
      execute: async (): Promise<unknown> => new Date().toISOString(),
    }),
  ]);
  console.log(await agent.execute("What time is it? Use the tool."));

  console.log("\nUsage:", agent.lastTokenUsage);
}

main().catch((error) => {
  console.error(`\nFailed: ${describeError(error)}`);
  process.exit(1);
});
