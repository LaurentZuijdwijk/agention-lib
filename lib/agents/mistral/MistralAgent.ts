import { Mistral } from "@mistralai/mistralai";

import { BaseAgent, BaseAgentConfig, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
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
export class MistralAgent extends BaseAgent {
  private client: Mistral;
  protected config: Partial<AgentConfig>;

  /** Token usage from the last execution (for metrics tracking) */
  public lastTokenUsage?: TokenUsage;

  /** Current visualization event ID for tracking */
  private vizEventId?: string;

  /** Count of tool calls in current execution */
  private currentToolCallCount: number = 0;

  constructor(config: Omit<AgentConfig, "vendor">, history?: History) {
    super({ ...config, vendor: "mistral" }, history);
    this.client = new Mistral({
      apiKey: config.apiKey,
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

  async execute(input: string | MessageContent[]): Promise<string> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);

    // Reset token usage for this execution
    this.lastTokenUsage = undefined;
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

    try {
      const messages = mistralTransformer.toProvider(this.history.getEntries());
      const response = await this.client.chat.complete({
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
      });

      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response);
    } catch (error: unknown) {
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
    }
  }

  protected async handleResponse(
    response: ChatCompletionResponse
  ): Promise<string> {
    if (!response.choices || response.choices.length === 0) {
      const error = new ExecutionError("Empty response from Mistral API");
      this.emit(AgentEvent.ERROR, error);
      throw error;
    }

    const choice = response.choices[0];
    const usage = this.parseUsage(response.usage);

    // Track token usage
    if (this.lastTokenUsage) {
      this.lastTokenUsage.input_tokens += usage.input_tokens;
      this.lastTokenUsage.output_tokens += usage.output_tokens;
      this.lastTokenUsage.total_tokens += usage.total_tokens;
    } else {
      this.lastTokenUsage = { ...usage };
    }

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
        this.emit(AgentEvent.TOOL_USE, message.toolCalls);

        // Add assistant message with tool calls to history (normalized)
        const assistantEntry = mistralTransformer.fromProviderMessage(message);
        this.addToHistory(assistantEntry);

        const toolResults = await this.handleToolCalls(message.toolCalls || []);
        // Add tool results to history (normalized)
        for (const result of toolResults) {
          const resultEntry = mistralTransformer.toolResultEntry(
            result.toolCallId,
            result.name,
            result.content
          );
          this.addToHistory(resultEntry);
        }

        // Rate limiting delay for Mistral
        await setTimeout(this.config.rateLimitDelay || 1500);

        // Continue conversation
        try {
          const messages = mistralTransformer.toProvider(this.history.getEntries());

          const newResponse = await this.client.chat.complete({
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
          });

          this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
          return this.handleResponse(newResponse);
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
    toolCalls: ToolCall[]
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
            "mistral"
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
