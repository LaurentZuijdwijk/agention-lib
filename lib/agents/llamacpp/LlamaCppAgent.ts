import OpenAI from "openai";
import {
  ChatCompletion,
  ChatCompletionMessage,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { Model } from "openai/resources/models";
import { BaseAgent, BaseAgentConfig, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import {
  ApiError,
  ExecutionError,
  MaxTokensExceededError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History, MessageContent } from "../../history/History";
import { chatCompletionsTransformer } from "../../history/transformers";
import { vizReporter } from "../../viz/VizReporter";
import { vizConfig } from "../../viz/VizConfig";
import { LlamaCppModel } from "../model-types";

type AgentConfig = BaseAgentConfig & {
  /** Base URL of the llama.cpp server's OpenAI-compatible API (default: `http://localhost:8080/v1`) */
  baseURL?: string;
  model?: LlamaCppModel;
  maxTokens?: number;
};

/**
 * Agent for locally-hosted models served by a llama.cpp server (`llama-server`),
 * which exposes an OpenAI-compatible `/v1/chat/completions` API.
 *
 * Requires the `openai` package as a peer dependency and a running llama.cpp server.
 *
 * @example
 * ```typescript
 * const agent = new LlamaCppAgent({
 *   id: "1",
 *   name: "Assistant",
 *   description: "A helpful assistant",
 *   apiKey: "",
 *   baseURL: "http://localhost:8080/v1",
 * });
 *
 * const response = await agent.execute("Hello!");
 * ```
 *
 * @example List available models
 * ```typescript
 * const models = await agent.listModels();
 * ```
 */
export class LlamaCppAgent extends BaseAgent {
  private client: OpenAI;
  protected config: Partial<AgentConfig>;

  /** Token usage from the last execution (for metrics tracking) */
  public lastTokenUsage?: TokenUsage;

  /** Current visualization event ID */
  private vizEventId?: string;

  /** Count of tool calls in current execution */
  private currentToolCallCount: number = 0;

  constructor(config: Omit<AgentConfig, "vendor">, history?: History) {
    super({ ...config, vendor: "llamacpp" }, history);

    const vendorConfig = config.vendorConfig?.llamacpp || {};
    const baseURL =
      config.baseURL ?? vendorConfig.baseURL ?? "http://localhost:8080/v1";

    this.client = new OpenAI({
      apiKey: config.apiKey || "not-needed",
      baseURL,
    });

    this.config = {
      model: config.model || "default",
      baseURL,
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

  /**
   * List the models currently available on the llama.cpp server (via its
   * OpenAI-compatible `/v1/models` endpoint).
   */
  async listModels(): Promise<Model[]> {
    try {
      const page = await this.client.models.list();
      return page.data;
    } catch (error: unknown) {
      throw new ExecutionError(
        `Failed to list llama.cpp models: ${
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
        "llamacpp",
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
      const response = await this.callLlamaCpp();
      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response);
    } catch (error: unknown) {
      if (error instanceof OpenAI.APIError) {
        const apiError = new ApiError(
          `llama.cpp API error: ${error.message}`,
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

      if (error instanceof ExecutionError || error instanceof ApiError) {
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
        `llama.cpp error: ${
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

  private async callLlamaCpp(): Promise<ChatCompletion> {
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

    // Tool calls detected
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

    // Continue conversation with tool results
    try {
      const newResponse = await this.callLlamaCpp();
      this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
      return this.handleResponse(newResponse);
    } catch (error: unknown) {
      const executionError = new ExecutionError(
        `llama.cpp error during tool response: ${
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
            toolCall.type === "function" ? toolCall.function.arguments : undefined
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
            "llamacpp"
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
