import { Mistral } from "@mistralai/mistralai";

import { BaseAgent, BaseAgentConfig, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import {
  ApiError,
  ExecutionError,
  MaxTokensExceededError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History } from "../../history/History";
import {
  ChatCompletionResponse,
  TextChunk,
  Tool,
  ToolCall,
  ToolTypes,
  UsageInfo,
} from "@mistralai/mistralai/models/components";
import { APIError } from "openai";
import { setTimeout } from "timers/promises";

type AgentConfig = BaseAgentConfig & {
  apiKey: string;
  model?: string | "mistral-small-latest" | "mistral-large-latest";
  maxTokens?: number;
  disableParallelToolUse?: boolean;
};

/**
 * Agent for Mistral models.
 *
 *
 * @example
 */
export class MistralAgent extends BaseAgent {
  private client: Mistral;
  protected config: Partial<AgentConfig>;

  constructor(config: Omit<AgentConfig, "vendor">, history?: History) {
    super({ ...config, vendor: "mistral" }, history);
    this.client = new Mistral({
      apiKey: config.apiKey,
    });

    this.config = {
      model: config.model || "mistral-small-latest",
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

  protected getToolDefinitions(): Tool[] {
    const tools = Array.from(this.tools.values()).map((tool) => ({
      type: ToolTypes.Function,
      function: {
        name: tool.getPrompt().name,
        description: tool.getPrompt().description,
        // strict: true,
        parameters: tool.getPrompt().input_schema,
      },
    }));
    console.log(tools);
    return tools;
  }

  // const tools = [
  //     {
  //         type: "function",
  //         function: {
  //             name: "retrievePaymentStatus",
  //             description: "Get payment status of a transaction",
  //             parameters: {
  //                 type: "object",
  //                 properties: {
  //                     transactionId: {
  //                         type: "string",
  //                         description: "The transaction id.",
  //                     }
  //                 },
  //                 required: ["transactionId"],
  //             },
  //         },
  //     },

  protected async process(_input: string): Promise<any> {}

  async execute(input: string): Promise<string> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);
    if (this.history.transient) {
      this.history.clear();
    }
    if (this.history.entries.length === 0) {
      const systemMessage = `You are an agent called ${this.getName()} and should follow these instructions: ${this.getDescription()}`;
      this.addToHistory("system", systemMessage);
    }
    this.addToHistory("user", input);
    try {
      const response = await this.client.chat.complete({
        model: this.config.model!,
        messages: this.history.entries as any,
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

    // Handle API response based on finish_reason
    if (choice.finishReason === "length") {
      const error = new MaxTokensExceededError(
        "Response exceeded maximum token limit",
        this.config.maxTokens || 1024
      );
      this.emit(AgentEvent.MAX_TOKENS_EXCEEDED, error);
      this.emit(AgentEvent.ERROR, error);
      throw error;
    }

    const message = choice.message;

    if (choice.finishReason !== "tool_calls" && !message.toolCalls) {
      // Regular text response
      if (typeof message.content === "string") {
        this.emit(AgentEvent.DONE, message, usage);
        this.addToHistory("assistant", message.content);
        return message.content;
      } else if (Array.isArray(message.content)) {
        // Handle array of content chunks
        const textContent = message.content
          .filter((chunk) => typeof chunk === "string" || chunk.type === "text")
          .map((chunk) =>
            typeof chunk === "string" ? chunk : (chunk as TextChunk).text
          )
          .join("");

        this.emit(AgentEvent.DONE, message, usage);
        this.addToHistory("assistant", textContent);
        return textContent;
      } else {
        // Unexpected response format
        const error = new ExecutionError(
          `Unexpected response format: ${JSON.stringify(message.content)}`
        );
        this.emit(AgentEvent.ERROR, error);
        throw error;
      }
    } else if (choice.finishReason === "tool_calls" || message.toolCalls) {
      // Tool use detected
      try {
        this.emit(AgentEvent.TOOL_USE, message.toolCalls);

        // Add assistant response to history
        this.addToHistory(message as any);

        const toolResults = await this.handleToolCalls(message.toolCalls || []);
        toolResults.forEach((res: any) => {
          this.addToHistory({ role: "tool", ...res });
        });
        console.log("this.history.entries", this.history.entries);
        // Continue conversation with tool results
        //
        await setTimeout(1500);
        try {
          const newResponse = await this.client.chat.complete({
            model: this.config.model!,
            messages: this.history.entries as any,
            tools: this.getToolDefinitions(),
            temperature: this.config.temperature,
          });

          this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
          return this.handleResponse(newResponse);
        } catch (error: any) {
          if (error.status) {
            const apiError = new ApiError(
              `Mistral API error during tool response: ${error.message}`,
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

    // Fallback for unexpected finish_reason
    const error = new ExecutionError(
      `Unexpected finish_reason: ${choice.finishReason}`
    );
    this.emit(AgentEvent.ERROR, error);
    throw error;
  }

  private async handleToolCalls(toolCalls: ToolCall[]): Promise<any> {
    if (!toolCalls.length) {
      console.error("No tool calls found in response");
      throw new ExecutionError("No tool calls found in response");
    }

    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const toolName = toolCall.function.name;
        const tool = this.tools.get(toolName);

        if (!tool) {
          const errorMessage = `Tool '${toolName}' not found`;
          const error = new ToolExecutionError(
            errorMessage,
            toolName,
            toolCall.function.arguments
          );

          // Log the error but continue with other tools
          if (this.debug) {
            console.error(error);
          }

          return {
            name: toolName,
            toolCallId: toolCall.id,
            content: errorMessage,
            // is_error: true,
          };
        }

        try {
          // Parse the arguments string to JSON object
          // console.log(toolCall);
          const args = toolCall.function.arguments;
          console.log(
            "toolCall.function.arguments",
            toolCall.function.arguments
          );
          const result = await tool.execute(
            this.getId(),
            this.getName(),
            args as Record<string, any>,
            toolCall.id || ""
          );

          return {
            name: toolName,
            toolCallId: toolCall.id,
            content: JSON.stringify(result),
          };
        } catch (error) {
          // Handle errors from tool execution
          const errorMessage = `Error executing tool '${toolName}': ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
          if (this.debug) console.error(errorMessage);

          const toolError = new ToolExecutionError(
            errorMessage,
            toolName,
            toolCall.function.arguments
          );

          // Emit tool error event
          this.emit(AgentEvent.TOOL_ERROR, toolError);

          // Log error in debug mode
          if (this.debug) {
            console.error(toolError);
          }

          return {
            name: toolName,
            toolCallId: toolCall.id,
            content: errorMessage,
            // is_error: true,
          };
        }
      })
    );

    return toolResults;
  }

  protected parseUsage(input: UsageInfo): TokenUsage {
    return {
      input_tokens: input.promptTokens,
      output_tokens: input.completionTokens,
      total_tokens: input.totalTokens,
    };
  }
}
