import OpenAI from "openai";
import { BaseAgent, BaseAgentConfig, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import {
  ApiError,
  ExecutionError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History, toolResult } from "../../history/History";
import { openAiTransformer } from "../../history/transformers";
import {
  Tool,
  Response,
  ResponseFunctionToolCall,
  ResponseUsage,
} from "openai/resources/responses/responses";

type AgentConfig = BaseAgentConfig & {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  disableParallelToolUse?: boolean;
};

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
export class OpenAiAgent extends BaseAgent {
  private client: OpenAI;
  protected config: Partial<AgentConfig>;

  /** Token usage from the last execution (for metrics tracking) */
  public lastTokenUsage?: TokenUsage;

  constructor(config: Omit<AgentConfig, "vendor">, history?: History) {
    super({ ...config, vendor: "openai" }, history);

    this.client = new OpenAI({
      apiKey: config.apiKey,
    });

    this.config = {
      model: config.model || "gpt-4.1-mini",
      maxTokens: config.maxTokens || 1024,
      disableParallelToolUse: config.disableParallelToolUse || false,
      apiKey: config.apiKey,
      temperature: config.temperature,
    };

    // Add system message to history (skips if already exists with same content)
    this.addSystemMessage(this.getSystemMessage());
  }

  protected getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values()).map((tool) => {
      const prompt = tool.getPrompt();

      return {
        type: "function",
        name: prompt.name,
        description: prompt.description,
        parameters: {
          type: prompt.input_schema.type,
          properties: prompt.input_schema.properties,
          required: prompt.input_schema.required,
          additionalProperties: false,
        },
        strict: true,
      };
    });
  }

  protected async process(_input: string): Promise<string> {
    return "";
  }

  async execute(input: string): Promise<string> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);

    // Reset token usage for this execution
    this.lastTokenUsage = undefined;

    if (this.history.transient) {
      this.history.clear();
      // Re-add system message after clear
      this.addSystemMessage(this.getSystemMessage());
    }

    this.addTextToHistory("user", input);

    try {
      const inputMessages = openAiTransformer.toProvider(this.history.entries);

      const response = await this.client.responses.create({
        model: this.config.model!,
        max_output_tokens: this.config.maxTokens,
        input: inputMessages,
        tools: this.getToolDefinitions(),
        store: false,
        temperature: this.config.temperature,
      });

      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response);
    } catch (error: unknown) {
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
        throw apiError;
      } else {
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

  protected async handleResponse(response: Response): Promise<string> {
    if (!response.output || !response.output.length) {
      const error = new ExecutionError(
        "Invalid response format: missing output"
      );
      this.emit(AgentEvent.ERROR, error);
      throw error;
    }

    // Track token usage if available
    if (response.usage) {
      const usage = this.parseUsage(response.usage);

      if (this.lastTokenUsage) {
        this.lastTokenUsage.input_tokens += usage.input_tokens;
        this.lastTokenUsage.output_tokens += usage.output_tokens;
        this.lastTokenUsage.total_tokens += usage.total_tokens;
      } else {
        this.lastTokenUsage = { ...usage };
      }
    }

    const toolCalls = response.output.filter(
      (output) => output.type === "function_call"
    ) as unknown as ResponseFunctionToolCall[];

    if (
      !toolCalls.length &&
      response.output[0].type === "message" &&
      response.output[0].status === "completed"
    ) {
      // Normal text response - add to history in normalized format
      const entry = openAiTransformer.fromProviderMessage(
        "assistant",
        response.output_text
      );
      this.addToHistory(entry);

      this.emit(AgentEvent.DONE, response, this.lastTokenUsage);
      return response.output_text;
    } else if (toolCalls.length) {
      try {
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

        const toolResponses = await this.handleToolUse(toolCalls);

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
            this.history.entries
          );

          const newResponse = await this.client.responses.create({
            model: this.config.model!,
            max_output_tokens: this.config.maxTokens,
            input: inputMessages,
            tools: this.getToolDefinitions(),
            store: false,
            temperature: this.config.temperature,
          });

          this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
          return this.handleResponse(newResponse);
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
      throw error;
    }
  }

  private async handleToolUse(
    content: ResponseFunctionToolCall[]
  ): Promise<Array<{ call_id: string; output: string }>> {
    if (!content || !content.length) {
      throw new ExecutionError("Invalid tool calls content");
    }

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
            toolCall.id || ""
          );

          const resultObj = result as { content?: string };
          return {
            call_id: toolCall.call_id,
            output:
              typeof resultObj.content === "string"
                ? resultObj.content
                : JSON.stringify(result),
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

  protected parseUsage(input: ResponseUsage): TokenUsage {
    return {
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      total_tokens: input.total_tokens,
    };
  }
}
