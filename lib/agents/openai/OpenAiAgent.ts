import OpenAI from "openai";
import { BaseAgent, BaseAgentConfig, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import {
  ApiError,
  ExecutionError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History } from "../../history/History";
import {
  ResponseInput,
  Tool,
  Response,
  ResponseFunctionToolCall,
} from "openai/resources/responses/responses";

type AgentConfig = BaseAgentConfig & {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  disableParallelToolUse?: boolean;
};

// type OpenAiRoles = "user" | "system" | "assistant" | "tool";

export class OpenAiAgent extends BaseAgent {
  private client: OpenAI;
  protected config: Partial<AgentConfig>;

  constructor(config: Omit<AgentConfig, "vendor">, history?: History) {
    super({ ...config, vendor: "openai" }, history);

    if (this.history?.entries.length === 0) {
      this.addToHistory(
        "system",
        `System message: You are an agent called ${this.name}`
      );
      this.addToHistory("system", this.description);
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
    });

    this.config = {
      model: config.model || "gpt-4.1-mini",
      maxTokens: config.maxTokens || 1024,
      disableParallelToolUse: config.disableParallelToolUse || false,
      apiKey: config.apiKey,
    };
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

  protected async process(_input: string): Promise<any> {}

  async execute(input: string): Promise<string> {
    // if (this.history.transient) {
    //   this.history.clear();
    //   this.addToHistory(
    //     "system",
    //     `System message: You are an agent called ${this.name}`
    //   );
    //   this.addToHistory("system", this.description);
    // }

    this.emit(AgentEvent.BEFORE_EXECUTE, input);
    this.addToHistory("user", input);

    try {
      const response = await this.client.responses.create({
        model: this.config.model!,
        max_output_tokens: this.config.maxTokens,
        input: this.history.entries as [],
        tools: this.getToolDefinitions(),
        store: false,
      });

      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response);
    } catch (error: any) {
      if (error?.error) {
        const apiError = new ApiError(
          `OpenAI API error: ${error.error.message || "Unknown error"}`,
          error.status,
          error.error
        );

        // Handle quota errors specifically
        if (error.error.code === "insufficient_quota") {
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

  protected async handleResponse(response: Response): Promise<any> {
    // Validate response structure
    if (!response.output || !response.output.length) {
      const error = new ExecutionError(
        "Invalid response format: missing output"
      );
      this.emit(AgentEvent.ERROR, error);
      throw error;
    }
    const toolCalls = response.output.filter(
      (output) => output.type === "function_call"
    ) as unknown as ResponseFunctionToolCall[];

    // response.output.forEach(console.log);

    // Handle different completion reasons
    if (
      !toolCalls.length &&
      response.output[0].type === "message" &&
      response.output[0].status === "completed"
    ) {
      // Normal text response
      // if (choice.message && choice.message.content) {
      this.addToHistory("assistant", response.output[0].content);
      this.emit(AgentEvent.DONE, response);
      return response.output_text;
    } else if (toolCalls.length) {
      /*
    if response.status == "incomplete" and response.incompconversation in one request to the model.

    To manually share context across generated responses, include the model's previous response output as input, and append that input to your next request.

    In the following example, we ask the model to tell a joke, followed by a request for another joke. Appending previous responses to new requests in this way helps ensure conversations feel natural andlete_details.reason == "max_output_tokens":
        print("Ran out of tokens")
        if response.output_text:
            print("Partial output:", response.output_text)
        else:
            print("Ran out of tokens during reasoning")
 */
      try {
        if (response.output_text && response.output_text.length)
          this.addToHistory("assistant", response.output_text);
        toolCalls.forEach((toolCall) => this.addToHistory(toolCall as any));
        const toolResponses = await this.handleToolUse(toolCalls);
        toolResponses.forEach((msg) => {
          this.addToHistory(msg);
        });
        try {
          const newResponse = await this.client.responses.create({
            model: this.config.model!,
            max_output_tokens: this.config.maxTokens,
            input: this.history.entries as ResponseInput,
            tools: this.getToolDefinitions(),
            store: false,
          });
          this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
          return this.handleResponse(newResponse);
        } catch (error: any) {
          if (error?.error) {
            const apiError = new ApiError(
              `OpenAI API error during tool response: ${
                error.error.message || "Unknown error"
              }`,
              error.status,
              error.error
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
      } catch (error) {
        console.error(error);
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
    }
    // else if (choice.finish_reason === "length") {
    //   // Max tokens reached
    //   const error = new MaxTokensExceededError(
    //     "Response exceeded maximum token limit",
    //     this.config.maxTokens || 1024
    //   );
    //   this.emit(AgentEvent.MAX_TOKENS_EXCEEDED, error);
    //   this.emit(AgentEvent.ERROR, error);
    //   throw error;
    // }
    else {
      // Unexpected finish reason
      const error = new ExecutionError(`Unexpected finish_reason: ${response}`);
      this.emit(AgentEvent.ERROR, error);
      throw error;
    }
  }

  private async handleToolUse(
    content: ResponseFunctionToolCall[]
  ): Promise<any[]> {
    if (!content || !content.length) {
      throw new ExecutionError("Invalid tool calls content");
    }

    const toolResults = await Promise.all(
      content.map(async (toolCall) => {
        if (!toolCall.name || !toolCall.name) {
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

          // Log the error if in debug mode
          if (this.debug) {
            console.error(error);
          }

          return {
            type: "function_call_output",
            call_id: toolCall.call_id,
            output: errorMessage,
          };
        }

        try {
          let toolArgs;
          try {
            toolArgs = JSON.parse(toolCall.arguments);
          } catch (parseError) {
            throw new ToolExecutionError(
              `Invalid tool arguments: ${
                parseError instanceof Error ? parseError.message : "Parse error"
              }`,
              toolName,
              toolCall.arguments
            );
          }

          // Execute the tool with parsed arguments
          const result = await tool.execute(
            this.getId(),
            this.getName(),
            toolArgs,
            toolCall.id || ""
          );

          return {
            type: "function_call_output",
            call_id: toolCall.call_id,
            output:
              typeof result.content === "string"
                ? result.content
                : JSON.stringify(result),
          };
        } catch (error) {
          // Handle tool execution errors
          const errorMessage = `Error executing tool '${toolName}': ${
            error instanceof Error ? error.message : "Unknown error"
          }`;

          const toolError = new ToolExecutionError(
            errorMessage,
            toolName,
            toolCall.arguments
          );

          // Emit tool error event
          this.emit(AgentEvent.TOOL_ERROR, toolError);

          // Log error in debug mode
          if (this.debug) {
            console.error(toolError);
          }

          return {
            type: "function_call_output",
            call_id: toolCall.call_id,
            output: errorMessage,
          };
        }
      })
    );
    // TODO: check multiple tools usage in unit test.
    return toolResults;
  }

  protected parseUsage(input: openaiUsage): TokenUsage {
    return {
      input_tokens: input.prompt_tokens,
      output_tokens: input.completion_tokens,
      total_tokens: input.total_tokens,
    };
  }
}

type openaiUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details: {
    cached_tokens: number;
    audio_tokens: number;
  };
  completion_tokens_details: {
    reasoning_tokens: number;
    audio_tokens: number;
    accepted_prediction_tokens: number;
    rejected_prediction_tokens: number;
  };
};
