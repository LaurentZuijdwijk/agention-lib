import { Anthropic, APIError } from "@anthropic-ai/sdk";
import {
  ContentBlock,
  Message,
  MessageParam,
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
import { History } from "../../history/History";

type AgentConfig = BaseAgentConfig & {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  disableParallelToolUse?: boolean;
};

// TODO: type the agents that are available.

/**
 * Agent for Anthropic models.
 *
 *
 * @example
 */
export class ClaudeAgent extends BaseAgent {
  private client: Anthropic;
  protected config: Partial<AgentConfig>;

  /** Token usage from the last execution (for metrics tracking) */
  public lastTokenUsage?: TokenUsage;

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
    this.addToHistory(
      "user",
      `System message: You are an agent called ${this.getName()} and should follow these instructions: ${this.getDescription()}`
    );
  }

  protected getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getPrompt());
  }

  protected async process(_input: string): Promise<any> {}

  async execute(input: string): Promise<string> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);

    // Reset token usage for this execution
    this.lastTokenUsage = undefined;

    if (this.history.transient) {
      this.history.clear();
    }
    this.addToHistory("user", input);
    // console.log(this.history.entries);
    try {
      const response = await this.client.messages.create({
        model: this.config.model!,
        system: `You are an agent called ${this.getName()} and should follow these instructions: ${this.getDescription()}`,
        max_tokens: this.config.maxTokens!,
        messages: this.history.entries as MessageParam[],
        tools: this.getToolDefinitions(),
      });

      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof APIError) {
        // Handle Anthropic API errors
        const apiError = new ApiError(
          `Anthropic API error: ${error.message}`,
          error.status,
          error
        );
        this.emit(AgentEvent.ERROR, apiError);
        throw apiError;
      } else {
        // Handle other execution errors
        const executionError = new ExecutionError(
          `Error executing agent: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        this.emit(AgentEvent.ERROR, executionError);
        throw executionError;
      }
    }
  }

  protected async handleResponse(response: Message): Promise<any> {
    const usage = this.parseUsage(response.usage);

    // Store token usage for metrics tracking
    if (this.lastTokenUsage) {
      // Accumulate if there are multiple calls (e.g., tool use loops)
      this.lastTokenUsage.input_tokens += usage.input_tokens;
      this.lastTokenUsage.output_tokens += usage.output_tokens;
      this.lastTokenUsage.total_tokens += usage.total_tokens;
    } else {
      this.lastTokenUsage = { ...usage };
    }

    // Handle API response based on stop_reason
    if (response.stop_reason === "max_tokens") {
      const error = new MaxTokensExceededError(
        "Response exceeded maximum token limit",
        this.config.maxTokens || 1024
      );
      this.emit(AgentEvent.MAX_TOKENS_EXCEEDED, error);
      this.emit(AgentEvent.ERROR, error);
      throw error;
    }

    if (response.stop_reason !== "tool_use") {
      // look at stop reasons
      if (response.content && response.content[0]?.type === "text") {
        this.emit(AgentEvent.DONE, response, usage);
        this.addToHistory("assistant", response.content);

        return response.content[0].text;
      } else {
        // Unexpected response format
        const error = new ExecutionError(
          `Unexpected response format: ${JSON.stringify(response.content)}`
        );
        this.emit(AgentEvent.ERROR, error);
        throw error;
      }
    } else if (response.stop_reason === "tool_use") {
      // Tool use detected
      try {
        this.emit(AgentEvent.TOOL_USE, response.content);

        // Add assistant response to history
        this.addToHistory("assistant", response.content);

        const res = await this.handleToolUse(response.content);
        this.addToHistory("user", res);

        // Continue conversation with tool results
        try {
          const newResponse = await this.client.messages.create({
            model: this.config.model!,
            max_tokens: this.config.maxTokens!,
            messages: this.history.entries as MessageParam[],
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
        // Error during tool execution
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

    // Fallback for unexpected stop_reason
    const error = new ExecutionError(
      `Unexpected stop_reason: ${response.stop_reason}`
    );
    this.emit(AgentEvent.ERROR, error);
    throw error;
  }

  private async handleToolUse(
    content: ContentBlock[]
  ): Promise<ContentBlock[]> {
    const toolUseBlocks = content.filter(
      (block) => block.type === "tool_use"
    ) as Array<ToolUseBlock>;
    if (!toolUseBlocks.length) {
      console.error("No tool use blocks found in content");
      throw new ExecutionError("No tool use blocks found in content");
    }

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const tool = this.tools.get(block.name);

        if (!tool) {
          const errorMessage = `Tool '${block.name}' not found`;
          const error = new ToolExecutionError(
            errorMessage,
            block.name,
            block.input
          );

          // Log the error but continue with other tools
          if (this.debug) {
            console.error(error);
          }

          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: errorMessage,
            is_error: true,
          };
        }

        try {
          const result = await tool.execute(
            this.getId(),
            this.getName(),
            block.input as any,
            block.id
          );
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          } as any;
        } catch (error) {
          // Handle errors from tool execution
          const errorMessage = `Error executing tool '${block.name}': ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
          if (this.debug) console.error(errorMessage);

          const toolError = new ToolExecutionError(
            errorMessage,
            block.name,
            block.input
          );

          // Emit tool error event
          this.emit(AgentEvent.TOOL_ERROR, toolError);

          // Log error in debug mode
          if (this.debug) {
            console.error(toolError);
          }

          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: errorMessage,
            is_error: true,
          };
        }
      })
    );

    return toolResults;
  }

  protected parseUsage(input: Usage): TokenUsage {
    return {
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      total_tokens: input.input_tokens + input.output_tokens,
    };
  }
}
