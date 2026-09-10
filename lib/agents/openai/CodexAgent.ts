import { History } from "../../history/History";
import { ModelInfo } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import { ExecutionError } from "../errors/AgentError";
import { ResponseInputItem } from "openai/resources/responses/responses";
import { OpenAIModel } from "../model-types";
import {
  AgentConfig as OpenAiAgentConfig,
  OpenAiAgent,
  wrapErrorBodyFetch,
} from "./OpenAiAgent";
import {
  CODEX_BASE_URL,
  CODEX_CLIENT_VERSION,
  CODEX_ORIGINATOR,
  CodexCredentials,
  CodexModelCard,
  CodexTokenProviderOptions,
  createCodexTokenProvider,
  loadCodexCredentials,
} from "./codex-auth";
import {
  CodexUsageLimits,
  observeHeadersFetch,
  parseCodexUsageLimits,
} from "./codex-usage";

/**
 * Models the ChatGPT-backed Codex backend serves.
 *
 * A different namespace from the platform API's — every platform id
 * (`gpt-5.6`, `gpt-4.1-mini`, even `gpt-5.1-codex`) is rejected here with
 * *"model is not supported when using Codex with a ChatGPT account"*. Probed
 * live on 2026-09-09; `(string & {})` keeps a newer model usable without a
 * release, while still autocompleting the known ones.
 */
export type CodexModel =
  | "gpt-5.6-luna"
  | "gpt-5.6-sol"
  | "gpt-5.6-terra"
  | "gpt-5.5"
  | "gpt-6-astra"
  | "codex-auto-review"
  // Keeps a model OpenAI adds later usable without a release, while the named
  // ones still autocomplete.
  | (string & Record<never, never>);

/**
 * Reasoning efforts the Codex models accept — a different set from the platform
 * API's, and uniform across these models rather than per-family. Each model's
 * live list is on `ModelInfo.raw.supported_reasoning_levels`.
 */
export type CodexReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";

export type CodexAgentConfig = Omit<
  OpenAiAgentConfig,
  // `vendor` is set by the base agent; the rest are re-typed or owned here.
  "model" | "reasoningEffort" | "fetch" | "vendor"
> & {
  /** @default "gpt-5.6-luna" */
  model?: CodexModel;
  /**
   * How hard the model should think. `medium` if unset — the backend's own
   * default for these models.
   */
  reasoningEffort?: CodexReasoningEffort;
  /**
   * ChatGPT workspace to bill, sent as the `chatgpt-account-id` header. Take it
   * from {@link loadCodexCredentials}; the backend may reject a request without
   * one.
   */
  accountId?: string;
  /**
   * Client identifier sent as `originator`. OpenAI gates parts of the model
   * catalog on this, so the default mirrors the Codex CLI.
   *
   * @default CODEX_ORIGINATOR
   */
  originator?: string;
  /**
   * `client_version` for the models endpoint, which 400s without one and hides
   * models newer than the version claimed.
   *
   * @default CODEX_CLIENT_VERSION
   */
  clientVersion?: string;
  /**
   * Conversation identifier sent as the `session_id` header, as the Codex CLI
   * does — **this is what makes prompt caching work on this backend**, and
   * setting it is how you opt into that caching.
   *
   * Requests carrying the same value are routed together and reuse each other's
   * cached prefix; without it the backend caches essentially nothing, however
   * identical the prefix. Measured on 2026-09-10 with a ~9K-token prefix
   * repeated 8 times: 0/14 calls hit the cache with no header, 12/14 hit
   * (~98% of the prefix) with one. `prompt_cache_key`, the platform API's
   * lever, makes no difference here.
   *
   * **Unset by default**, so the header is omitted entirely and a request stays
   * byte-identical to what earlier versions sent — the same opt-in rule as
   * {@link AgentConfig.promptCacheKey} and
   * {@link AgentConfig.promptCacheRetention}. Caching is not free of side
   * effects: it groups your requests server-side under an id you chose, so it
   * is yours to turn on rather than the agent's to assume.
   *
   * Any stable string works; the value is opaque and only its stability
   * matters. One id per conversation is the usual grain — `randomUUID()` per
   * agent instance reproduces the old default:
   *
   * ```typescript
   * new CodexAgent({ …, sessionId: randomUUID() })      // cache within this run
   * new CodexAgent({ …, sessionId: conversationId })    // cache across runs
   * ```
   *
   * Note it is a *header*: `session_id` in the request body is rejected with
   * *"Unsupported parameter: session_id"*.
   */
  sessionId?: string;
};

/**
 * Configuration a factory hands to the constructor, before the credentials it
 * resolves are merged in.
 */
type CodexFactoryConfig = Omit<CodexAgentConfig, "apiKey" | "accountId"> & {
  tokenOptions?: CodexTokenProviderOptions;
};

/**
 * What a static factory needs of the class it was called on: a constructor for
 * the concrete subclass — which is where `T` is inferred from — intersected
 * with the sibling factory it delegates to, so an override of that runs too.
 *
 * `Pick<typeof CodexAgent, …>` rather than a hand-written signature: the
 * sibling's own `this` parameter is what carries `T` through the delegation,
 * and restating it here would erase that and pin every subclass back to the
 * base type.
 */
type CodexAgentClass<T extends CodexAgent> = (new (
  config: CodexAgentConfig,
  history?: History
) => T) &
  Pick<typeof CodexAgent, "fromCredentials">;

/**
 * Agent for OpenAI models reached through a **ChatGPT subscription** rather
 * than a platform API key.
 *
 * Talks to `https://chatgpt.com/backend-api/codex`, the endpoint OpenAI's Codex
 * CLI uses, so calls are billed against the subscription instead of an API
 * account. It speaks the Responses API, hence the `OpenAiAgent` base — but the
 * two are far enough apart that mixing them in one class meant lying to the
 * type system about which models exist:
 *
 * | | platform | Codex |
 * |---|---|---|
 * | models | `gpt-5.6`, `gpt-4.1-mini`, … | `gpt-5.6-luna/sol/terra`, … — disjoint sets |
 * | body | as written | `instructions` required, `stream: true`, no `max_output_tokens` |
 * | errors | `{error: {…}}` | `{detail: …}` |
 * | terminal event | `output` populated | `output: []`; content arrives as items |
 * | models endpoint | `/v1/models` | `/models?client_version=…` |
 *
 * Nothing here is a documented public API and OpenAI can change it without
 * notice; {@link OpenAiAgent} with a platform key remains the supported path.
 *
 * @example
 * ```typescript
 * // Reads the credentials `codex login` stored, and keeps the token fresh.
 * const agent = await CodexAgent.fromCodexCli({
 *   id: "1",
 *   name: "Assistant",
 *   description: "A helpful assistant",
 * });
 *
 * console.log(await agent.execute("Hello!"));
 * ```
 */
export class CodexAgent extends OpenAiAgent<OpenAIModel, CodexModelCard> {
  private readonly accountId?: string;
  private readonly originator: string;
  private readonly clientVersion: string;
  private readonly codexBaseURL: string;
  /**
   * The `session_id` this agent sends on every request, or `undefined` when the
   * header is not being sent — the key the backend's prompt cache is routed by.
   *
   * `undefined` means prompt caching is effectively off for this agent; set
   * {@link CodexSpecificConfig.sessionId} to opt in. Read it back to pin a
   * later agent to the same cache.
   */
  readonly sessionId?: string;

  /**
   * Quota state written by the fetch wrapper installed in the constructor.
   *
   * A holder object rather than a field because the wrapper is built *before*
   * `super()` — the base constructor creates the SDK client, so the wrapper has
   * to exist by then, and `this` is not available yet. `notify` is attached
   * afterwards, once emitting is possible.
   */
  private readonly limits: {
    latest?: CodexUsageLimits;
    notify?: (limits: CodexUsageLimits) => void;
  };

  constructor(config: CodexAgentConfig, history?: History) {
    const vendorConfig = config.vendorConfig?.openai ?? {};
    const accountId = config.accountId ?? vendorConfig.accountId;
    const originator =
      config.originator ?? vendorConfig.originator ?? CODEX_ORIGINATOR;
    const baseURL = config.baseURL ?? vendorConfig.baseURL ?? CODEX_BASE_URL;
    // No generated fallback: caching is opt-in, so an unset id means the header
    // is not sent at all.
    const sessionId = config.sessionId ?? vendorConfig.sessionId;
    // Filled by the fetch wrapper below and adopted as `this.limits` once
    // `super()` has run.
    const limits: CodexAgent["limits"] = {};

    // Everything host-specific is passed *into* the base constructor rather
    // than supplied by an override: the base runs before this class's fields
    // are assigned, so an override could not read them.
    super(
      {
        ...config,
        model: config.model ?? "gpt-5.6-luna",
        reasoningEffort: config.reasoningEffort,
        baseURL,
        defaultHeaders: {
          ...(accountId ? { "chatgpt-account-id": accountId } : {}),
          "OpenAI-Beta": "responses=experimental",
          originator,
          // Opt-in. Stable for the life of the agent: the backend keys its
          // prompt cache on this, and drops to ~0% hit rate without it. Omitted
          // entirely when unset, so the request is byte-identical to one sent
          // before this existed.
          ...(sessionId ? { session_id: sessionId } : {}),
          // Every Codex request is a stream; the SDK would send
          // `application/json`, which no reference client does.
          Accept: "text/event-stream",
          ...config.defaultHeaders,
        },
        // Two wrappers, innermost first: normalise this backend's `{detail: …}`
        // error bodies (which the SDK otherwise drops on the floor — see
        // wrapErrorBodyFetch()), then read the `x-codex-*` quota headers off
        // every response on the way back out.
        fetch: observeHeadersFetch((headers) => {
          const parsed = parseCodexUsageLimits(headers);
          if (!parsed) return;
          limits.latest = parsed;
          limits.notify?.(parsed);
        }, wrapErrorBodyFetch()),
        // Cast: the codex-specific keys (accountId, originator, clientVersion)
        // are not part of the base config, and `vendor` is supplied by it.
      } as unknown as Omit<OpenAiAgentConfig, "vendor">,
      history
    );

    this.limits = limits;
    // Only now can the wrapper emit; anything parsed before this point is still
    // on `limits.latest`.
    limits.notify = (usageLimits) =>
      this.emit(AgentEvent.USAGE_LIMITS, usageLimits);

    this.accountId = accountId;
    this.originator = originator;
    this.clientVersion =
      config.clientVersion ??
      vendorConfig.clientVersion ??
      CODEX_CLIENT_VERSION;
    this.codexBaseURL = baseURL;
    this.sessionId = sessionId;
  }

  /**
   * What the most recent response said about the subscription's remaining
   * allowance — this backend's answer to "what did that cost?".
   *
   * A ChatGPT subscription is not priced per request, so
   * `lastTokenUsage.cost_usd` is undefined here and always will be. What a call
   * spends is plan allowance, reported as two rolling windows (5-hourly and
   * weekly) plus the credit balance that takes over once they are used up.
   *
   * Unlike `lastTokenUsage`, this is **not** reset per run: it describes the
   * account, not the turn, so it keeps the last value seen until another call
   * updates it. `undefined` before the first call, and after calls that carried
   * no quota headers — `listModels()` is one, so only `execute()` /
   * `executeStream()` refresh it. `AgentEvent.USAGE_LIMITS` fires on every
   * update, including the ones on a failed request.
   *
   * @example
   * ```typescript
   * await agent.execute("Hello!");
   * const limits = agent.lastUsageLimits;
   * console.log(`${limits?.primary?.usedPercent}% of the 5h window used`);
   * ```
   */
  get lastUsageLimits(): CodexUsageLimits | undefined {
    return this.limits.latest;
  }

  /**
   * Build an agent from the credentials `codex login` stored, wrapped in a
   * provider that refreshes the access token as it ages out.
   *
   * Constructs `this`, so `MyCodexAgent.fromCodexCli(…)` returns a
   * `MyCodexAgent` — see {@link CodexAgent.fromCredentials}.
   *
   * @throws if no credentials are present — run `codex login` first.
   */
  static async fromCodexCli<T extends CodexAgent>(
    this: CodexAgentClass<T>,
    config: CodexFactoryConfig & {
      /** Read `auth.json` from somewhere other than `$CODEX_HOME`. */
      codexHome?: string;
    },
    history?: History
  ): Promise<T> {
    const credentials = await loadCodexCredentials(config.codexHome);
    // `this`, not `CodexAgent`: routed through the subclass so an override of
    // `fromCredentials` is not skipped either.
    return this.fromCredentials(credentials, config, history);
  }

  /**
   * Build an agent from credentials obtained however you like.
   *
   * Instantiates `this` rather than `CodexAgent`, so a subclass gets its own
   * type back and its overrides actually run. Hard-coding the class here made
   * `class MyCodexAgent extends CodexAgent` silently produce a plain
   * `CodexAgent` — no error, no override, and nothing to see until an
   * experiment came back saying the change under test had no effect.
   */
  static fromCredentials<T extends CodexAgent>(
    this: new (config: CodexAgentConfig, history?: History) => T,
    credentials: CodexCredentials,
    config: CodexFactoryConfig,
    history?: History
  ): T {
    const tokens = createCodexTokenProvider(credentials, config.tokenOptions);

    return new this(
      {
        ...config,
        // The function form: the SDK re-invokes it before every request, so a
        // long run outlives the ~1h token.
        apiKey: tokens.getToken,
        accountId: credentials.accountId,
      },
      history
    );
  }

  /**
   * Every model on this backend reasons, and this is what the Codex CLI itself
   * does, so the encrypted-reasoning round trip is on unless turned off.
   */
  protected override defaultIncludeEncryptedReasoning(): boolean {
    return true;
  }

  /** This backend refuses `stream: false` outright. */
  protected override get forceStreaming(): boolean {
    return true;
  }

  /**
   * Satisfy the backend's extra body validations, each of which is otherwise a
   * bare `400`: *"Instructions are required"*, *"Input must be a list"*,
   * *"Store must be set to false"*, *"Stream must be set to true"*,
   * *"Unsupported parameter: max_output_tokens"*.
   *
   * `store: false` and a list-shaped `input` already hold at every call site in
   * the base class.
   */
  protected override transformRequestParams<
    T extends { input: ResponseInputItem[] }
  >(params: T): T {
    // Read from history rather than getSystemMessage(): that is the message
    // being stripped from `input` below, and a caller may have replaced it.
    const systemMessage =
      this.history.getSystemMessage() ?? this.getSystemMessage();

    // Rejected outright, so it cannot merely be left undefined when the caller
    // set `maxTokens`.
    const { max_output_tokens: _dropped, ...rest } = params as T & {
      max_output_tokens?: number;
    };

    return {
      ...(rest as T),
      // Must be present and non-empty.
      instructions: systemMessage?.trim()
        ? systemMessage
        : "You are a helpful assistant.",
      // The system prompt travels in `instructions` now, so drop the copy the
      // transformer put in `input` rather than sending it twice.
      input: params.input.filter(
        (item) =>
          !(
            typeof item === "object" &&
            item !== null &&
            "role" in item &&
            item.role === "system"
          )
      ),
    };
  }

  /**
   * List the models this ChatGPT account may drive.
   *
   * Neither the endpoint nor the shape matches the platform API's
   * `/v1/models`: it needs a `client_version` query parameter (400s without
   * one) and returns richer cards — the context window for this account's
   * plan, the reasoning efforts the model accepts, the plans it is available
   * in. The SDK has no method for it, so this goes out through `fetch`.
   *
   * Models whose `minimal_client_version` exceeds {@link clientVersion} are
   * omitted by the server, not here.
   */
  override async listModels(): Promise<ModelInfo<CodexModelCard>[]> {
    try {
      const token = await this.resolveApiKey();
      const url = `${
        this.codexBaseURL
      }/models?client_version=${encodeURIComponent(this.clientVersion)}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(this.accountId ? { "chatgpt-account-id": this.accountId } : {}),
          originator: this.originator,
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `${res.status} ${res.statusText}${
            body ? `: ${body.slice(0, 300)}` : ""
          }`
        );
      }

      const data = (await res.json()) as { models?: CodexModelCard[] };

      return (data.models ?? []).map((model) => ({
        id: model.slug,
        displayName: model.display_name,
        // The plan's window, not the model's ceiling — `max_context_window` is
        // on `raw` for anyone who needs the larger number.
        contextLength: model.context_window,
        capabilities: {
          chat: true,
          tools: true,
          vision: model.input_modalities?.includes("image"),
          thinking: (model.supported_reasoning_levels?.length ?? 0) > 0,
        },
        raw: model,
      }));
    } catch (error: unknown) {
      throw new ExecutionError(
        `Failed to list Codex models: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
