import { Anthropic, APIError } from "@anthropic-ai/sdk";
import {
  ContentBlock,
  Message,
  ToolUseBlock,
  Usage,
} from "@anthropic-ai/sdk/resources";
import { type ToolDefinition } from "../../tools/Tool";
import { BaseAgent, BaseAgentConfig, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import {
  ApiError,
  ExecutionError,
  MaxTokensExceededError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History, toolResult, toolUse, text } from "../../history/History";
import { anthropicTransformer } from "../../history/transformers";
import { vizReporter } from "../../viz/VizReporter";
import { vizConfig } from "../../viz/VizConfig";
import { VizStopReason } from "../../viz/types";

type AgentConfig = BaseAgentConfig & {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  disableParallelToolUse?: boolean;
};

/**
 * Agent for Anthropic models.
 *
 * @example
 * ```typescript
 * const agent = new ClaudeAgent({
 *   id: "1",
 *   name: "Assistant",
 *   description: "A helpful assistant",
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 * });
 *
 * const response = await agent.execute("Hello!");
 * ```
 */
export class ClaudeAgent extends BaseAgent {
  private client: Anthropic;
  protected config: Partial<AgentConfig>;

  /** Token usage from the last execution (for metrics tracking) */
  public lastTokenUsage?: TokenUsage;

  /** Current visualization event ID for tracking */
  private vizEventId?: string;

  /** Count of tool calls in current execution */
  private currentToolCallCount: number = 0;

  constructor(config: Omit<AgentConfig, "vendor">, history?: History) {
    super({ ...config, vendor: "anthropic" }, history);
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });

    this.config = {
      model: config.model || "claude-3-5-haiku-latest",
      maxTokens: config.maxTokens || 1024,
      disableParallelToolUse: config.disableParallelToolUse || false,
      apiKey: config.apiKey,
      temperature: config.temperature,
    };

    // Add system message to history (skips if already exists with same content)
    this.addSystemMessage(this.getSystemMessage());
  }

  protected getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getPrompt());
  }

  protected async process(_input: string): Promise<string> {
    return "";
  }

  async execute(input: string): Promise<string> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);

    // Reset token usage for this execution
    this.lastTokenUsage = undefined;
    this.currentToolCallCount = 0;

    // Start visualization reporting
    if (vizConfig.isEnabled()) {
      this.vizEventId = vizReporter.agentStart(
        this.id,
        this.name,
        this.config.model!,
        "anthropic",
        input
      );
    }

    if (this.history.transient) {
      this.history.clear();
      // Re-add system message after clear
      this.addSystemMessage(this.getSystemMessage());
    }

    this.addTextToHistory("user", input);

    try {
      const messages = anthropicTransformer.toProvider(this.history.entries);
      const systemMessage = this.history.getSystemMessage();

      const response = await this.client.messages.create({
        model: this.config.model!,
        system: systemMessage,
        max_tokens: this.config.maxTokens!,
        messages,
        tools: this.getToolDefinitions(),
      });

      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof APIError) {
        const apiError = new ApiError(
          `Anthropic API error: ${error.message}`,
          error.status,
          error
        );
        this.emit(AgentEvent.ERROR, apiError);

        // Report error to viz
        if (this.vizEventId) {
          vizReporter.agentError(
            this.vizEventId,
            "ApiError",
            apiError.message,
            error.status === 429 // Rate limit is retryable
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

  protected async handleResponse(response: Message): Promise<string> {
    const usage = this.parseUsage(response.usage);

    // Store token usage for metrics tracking
    if (this.lastTokenUsage) {
      this.lastTokenUsage.input_tokens += usage.input_tokens;
      this.lastTokenUsage.output_tokens += usage.output_tokens;
      this.lastTokenUsage.total_tokens += usage.total_tokens;
    } else {
      this.lastTokenUsage = { ...usage };
    }

    if (response.stop_reason === "max_tokens") {
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

    if (response.stop_reason !== "tool_use") {
      if (response.content && response.content[0]?.type === "text") {
        this.emit(AgentEvent.DONE, response, usage);

        // Convert response to normalized format and add to history
        const entry = anthropicTransformer.fromProviderContent(
          "assistant",
          response.content
        );
        this.addToHistory(entry);

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
            response.content[0].text
          );
          this.vizEventId = undefined;
        }

        return response.content[0].text;
      } else {
        const error = new ExecutionError(
          `Unexpected response format: ${JSON.stringify(response.content)}`
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
    } else if (response.stop_reason === "tool_use") {
      try {
        this.emit(AgentEvent.TOOL_USE, response.content);

        // Add assistant response to history (normalized format)
        const assistantEntry = anthropicTransformer.fromProviderContent(
          "assistant",
          response.content
        );
        this.addToHistory(assistantEntry);

        const toolResults = await this.handleToolUse(response.content);

        // Add tool results to history (normalized format)
        this.addMessageToHistory("user", toolResults);

        // Continue conversation with tool results
        try {
          const messages = anthropicTransformer.toProvider(
            this.history.entries
          );

          const newResponse = await this.client.messages.create({
            model: this.config.model!,
            max_tokens: this.config.maxTokens!,
            messages,
            tools: this.getToolDefinitions(),
          });

          this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
          return this.handleResponse(newResponse);
        } catch (error) {
          if (error instanceof APIError) {
            const apiError = new ApiError(
              `Anthropic API error during tool response: ${error.message}`,
              error.status,
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
      } catch (error) {
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
      `Unexpected stop_reason: ${response.stop_reason}`
    );
    this.emit(AgentEvent.ERROR, error);
    throw error;
  }

  private async handleToolUse(
    content: ContentBlock[]
  ): Promise<ReturnType<typeof toolResult>[]> {
    const toolUseBlocks = content.filter(
      (block) => block.type === "tool_use"
    ) as Array<ToolUseBlock>;

    if (!toolUseBlocks.length) {
      throw new ExecutionError("No tool use blocks found in content");
    }

    // Track tool call count for viz reporting
    this.currentToolCallCount += toolUseBlocks.length;

    const results = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const tool = this.tools.get(block.name);

        if (!tool) {
          const errorMessage = `Tool '${block.name}' not found`;
          const error = new ToolExecutionError(
            errorMessage,
            block.name,
            block.input
          );

          if (this.debug) {
            console.error(error);
          }

          return toolResult(block.id, errorMessage, true);
        }

        try {
          const result = await tool.execute(
            this.getId(),
            this.getName(),
            block.input as Record<string, unknown>,
            block.id,
            this.config.model,
            "anthropic"
          );

          return toolResult(block.id, JSON.stringify(result));
        } catch (error) {
          const errorMessage = `Error executing tool '${block.name}': ${
            error instanceof Error ? error.message : "Unknown error"
          }`;

          if (this.debug) {
            console.error(errorMessage);
          }

          const toolError = new ToolExecutionError(
            errorMessage,
            block.name,
            block.input
          );
          this.emit(AgentEvent.TOOL_ERROR, toolError);

          return toolResult(block.id, errorMessage, true);
        }
      })
    );

    return results;
  }

  protected parseUsage(input: Usage): TokenUsage {
    return {
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      total_tokens: input.input_tokens + input.output_tokens,
    };
  }
}
