import OpenAI from "openai";
import { BaseAgent, BaseAgentConfig, ModelInfo, TokenUsage } from "../BaseAgent";
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
import { openAiTransformer } from "../../history/transformers";
import { type BuiltInTool } from "../../tools/BuiltInTool";
import {
  Tool,
  Response,
  ResponseCompletedEvent,
  ResponseFunctionToolCall,
  ResponseStreamEvent,
  ResponseUsage,
} from "openai/resources/responses/responses";
import { vizReporter } from "../../viz/VizReporter";
import { vizConfig } from "../../viz/VizConfig";
import type { Reasoning } from "openai/resources/shared";
import type { Model as OpenAIModelCard } from "openai/resources/models";
import {
  OPENAI_REASONING_SUPPORT,
  OpenAIModel,
  ReasoningEffort,
  ReasoningEffortFor,
} from "../model-types";
import { StreamChunk } from "../openai-compatible/OpenAICompatibleAgent";
import { canUseStrictSchema } from "./openai-strict";

type AgentConfig<M extends OpenAIModel = OpenAIModel> = BaseAgentConfig & {
  apiKey: string;
  model?: M;
  maxTokens?: number;
  // Backward compatibility: vendor-specific at top level (deprecated)
  disableParallelToolUse?: boolean;
  /**
   * Ask for the least reasoning the configured model supports (e.g. `minimal` on
   * `gpt-5-nano`, `none` on `gpt-5.6`). Takes precedence over `reasoningEffort`.
   * No effect on models without reasoning support.
   */
  disableReasoning?: boolean;
  /**
   * How hard the model should think. Narrowed to the values the configured
   * `model` actually accepts — `reasoningEffort: "none"` is a type error on
   * `gpt-5-nano`, which takes `minimal` instead.
   */
  reasoningEffort?: ReasoningEffortFor<M>;
  user?: string;
  /**
   * Provider-defined / server-side tools (e.g. web search, file search, code
   * interpreter). These run on OpenAI's infrastructure rather than locally.
   * @see lib/tools/BuiltInTool.ts
   */
  builtInTools?: BuiltInTool[];
};

/**
 * Lowest `reasoning.effort` the given model accepts, used to resolve
 * `disableReasoning`. Returns `undefined` when the model has no reasoning to turn
 * off, in which case the caller omits `reasoning` entirely rather than risk a 400
 * — non-reasoning models such as `gpt-4.1-mini` reject the parameter outright.
 *
 * There is no single "off" value, and `effort: null` is not one either: it means
 * *unset*, so the model falls back to its own default (`medium` on every family
 * released before `gpt-5.1`).
 *
 * Reads {@link OPENAI_REASONING_SUPPORT}, the same table {@link ReasoningEffortFor}
 * is derived from, so the compile-time and runtime views cannot disagree. Models
 * missing from it — including newer families — return `undefined`; set
 * `reasoningEffort` explicitly to override.
 */
export function lowestReasoningEffort(
  model: string | undefined
): ReasoningEffort | undefined {
  if (!model) return undefined;

  // Snapshot ids (`gpt-5-nano-2025-08-07`) share their alias's support set.
  const base = model.replace(/-20\d{2}-\d{2}-\d{2}$/, "");

  const group = OPENAI_REASONING_SUPPORT.find((entry) =>
    (entry.models as readonly string[]).includes(base)
  );

  return group?.efforts[0];
}

/**
 * Agent for OpenAI models using the Responses API.
 *
 * @example
 * ```typescript
 * const agent = new OpenAiAgent({
 *   id: "1",
 *   name: "Assistant",
 *   description: "A helpful assistant",
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 *
 * const response = await agent.execute("Hello!");
 * ```
 */
export class OpenAiAgent<M extends OpenAIModel = OpenAIModel> extends BaseAgent {
  private client: OpenAI;
  /**
   * Resolved runtime config. Deliberately not narrowed by `M` — the constructor
   * fills in defaults and merges `vendorConfig`, whose values are not
   * model-scoped. Narrowing happens on the constructor's parameter, where the
   * caller's model is known.
   */
  protected config: Partial<AgentConfig>;

  /** Current visualization event ID for tracking */
  private vizEventId?: string;

  /** Count of tool calls in current execution */
  private currentToolCallCount: number = 0;

  constructor(config: Omit<AgentConfig<M>, "vendor">, history?: History) {
    super({ ...config, vendor: "openai" }, history);

    this.client = new OpenAI({
      apiKey: config.apiKey,
      defaultHeaders: config.defaultHeaders,
    });

    // Merge flat config (deprecated) with nested vendorConfig
    // Flat config takes precedence for backward compatibility
    const vendorConfig = config.vendorConfig?.openai || {};
    const disableParallelToolUse =
      config.disableParallelToolUse ??
      vendorConfig.disableParallelToolUse ??
      false;
    const disableReasoning =
      config.disableReasoning ?? vendorConfig.disableReasoning ?? false;
    const reasoningEffort =
      config.reasoningEffort ?? vendorConfig.reasoningEffort;
    const user = config.user ?? vendorConfig.user;
    const builtInTools = config.builtInTools ?? vendorConfig.builtInTools;

    this.config = {
      model: config.model || "gpt-4.1-mini",
      // No default. `max_output_tokens` is optional on the Responses API, and
      // omitting it lets the model use its full output budget. A default here
      // silently truncated every response — and on reasoning models it was
      // worse than a truncation, since reasoning tokens count against the same
      // budget: a small cap could be spent entirely on thinking, returning
      // `status: "incomplete"` with no text at all.
      maxTokens: config.maxTokens,
      disableParallelToolUse,
      disableReasoning,
      reasoningEffort,
      user,
      builtInTools,
      apiKey: config.apiKey,
      temperature: config.temperature,
      topP: config.topP,
      seed: config.seed,
      presencePenalty: config.presencePenalty,
      frequencyPenalty: config.frequencyPenalty,
      stopSequences: config.stopSequences,
    };

    // Add system message to history (skips if already exists with same content)
    this.addSystemMessage(this.getSystemMessage());
  }

  /**
   * List the models available to this API key.
   *
   * The list covers everything the key can reach — chat, embedding, audio and
   * image models alike — so filter by `id` if you only want the ones this
   * agent can drive.
   */
  async listModels(): Promise<ModelInfo<OpenAIModelCard>[]> {
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
        `Failed to list OpenAI models: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  protected getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values()).map((tool) => {
      const prompt = tool.getPrompt();

      const parameters = {
        type: prompt.input_schema.type,
        properties: prompt.input_schema.properties,
        required: prompt.input_schema.required,
        additionalProperties: false,
      };

      return {
        type: "function",
        name: prompt.name,
        description: prompt.description,
        parameters,
        // Per tool, not unconditional: strict mode requires `required` to name
        // every property, so one optional parameter would 400 the whole request
        strict: canUseStrictSchema(parameters),
      };
    });
  }

  /**
   * Combine locally-executed tool definitions with provider-defined
   * (server-side) built-in tools, in the shape the Responses API expects.
   * Cast to `Tool[]`: built-in tool objects (e.g. `{ type: "web_search" }`)
   * don't fit the SDK's `Tool` union, which only names `function` tools plus
   * the specific built-ins it has typed — the same passthrough `ClaudeAgent`
   * uses for its own `ToolUnion[]`.
   */
  protected getAllToolDefinitions(): Tool[] {
    return [
      ...this.getToolDefinitions(),
      ...(this.config.builtInTools ?? []),
    ] as Tool[];
  }

  /**
   * Build the `reasoning` field for a Responses API request, as an object to
   * spread into the request params.
   *
   * `disableReasoning` takes precedence over `reasoningEffort` and resolves to the
   * lowest effort the configured model accepts (see {@link lowestReasoningEffort}).
   * The field is omitted entirely when neither option applies — `reasoning: {}` is
   * not the same as omitting it, and non-reasoning models reject the parameter.
   *
   * All three request sites go through here: they were copies of the same
   * expression, and one drifted into overwriting the disable case with an
   * unconditional `reasoning` key.
   *
   * @param summary Pass `"auto"` for streaming requests — the Responses API only
   * emits `response.reasoning_summary_text.delta` events when it is set.
   */
  private buildReasoningParams(summary?: "auto"): { reasoning?: Reasoning } {
    const effort = this.config.disableReasoning
      ? lowestReasoningEffort(this.config.model)
      : this.config.reasoningEffort;

    if (!effort) return {};

    return {
      reasoning: {
        // The Responses API accepts "max" (verified on gpt-5.6), but the installed
        // SDK's ReasoningEffort union predates it — cast at this one boundary.
        effort: effort as Reasoning["effort"],
        ...(summary ? { summary } : {}),
      },
    };
  }

  protected async process(_input: string): Promise<string> {
    return "";
  }

  async execute(
    input: string | MessageContent[],
    options?: ExecuteOptions
  ): Promise<string> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);

    // Reset token usage for this execution
    this.resetTokenUsage();
    this.resetPartialTurn();
    this.currentToolCallCount = 0;

    const inputPreview =
      typeof input === "string" ? input : JSON.stringify(input);

    // Start visualization reporting
    if (vizConfig.isEnabled()) {
      this.vizEventId = vizReporter.agentStart(
        this.id,
        this.name,
        this.config.model!,
        "openai",
        inputPreview
      );
    }

    if (this.history.transient) {
      this.history.clear();
      // Re-add system message after clear
      this.addSystemMessage(this.getSystemMessage());
    }

    if (typeof input === "string") {
      this.addTextToHistory("user", input);
    } else {
      this.addMessageToHistory("user", input);
    }

    // Mark session boundary so transform plugins (e.g. toolResultMaskingPlugin)
    // don't mask tool results produced within this execute() loop.
    this.history.setSessionAnchor();
    // Suspend auto-trimming so tool_use / tool_result pairs are never split
    // mid-loop. endExecution() in the finally block enforces limits once.
    this.history.beginExecution();

    try {
      const inputMessages = openAiTransformer.toProvider(this.history.getEntries());

      this.startTurnTimer();
      const response = await this.client.responses.create(
        {
          model: this.config.model!,
          max_output_tokens: this.config.maxTokens,
          input: inputMessages,
          tools: this.getAllToolDefinitions(),
          store: false,
          temperature: this.config.temperature,
          top_p: this.config.topP,
          // Note: Responses API doesn't support seed, presence_penalty, frequency_penalty, stop
          user: this.config.user,
          ...this.buildReasoningParams(),
        },
        { signal: options?.signal }
      );

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

      if (error && typeof error === "object" && "error" in error) {
        const openAIError = error as {
          error: { message?: string; code?: string };
          status?: number;
        };
        const apiError = new ApiError(
          `OpenAI API error: ${openAIError.error.message || "Unknown error"}`,
          openAIError.status,
          openAIError.error
        );

        if (openAIError.error.code === "insufficient_quota") {
          apiError.message =
            "OpenAI API quota exceeded. Please check your billing details.";
        }

        this.emit(AgentEvent.ERROR, apiError);

        // Report error to viz
        if (this.vizEventId) {
          vizReporter.agentError(
            this.vizEventId,
            "ApiError",
            apiError.message,
            openAIError.error.code === "rate_limit_exceeded"
          );
          this.vizEventId = undefined;
        }

        throw apiError;
      } else {
        const executionError = new ExecutionError(
          `Error executing agent: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        this.emit(AgentEvent.ERROR, executionError);

        // Report error to viz
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
      }
    } finally {
      this.history.endExecution();
    }
  }

  protected async handleResponse(
    response: Response,
    options?: ExecuteOptions
  ): Promise<string> {
    if (!response.output || !response.output.length) {
      const error = new ExecutionError(
        "Invalid response format: missing output"
      );
      this.emit(AgentEvent.ERROR, error);
      throw error;
    }

    // Track token usage if available
    if (response.usage) {
      this.accumulateUsage(this.parseUsage(response.usage));
    }

    const toolCalls = response.output.filter(
      (output: any) => output.type === "function_call"
    ) as unknown as ResponseFunctionToolCall[];

    // Find the message output (skip reasoning outputs)
    const messageOutput = response.output.find(
      (output: any) => output.type === "message"
    );

    // Handle incomplete responses (e.g., reasoning hit token limit)
    if (
      !toolCalls.length &&
      messageOutput &&
      messageOutput.type === "message" &&
      messageOutput.status === "incomplete"
    ) {
      const error = new ExecutionError(
        `Response incomplete: ${
          response.incomplete_details?.reason || "unknown reason"
        }. ` +
          `Try increasing maxTokens or setting disableReasoning: true for this agent.`
      );
      this.emit(AgentEvent.ERROR, error);

      // Report error to viz
      if (this.vizEventId) {
        vizReporter.agentError(
          this.vizEventId,
          "ExecutionError",
          error.message,
          false
        );
        this.vizEventId = undefined;
      }

      throw error;
    }

    if (
      !toolCalls.length &&
      messageOutput &&
      messageOutput.type === "message" &&
      messageOutput.status === "completed"
    ) {
      // Normal text response - add to history in normalized format
      const entry = openAiTransformer.fromProviderMessage(
        "assistant",
        response.output_text
      );
      this.addToHistory(entry);

      this.emit(AgentEvent.DONE, response, this.lastTokenUsage);

      // Report completion to viz
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
          response.output_text
        );
        this.vizEventId = undefined;
      }

      return response.output_text;
    } else if (toolCalls.length) {
      try {
        // Stop before the assistant turn is written: nothing else would notice
        // a cancellation until the next provider call, and bailing out here
        // avoids both running the tools' side effects and leaving a function
        // call in history with no output to answer it.
        throwIfAborted(options?.signal, `Execution of agent ${this.getName()}`);

        // Add assistant message with tool calls to history (normalized)
        const functionCalls = toolCalls.map((tc) => ({
          id: tc.id || tc.call_id,
          call_id: tc.call_id,
          name: tc.name,
          arguments: tc.arguments,
        }));

        const assistantEntry = openAiTransformer.fromProviderMessage(
          "assistant",
          response.output_text || "",
          functionCalls
        );
        this.addToHistory(assistantEntry);

        const toolResponses = await this.handleToolUse(toolCalls, options);

        // Add tool results to history (normalized)
        for (const result of toolResponses) {
          const resultEntry = openAiTransformer.toolResultEntry(
            result.call_id,
            result.output,
            false
          );
          this.addToHistory(resultEntry);
        }

        // Continue conversation
        try {
          const inputMessages = openAiTransformer.toProvider(
            this.history.getEntries()
          );

          this.startTurnTimer();
          const newResponse = await this.client.responses.create(
            {
              model: this.config.model!,
              max_output_tokens: this.config.maxTokens,
              input: inputMessages,
              tools: this.getAllToolDefinitions(),
              store: false,
              temperature: this.config.temperature,
              top_p: this.config.topP,
              // Note: Responses API doesn't support seed, presence_penalty, frequency_penalty, stop
              user: this.config.user,
              ...this.buildReasoningParams(),
            },
            { signal: options?.signal }
          );

          this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
          return this.handleResponse(newResponse, options);
        } catch (error: unknown) {
          if (error && typeof error === "object" && "error" in error) {
            const openAIError = error as {
              error: { message?: string };
              status?: number;
            };
            const apiError = new ApiError(
              `OpenAI API error during tool response: ${
                openAIError.error.message || "Unknown error"
              }`,
              openAIError.status,
              openAIError.error
            );
            this.emit(AgentEvent.ERROR, apiError);
            throw apiError;
          } else {
            throw new ExecutionError(
              `Error processing tool response: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        }
      } catch (error: unknown) {
        if (this.debug) {
          console.error(error);
        }
        if (error instanceof ToolExecutionError) {
          this.emit(AgentEvent.TOOL_ERROR, error);
          throw error;
        }
        const executionError = new ExecutionError(
          `Error during tool execution: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        this.emit(AgentEvent.ERROR, executionError);
        throw executionError;
      }
    } else {
      const error = new ExecutionError(
        `Unexpected response format: ${JSON.stringify(response.output)}`
      );
      this.emit(AgentEvent.ERROR, error);

      // Report error to viz
      if (this.vizEventId) {
        vizReporter.agentError(
          this.vizEventId,
          "ExecutionError",
          error.message,
          false
        );
        this.vizEventId = undefined;
      }

      throw error;
    }
  }

  private async handleToolUse(
    content: ResponseFunctionToolCall[],
    options?: ExecuteOptions
  ): Promise<Array<{ call_id: string; output: string }>> {
    if (!content || !content.length) {
      throw new ExecutionError("Invalid tool calls content");
    }

    // Track tool call count for viz reporting
    this.currentToolCallCount += content.length;

    const toolResults = await Promise.all(
      content.map(async (toolCall) => {
        if (!toolCall.name) {
          throw new ExecutionError("Invalid tool call format");
        }

        const toolName = toolCall.name;
        const tool = this.tools.get(toolName);

        if (!tool) {
          const errorMessage = `Tool '${toolName}' not found`;
          const error = new ToolExecutionError(
            errorMessage,
            toolName,
            toolCall.arguments
          );

          if (this.debug) {
            console.error(error);
          }

          return {
            call_id: toolCall.call_id,
            output: errorMessage,
          };
        }

        try {
          let toolArgs: Record<string, unknown>;
          try {
            toolArgs = JSON.parse(toolCall.arguments);
          } catch (parseError: unknown) {
            throw new ToolExecutionError(
              `Invalid tool arguments: ${
                parseError instanceof Error ? parseError.message : "Parse error"
              }`,
              toolName,
              toolCall.arguments
            );
          }

          const result = await tool.execute(
            this.getId(),
            this.getName(),
            toolArgs,
            toolCall.id || "",
            this.config.model,
            "openai",
            { signal: options?.signal }
          );

          return {
            call_id: toolCall.call_id,
            output: JSON.stringify(result),
          };
        } catch (error: unknown) {
          const errorMessage = `Error executing tool '${toolName}': ${
            error instanceof Error ? error.message : "Unknown error"
          }`;

          const toolError = new ToolExecutionError(
            errorMessage,
            toolName,
            toolCall.arguments
          );

          this.emit(AgentEvent.TOOL_ERROR, toolError);

          if (this.debug) {
            console.error(toolError);
          }

          return {
            call_id: toolCall.call_id,
            output: errorMessage,
          };
        }
      })
    );

    return toolResults;
  }

  /**
   * Stream a response as an async generator of `StreamChunk` objects.
   * Yields `{ type: "text" }` for visible output and `{ type: "reasoning" }` for
   * reasoning summary tokens (o-series models). Tool calls are handled transparently.
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
        "openai",
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
      if (error instanceof AgentError) {
        this.emit(AgentEvent.ERROR, error);
        if (this.vizEventId) {
          vizReporter.agentError(this.vizEventId, error.constructor.name, error.message, false);
          this.vizEventId = undefined;
        }
        throw this.withPartialTurn(error);
      }
      if (error && typeof error === "object" && "error" in error) {
        const openAIError = error as { error: { message?: string; code?: string }; status?: number };
        const apiError = new ApiError(
          `OpenAI API error: ${openAIError.error.message || "Unknown error"}`,
          openAIError.status,
          openAIError.error
        );
        this.emit(AgentEvent.ERROR, apiError);
        if (this.vizEventId) {
          vizReporter.agentError(this.vizEventId, "ApiError", apiError.message, openAIError.error.code === "rate_limit_exceeded");
          this.vizEventId = undefined;
        }
        throw this.withPartialTurn(apiError);
      }
      const executionError = new ExecutionError(
        `OpenAI error: ${error instanceof Error ? error.message : "Unknown error"}`
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
    const inputMessages = openAiTransformer.toProvider(this.history.getEntries());

    this.startTurnTimer();
    const stream = await this.client.responses.create(
      {
        model: this.config.model!,
        max_output_tokens: this.config.maxTokens,
        input: inputMessages,
        tools: this.getAllToolDefinitions(),
        store: false,
        stream: true,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        user: this.config.user,
        ...this.buildReasoningParams("auto"),
      },
      { signal: options?.signal }
    ) as AsyncIterable<ResponseStreamEvent>;

    let completedEvent: ResponseCompletedEvent | null = null;

    // The Responses API builds the committed turn out of `response.completed`,
    // which only arrives on success, so the deltas are mirrored here as well:
    // without them a stream that dies mid-flight leaves nothing behind at all,
    // and a reasoning summary can be minutes of generation.
    let textDelta = "";
    let reasoningDelta = "";
    const partialCalls = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    // Set once this frame's assistant message reaches history.
    let committed = false;
    let failure: unknown;

    try {

      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          this.markFirstToken();
          // Accumulated as well as yielded purely so the `finally` below can hand
          // it back if the stream dies: the committed turn is rebuilt from
          // `response.completed`, which never arrives on a failure.
          textDelta += event.delta;
          this.emit(AgentEvent.CHUNK, event.delta);
          yield { type: "text", content: event.delta };
        }
        if (event.type === "response.reasoning_summary_text.delta") {
          this.markFirstToken();
          reasoningDelta += event.delta;
          this.emit(AgentEvent.REASONING_CHUNK, event.delta);
          yield { type: "reasoning", content: event.delta };
        }
        if (event.type === "response.output_item.added") {
          const item = event.item as {
            type?: string;
            id?: string;
            call_id?: string;
            name?: string;
          };
          if (item.type === "function_call") {
            partialCalls.set(event.output_index, {
              id: item.call_id || item.id || "",
              name: item.name ?? "",
              arguments: "",
            });
          }
        }
        if (event.type === "response.function_call_arguments.delta") {
          const acc = partialCalls.get(event.output_index);
          if (acc) acc.arguments += event.delta;
        }
        if (event.type === "response.completed") {
          completedEvent = event;
          if (event.response.usage) {
            this.accumulateUsage(this.parseUsage(event.response.usage));
          }
        }
        if (event.type === "response.incomplete") {
          throw new MaxTokensExceededError(
            "Response incomplete: max tokens reached",
            this.config.maxTokens
          );
        }
      }

      // The SDK's stream iterator swallows the abort and simply stops yielding.
      // Without this the turn would fail as a malformed stream instead of a
      // cancellation — checked here so the tokens already spent are reported.
      throwIfAborted(options?.signal, `Execution of agent ${this.getName()}`);

      if (!completedEvent) {
        throw new ExecutionError("OpenAI stream ended without a completed event");
      }

      const response = completedEvent.response;
      const toolCalls = response.output.filter(
        (o: any) => o.type === "function_call"
      ) as unknown as ResponseFunctionToolCall[];

      if (toolCalls.length > 0) {
        // As in handleResponse(): bail out before the assistant turn is written,
        // so a cancelled run leaves no unanswered function call in history.
        throwIfAborted(options?.signal, `Execution of agent ${this.getName()}`);

        this.emit(AgentEvent.TOOL_USE, toolCalls);
        this.currentToolCallCount += toolCalls.length;

        const functionCalls = toolCalls.map((tc) => ({
          id: tc.id || tc.call_id,
          call_id: tc.call_id,
          name: tc.name,
          arguments: tc.arguments,
        }));
        const assistantEntry = openAiTransformer.fromProviderMessage(
          "assistant",
          response.output_text || "",
          functionCalls
        );
        this.addToHistory(assistantEntry);
        committed = true;

        const toolResults = await this.handleToolUse(toolCalls, options);
        for (const result of toolResults) {
          this.addToHistory(openAiTransformer.toolResultEntry(result.call_id, result.output, false));
        }

        yield* this.streamTurn(options);
      } else {
        const textContent = response.output_text || "";
        const entry = openAiTransformer.fromProviderMessage("assistant", textContent);
        this.addToHistory(entry);
        committed = true;

        this.emit(AgentEvent.DONE, response, this.lastTokenUsage);

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
          text: textDelta,
          reasoning: reasoningDelta,
          toolCalls: Array.from(partialCalls.entries())
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

  protected parseUsage(input: ResponseUsage): TokenUsage {
    return {
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      total_tokens: input.total_tokens,
      // Reasoning tokens are already counted inside `output_tokens`.
      reasoning_tokens: input.output_tokens_details?.reasoning_tokens,
    };
  }
}
