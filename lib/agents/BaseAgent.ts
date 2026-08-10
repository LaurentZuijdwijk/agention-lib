import EventEmitter from "events";
import { Tool } from "../tools/Tool";
import {
  History,
  HistoryEntry,
  MessageRole,
  MessageContent,
  ImageMimeType,
} from "../history/History";
import {
  AgentVendor,
  CommonAgentConfig,
  VendorSpecificConfig,
} from "./AgentConfig";

// Re-export for convenience
export type { HistoryEntry, MessageRole, MessageContent, ImageMimeType };
export type { AgentVendor };

/**
 * Agent config as used across all agents
 * @deprecated Use CommonAgentConfig with vendorConfig instead
 */
export interface BaseAgentConfig extends CommonAgentConfig {
  vendor: AgentVendor;
  vendorConfig?: VendorSpecificConfig;
}

/**
 * Token counts and timing for one or more provider API calls.
 *
 * Counts are always present. Timing fields are optional because their
 * availability depends on the provider and on whether the call was streamed:
 *
 * - `totalMs` is always measured (wall clock around the API call).
 * - `timeToFirstTokenMs` / `generationMs` require either a streamed response
 *   (measured locally) or a provider that reports its own timings
 *   (Ollama, llama.cpp).
 *
 * When usage from several calls is folded together (a tool-use loop, for
 * example) the counts and durations are summed and the rates recomputed from
 * those totals.
 */
export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  /**
   * Reasoning/thinking tokens, where the provider reports them separately
   * (OpenAI, Gemini). These are a subset of `output_tokens`, not an addition
   * to them. Undefined when the provider does not break them out — Anthropic,
   * for instance, folds thinking tokens into `output_tokens`.
   */
  reasoning_tokens?: number;
  /**
   * Milliseconds from sending the request to the first token of the response —
   * prompt upload plus prompt processing.
   */
  timeToFirstTokenMs?: number;
  /** Milliseconds spent generating the response after the first token. */
  generationMs?: number;
  /** Total wall-clock milliseconds spent in provider API calls. */
  totalMs?: number;
  /**
   * Prompt processing throughput: `input_tokens` over `timeToFirstTokenMs`.
   * Undefined when the time to first token is unknown.
   */
  inputTokensPerSecond?: number;
  /**
   * Generation throughput: `output_tokens` over `generationMs`. Falls back to
   * `totalMs` when the first-token time is unknown (an unstreamed call), in
   * which case it is an end-to-end rate rather than a pure generation rate.
   *
   * Accurate wherever thinking is streamed, because the first thinking chunk
   * starts the generation window — verified on Anthropic extended thinking and
   * on DeepSeek via OpenRouter. It over-reports on OpenAI's Responses API,
   * which does not stream raw reasoning: there the thinking finishes before the
   * first visible token, so it lands inside `timeToFirstTokenMs` while its
   * tokens still count toward `output_tokens`. For the visible-output rate on
   * that path, divide `output_tokens - reasoning_tokens` by `generationMs`.
   */
  outputTokensPerSecond?: number;
};

/**
 * The base agent is what the other agents are inheriting from
 * Handles the BaseConfig
 */
export abstract class BaseAgent<
  TInput = unknown,
  TOutput = unknown
> extends EventEmitter {
  protected id: string;
  protected debug: boolean = true;

  protected name: string;
  protected description: string;
  protected tools: Map<string, Tool<unknown>>;
  protected maxHistoryLength: number;
  protected history: History;

  /** The vendor/provider for this agent (anthropic, openai, mistral, gemini) */
  protected vendor: AgentVendor;

  /** The model identifier for this agent */
  protected model: string;

  /**
   * Token counts and timings for the most recent `execute()` call, summed
   * across every provider API call it made (including tool-use follow-ups).
   * Reset at the start of each execution.
   */
  public lastTokenUsage?: TokenUsage;

  /** Start of the API call currently in flight, set by `startTurnTimer()`. */
  private turnStartedAt?: number;

  /** First-token timestamp of the call in flight, set by `markFirstToken()`. */
  private turnFirstTokenAt?: number;

  /**
   * An Agent is the primary LLM entity.
   *
   * @param config
   * @param history History is transient by default, meaning it will be cleared for every question.
   *                 this makes hostory easier to manage and saves cost. If history should be kept in between
   *                 prompts, then supply a History object.
   *
   */
  constructor(
    config: BaseAgentConfig,
    history?: History
  ) {
    super();

    this.id = config.id;
    this.debug = config.debug || false;
    this.name = config.name;
    this.description = config.description;
    this.vendor = config.vendor;
    this.model = config.model || "unknown";
    this.maxHistoryLength = config.maxHistoryLength || 100;

    this.history = history ?? new History([], {
      transient: true,
      maxLength: config.maxHistoryLength,
      maxTokens: config.maxHistoryTokens,
    });

    if (config.agents) {
      const agentTools = config.agents.map((agent) => {
        return Tool.fromAgent(
          agent,
          `You can use this agent ${agent.getName()} to execute tasks`
        );
      });
      config.tools = config.tools
        ? [...config.tools, ...agentTools]
        : agentTools;
    }

    this.tools = new Map((config.tools || []).map((tool) => [tool.name, tool]));
  }

  abstract execute(input: TInput): Promise<TOutput>;

  protected abstract process(input: TInput): Promise<TOutput>;

  protected abstract handleResponse(response: unknown): Promise<unknown>;

  protected getToolDefinitions(): unknown[] {
    return Array.from(this.tools.values()).map((tool) => tool.getPrompt());
  }

  /**
   * Add an entry to history
   */
  protected addToHistory(entry: HistoryEntry): void {
    this.history.addEntry(entry);
  }

  /**
   * Add a text message to history
   */
  protected addTextToHistory(role: MessageRole, content: string): void {
    this.history.addText(role, content);
  }

  /**
   * Add system message to history if it doesn't already exist.
   * Checks if the first system message matches the provided content.
   */
  protected addSystemMessage(content: string): void {
    const existingSystem = this.history.getSystemMessage();
    if (existingSystem === content) {
      // System message already exists with same content, skip
      return;
    }
    this.history.addSystem(content);
  }

  /**
   * Get the standard system message for this agent
   */
  protected getSystemMessage(): string {
    return `You are an agent called ${this.getName()} and should follow these instructions: ${this.getDescription()}`;
  }

  /**
   * Add a message with content blocks to history
   */
  protected addMessageToHistory(
    role: MessageRole,
    content: MessageContent[]
  ): void {
    this.history.addMessage(role, content);
  }

  public addTools(tools: Tool<unknown>[]) {
    tools.forEach((tool) => {
      if (!this.tools.has(tool.name)) {
        this.tools.set(tool.name, tool);
      } else {
        throw new Error(
          `AddTool: Tool ${tool.name} already exists for ${this.getName()}`
        );
      }
    });
  }

  // Getters
  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  getVendor(): AgentVendor {
    return this.vendor;
  }

  getModel(): string {
    return this.model;
  }

  getHistoryEntries(): HistoryEntry[] {
    return this.history.getEntries();
  }

  getTools(): Tool<unknown>[] {
    return [...this.tools.values()];
  }

  clearHistory(): void {
    this.history.clear();
  }

  protected abstract parseUsage(input: unknown): TokenUsage;

  /**
   * Clear accumulated usage. Called at the start of every `execute()` /
   * `executeStream()` so `lastTokenUsage` describes a single execution.
   */
  protected resetTokenUsage(): void {
    this.lastTokenUsage = undefined;
    this.turnStartedAt = undefined;
    this.turnFirstTokenAt = undefined;
  }

  /**
   * Mark the moment a provider API call is sent. Call this immediately before
   * every request so the usage folded in afterwards can be timed.
   */
  protected startTurnTimer(): void {
    this.turnStartedAt = Date.now();
    this.turnFirstTokenAt = undefined;
  }

  /**
   * Mark the arrival of the first token of a streamed response. Subsequent
   * calls within the same turn are ignored, so it is safe to call on every
   * chunk.
   */
  protected markFirstToken(): void {
    if (
      this.turnStartedAt !== undefined &&
      this.turnFirstTokenAt === undefined
    ) {
      this.turnFirstTokenAt = Date.now();
    }
  }

  /**
   * Fold one API call's usage into `lastTokenUsage`, filling in any timings
   * the provider did not report from the local turn timer.
   *
   * @returns the usage for this single call, with timings and rates filled in —
   *          `lastTokenUsage` holds the running total across calls.
   */
  protected accumulateUsage(usage: TokenUsage): TokenUsage {
    const timed = this.applyTurnTiming(usage);
    const previous = this.lastTokenUsage;

    const merged: TokenUsage = previous
      ? {
          input_tokens: previous.input_tokens + timed.input_tokens,
          output_tokens: previous.output_tokens + timed.output_tokens,
          total_tokens: previous.total_tokens + timed.total_tokens,
          reasoning_tokens: sumOptional(
            previous.reasoning_tokens,
            timed.reasoning_tokens
          ),
          timeToFirstTokenMs: sumOptional(
            previous.timeToFirstTokenMs,
            timed.timeToFirstTokenMs
          ),
          generationMs: sumOptional(previous.generationMs, timed.generationMs),
          totalMs: sumOptional(previous.totalMs, timed.totalMs),
        }
      : { ...timed };

    this.lastTokenUsage = withThroughput(merged);
    this.turnStartedAt = undefined;
    this.turnFirstTokenAt = undefined;

    return withThroughput(timed);
  }

  /**
   * Add locally measured timings to a provider-parsed usage object. Timings the
   * provider reported itself (Ollama, llama.cpp) are kept as-is — they exclude
   * network overhead and are more accurate than anything measured here.
   */
  private applyTurnTiming(usage: TokenUsage): TokenUsage {
    if (this.turnStartedAt === undefined) return usage;

    const now = Date.now();
    const timed = { ...usage };

    timed.totalMs ??= now - this.turnStartedAt;

    if (this.turnFirstTokenAt !== undefined) {
      timed.timeToFirstTokenMs ??= this.turnFirstTokenAt - this.turnStartedAt;
      timed.generationMs ??= now - this.turnFirstTokenAt;
    }

    return timed;
  }
}

/**
 * Add two values that may each be undefined, returning undefined only when
 * neither side has a value (so "not reported" never reads as zero).
 */
function sumOptional(a?: number, b?: number): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a + b;
}

/**
 * Derive tokens-per-second rates from the counts and durations on a usage
 * object. Recomputed from totals rather than averaged, so folding several calls
 * together stays correct.
 *
 * Fields that stayed unknown are dropped rather than left as explicit
 * `undefined`, keeping serialized usage free of empty keys.
 */
function withThroughput(usage: TokenUsage): TokenUsage {
  const result = { ...usage };

  if (result.timeToFirstTokenMs) {
    result.inputTokensPerSecond =
      result.input_tokens / (result.timeToFirstTokenMs / 1000);
  }

  const outputWindowMs = result.generationMs || result.totalMs;
  if (outputWindowMs) {
    result.outputTokensPerSecond =
      result.output_tokens / (outputWindowMs / 1000);
  }

  for (const key of Object.keys(result) as (keyof TokenUsage)[]) {
    if (result[key] === undefined) delete result[key];
  }

  return result;
}
