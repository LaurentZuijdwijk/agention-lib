import { BaseAgent, BaseAgentConfig, ModelInfo, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import { OpenRouterSpecificConfig } from "../AgentConfig";
import { ExecuteOptions, isAbortError, throwIfAborted } from "../cancellation";
import {
  AgentError,
  ApiError,
  ExecutionError,
  MaxTokensExceededError,
  RateLimitError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History, MessageContent } from "../../history/History";
import { openRouterTransformer } from "../../history/transformers";
import { vizReporter } from "../../viz/VizReporter";
import { vizConfig } from "../../viz/VizConfig";
import type {
  OpenRouterGenerationInfo,
  OpenRouterRetryConfig,
} from "./types";

/**
 * A single chunk yielded by `executeStream()`.
 * - `"text"` — visible output token
 * - `"reasoning"` — internal reasoning token
 */
export type StreamChunk = {
  type: "text" | "reasoning";
  content: string;
};

/**
 * Retry policy the agent applies when the config does not name one.
 *
 * `@openrouter/sdk` already knows how to honour `Retry-After` and
 * `retry-after-ms` (`lib/retries.js`), but `chat.send()` defaults to
 * `retryCodes: ["5XX"]`, so a 429 never reaches that code — and its default
 * `maxElapsedTime` is 3_600_000, an hour-long retry loop. Both are replaced
 * here; see {@link OpenRouterSpecificConfig.retry}.
 */
const DEFAULT_RETRY: OpenRouterRetryConfig = {
  strategy: "backoff",
  backoff: {
    initialInterval: 500,
    maxInterval: 30_000,
    exponent: 1.5,
    // Two minutes: long enough to sit out a couple of `Retry-After` waits on a
    // per-minute limit, short enough that a daily quota (whose reset is hours
    // away) fails fast instead of blocking the run. Use `models` fallbacks for
    // that case, not a longer wait.
    maxElapsedTime: 120_000,
  },
  retryConnectionErrors: true,
};

/** Status codes retried by default. `429` is the one the SDK omits. */
const DEFAULT_RETRY_CODES = ["408", "409", "429", "5XX"];

/**
 * Build a `beforeRequest` hook that adds custom headers to every request.
 *
 * `@openrouter/sdk` has no `defaultHeaders` option like the Anthropic and
 * OpenAI clients, so headers are injected at the HTTP layer instead. They
 * overwrite headers the SDK already set, so that `defaultHeaders` means the
 * same thing on every provider — see `CommonAgentConfig.defaultHeaders`.
 *
 * `httpReferer` / `appTitle` are a separate OpenRouter attribution path
 * (`HTTP-Referer` / `X-Title`). They are not a substitute for tracing or
 * gateway headers.
 */
export function defaultHeadersHook(
  headers: Record<string, string>
): (request: Request) => void {
  return (request: Request) => {
    for (const [name, value] of Object.entries(headers)) {
      request.headers.set(name, value);
    }
  };
}

export type OpenRouterConfig = BaseAgentConfig &
  OpenRouterSpecificConfig & {
    model?: string;
    maxTokens?: number;
    /** Override the API base URL — for an OpenRouter-compatible gateway. */
    baseURL?: string;
    /** Vendor-nested form of the same options, for `AgentConfig` compatibility. */
    vendorConfig?: { openrouter?: OpenRouterSpecificConfig };
  };

/**
 * A model as OpenRouter's `/models` endpoint reports it.
 *
 * Richer than any single upstream provider's listing: OpenRouter publishes
 * per-token pricing, the context window, and the exact parameter names each
 * model accepts.
 */
export type OpenRouterModelCard = {
  id: string;
  canonicalSlug?: string | null;
  name?: string;
  created?: number;
  description?: string;
  contextLength?: number | null;
  architecture?: {
    inputModalities?: string[];
    outputModalities?: string[];
    tokenizer?: string;
    instructType?: string | null;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
    webSearch?: string;
    internalReasoning?: string;
  };
  topProvider?: {
    contextLength?: number | null;
    maxCompletionTokens?: number | null;
    isModerated?: boolean;
  };
  /** Parameter names the model accepts, e.g. `"tools"`, `"reasoning"`, `"seed"`. */
  supportedParameters?: string[] | null;
  [key: string]: unknown;
};

/**
 * Agent backed by [OpenRouter](https://openrouter.ai) via the official
 * `@openrouter/sdk`, giving one API key access to models from every provider it
 * fronts.
 *
 * Beyond what an OpenAI-compatible endpoint offers, this agent exposes
 * OpenRouter's routing controls — `models` fallbacks, `provider` preferences —
 * reports the credit cost of each run on {@link lastGeneration}, and round-trips
 * `reasoning_details` so multi-turn tool calls work on reasoning models whose
 * thinking blocks are signed.
 *
 * @requires @openrouter/sdk - Install as a peer dependency:
 * ```bash
 * npm install @openrouter/sdk
 * ```
 * The SDK is ESM-only, so it is loaded through a dynamic import. On CommonJS
 * that needs Node 20.19+ or 22.12+, where `require()` of an ES module works.
 *
 * @example
 * ```typescript
 * const agent = new OpenRouterAgent({
 *   id: "router",
 *   name: "Router",
 *   description: "Answers questions",
 *   apiKey: process.env.OPENROUTER_API_KEY!,
 *   model: "anthropic/claude-opus-4-20250514",
 *   models: ["openai/gpt-5.6"],          // used if the primary is rate limited
 *   provider: { sort: "throughput" },
 * });
 *
 * const answer = await agent.execute("Explain recursion");
 * console.log(agent.lastGeneration?.cost, "credits");
 * ```
 */
export class OpenRouterAgent extends BaseAgent {
  protected config: OpenRouterConfig;

  /**
   * Cost and routing facts for the most recent `execute()` / `executeStream()`.
   * Reset at the start of each run, alongside `lastTokenUsage`.
   */
  public lastGeneration?: OpenRouterGenerationInfo;

  private clientPromise?: Promise<any>;
  private vizEventId?: string;
  private currentToolCallCount: number = 0;

  constructor(config: OpenRouterConfig, history?: History) {
    super({ ...config, vendor: "openrouter" }, history);

    // Flat config wins over the nested form, matching the other agents.
    const nested = config.vendorConfig?.openrouter ?? {};
    this.config = {
      ...config,
      vendor: "openrouter",
      model: config.model || "openrouter/auto",
      models: config.models ?? nested.models,
      provider: config.provider ?? nested.provider,
      retry: config.retry ?? nested.retry,
      retryCodes: config.retryCodes ?? nested.retryCodes,
      reasoning: config.reasoning ?? nested.reasoning,
      plugins: config.plugins ?? nested.plugins,
      builtInTools: config.builtInTools ?? nested.builtInTools,
      sessionId: config.sessionId ?? nested.sessionId,
      user: config.user ?? nested.user,
      serviceTier: config.serviceTier ?? nested.serviceTier,
      httpReferer: config.httpReferer ?? nested.httpReferer,
      appTitle: config.appTitle ?? nested.appTitle,
      disableParallelToolUse:
        config.disableParallelToolUse ?? nested.disableParallelToolUse,
    };
    this.model = this.config.model!;

    this.addSystemMessage(this.getSystemMessage());
  }

  /**
   * Load `@openrouter/sdk` and construct the client, once per agent.
   *
   * The specifier goes through a variable so TypeScript does not resolve it at
   * build time, which keeps the dependency genuinely optional — the same
   * approach `MCPClient` uses. The promise is memoized including its rejection,
   * so a missing package reports the install hint on every call rather than
   * retrying the import.
   */
  private getClient(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = this.createClient();
    }
    return this.clientPromise;
  }

  private async createClient(): Promise<any> {
    const pkg = "@openrouter/sdk";
    let OpenRouter: any;
    let HTTPClient: any;
    try {
      ({ OpenRouter, HTTPClient } = (await import(/* @vite-ignore */ pkg)) as any);
    } catch (error: unknown) {
      throw new ExecutionError(
        `OpenRouterAgent requires the '@openrouter/sdk' package. Install it with: npm install @openrouter/sdk` +
          `\nUnderlying error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
      );
    }

    let httpClient: unknown;
    if (this.config.defaultHeaders) {
      httpClient = new HTTPClient();
      (httpClient as { addHook: (hook: string, fn: unknown) => void }).addHook(
        "beforeRequest",
        defaultHeadersHook(this.config.defaultHeaders)
      );
    }

    return new OpenRouter({
      apiKey: this.config.apiKey,
      ...(this.config.baseURL ? { serverURL: this.config.baseURL } : {}),
      ...(this.config.httpReferer ? { httpReferer: this.config.httpReferer } : {}),
      ...(this.config.appTitle ? { appTitle: this.config.appTitle } : {}),
      ...(this.config.timeout ? { timeoutMs: this.config.timeout } : {}),
      ...(this.config.debug ? { debugLogger: console } : {}),
      ...(httpClient ? { httpClient } : {}),
    });
  }

  protected getToolDefinitions(): Array<Record<string, unknown>> {
    return Array.from(this.tools.values()).map((tool) => {
      const prompt = tool.getPrompt();
      return {
        type: "function" as const,
        function: {
          name: prompt.name,
          description: prompt.description,
          parameters: prompt.input_schema as unknown as Record<string, unknown>,
        },
      };
    });
  }

  /**
   * Combine locally-executed tool definitions with provider-defined
   * (server-side) built-in tools (e.g. `openrouter:web_search`). Both sit in
   * the same flat `tools` array OpenRouter's OpenAI-compatible endpoint takes.
   */
  protected getAllToolDefinitions(): Array<Record<string, unknown>> {
    return [
      ...this.getToolDefinitions(),
      ...(this.config.builtInTools ?? []),
    ];
  }

  protected async process(_input: string): Promise<string> {
    return "";
  }

  /**
   * List the models OpenRouter offers, following pagination to the end.
   *
   * Fills `contextLength`, `maxOutputTokens` and `capabilities` from
   * OpenRouter's own metadata: `supported_parameters` says whether a model takes
   * `tools` and `reasoning`, and `architecture.input_modalities` whether it
   * accepts images. Per-token pricing is on `raw.pricing`.
   */
  async listModels(): Promise<ModelInfo<OpenRouterModelCard>[]> {
    try {
      const client = await this.getClient();
      const result = await client.models.list();

      const models: ModelInfo<OpenRouterModelCard>[] = [];
      for await (const page of result) {
        // `models.list()` yields GetModelsResponse: `{ result: { data, links, totalCount } }`.
        const entries: OpenRouterModelCard[] = page?.result?.data ?? [];
        for (const card of entries) {
          const params = card.supportedParameters ?? [];
          const modalities = card.architecture?.inputModalities ?? [];
          models.push({
            id: card.id,
            displayName: card.name,
            created: card.created ? new Date(card.created * 1000) : undefined,
            contextLength: card.contextLength ?? card.topProvider?.contextLength ?? undefined,
            maxOutputTokens: card.topProvider?.maxCompletionTokens ?? undefined,
            capabilities: {
              chat: true,
              tools: params.includes("tools"),
              vision: modalities.includes("image"),
              thinking:
                params.includes("reasoning") || params.includes("include_reasoning"),
            },
            raw: card,
          });
        }
      }
      return models;
    } catch (error: unknown) {
      throw new ExecutionError(
        `Failed to list OpenRouter models: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async execute(
    input: string | MessageContent[],
    options?: ExecuteOptions
  ): Promise<string> {
    this.beginRun(input);

    try {
      const response = await this.callProvider(options);
      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response, options);
    } catch (error: unknown) {
      throw this.failRun(error, options);
    } finally {
      this.history.endExecution();
    }
  }

  /**
   * Stream a response as an async generator of {@link StreamChunk} objects.
   *
   * Tool calls are executed transparently — the generator keeps streaming after
   * each tool-call round trip.
   */
  async *executeStream(
    input: string | MessageContent[],
    options?: ExecuteOptions
  ): AsyncGenerator<StreamChunk> {
    this.beginRun(input);

    try {
      yield* this.streamTurn(options);
    } catch (error: unknown) {
      throw this.failRun(error, options);
    } finally {
      this.history.endExecution();
    }
  }

  /** Shared setup for `execute()` and `executeStream()`. */
  private beginRun(input: string | MessageContent[]): void {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);
    this.resetTokenUsage();
    this.lastGeneration = undefined;
    this.currentToolCallCount = 0;

    if (vizConfig.isEnabled()) {
      this.vizEventId = vizReporter.agentStart(
        this.id,
        this.name,
        this.config.model!,
        this.vendor,
        typeof input === "string" ? input : JSON.stringify(input)
      );
    }

    if (this.history.transient) {
      this.history.clear();
      this.addSystemMessage(this.getSystemMessage());
    }

    if (typeof input === "string") {
      this.addTextToHistory("user", input);
    } else {
      this.addMessageToHistory("user", input);
    }

    this.history.setSessionAnchor();
    this.history.beginExecution();
  }

  /**
   * Map whatever a run threw onto this library's error types, emit it, and close
   * any open visualization event. Returns the error for the caller to throw.
   */
  private failRun(error: unknown, options?: ExecuteOptions): Error {
    // The abort branch comes first and keys off the signal rather than the
    // error's name, so a cancellation still surfaces as an AbortError even when
    // an inner catch already wrapped it.
    if (isAbortError(error, options?.signal)) {
      const abortError = this.abortError(error, options?.signal);
      this.closeViz("AbortError", abortError.message, false);
      return abortError;
    }

    const mapped = this.mapProviderError(error);
    this.emit(AgentEvent.ERROR, mapped);
    this.closeViz(
      mapped.name,
      mapped.message,
      mapped instanceof ApiError && mapped.statusCode === 429
    );
    return mapped;
  }

  /**
   * Turn an `@openrouter/sdk` error into an {@link AgentError}.
   *
   * The SDK throws one class per status code, all extending `OpenRouterError`
   * with `statusCode`, `headers` and `body`. Rather than importing those classes
   * — which would make the optional peer dependency mandatory — this reads the
   * shape structurally.
   */
  private mapProviderError(error: unknown): AgentError {
    if (error instanceof AgentError) return error;

    const err = error as {
      statusCode?: number;
      headers?: Headers;
      message?: string;
      body?: string;
    };

    if (typeof err?.statusCode === "number") {
      const message = unwrapOpenRouterMessage(
        parseOpenRouterErrorBody(err.body),
        err.message ?? "Unknown error"
      );

      if (err.statusCode === 429) {
        return this.rateLimitError(err, message);
      }
      return new ApiError(`OpenRouter API error: ${message}`, err.statusCode, error);
    }

    return new ExecutionError(
      `OpenRouter error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  /**
   * Build a {@link RateLimitError} from a 429, lifting OpenRouter's rate-limit
   * headers onto it. They are only present on OpenRouter's own platform limits —
   * a 429 passed through from an upstream provider carries neither, which is why
   * every field is optional.
   */
  private rateLimitError(
    err: { headers?: Headers },
    message: string
  ): RateLimitError {
    const headers = err.headers;
    const num = (name: string): number | undefined => {
      const raw = headers?.get(name);
      if (!raw) return undefined;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    // `Retry-After` is defined by RFC 9110 as either delay-seconds or an
    // HTTP-date. OpenRouter sends the numeric form, but the date form is
    // legal and costs one branch to accept.
    const retryAfterRaw = headers?.get("retry-after");
    const retryAfterMs = parseRetryAfter(retryAfterRaw);

    return new RateLimitError(
      `OpenRouter rate limit: ${message}`,
      retryAfterMs,
      num("x-ratelimit-limit"),
      num("x-ratelimit-remaining"),
      parseResetAt(num("x-ratelimit-reset")),
      err
    );
  }

  private closeViz(name: string, message: string, throttled: boolean): void {
    if (!this.vizEventId) return;
    vizReporter.agentError(this.vizEventId, name, message, throttled);
    this.vizEventId = undefined;
  }

  /**
   * Wrap a `ChatRequest` in the envelope `@openrouter/sdk` `chat.send()` expects.
   * Passing the body bare fails Speakeasy validation (`Input validation failed`).
   */
  private sendRequest(stream: boolean): Record<string, unknown> {
    return {
      chatRequest: this.buildRequest(stream),
      ...(this.config.httpReferer ? { httpReferer: this.config.httpReferer } : {}),
      ...(this.config.appTitle ? { appTitle: this.config.appTitle } : {}),
    };
  }

  /** The `ChatRequest` body, identical for the streaming and buffered paths. */
  private buildRequest(stream: boolean): Record<string, unknown> {
    const messages = openRouterTransformer.toProvider(this.history.getEntries());
    const allTools = this.getAllToolDefinitions();
    const tools = allTools.length > 0 ? allTools : undefined;

    return {
      model: this.config.model!,
      messages,
      stream,
      // Ask for usage in the stream. Without this OpenRouter often omits the
      // `usage` chunk, leaving `lastTokenUsage` / `lastGeneration.cost` empty
      // on `executeStream()` — same option the OpenAI-compatible agent sends.
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      ...(tools ? { tools } : {}),
      ...(this.config.models?.length ? { models: this.config.models } : {}),
      ...(this.config.provider ? { provider: this.config.provider } : {}),
      ...(this.config.reasoning ? { reasoning: this.config.reasoning } : {}),
      ...(this.config.plugins?.length ? { plugins: this.config.plugins } : {}),
      ...(this.config.sessionId ? { sessionId: this.config.sessionId } : {}),
      ...(this.config.user ? { user: this.config.user } : {}),
      ...(this.config.serviceTier ? { serviceTier: this.config.serviceTier } : {}),
      ...(this.config.disableParallelToolUse !== undefined
        ? { parallelToolCalls: !this.config.disableParallelToolUse }
        : {}),
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      topP: this.config.topP,
      topK: this.config.topK,
      stop: this.config.stopSequences,
      seed: this.config.seed,
      presencePenalty: this.config.presencePenalty,
      frequencyPenalty: this.config.frequencyPenalty,
    };
  }

  /**
   * Per-request options: the cancellation signal plus the retry policy.
   *
   * `retryCodes` has to be passed on every call — the SDK reads it only from the
   * call options, never from the client's, so setting it once at construction
   * would silently do nothing.
   */
  private requestOptions(options?: ExecuteOptions): Record<string, unknown> {
    return {
      ...(options?.signal ? { signal: options.signal } : {}),
      retries: this.config.retry ?? DEFAULT_RETRY,
      retryCodes: this.config.retryCodes ?? DEFAULT_RETRY_CODES,
      // Ask OpenRouter to include `openrouter_metadata` (attempt count, etc.)
      // in the response. It only does so when the header is present, and default
      // is off — without it `openrouterMetadata` never appears.
      headers: { "X-OpenRouter-Metadata": "1" },
    };
  }

  private async callProvider(options?: ExecuteOptions): Promise<any> {
    const client = await this.getClient();
    this.startTurnTimer();
    return client.chat.send(this.sendRequest(false), this.requestOptions(options));
  }

  protected async handleResponse(
    response: any,
    options?: ExecuteOptions
  ): Promise<string> {
    const usage = this.accumulateUsage(this.parseUsage(response));
    this.recordGeneration(response);

    const choice = response?.choices?.[0];

    // OpenRouter can report a provider failure inside a 200 body rather than as
    // an HTTP error, with whatever text was generated before it failed. Without
    // this the run would look like a successful short answer.
    if (!choice) {
      throw new ExecutionError(
        `OpenRouter returned no choices: ${
          response?.error?.message ?? "empty response"
        }`
      );
    }
    if (choice.finishReason === "error") {
      throw new ApiError(
        `OpenRouter provider error mid-generation: ${
          response?.error?.message ?? "no message"
        }`,
        response?.error?.code,
        response
      );
    }

    const message = choice.message ?? {};

    if (choice.finishReason === "length") {
      const error = new MaxTokensExceededError(
        "Response exceeded maximum token limit",
        this.config.maxTokens
      );
      this.emit(AgentEvent.MAX_TOKENS_EXCEEDED, error);
      throw error;
    }

    const toolCalls = message.toolCalls ?? [];

    if (toolCalls.length === 0) {
      const textContent = message.content || "";
      this.addToHistory(openRouterTransformer.fromProviderMessage(message));
      this.emit(AgentEvent.DONE, message, usage);
      this.completeViz(textContent);
      return textContent;
    }

    // Stop before the assistant turn is written: bailing out here avoids both
    // running the tools' side effects and leaving a tool call in history with no
    // tool message to answer it.
    throwIfAborted(options?.signal, `Execution of agent ${this.getName()}`);

    this.emit(AgentEvent.TOOL_USE, toolCalls);
    this.currentToolCallCount += toolCalls.length;

    this.addToHistory(openRouterTransformer.fromProviderMessage(message));

    const toolResults = await this.handleToolCalls(toolCalls, options);
    for (const result of toolResults) {
      this.addToHistory(
        openRouterTransformer.toolResultEntry(result.toolCallId, result.content)
      );
    }

    const newResponse = await this.callProvider(options);
    this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
    return this.handleResponse(newResponse, options);
  }

  private async *streamTurn(
    options?: ExecuteOptions
  ): AsyncGenerator<StreamChunk> {
    const client = await this.getClient();
    this.startTurnTimer();

    const stream = await client.chat.send(
      this.sendRequest(true),
      this.requestOptions(options)
    );

    let textContent = "";
    let reasoningContent = "";
    let reasoningDetails: unknown[] = [];
    const toolCallAcc = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();
    let finishReason: string | null = null;
    let streamUsage: any;
    let streamError: OpenRouterErrorPayload | undefined;

    for await (const chunk of stream as AsyncIterable<any>) {
      // Once the first token is out the 200 and its headers are committed, so a
      // provider failure after that point arrives as an SSE payload instead of
      // an HTTP status. Recorded and thrown after the loop, so the tokens
      // already spent still get reported.
      if (chunk?.error) streamError = chunk.error;

      // Usage rides on whichever chunk OpenRouter chooses — often the last
      // content chunk rather than a trailing choice-less one. It is a running
      // total for the turn, not a delta, so keeping the most recent covers both
      // layouts without double-counting.
      if (chunk?.usage) streamUsage = chunk.usage;
      if (chunk?.id || chunk?.model) this.recordGeneration(chunk);

      const choice = chunk?.choices?.[0];
      if (!choice) continue;

      finishReason = choice.finishReason ?? finishReason;
      const delta = choice.delta ?? {};

      if (delta.content) {
        this.markFirstToken();
        textContent += delta.content;
        this.emit(AgentEvent.CHUNK, delta.content);
        yield { type: "text", content: delta.content };
      }

      if (delta.reasoning) {
        this.markFirstToken();
        // Accumulated as well as yielded: the assistant turn has to carry its
        // reasoning back on the next request.
        reasoningContent += delta.reasoning;
        this.emit(AgentEvent.REASONING_CHUNK, delta.reasoning);
        yield { type: "reasoning", content: delta.reasoning };
      }

      if (delta.reasoningDetails?.length) {
        reasoningDetails = reasoningDetails.concat(delta.reasoningDetails);
      }

      if (delta.toolCalls) {
        for (const tc of delta.toolCalls) {
          const index = tc.index ?? 0;
          if (!toolCallAcc.has(index)) {
            toolCallAcc.set(index, { id: "", name: "", arguments: "" });
          }
          const acc = toolCallAcc.get(index)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name += tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        }
      }
    }

    // Before any throw below, so a turn that failed part way still reports what
    // it spent.
    if (streamUsage) this.accumulateUsage(this.parseUsageObject(streamUsage));

    // The SDK's stream iterator stops yielding on abort rather than throwing, so
    // without this an interrupted stream would look like a short but complete
    // turn — writing partial text to history and emitting DONE.
    throwIfAborted(options?.signal, `Execution of agent ${this.getName()}`);

    if (streamError) {
      throw new ApiError(
        `OpenRouter stream error: ${unwrapOpenRouterMessage(streamError, streamError.message ?? "no message")}`,
        streamError.code,
        streamError
      );
    }

    if (finishReason === "length") {
      const error = new MaxTokensExceededError(
        "Response exceeded maximum token limit",
        this.config.maxTokens
      );
      this.emit(AgentEvent.MAX_TOKENS_EXCEEDED, error);
      throw error;
    }

    const assistantMessage = {
      role: "assistant",
      content: textContent || null,
      reasoning: reasoningContent || null,
      reasoningDetails,
    };

    if (finishReason === "tool_calls" && toolCallAcc.size > 0) {
      // As in handleResponse(): bail out before the assistant turn is written,
      // so a cancelled run leaves no unanswered tool call in history.
      throwIfAborted(options?.signal, `Execution of agent ${this.getName()}`);

      const toolCalls = Array.from(toolCallAcc.entries())
        .sort(([a], [b]) => a - b)
        .map(([, tc]) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        }));

      this.emit(AgentEvent.TOOL_USE, toolCalls);
      this.currentToolCallCount += toolCalls.length;

      this.addToHistory(
        openRouterTransformer.fromProviderMessage({
          ...assistantMessage,
          toolCalls,
        })
      );

      const toolResults = await this.handleToolCalls(toolCalls, options);
      for (const result of toolResults) {
        this.addToHistory(
          openRouterTransformer.toolResultEntry(result.toolCallId, result.content)
        );
      }

      yield* this.streamTurn(options);
    } else {
      this.addToHistory(
        openRouterTransformer.fromProviderMessage(assistantMessage)
      );
      this.emit(AgentEvent.DONE, { content: textContent }, this.lastTokenUsage);
      this.completeViz(textContent);
    }
  }

  private async handleToolCalls(
    toolCalls: Array<{
      id: string;
      type?: string;
      function?: { name: string; arguments: string };
    }>,
    options?: ExecuteOptions
  ): Promise<Array<{ toolCallId: string; content: string }>> {
    return Promise.all(
      toolCalls.map(async (toolCall) => {
        const toolName = toolCall.function?.name ?? "";
        const tool = this.tools.get(toolName);
        const toolCallId = toolCall.id;

        if (!toolCall.function || !tool) {
          const errorMessage = `Tool '${toolName}' not found`;
          this.emit(
            AgentEvent.TOOL_ERROR,
            new ToolExecutionError(
              errorMessage,
              toolName,
              toolCall.function?.arguments
            )
          );
          return { toolCallId, content: errorMessage };
        }

        try {
          const args = JSON.parse(toolCall.function.arguments || "{}");

          const result = await tool.execute(
            this.getId(),
            this.getName(),
            args as Record<string, unknown>,
            toolCallId,
            this.config.model,
            this.vendor,
            { signal: options?.signal }
          );

          return { toolCallId, content: JSON.stringify(result) };
        } catch (error: unknown) {
          const errorMessage = `Error executing tool '${toolName}': ${
            error instanceof Error ? error.message : "Unknown error"
          }`;

          if (this.debug) {
            console.error(errorMessage);
          }

          this.emit(
            AgentEvent.TOOL_ERROR,
            new ToolExecutionError(
              errorMessage,
              toolName,
              toolCall.function.arguments
            )
          );
          return { toolCallId, content: errorMessage };
        }
      })
    );
  }

  /**
   * Fold one API call's cost and routing facts into {@link lastGeneration}.
   * Cost is summed — a tool loop bills once per hop — while the id and model
   * describe the most recent call.
   */
  private recordGeneration(response: any): void {
    const cost = response?.usage?.cost;
    const previous = this.lastGeneration;

    this.lastGeneration = {
      id: response?.id ?? previous?.id,
      model: response?.model ?? previous?.model,
      cost:
        typeof cost === "number"
          ? (previous?.cost ?? 0) + cost
          : previous?.cost,
      isByok: response?.usage?.isByok ?? previous?.isByok,
      attempts: response?.openrouterMetadata?.attempt ?? previous?.attempts,
    };
  }

  protected parseUsage(response: unknown): TokenUsage {
    return this.parseUsageObject((response as { usage?: unknown })?.usage);
  }

  private parseUsageObject(usage: any): TokenUsage {
    return {
      input_tokens: usage?.promptTokens ?? 0,
      output_tokens: usage?.completionTokens ?? 0,
      total_tokens: usage?.totalTokens ?? 0,
      reasoning_tokens:
        usage?.completionTokensDetails?.reasoningTokens ?? undefined,
    };
  }

  private completeViz(textContent: string): void {
    if (!this.vizEventId) return;
    vizReporter.agentComplete(
      this.vizEventId,
      {
        input: this.lastTokenUsage?.input_tokens || 0,
        output: this.lastTokenUsage?.output_tokens || 0,
        total: this.lastTokenUsage?.total_tokens || 0,
      },
      "end_turn",
      this.currentToolCallCount > 0,
      this.currentToolCallCount,
      textContent
    );
    this.vizEventId = undefined;
  }
}

/**
 * Milliseconds to wait from a `Retry-After` header.
 *
 * RFC 9110 allows two forms — delay-seconds (`120`) and an HTTP-date
 * (`Wed, 21 Oct 2026 07:28:00 GMT`). OpenRouter sends the first; the second is
 * accepted because it is legal and cheap to support. A date already in the past
 * yields `0` rather than a negative wait.
 *
 * @returns The delay in milliseconds, or `undefined` when the header is absent
 *          or unparseable.
 */
export function parseRetryAfter(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;

  const seconds = Number(raw);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(raw);
  if (Number.isFinite(date)) {
    return Math.max(0, date - Date.now());
  }

  return undefined;
}

/**
 * The instant an `X-RateLimit-Reset` header points at.
 *
 * OpenRouter documents that the header exists but not what is in it, and the
 * three encodings in common use across APIs are indistinguishable by type — so
 * they are told apart by magnitude, taking "the answer is somewhere near now" as
 * the tiebreaker:
 *
 * - below `10^9` — a duration in seconds from now (a literal epoch would be
 *   before 2001, which no live API means)
 * - below `10^11` — Unix **seconds** (`10^11` seconds is the year 5138, so
 *   anything under it is a plausible timestamp and anything over it is not)
 * - otherwise — Unix **milliseconds**
 *
 * Returns `undefined` for a missing or non-finite value, so callers see "not
 * reported" rather than a date in 1970. Prefer
 * {@link RateLimitError.retryAfterMs} when both are present: it is unambiguous.
 */
export function parseResetAt(value: number | undefined): Date | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  if (value < 1e9) return new Date(Date.now() + value * 1000);
  if (value < 1e11) return new Date(value * 1000);
  return new Date(value);
}

/**
 * Shape of the `error` object OpenRouter embeds both in an HTTP error body and
 * in an SSE error chunk. `metadata.raw` is the upstream provider's own error,
 * JSON-encoded as a string — OpenRouter's own `message` is a generic wrapper
 * ("Provider returned error") that says nothing about what actually went
 * wrong.
 */
type OpenRouterErrorPayload = {
  message?: string;
  code?: number;
  metadata?: { raw?: string; provider_name?: string; [key: string]: unknown } | null;
};

/**
 * Parse an OpenRouter HTTP error body (`OpenRouterError.body`) down to its
 * `error` field. Returns `undefined` for a missing or non-JSON body rather
 * than throwing, since a malformed body is itself just something to fall back
 * from, not a reason to lose the original error.
 */
function parseOpenRouterErrorBody(body: string | undefined): OpenRouterErrorPayload | undefined {
  if (!body) return undefined;
  try {
    return JSON.parse(body)?.error;
  } catch {
    return undefined;
  }
}

/**
 * Best-effort extraction of the most specific message an OpenRouter error
 * payload carries, unwrapping `metadata.raw` when present. `raw` holds the
 * upstream provider's exact error text (e.g. OpenAI's own `{error: {message}}`
 * shape) — falls back to the payload's own `message`, then to `fallback`, so an
 * unfamiliar or non-JSON `raw` still yields something rather than throwing.
 */
function unwrapOpenRouterMessage(
  payload: OpenRouterErrorPayload | undefined,
  fallback: string
): string {
  const topMessage = payload?.message ?? fallback;
  const raw = payload?.metadata?.raw;
  if (typeof raw !== "string" || !raw) return topMessage;

  try {
    const parsedRaw = JSON.parse(raw);
    const upstreamMessage = parsedRaw?.error?.message ?? parsedRaw?.message;
    if (typeof upstreamMessage === "string" && upstreamMessage) return upstreamMessage;
  } catch {
    // Not JSON — some upstreams return plain text. Use it directly if short
    // enough to be a message rather than a stack trace or HTML error page.
    if (raw.length < 500) return raw;
  }
  return topMessage;
}
