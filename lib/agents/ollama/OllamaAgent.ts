import { BaseAgent, BaseAgentConfig, ModelInfo, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import {
  ApiError,
  ExecutionError,
  MaxTokensExceededError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History, MessageContent } from "../../history/History";
import { ollamaTransformer } from "../../history/transformers";
import { vizReporter } from "../../viz/VizReporter";
import { vizConfig } from "../../viz/VizConfig";
import { OllamaModel } from "../model-types";

type AgentConfig = BaseAgentConfig & {
  /** Ollama server URL (default: `http://localhost:11434`) */
  host?: string;
  model?: OllamaModel;
  maxTokens?: number;
  think?: boolean;
};

type OllamaToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
};

type OllamaOptions = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  seed?: number;
  num_predict?: number;
  stop?: string[];
  think?: boolean;
};

/**
 * Agent for locally-hosted Ollama models.
 *
 * Requires the `ollama` package as a peer dependency and Ollama running locally.
 *
 * @example
 * ```typescript
 * const agent = new OllamaAgent({
 *   id: "1",
 *   name: "Assistant",
 *   description: "A helpful assistant",
 *   model: "llama3.2",
 * });
 *
 * const response = await agent.execute("Hello!");
 * ```
 *
 * @example With tools
 * ```typescript
 * const agent = new OllamaAgent({
 *   id: "1",
 *   name: "Assistant",
 *   description: "A helpful assistant",
 *   model: "qwen2.5",  // Qwen models have strong tool-use support
 *   tools: [myTool],
 * });
 * ```
 */
export class OllamaAgent extends BaseAgent {
  protected config: Partial<AgentConfig>;

  /** Current visualization event ID */
  private vizEventId?: string;

  /** Count of tool calls in current execution */
  private currentToolCallCount: number = 0;

  /** Cached Ollama client instance */
  private _client: unknown = null;

  constructor(config: Omit<AgentConfig, "vendor">, history?: History) {
    super({ ...config, vendor: "ollama" }, history);

    const vendorConfig = config.vendorConfig?.ollama || {};
    const host = config.host ?? vendorConfig.host;

    this.config = {
      model: config.model || "llama3.2",
      host,
      defaultHeaders: config.defaultHeaders,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK,
      stopSequences: config.stopSequences,
      seed: config.seed,
      think: config.think,
    };

    this.addSystemMessage(this.getSystemMessage());
  }

  private async getClient(): Promise<{
    chat: (params: unknown) => Promise<unknown>;
    list: () => Promise<{ models: OllamaModelInfo[] }>;
  }> {
    if (!this._client) {
      const pkg = "ollama";
      try {
        const mod = (await import(pkg)) as {
          Ollama?: new (opts: unknown) => unknown;
          default?: { Ollama?: new (opts: unknown) => unknown };
        };
        const OllamaClass = mod.Ollama ?? mod.default?.Ollama;
        if (!OllamaClass) {
          throw new Error("Could not find Ollama class in ollama package");
        }
        this._client = new OllamaClass({
          host: this.config.host,
          headers: this.config.defaultHeaders,
        });
      } catch (err) {
        throw new ExecutionError(
          `Failed to load 'ollama' package. Install it with: npm install ollama\n${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
    return this._client as {
      chat: (params: unknown) => Promise<unknown>;
      list: () => Promise<{ models: OllamaModelInfo[] }>;
    };
  }

  /**
   * List the models currently available on the Ollama server.
   *
   * `id` is the tag to pass as `model` (e.g. `"llama3.2:latest"`) and `created`
   * carries the local `modified_at` timestamp — Ollama reports when a model was
   * last pulled or changed on this machine, not when it was released.
   */
  async listModels(): Promise<ModelInfo<OllamaModelInfo>[]> {
    try {
      const client = await this.getClient();
      const response = await client.list();
      return response.models.map((model) => ({
        id: model.model,
        displayName: model.name,
        created: model.modified_at ? new Date(model.modified_at) : undefined,
        raw: model,
      }));
    } catch (error: unknown) {
      throw new ExecutionError(
        `Failed to list Ollama models: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  protected getToolDefinitions(): OllamaToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: "function" as const,
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
    this.resetTokenUsage();
    this.currentToolCallCount = 0;

    const inputPreview =
      typeof input === "string" ? input : JSON.stringify(input);

    if (vizConfig.isEnabled()) {
      this.vizEventId = vizReporter.agentStart(
        this.id,
        this.name,
        this.config.model!,
        "ollama",
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
      await this.getClient(); // ensure client is cached before handleResponse loop
      const response = await this.callOllama();
      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response as OllamaResponse);
    } catch (error: unknown) {
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
        `Ollama error: ${
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

  private buildOptions(): OllamaOptions {
    const opts: OllamaOptions = {};
    if (this.config.temperature !== undefined)
      opts.temperature = this.config.temperature;
    if (this.config.topP !== undefined) opts.top_p = this.config.topP;
    if (this.config.topK !== undefined) opts.top_k = this.config.topK;
    if (this.config.seed !== undefined) opts.seed = this.config.seed;
    if (this.config.maxTokens !== undefined)
      opts.num_predict = this.config.maxTokens;
    if (this.config.stopSequences?.length)
      opts.stop = this.config.stopSequences;
    if (this.config.think) opts.think = this.config.think;
    return opts;
  }

  private async callOllama(): Promise<unknown> {
    const client = await this.getClient();
    const messages = ollamaTransformer.toProvider(this.history.getEntries());
    const tools = this.tools.size > 0 ? this.getToolDefinitions() : undefined;
    const options = this.buildOptions();
    this.startTurnTimer();
    return client.chat({
      model: this.config.model!,
      messages,
      tools,
      stream: false,
      think: this.config.think,
      options: Object.keys(options).length > 0 ? options : undefined,
    });
  }

  protected async handleResponse(response: unknown): Promise<string> {
    const ollamaResponse = response as OllamaResponse;

    const usage = this.accumulateUsage(this.parseUsage(ollamaResponse));

    if (ollamaResponse.done_reason === "length") {
      const error = new MaxTokensExceededError(
        "Response exceeded maximum token limit",
        this.config.maxTokens || 2048
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

    const message = ollamaResponse.message;
    const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;

    if (!hasToolCalls) {
      const textContent = message.content || "";

      const entry = ollamaTransformer.fromProviderMessage(message, []);
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

    // Generate IDs — Ollama doesn't provide tool call IDs
    const generatedIds = toolCalls.map(
      (_: unknown, i: number) => `ollama_${Date.now()}_${i}`
    );

    const assistantEntry = ollamaTransformer.fromProviderMessage(
      message,
      generatedIds
    );
    this.addToHistory(assistantEntry);

    const toolResults = await this.handleToolCalls(toolCalls, generatedIds);

    for (const result of toolResults) {
      const resultEntry = ollamaTransformer.toolResultEntry(
        result.toolCallId,
        result.content
      );
      this.addToHistory(resultEntry);
    }

    // Continue conversation with tool results
    try {
      const newResponse = await this.callOllama();
      this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
      return this.handleResponse(newResponse);
    } catch (error: unknown) {
      const executionError = new ExecutionError(
        `Ollama error during tool response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      this.emit(AgentEvent.ERROR, executionError);
      throw executionError;
    }
  }

  private async handleToolCalls(
    toolCalls: OllamaToolCall[],
    generatedIds: string[]
  ): Promise<Array<{ toolCallId: string; content: string }>> {
    return Promise.all(
      toolCalls.map(async (toolCall, idx) => {
        const toolName = toolCall.function.name;
        const tool = this.tools.get(toolName);
        const toolCallId = generatedIds[idx];

        if (!tool) {
          const errorMessage = `Tool '${toolName}' not found`;
          const error = new ToolExecutionError(
            errorMessage,
            toolName,
            toolCall.function.arguments
          );
          this.emit(AgentEvent.TOOL_ERROR, error);
          return { toolCallId, content: errorMessage };
        }

        try {
          const args =
            typeof toolCall.function.arguments === "string"
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;

          const result = await tool.execute(
            this.getId(),
            this.getName(),
            args as Record<string, unknown>,
            toolCallId,
            this.config.model,
            "ollama"
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

  protected parseUsage(input: unknown): TokenUsage {
    const response = input as OllamaResponse;

    // Ollama reports its own timings in nanoseconds. Time to first token is
    // model load plus prompt evaluation — everything before generation starts.
    const toMs = (ns?: number): number | undefined =>
      ns === undefined ? undefined : ns / 1_000_000;
    const timeToFirstTokenMs =
      response.prompt_eval_duration === undefined
        ? undefined
        : toMs((response.load_duration ?? 0) + response.prompt_eval_duration);

    return {
      input_tokens: response.prompt_eval_count ?? 0,
      output_tokens: response.eval_count ?? 0,
      total_tokens:
        (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
      timeToFirstTokenMs,
      generationMs: toMs(response.eval_duration),
      totalMs: toMs(response.total_duration),
    };
  }
}

// Internal response shape from the ollama package
type OllamaToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown> | string;
  };
};

type OllamaResponse = {
  model: string;
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  done_reason?: string;
  eval_count?: number;
  prompt_eval_count?: number;
  /** Nanoseconds spent on the whole request. */
  total_duration?: number;
  /** Nanoseconds spent loading the model into memory. */
  load_duration?: number;
  /** Nanoseconds spent evaluating the prompt. */
  prompt_eval_duration?: number;
  /** Nanoseconds spent generating the response. */
  eval_duration?: number;
};

/**
 * A model available on the Ollama server, as returned by `client.list()`.
 */
export type OllamaModelInfo = {
  name: string;
  model: string;
  modified_at: Date;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
};
