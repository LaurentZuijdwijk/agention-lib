import { Mistral } from "@mistralai/mistralai";
import { HTTPClient } from "@mistralai/mistralai/lib/http";

import { BaseAgent, BaseAgentConfig, ModelInfo, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import {
  ExecuteOptions,
  isAbortError,
  throwIfAborted,
} from "../cancellation";
import {
  ApiError,
  ExecutionError,
  MaxTokensExceededError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History, MessageContent } from "../../history/History";
import { mistralTransformer } from "../../history/transformers";
import {
  ChatCompletionResponse,
  ModelList,
  TextChunk,
  Tool,
  ToolCall,
  ToolTypes,
  UsageInfo,
} from "@mistralai/mistralai/models/components";
import { setTimeout } from "timers/promises";
import { vizReporter } from "../../viz/VizReporter";
import { vizConfig } from "../../viz/VizConfig";
import { MistralModel } from "../model-types";

/**
 * One entry from Mistral's `/v1/models` response — a base model card or a
 * fine-tuned one. Derived from the SDK's `ModelList` rather than imported
 * directly, since the SDK exports the union under the unhelpful name `Data`.
 */
export type MistralModelCard = NonNullable<ModelList["data"]>[number];

type AgentConfig = BaseAgentConfig & {
  apiKey: string;
  model?: MistralModel;
  maxTokens?: number;
  // Backward compatibility: vendor-specific at top level (deprecated)
  disableParallelToolUse?: boolean;
  safePrompt?: boolean;
  randomSeed?: number;
  rateLimitDelay?: number;
};

/**
 * Agent for Mistral models.
 *
 * @example
 * ```typescript
 * const agent = new MistralAgent({
 *   id: "1",
 *   name: "Assistant",
 *   description: "A helpful assistant",
 *   apiKey: process.env.MISTRAL_API_KEY,
 * });
 *
 * const response = await agent.execute("Hello!");
 * ```
 */
/**
 * Build a `beforeRequest` hook that adds custom headers to every request.
 *
 * The Mistral SDK has no `defaultHeaders` option like the Anthropic and OpenAI
 * clients, so headers are injected at the HTTP layer instead. They overwrite
 * headers the SDK already set, so that `defaultHeaders` means the same thing on
 * every provider — see `CommonAgentConfig.defaultHeaders`. Verified against the
 * OpenAI SDK on the wire: its `defaultHeaders` win over the client's own auth.
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

export class MistralAgent extends BaseAgent {
  private client: Mistral;
  protected config: Partial<AgentConfig>;

  /** Current visualization event ID for tracking */
  private vizEventId?: string;

  /** Count of tool calls in current execution */
  private currentToolCallCount: number = 0;

  constructor(config: Omit<AgentConfig, "vendor">, history?: History) {
    super({ ...config, vendor: "mistral" }, history);
    const httpClient = new HTTPClient();
    if (config.defaultHeaders) {
      httpClient.addHook(
        "beforeRequest",
        defaultHeadersHook(config.defaultHeaders)
      );
    }
    this.client = new Mistral({
      apiKey: config.apiKey,
      httpClient,
    });

    // Merge flat config (deprecated) with nested vendorConfig
    // Flat config takes precedence for backward compatibility
    const vendorConfig = config.vendorConfig?.mistral || {};
    const disableParallelToolUse =
      config.disableParallelToolUse ??
      vendorConfig.disableParallelToolUse ??
      false;
    const safePrompt = config.safePrompt ?? vendorConfig.safePrompt;
    const randomSeed =
      config.randomSeed ?? vendorConfig.randomSeed ?? config.seed;
    const rateLimitDelay =
      config.rateLimitDelay ?? vendorConfig.rateLimitDelay ?? 1500;

    this.config = {
      model: config.model || "mistral-small-latest",
      maxTokens: config.maxTokens || 1024,
      disableParallelToolUse,
      safePrompt,
      randomSeed,
      rateLimitDelay,
      apiKey: config.apiKey,
      temperature: config.temperature,
      topP: config.topP,
      stopSequences: config.stopSequences,
    };

    // Add system message to history (skips if already exists with same content)
    this.addSystemMessage(this.getSystemMessage());
  }

  /**
   * List the models available to this API key, base and fine-tuned alike.
   *
   * Mistral is the most forthcoming of the providers: it reports a context
   * window, a full capability set, and a retirement date with a replacement
   * model. All of that is mapped onto the neutral fields.
   *
   * Note that `raw` here is the SDK's parsed view, not the wire response — the
   * Mistral SDK validates against a schema that drops fields it does not know,
   * so capabilities the API has added since the installed SDK version (as of
   * `1.13.0`: `reasoning`, the audio flags) are gone before this code sees
   * them. Every other agent's `raw` is the untouched response.
   */
  async listModels(): Promise<ModelInfo<MistralModelCard>[]> {
    try {
      const response = await this.client.models.list();
      return (response.data ?? []).map((model) => ({
        id: model.id,
        displayName: model.name ?? undefined,
        created: model.created ? new Date(model.created * 1000) : undefined,
        ownedBy: model.ownedBy,
        contextLength: model.maxContextLength,
        capabilities: {
          chat: model.capabilities.completionChat,
          tools: model.capabilities.functionCalling,
          vision: model.capabilities.vision,
        },
        deprecatedAt: model.deprecation ?? undefined,
        replacedBy: model.deprecationReplacementModel ?? undefined,
        raw: model,
      }));
    } catch (error: unknown) {
      throw new ExecutionError(
        `Failed to list Mistral models: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  protected getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: ToolTypes.Function,
      function: {
        name: tool.getPrompt().name,
        description: tool.getPrompt().description,
        parameters: tool.getPrompt().input_schema,
      },
    }));
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
    this.currentToolCallCount = 0;

    const inputPreview =
      typeof input === "string" ? input : JSON.stringify(input);

    // Start visualization reporting
    if (vizConfig.isEnabled()) {
      this.vizEventId = vizReporter.agentStart(
        this.id,
        this.name,
        this.config.model!,
        "mistral",
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
      const messages = mistralTransformer.toProvider(this.history.getEntries());
      this.startTurnTimer();
      const response = await this.client.chat.complete(
        {
          model: this.config.model!,
          messages: messages as Parameters<
            typeof this.client.chat.complete
          >[0]["messages"],
          tools: this.getToolDefinitions(),
          temperature: this.config.temperature,
          topP: this.config.topP,
          maxTokens: this.config.maxTokens,
          randomSeed: this.config.randomSeed,
          safePrompt: this.config.safePrompt,
          stop: this.config.stopSequences,
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

      const err = error as { status?: number; message?: string };
      if (err.status) {
        const apiError = new ApiError(
          `Mistral API error: ${err.message || "Unknown error"}`,
          err.status,
          error
        );
        this.emit(AgentEvent.ERROR, apiError);

        // Report error to viz
        if (this.vizEventId) {
          vizReporter.agentError(
            this.vizEventId,
            "ApiError",
            apiError.message,
            err.status === 429
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
    response: ChatCompletionResponse,
    options?: ExecuteOptions
  ): Promise<string> {
    if (!response.choices || response.choices.length === 0) {
      const error = new ExecutionError("Empty response from Mistral API");
      this.emit(AgentEvent.ERROR, error);
      throw error;
    }

    const choice = response.choices[0];
    // Track token usage
    const usage = this.accumulateUsage(this.parseUsage(response.usage));

    if (choice.finishReason === "length") {
      const error = new MaxTokensExceededError(
        "Response exceeded maximum token limit",
        this.config.maxTokens || 1024
      );
      this.emit(AgentEvent.MAX_TOKENS_EXCEEDED, error);
      this.emit(AgentEvent.ERROR, error);

      // Report error to viz
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

    const message = choice.message;
    if (choice.finishReason !== "tool_calls" && !message.toolCalls) {
      // Regular text response
      let textContent: string;

      if (typeof message.content === "string") {
        textContent = message.content;
      } else if (Array.isArray(message.content)) {
        textContent = message.content
          .filter(
            (chunk: any) => typeof chunk === "string" || chunk.type === "text"
          )
          .map((chunk: any) =>
            typeof chunk === "string" ? chunk : (chunk as TextChunk).text
          )
          .join("");
      } else {
        const error = new ExecutionError(
          `Unexpected response format: ${JSON.stringify(message.content)}`
        );
        this.emit(AgentEvent.ERROR, error);
        throw error;
      }

      // Add to history in normalized format
      const entry = mistralTransformer.fromProviderMessage(message);
      this.addToHistory(entry);

      this.emit(AgentEvent.DONE, message, usage);

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
          textContent
        );
        this.vizEventId = undefined;
      }

      return textContent;
    } else if (choice.finishReason === "tool_calls" || message.toolCalls) {
      try {
        // Stop before the assistant turn is written: nothing else would notice
        // a cancellation until the next provider call, and bailing out here
        // avoids both running the tools' side effects and leaving a tool call
        // in history with no tool message to answer it.
        throwIfAborted(options?.signal, `Execution of agent ${this.getName()}`);

        this.emit(AgentEvent.TOOL_USE, message.toolCalls);

        // Add assistant message with tool calls to history (normalized)
        const assistantEntry = mistralTransformer.fromProviderMessage(message);
        this.addToHistory(assistantEntry);

        const toolResults = await this.handleToolCalls(
          message.toolCalls || [],
          options
        );
        // Add tool results to history (normalized)
        for (const result of toolResults) {
          const resultEntry = mistralTransformer.toolResultEntry(
            result.toolCallId,
            result.name,
            result.content
          );
          this.addToHistory(resultEntry);
        }

        // Rate limiting delay for Mistral. Aborting during the wait rejects
        // immediately rather than sitting out the full delay first.
        await setTimeout(this.config.rateLimitDelay || 1500, undefined, {
          signal: options?.signal,
        });

        // Continue conversation
        try {
          const messages = mistralTransformer.toProvider(this.history.getEntries());

          this.startTurnTimer();

          const newResponse = await this.client.chat.complete(
            {
              model: this.config.model!,
              messages: messages as Parameters<
                typeof this.client.chat.complete
              >[0]["messages"],
              tools: this.getToolDefinitions(),
              temperature: this.config.temperature,
              topP: this.config.topP,
              maxTokens: this.config.maxTokens,
              randomSeed: this.config.randomSeed,
              safePrompt: this.config.safePrompt,
              stop: this.config.stopSequences,
            },
            { signal: options?.signal }
          );

          this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
          return this.handleResponse(newResponse, options);
        } catch (error: unknown) {
          const err = error as { status?: number; message?: string };
          if (err.status) {
            const apiError = new ApiError(
              `Mistral API error during tool response: ${
                err.message || "Unknown error"
              }`,
              err.status,
              error
            );
            this.emit(AgentEvent.ERROR, apiError);
            throw apiError;
          } else {
            throw new ExecutionError(
              `Error handling tool response: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        }
      } catch (error: unknown) {
        if (error instanceof ToolExecutionError) {
          this.emit(AgentEvent.TOOL_ERROR, error);
          throw error;
        }

        const toolError = new ExecutionError(
          `Error during tool execution: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        this.emit(AgentEvent.ERROR, toolError);
        throw toolError;
      }
    }

    const error = new ExecutionError(
      `Unexpected finish_reason: ${choice.finishReason}`
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

  private async handleToolCalls(
    toolCalls: ToolCall[],
    options?: ExecuteOptions
  ): Promise<Array<{ name: string; toolCallId: string; content: string }>> {
    if (!toolCalls.length) {
      throw new ExecutionError("No tool calls found in response");
    }

    // Track tool call count for viz reporting
    this.currentToolCallCount += toolCalls.length;

    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const toolName = toolCall.function.name;
        const tool = this.tools.get(toolName);
        const toolCallId = toolCall.id || "";

        if (!tool) {
          const errorMessage = `Tool '${toolName}' not found`;
          const error = new ToolExecutionError(
            errorMessage,
            toolName,
            toolCall.function.arguments
          );

          if (this.debug) {
            console.error(error);
          }

          return {
            name: toolName,
            toolCallId,
            content: errorMessage,
          };
        }

        try {
          let args: Record<string, unknown>;
          if (typeof toolCall.function.arguments === "string") {
            args = JSON.parse(toolCall.function.arguments);
          } else {
            args = toolCall.function.arguments as Record<string, unknown>;
          }

          const result = await tool.execute(
            this.getId(),
            this.getName(),
            args,
            toolCallId,
            this.config.model,
            "mistral",
            { signal: options?.signal }
          );

          return {
            name: toolName,
            toolCallId,
            content: JSON.stringify(result),
          };
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

          return {
            name: toolName,
            toolCallId,
            content: errorMessage,
          };
        }
      })
    );

    return toolResults;
  }

  protected parseUsage(input: UsageInfo): TokenUsage {
    return {
      input_tokens: input.promptTokens ?? 0,
      output_tokens: input.completionTokens ?? 0,
      total_tokens: input.totalTokens ?? 0,
    };
  }
}
