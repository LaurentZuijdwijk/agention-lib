import OpenAI from "openai";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessage,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { Model } from "openai/resources/models";
import { BaseAgent, BaseAgentConfig, ModelInfo, TokenUsage } from "../BaseAgent";
import { AgentVendor } from "../AgentConfig";
import { AgentEvent } from "../AgentEvent";
import {
  ExecuteOptions,
  isAbortError,
  throwIfAborted,
} from "../cancellation";
import {
  AgentError,
  ApiError,
  ExecutionError,
  MaxTokensExceededError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History, MessageContent } from "../../history/History";
import { isThinkingContent } from "../../history/types";
import { chatCompletionsTransformer } from "../../history/transformers";
import { vizReporter } from "../../viz/VizReporter";
import { vizConfig } from "../../viz/VizConfig";

/**
 * A single chunk yielded by `executeStream()`.
 * - `"text"` — visible output token
 * - `"reasoning"` — internal reasoning token (`reasoning` on OpenRouter, `reasoning_content` on DeepSeek/llama.cpp)
 */
export type StreamChunk = {
  type: "text" | "reasoning";
  content: string;
};

export type OpenAICompatibleConfig = BaseAgentConfig & {
  /** Base URL of the OpenAI-compatible `/v1` endpoint (required) */
  baseURL: string;
  model?: string;
  maxTokens?: number;
};

/**
 * Abstract base class for agents that talk to any OpenAI-compatible
 * `/v1/chat/completions` endpoint (llama.cpp, vLLM, LM Studio, etc.).
 *
 * Subclasses must implement:
 * - `getVendorName()` — human-readable name used in error messages (e.g. `"llama.cpp"`)
 *
 * Subclasses may override:
 * - `buildExtraRequestParams()` — extra fields merged into the completions request
 */
export abstract class OpenAICompatibleAgent extends BaseAgent {
  protected client: OpenAI;
  protected config: Partial<OpenAICompatibleConfig>;

  private vizEventId?: string;
  private currentToolCallCount: number = 0;

  /**
   * The `id` of the most recently seen streamed `ChatCompletionChunk`
   * (`chatcmpl-...`). Internal only — some servers key control-plane calls
   * (e.g. llama.cpp's `/chat/completions/control`) off the in-flight
   * completion's id, so it needs to be captured somewhere subclasses can
   * reach it, but it isn't part of the public `StreamChunk` shape.
   */
  protected lastChunkId?: string;

  /**
   * Whether this server accepts a replayed `reasoning_content` field on an
   * assistant message. `undefined` until proven otherwise — see
   * {@link withReasoningReplayFallback}.
   */
  private reasoningReplaySupported?: boolean;

  constructor(
    config: OpenAICompatibleConfig & { vendor: AgentVendor },
    history?: History
  ) {
    super(config, history);

    this.client = new OpenAI({
      apiKey: config.apiKey || "not-needed",
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
    });

    this.config = {
      model: config.model,
      baseURL: config.baseURL,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      topP: config.topP,
      stopSequences: config.stopSequences,
      seed: config.seed,
      presencePenalty: config.presencePenalty,
      frequencyPenalty: config.frequencyPenalty,
      apiKey: config.apiKey,
    };

    this.addSystemMessage(this.getSystemMessage());
  }

  /** Human-readable vendor name used in error messages (e.g. `"llama.cpp"`). */
  protected abstract getVendorName(): string;

  /** Extra fields to merge into the chat completions request. Override for vendor-specific params. */
  protected buildExtraRequestParams(): Record<string, unknown> {
    return {};
  }

  /**
   * List the models available on the server via the `/v1/models` endpoint.
   *
   * Local servers vary in how much they fill in — llama.cpp reports little
   * beyond the id — so most fields other than `id` are typically undefined.
   */
  async listModels(): Promise<ModelInfo<Model>[]> {
    try {
      const page = await this.client.models.list();
      return page.data.map((model) => ({
        id: model.id,
        created: model.created ? new Date(model.created * 1000) : undefined,
        ownedBy: model.owned_by,
        raw: model,
      }));
    } catch (error: unknown) {
      throw new ExecutionError(
        `Failed to list ${this.getVendorName()} models: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  protected getToolDefinitions(): ChatCompletionTool[] {
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

  protected async process(_input: string): Promise<string> {
    return "";
  }

  async execute(
    input: string | MessageContent[],
    options?: ExecuteOptions
  ): Promise<string> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);
    this.resetTokenUsage();
    this.resetPartialTurn();
    this.currentToolCallCount = 0;

    const inputPreview =
      typeof input === "string" ? input : JSON.stringify(input);

    if (vizConfig.isEnabled()) {
      this.vizEventId = vizReporter.agentStart(
        this.id,
        this.name,
        this.config.model!,
        this.vendor,
        inputPreview
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

    try {
      const response = await this.callProvider(options);
      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response, options);
    } catch (error: unknown) {
      if (isAbortError(error, options?.signal)) {
        const abortError = this.abortError(error, options?.signal);
        if (this.vizEventId) {
          vizReporter.agentError(
            this.vizEventId,
            "AbortError",
            abortError.message,
            false
          );
          this.vizEventId = undefined;
        }
        throw abortError;
      }

      if (error instanceof OpenAI.APIError) {
        const apiError = new ApiError(
          `${this.getVendorName()} API error: ${error.message}`,
          error.status,
          error
        );
        this.emit(AgentEvent.ERROR, apiError);
        if (this.vizEventId) {
          vizReporter.agentError(
            this.vizEventId,
            "ApiError",
            apiError.message,
            error.status === 429
          );
          this.vizEventId = undefined;
        }
        throw apiError;
      }

      if (error instanceof AgentError) {
        this.emit(AgentEvent.ERROR, error);
        if (this.vizEventId) {
          vizReporter.agentError(
            this.vizEventId,
            error.constructor.name,
            error.message,
            false
          );
          this.vizEventId = undefined;
        }
        throw error;
      }

      const executionError = new ExecutionError(
        `${this.getVendorName()} error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit(AgentEvent.ERROR, executionError);
      if (this.vizEventId) {
        vizReporter.agentError(
          this.vizEventId,
          "ExecutionError",
          executionError.message,
          false
        );
        this.vizEventId = undefined;
      }
      throw executionError;
    } finally {
      this.history.endExecution();
    }
  }

  private async callProvider(
    options?: ExecuteOptions
  ): Promise<ChatCompletion> {
    const tools = this.tools.size > 0 ? this.getToolDefinitions() : undefined;

    this.startTurnTimer();

    return this.withReasoningReplayFallback((includeReasoning) =>
      this.client.chat.completions.create(
        {
          model: this.config.model!,
          messages: chatCompletionsTransformer.toProvider(
            this.history.getEntries(),
            { includeReasoning }
          ),
          tools,
          stream: false,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          top_p: this.config.topP,
          stop: this.config.stopSequences,
          seed: this.config.seed,
          presence_penalty: this.config.presencePenalty,
          frequency_penalty: this.config.frequencyPenalty,
          ...this.buildExtraRequestParams(),
        },
        { signal: options?.signal }
      )
    );
  }

  /**
   * Some OpenAI-compatible servers (Cerebras, at least as of 2026-08) reject
   * any message carrying `reasoning_content` with a plain 400 — no per-field
   * detail worth parsing, and other servers *require* the field (DeepSeek's
   * thinking mode), so it can't just be dropped unconditionally either.
   *
   * Runs `request` normally first. On a 400 that could plausibly be caused by
   * a replayed reasoning field, retries once with it stripped; if that
   * succeeds, remembers the result so every later call in this agent's
   * lifetime skips straight to the working shape instead of paying for the
   * failed attempt again. If the retry also fails, the original error is
   * what surfaces — it's more likely to point at the real problem.
   */
  private async withReasoningReplayFallback<T>(
    request: (includeReasoning: boolean) => Promise<T>
  ): Promise<T> {
    const includeReasoning = this.reasoningReplaySupported !== false;

    try {
      return await request(includeReasoning);
    } catch (error: unknown) {
      const worthRetrying =
        includeReasoning &&
        this.hasReplayableReasoning() &&
        error instanceof OpenAI.APIError &&
        error.status === 400;

      if (!worthRetrying) throw error;

      try {
        const result = await request(false);
        this.reasoningReplaySupported = false;
        return result;
      } catch {
        throw error;
      }
    }
  }

  /** Whether any assistant turn in history carries reasoning that would be replayed. */
  private hasReplayableReasoning(): boolean {
    return this.history
      .getEntries()
      .some(
        (entry) =>
          entry.role === "assistant" &&
          entry.content.some(
            (block) => isThinkingContent(block) && block.thinking.length > 0
          )
      );
  }

  protected async handleResponse(
    response: ChatCompletion,
    options?: ExecuteOptions
  ): Promise<string> {
    const usage = this.accumulateUsage(this.parseUsage(response));

    const choice = response.choices[0];
    const message = choice.message;

    if (choice.finish_reason === "length") {
      const error = new MaxTokensExceededError(
        "Response exceeded maximum token limit",
        this.config.maxTokens
      );
      this.emit(AgentEvent.MAX_TOKENS_EXCEEDED, error);
      this.emit(AgentEvent.ERROR, error);
      if (this.vizEventId) {
        vizReporter.agentError(
          this.vizEventId,
          "MaxTokensExceededError",
          error.message,
          false
        );
        this.vizEventId = undefined;
      }
      throw error;
    }

    const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;

    if (!hasToolCalls) {
      const textContent = message.content || "";

      const entry = chatCompletionsTransformer.fromProviderMessage(message);
      this.addToHistory(entry);

      this.emit(AgentEvent.DONE, message, usage);

      if (this.vizEventId) {
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

      return textContent;
    }

    const toolCalls = message.tool_calls!;

    // Stop before the assistant turn is written: nothing else would notice a
    // cancellation until the next provider call, and bailing out here avoids
    // both running the tools' side effects and leaving a tool call in history
    // with no tool message to answer it.
    throwIfAborted(options?.signal, `Execution of agent ${this.getName()}`);

    this.emit(AgentEvent.TOOL_USE, toolCalls);
    this.currentToolCallCount += toolCalls.length;

    const assistantEntry = chatCompletionsTransformer.fromProviderMessage(message);
    this.addToHistory(assistantEntry);

    const toolResults = await this.handleToolCalls(toolCalls, options);

    for (const result of toolResults) {
      const resultEntry = chatCompletionsTransformer.toolResultEntry(
        result.toolCallId,
        result.content
      );
      this.addToHistory(resultEntry);
    }

    try {
      const newResponse = await this.callProvider(options);
      this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
      return this.handleResponse(newResponse, options);
    } catch (error: unknown) {
      const executionError = new ExecutionError(
        `${this.getVendorName()} error during tool response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit(AgentEvent.ERROR, executionError);
      throw executionError;
    }
  }

  private async handleToolCalls(
    toolCalls: NonNullable<ChatCompletionMessage["tool_calls"]>,
    options?: ExecuteOptions
  ): Promise<Array<{ toolCallId: string; content: string }>> {
    return Promise.all(
      toolCalls.map(async (toolCall) => {
        const toolName =
          toolCall.type === "function" ? toolCall.function.name : "";
        const tool = this.tools.get(toolName);
        const toolCallId = toolCall.id;

        if (toolCall.type !== "function" || !tool) {
          const errorMessage = `Tool '${toolName}' not found`;
          const error = new ToolExecutionError(
            errorMessage,
            toolName,
            toolCall.type === "function"
              ? toolCall.function.arguments
              : undefined
          );
          this.emit(AgentEvent.TOOL_ERROR, error);
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

          const toolError = new ToolExecutionError(
            errorMessage,
            toolName,
            toolCall.function.arguments
          );
          this.emit(AgentEvent.TOOL_ERROR, toolError);
          return { toolCallId, content: errorMessage };
        }
      })
    );
  }

  /**
   * Stream a response as an async generator of `StreamChunk` objects.
   *
   * Yields `{ type: "text" }` for visible output and `{ type: "reasoning" }` for
   * internal reasoning tokens (models that expose `reasoning_content`, e.g. DeepSeek R1).
   * Tool calls are executed transparently — the generator continues streaming after
   * each tool-call round-trip.
   *
   * @example
   * ```typescript
   * for await (const chunk of agent.executeStream("Explain recursion")) {
   *   if (chunk.type === "text") process.stdout.write(chunk.content);
   * }
   * ```
   */
  async *executeStream(
    input: string | MessageContent[],
    options?: ExecuteOptions
  ): AsyncGenerator<StreamChunk> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);
    this.resetTokenUsage();
    this.resetPartialTurn();
    this.currentToolCallCount = 0;

    const inputPreview =
      typeof input === "string" ? input : JSON.stringify(input);

    if (vizConfig.isEnabled()) {
      this.vizEventId = vizReporter.agentStart(
        this.id,
        this.name,
        this.config.model!,
        this.vendor,
        inputPreview
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

    try {
      yield* this.streamTurn(options);
    } catch (error: unknown) {
      if (isAbortError(error, options?.signal)) {
        const abortError = this.abortError(error, options?.signal);
        if (this.vizEventId) {
          vizReporter.agentError(this.vizEventId, "AbortError", abortError.message, false);
          this.vizEventId = undefined;
        }
        throw this.withPartialTurn(abortError);
      }

      if (error instanceof OpenAI.APIError) {
        const apiError = new ApiError(
          `${this.getVendorName()} API error: ${error.message}`,
          error.status,
          error
        );
        this.emit(AgentEvent.ERROR, apiError);
        if (this.vizEventId) {
          vizReporter.agentError(this.vizEventId, "ApiError", apiError.message, error.status === 429);
          this.vizEventId = undefined;
        }
        throw this.withPartialTurn(apiError);
      }

      if (error instanceof AgentError) {
        this.emit(AgentEvent.ERROR, error);
        if (this.vizEventId) {
          vizReporter.agentError(this.vizEventId, error.constructor.name, error.message, false);
          this.vizEventId = undefined;
        }
        throw this.withPartialTurn(error);
      }

      const executionError = new ExecutionError(
        `${this.getVendorName()} error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit(AgentEvent.ERROR, executionError);
      if (this.vizEventId) {
        vizReporter.agentError(this.vizEventId, "ExecutionError", executionError.message, false);
        this.vizEventId = undefined;
      }
      throw this.withPartialTurn(executionError);
    } finally {
      this.history.endExecution();
    }
  }

  private async *streamTurn(
    options?: ExecuteOptions
  ): AsyncGenerator<StreamChunk> {
    const tools = this.tools.size > 0 ? this.getToolDefinitions() : undefined;

    this.startTurnTimer();

    const stream = await this.withReasoningReplayFallback((includeReasoning) =>
      this.client.chat.completions.create(
        {
          model: this.config.model!,
          messages: chatCompletionsTransformer.toProvider(
            this.history.getEntries(),
            { includeReasoning }
          ),
          tools,
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          top_p: this.config.topP,
          stop: this.config.stopSequences,
          seed: this.config.seed,
          presence_penalty: this.config.presencePenalty,
          frequency_penalty: this.config.frequencyPenalty,
          ...this.buildExtraRequestParams(),
        },
        { signal: options?.signal }
      )
    );

    let textContent = "";
    let reasoningContent = "";
    const toolCallAcc = new Map<number, { id: string; name: string; arguments: string }>();
    let finishReason: string | null = null;
    let streamUsage: ChatCompletionChunk["usage"] | undefined;

    // Set once this frame's assistant message reaches history. Until then the
    // turn exists only in the accumulators above, and the `finally` salvages
    // them — a reasoning trail can be twenty minutes of local compute, and the
    // stream throwing (or the consumer walking away) would otherwise drop it.
    let committed = false;
    let failure: unknown;

    try {
      for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
        // Usage can ride on any chunk: OpenAI sends it on a final choice-less
        // chunk, OpenRouter attaches it to the last content chunk (the one
        // carrying finish_reason). Keep the most recent and fold it in once the
        // stream ends — it is a running total for the turn, not a delta, so
        // taking the last one covers both layouts without double-counting.
        if (chunk.usage) streamUsage = chunk.usage;
        if (chunk.id) this.lastChunkId = chunk.id;

        if (chunk.choices.length === 0) continue;

        const choice = chunk.choices[0];
        finishReason = choice.finish_reason ?? finishReason;
        const delta = choice.delta;

        if (delta.content) {
          this.markFirstToken();
          textContent += delta.content;
          this.emit(AgentEvent.CHUNK, delta.content);
          yield { type: "text", content: delta.content };
        }

        // Reasoning tokens (not in OpenAI SDK types — cast required). Servers
        // disagree on the field name: OpenRouter sends `delta.reasoning`, while
        // DeepSeek/llama.cpp send `delta.reasoning_content`. Prefer `reasoning`;
        // never concatenate — that would duplicate the text if both were sent.
        const deltaExtras = delta as Record<string, unknown>;
        const reasoningDelta = (deltaExtras.reasoning ?? deltaExtras.reasoning_content) as string | null | undefined;
        if (reasoningDelta) {
          this.markFirstToken();
          // Accumulated as well as yielded: DeepSeek's thinking mode requires the
          // assistant turn's reasoning to be replayed on the next request, so it
          // has to reach history rather than only the caller.
          reasoningContent += reasoningDelta;
          this.emit(AgentEvent.REASONING_CHUNK, reasoningDelta);
          yield { type: "reasoning", content: reasoningDelta };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallAcc.has(tc.index)) {
              toolCallAcc.set(tc.index, { id: "", name: "", arguments: "" });
            }
            const acc = toolCallAcc.get(tc.index)!;
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name += tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          }
        }
      }

      // Before any early return below, so a turn that hits the token limit or
      // continues into a tool call still reports what it spent.
      if (streamUsage) this.accumulateStreamUsage(streamUsage);

      // The SDK's stream iterator swallows the abort and simply stops yielding,
      // so without this an interrupted stream would look like a short but
      // complete turn — writing partial text to history and emitting DONE.
      throwIfAborted(options?.signal, `Execution of agent ${this.getName()}`);

      if (finishReason === "length") {
        const error = new MaxTokensExceededError(
          "Response exceeded maximum token limit",
          this.config.maxTokens
        );
        this.emit(AgentEvent.MAX_TOKENS_EXCEEDED, error);
        this.emit(AgentEvent.ERROR, error);
        if (this.vizEventId) {
          vizReporter.agentError(this.vizEventId, "MaxTokensExceededError", error.message, false);
          this.vizEventId = undefined;
        }
        throw error;
      }

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

        const assistantEntry = chatCompletionsTransformer.fromProviderMessage({
          role: "assistant",
          content: textContent || null,
          tool_calls: toolCalls,
          reasoning_content: reasoningContent || null,
        });
        this.addToHistory(assistantEntry);
        committed = true;

        const toolResults = await this.handleToolCalls(toolCalls, options);
        for (const result of toolResults) {
          this.addToHistory(chatCompletionsTransformer.toolResultEntry(result.toolCallId, result.content));
        }

        yield* this.streamTurn(options);
      } else {
        const assistantEntry = chatCompletionsTransformer.fromProviderMessage({
          role: "assistant",
          content: textContent || null,
          reasoning_content: reasoningContent || null,
        });
        this.addToHistory(assistantEntry);
        committed = true;

        this.emit(AgentEvent.DONE, { content: textContent }, this.lastTokenUsage);

        if (this.vizEventId) {
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
    } catch (error: unknown) {
      failure = error;
      throw error;
    } finally {
      if (!committed) {
        this.capturePartialTurn({
          text: textContent,
          reasoning: reasoningContent,
          toolCalls: Array.from(toolCallAcc.entries())
            .sort(([a], [b]) => a - b)
            .map(([, tc]) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            })),
          reason: this.partialTurnReason(failure, options?.signal),
          error: failure,
        });
      }
    }
  }

  private accumulateStreamUsage(usage: ChatCompletionChunk["usage"]): void {
    if (!usage) return;
    this.accumulateUsage({
      input_tokens: usage.prompt_tokens ?? 0,
      output_tokens: usage.completion_tokens ?? 0,
      total_tokens: usage.total_tokens ?? 0,
      reasoning_tokens: extractReasoningTokens(usage),
    });
  }

  protected parseUsage(response: ChatCompletion): TokenUsage {
    const usage = response.usage;
    return {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
      reasoning_tokens: extractReasoningTokens(usage),
      ...extractServerTimings(response),
    };
  }
}

/**
 * Reasoning token count from `completion_tokens_details`, which reasoning
 * models (and OpenAI-compatible proxies fronting them) fill in.
 */
function extractReasoningTokens(usage: unknown): number | undefined {
  const details = (usage as { completion_tokens_details?: unknown })
    ?.completion_tokens_details as { reasoning_tokens?: number } | undefined;
  return details?.reasoning_tokens;
}

/**
 * Timings reported by llama.cpp's `llama-server`, which adds a non-standard
 * `timings` object to its chat completion responses. Absent on every other
 * OpenAI-compatible server, in which case the durations are measured locally.
 */
function extractServerTimings(response: unknown): Partial<TokenUsage> {
  const timings = (response as { timings?: unknown })?.timings as
    | { prompt_ms?: number; predicted_ms?: number }
    | undefined;
  if (!timings) return {};

  const { prompt_ms, predicted_ms } = timings;
  const totalMs =
    prompt_ms === undefined && predicted_ms === undefined
      ? undefined
      : (prompt_ms ?? 0) + (predicted_ms ?? 0);

  return {
    timeToFirstTokenMs: prompt_ms,
    generationMs: predicted_ms,
    totalMs,
  };
}
