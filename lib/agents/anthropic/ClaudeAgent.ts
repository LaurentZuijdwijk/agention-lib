import { Anthropic, APIError } from "@anthropic-ai/sdk";
import {
  ContentBlock,
  Message,
  RawContentBlockDeltaEvent,
  RawContentBlockStartEvent,
  RawMessageDeltaEvent,
  RawMessageStartEvent,
  ToolUnion,
  ToolUseBlock,
  Usage,
} from "@anthropic-ai/sdk/resources";
import { type ToolDefinition } from "../../tools/Tool";
import { type BuiltInTool } from "../../tools/BuiltInTool";
import { BaseAgent, BaseAgentConfig, TokenUsage } from "../BaseAgent";
import { AgentEvent } from "../AgentEvent";
import {
  AgentError,
  ApiError,
  ExecutionError,
  MaxTokensExceededError,
  ToolExecutionError,
} from "../errors/AgentError";
import { History, toolResult, MessageContent } from "../../history/History";
import { StreamChunk } from "../openai-compatible/OpenAICompatibleAgent";
import { anthropicTransformer } from "../../history/transformers";
import { vizReporter } from "../../viz/VizReporter";
import { vizConfig } from "../../viz/VizConfig";
import { ClaudeModel } from "../model-types";

type AgentConfig = BaseAgentConfig & {
  apiKey: string;
  model?: ClaudeModel;
  maxTokens?: number;
  // Backward compatibility: vendor-specific at top level (deprecated)
  disableParallelToolUse?: boolean;
  metadata?: Record<string, string>;
  /**
   * How `apiKey` should be presented to the Anthropic SDK — `"apiKey"` (default, `x-api-key`
   * header) or `"oauth"` (bearer `authToken`, for OAuth access tokens like Claude Code's
   * `sk-ant-oat...` tokens). Set explicitly; do not infer it from the token's prefix.
   */
  authType?: "apiKey" | "oauth";
  /**
   * Provider-defined / server-side tools (e.g. web search, bash, text editor).
   * These run on Anthropic's infrastructure rather than locally.
   * @see lib/tools/BuiltInTool.ts
   */
  builtInTools?: BuiltInTool[];
  /**
   * Enable extended thinking with this token budget (≥ 1024, and strictly less than
   * `maxTokens`). When set, thinking tokens are streamed as `"reasoning"` chunks and
   * `temperature`/`topP`/`topK` are omitted (required by the API when thinking is on).
   */
  thinkingBudgetTokens?: number;
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

  /** Current visualization event ID for tracking */
  private vizEventId?: string;

  /** Count of tool calls in current execution */
  private currentToolCallCount: number = 0;

  constructor(config: Omit<AgentConfig, "vendor">, history?: History) {
    super({ ...config, vendor: "anthropic" }, history);

    // Merge flat config (deprecated) with nested vendorConfig
    // Flat config takes precedence for backward compatibility
    const vendorConfig = config.vendorConfig?.anthropic || {};
    const disableParallelToolUse =
      config.disableParallelToolUse ??
      vendorConfig.disableParallelToolUse ??
      false;
    const metadata = config.metadata ?? vendorConfig.metadata;
    const builtInTools = config.builtInTools ?? vendorConfig.builtInTools;
    const authType = config.authType ?? vendorConfig.authType ?? "apiKey";
    const thinkingBudgetTokens =
      config.thinkingBudgetTokens ?? vendorConfig.thinkingBudgetTokens;

    this.client = new Anthropic(
      authType === "oauth"
        ? { authToken: config.apiKey, defaultHeaders: config.defaultHeaders }
        : { apiKey: config.apiKey, defaultHeaders: config.defaultHeaders }
    );

    this.config = {
      model: config.model || "claude-haiku-4-5",
      maxTokens: config.maxTokens || 1024,
      disableParallelToolUse,
      metadata,
      builtInTools,
      authType,
      thinkingBudgetTokens,
      apiKey: config.apiKey,
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK,
      stopSequences: config.stopSequences,
    };

    // Add system message to history (skips if already exists with same content)
    this.addSystemMessage(this.getSystemMessage());
  }

  protected getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getPrompt());
  }

  /**
   * Combine locally-executed tool definitions with provider-defined
   * (server-side) built-in tools, in the shape Anthropic's API expects.
   */
  protected getAllToolDefinitions(): ToolUnion[] {
    return [
      ...this.getToolDefinitions(),
      ...(this.config.builtInTools ?? []),
    ] as ToolUnion[];
  }

  /**
   * Build the common `messages.create` params (shared by `execute()` and
   * `executeStream()`), excluding `stream`. When extended thinking is enabled
   * (`thinkingBudgetTokens > 0`) the API requires default sampling, so
   * `temperature`/`top_p`/`top_k` are omitted in favour of the `thinking` block.
   */
  protected buildMessageParams() {
    const messages = anthropicTransformer.toProvider(this.history.getEntries());
    const thinkingEnabled = (this.config.thinkingBudgetTokens ?? 0) > 0;

    return {
      model: this.config.model!,
      system: this.history.getSystemMessage(),
      max_tokens: this.config.maxTokens!,
      messages,
      tools: this.getAllToolDefinitions(),
      stop_sequences: this.config.stopSequences,
      metadata: this.config.metadata,
      ...(thinkingEnabled
        ? {
            thinking: {
              type: "enabled" as const,
              budget_tokens: this.config.thinkingBudgetTokens!,
            },
          }
        : {
            temperature: this.config.temperature,
            top_p: this.config.topP,
            top_k: this.config.topK,
          }),
    };
  }

  protected async process(_input: string): Promise<string> {
    return "";
  }

  async execute(input: string | MessageContent[]): Promise<string> {
    this.emit(AgentEvent.BEFORE_EXECUTE, input);

    // Reset token usage for this execution
    this.resetTokenUsage();
    this.currentToolCallCount = 0;

    // Normalise input to a display string for viz reporting
    const inputPreview =
      typeof input === "string" ? input : JSON.stringify(input);

    // Start visualization reporting
    if (vizConfig.isEnabled()) {
      this.vizEventId = vizReporter.agentStart(
        this.id,
        this.name,
        this.config.model!,
        "anthropic",
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
      this.startTurnTimer();
      const response = (await this.client.messages.create(
        this.buildMessageParams()
      )) as Message;

      this.emit(AgentEvent.AFTER_EXECUTE, response);
      return await this.handleResponse(response);
    } catch (error: unknown) {
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
    } finally {
      this.history.endExecution();
    }
  }

  protected async handleResponse(response: Message): Promise<string> {
    // Store token usage for metrics tracking
    const usage = this.accumulateUsage(this.parseUsage(response.usage));

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
      // Server-side tools (web search, bash, etc.) add their own content blocks
      // (server_tool_use / web_search_tool_result / ...) ahead of the final
      // text — collect every text block rather than assuming content[0] is text.
      const textBlocks = response.content?.filter(
        (block): block is ContentBlock & { type: "text"; text: string } => block.type === "text"
      );

      if (response.content && textBlocks && textBlocks.length > 0) {
        const textContent = textBlocks.map((block) => block.text).join("\n");

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
            textContent
          );
          this.vizEventId = undefined;
        }

        return textContent;
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
          this.startTurnTimer();
          const newResponse = (await this.client.messages.create(
            this.buildMessageParams()
          )) as Message;

          this.emit(AgentEvent.AFTER_EXECUTE, newResponse);
          return this.handleResponse(newResponse);
        } catch (error: unknown) {
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

    const agentSource = {
      agentId: this.getId(),
      agentName: this.getName(),
      model: this.config.model!,
      vendor: "anthropic" as const,
    };

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

          if (vizConfig.isEnabled()) {
            const vizEventId = vizReporter.toolStart(
              block.name,
              block.id,
              block.input,
              agentSource
            );
            vizReporter.toolError(vizEventId, block.name, block.id, errorMessage);
          }

          return toolResult(block.id, errorMessage, true);
        }

        const vizEventId = vizConfig.isEnabled()
          ? vizReporter.toolStart(block.name, block.id, block.input, agentSource)
          : undefined;

        try {
          const result = await tool.execute(
            this.getId(),
            this.getName(),
            block.input as Record<string, unknown>,
            block.id,
            this.config.model,
            "anthropic"
          );

          if (vizEventId) {
            vizReporter.toolComplete(vizEventId, block.name, block.id, true, result);
          }

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

          if (vizEventId) {
            vizReporter.toolError(vizEventId, block.name, block.id, errorMessage);
          }

          return toolResult(block.id, errorMessage, true);
        }
      })
    );

    return results;
  }

  /**
   * Stream a response as an async generator of `StreamChunk` objects.
   * Yields `{ type: "text" }` for visible output and `{ type: "reasoning" }` for
   * extended thinking tokens (models with thinking enabled). Tool calls are handled
   * transparently — the generator continues streaming after each round-trip.
   *
   * @example
   * ```typescript
   * for await (const chunk of agent.executeStream("Explain recursion")) {
   *   if (chunk.type === "text") process.stdout.write(chunk.content);
   *   else process.stderr.write(`[thinking] ${chunk.content}`);
   * }
   * ```
   */
  async *executeStream(input: string | MessageContent[]): AsyncGenerator<StreamChunk> {
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
        "anthropic",
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
      yield* this.streamTurn();
    } catch (error: unknown) {
      if (error instanceof APIError) {
        const apiError = new ApiError(
          `Anthropic API error: ${error.message}`,
          error.status,
          error
        );
        this.emit(AgentEvent.ERROR, apiError);
        if (this.vizEventId) {
          vizReporter.agentError(this.vizEventId, "ApiError", apiError.message, error.status === 429);
          this.vizEventId = undefined;
        }
        throw apiError;
      }
      // Errors raised inside streamTurn() (e.g. MaxTokensExceededError) are
      // already emitted and viz-reported at the throw site — preserve their
      // type rather than re-wrapping them in a generic ExecutionError.
      if (error instanceof AgentError) {
        throw error;
      }
      const executionError = new ExecutionError(
        `Anthropic error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      this.emit(AgentEvent.ERROR, executionError);
      if (this.vizEventId) {
        vizReporter.agentError(this.vizEventId, "ExecutionError", executionError.message, false);
        this.vizEventId = undefined;
      }
      throw executionError;
    } finally {
      this.history.endExecution();
    }
  }

  private async *streamTurn(): AsyncGenerator<StreamChunk> {
    this.startTurnTimer();
    const stream = await this.client.messages.create({
      ...this.buildMessageParams(),
      stream: true,
    });

    // Accumulate every content block by index so the assistant turn can be
    // reconstructed in order — critically including `thinking` blocks (with
    // their signatures), which Anthropic requires to be echoed back on the
    // follow-up request when a tool was used.
    type AccBlock =
      | { kind: "thinking"; thinking: string; signature: string }
      | { kind: "redacted_thinking"; data: string }
      | { kind: "text"; text: string }
      | { kind: "tool_use"; id: string; name: string; inputJson: string };

    const blocks = new Map<number, AccBlock>();
    let textContent = "";
    let stopReason: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (event.type === "message_start") {
        const e = event as RawMessageStartEvent;
        inputTokens = e.message.usage.input_tokens;
        outputTokens = e.message.usage.output_tokens;
      }

      if (event.type === "message_delta") {
        const e = event as RawMessageDeltaEvent;
        stopReason = e.delta.stop_reason ?? stopReason;
        outputTokens += e.usage?.output_tokens ?? 0;
      }

      if (event.type === "content_block_start") {
        const e = event as RawContentBlockStartEvent;
        const block = e.content_block;
        if (block.type === "tool_use") {
          blocks.set(e.index, { kind: "tool_use", id: block.id, name: block.name, inputJson: "" });
        } else if (block.type === "text") {
          blocks.set(e.index, { kind: "text", text: "" });
        } else if (block.type === "thinking") {
          blocks.set(e.index, { kind: "thinking", thinking: "", signature: "" });
        } else if (block.type === "redacted_thinking") {
          blocks.set(e.index, { kind: "redacted_thinking", data: block.data });
        }
      }

      if (event.type === "content_block_delta") {
        // First generated content of the turn — thinking counts, since it is
        // generation time either way.
        this.markFirstToken();
        const e = event as RawContentBlockDeltaEvent;
        const delta = e.delta;
        const acc = blocks.get(e.index);
        if (delta.type === "text_delta") {
          textContent += delta.text;
          if (acc?.kind === "text") acc.text += delta.text;
          this.emit(AgentEvent.CHUNK, delta.text);
          yield { type: "text", content: delta.text };
        } else if (delta.type === "thinking_delta") {
          if (acc?.kind === "thinking") acc.thinking += delta.thinking;
          this.emit(AgentEvent.REASONING_CHUNK, delta.thinking);
          yield { type: "reasoning", content: delta.thinking };
        } else if (delta.type === "signature_delta") {
          if (acc?.kind === "thinking") acc.signature += delta.signature;
        } else if (delta.type === "input_json_delta") {
          if (acc?.kind === "tool_use") acc.inputJson += delta.partial_json;
        }
      }
    }

    this.accumulateUsage({
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    });

    if (stopReason === "max_tokens") {
      const error = new MaxTokensExceededError(
        "Response exceeded maximum token limit",
        this.config.maxTokens || 1024
      );
      this.emit(AgentEvent.MAX_TOKENS_EXCEEDED, error);
      this.emit(AgentEvent.ERROR, error);
      if (this.vizEventId) {
        vizReporter.agentError(this.vizEventId, "MaxTokensExceededError", error.message, false);
        this.vizEventId = undefined;
      }
      throw error;
    }

    // Rebuild the assistant turn in stream order (thinking → text → tool_use).
    const orderedBlocks: ContentBlock[] = Array.from(blocks.entries())
      .sort(([a], [b]) => a - b)
      .map(([, b]): ContentBlock => {
        switch (b.kind) {
          case "thinking":
            return { type: "thinking", thinking: b.thinking, signature: b.signature };
          case "redacted_thinking":
            return { type: "redacted_thinking", data: b.data };
          case "tool_use":
            return {
              type: "tool_use",
              id: b.id,
              name: b.name,
              input: JSON.parse(b.inputJson || "{}") as Record<string, unknown>,
            };
          case "text":
            return { type: "text", text: b.text, citations: [] };
        }
      });

    // Fallback: preserve streamed text even if no text block start was observed.
    if (textContent && !orderedBlocks.some((b) => b.type === "text")) {
      orderedBlocks.push({ type: "text", text: textContent, citations: [] });
    }

    const toolUseBlocks = orderedBlocks.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );

    if (stopReason === "tool_use" && toolUseBlocks.length > 0) {
      this.emit(AgentEvent.TOOL_USE, orderedBlocks);
      this.currentToolCallCount += toolUseBlocks.length;

      const assistantEntry = anthropicTransformer.fromProviderContent("assistant", orderedBlocks);
      this.addToHistory(assistantEntry);

      const toolResults = await this.handleToolUse(orderedBlocks);
      this.addMessageToHistory("user", toolResults);

      yield* this.streamTurn();
    } else {
      const assistantEntry = anthropicTransformer.fromProviderContent("assistant", orderedBlocks);
      this.addToHistory(assistantEntry);

      this.emit(AgentEvent.DONE, { content: textContent }, this.lastTokenUsage);

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
    }
  }

  protected parseUsage(input: Usage): TokenUsage {
    return {
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      total_tokens: input.input_tokens + input.output_tokens,
    };
  }
}
