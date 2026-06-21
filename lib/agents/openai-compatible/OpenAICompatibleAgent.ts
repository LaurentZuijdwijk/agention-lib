import OpenAI from "openai";
import {
  ChatCompletion,
  ChatCompletionMessage,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { Model } from "openai/resources/models";
import { BaseAgent, BaseAgentConfig, TokenUsage } from "../BaseAgent";
import { AgentVendor } from "../AgentConfig";
import { AgentEvent } from "../AgentEvent";
import {
  AgentError,
  ApiError,
  ExecutionError,
  MaxTokensExceededError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History, MessageContent } from "../../history/History";
import { chatCompletionsTransformer } from "../../history/transformers";
import { vizReporter } from "../../viz/VizReporter";
import { vizConfig } from "../../viz/VizConfig";

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

  public lastTokenUsage?: TokenUsage;
  private vizEventId?: string;
  private currentToolCallCount: number = 0;

  constructor(
    config: OpenAICompatibleConfig & { vendor: AgentVendor },
    history?: History
  ) {
    super(config, history);

    this.client = new OpenAI({
      apiKey: config.apiKey || "not-needed",
      baseURL: config.baseURL,
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
   */
  async listModels(): Promise<Model[]> {
    try {
      const page = await this.client.models.list();
      return page.data;
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

  async execute(input: string | MessageContent[]): Promise<string> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);
    this.lastTokenUsage = undefined;
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
      const response = await this.callProvider();
      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response);
    } catch (error: unknown) {
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

  private async callProvider(): Promise<ChatCompletion> {
    const messages = chatCompletionsTransformer.toProvider(
      this.history.getEntries()
    );
    const tools = this.tools.size > 0 ? this.getToolDefinitions() : undefined;

    return this.client.chat.completions.create({
      model: this.config.model!,
      messages,
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
    });
  }

  protected async handleResponse(response: ChatCompletion): Promise<string> {
    const usage = this.parseUsage(response);

    if (this.lastTokenUsage) {
      this.lastTokenUsage.input_tokens += usage.input_tokens;
      this.lastTokenUsage.output_tokens += usage.output_tokens;
      this.lastTokenUsage.total_tokens += usage.total_tokens;
    } else {
      this.lastTokenUsage = { ...usage };
    }

    const choice = response.choices[0];
    const message = choice.message;

    if (choice.finish_reason === "length") {
      const error = new MaxTokensExceededError(
        "Response exceeded maximum token limit",
        this.config.maxTokens || 1024
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
    this.emit(AgentEvent.TOOL_USE, toolCalls);
    this.currentToolCallCount += toolCalls.length;

    const assistantEntry = chatCompletionsTransformer.fromProviderMessage(message);
    this.addToHistory(assistantEntry);

    const toolResults = await this.handleToolCalls(toolCalls);

    for (const result of toolResults) {
      const resultEntry = chatCompletionsTransformer.toolResultEntry(
        result.toolCallId,
        result.content
      );
      this.addToHistory(resultEntry);
    }

    try {
      const newResponse = await this.callProvider();
      this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
      return this.handleResponse(newResponse);
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
    toolCalls: NonNullable<ChatCompletionMessage["tool_calls"]>
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
            this.vendor
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

  protected parseUsage(response: ChatCompletion): TokenUsage {
    const usage = response.usage;
    return {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
    };
  }
}
