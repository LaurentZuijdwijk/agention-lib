import EventEmitter from "events";
import {
  HistoryEntry,
  MessageRole,
  MessageContent,
  text,
  isTextContent,
  isToolResultContent,
} from "./types";
import type { ReduceOptions } from "./types";

// Cached tokenx estimator — starts as a character-based fallback and is
// replaced with the real tokenx implementation once the module loads.
let _estimateTokenCount: (text: string) => number = (t: string) =>
  Math.ceil(t.length / 4);

void import("tokenx")
  .then((mod) => {
    _estimateTokenCount = mod.estimateTokenCount;
  })
  .catch(() => {
    /* keep fallback */
  });

/** @internal — exposed for test teardown only */
export function resetTokenxCache(): void {
  _estimateTokenCount = (t: string) => Math.ceil(t.length / 4);
}

// Re-export types for convenience
export type { HistoryEntry, MessageRole, MessageContent, ReduceOptions } from "./types";
export {
  text,
  toolUse,
  toolResult,
  textMessage,
  isTextContent,
  isToolUseContent,
  isToolResultContent,
} from "./types";

// =============================================================================
// Plugin system types
// =============================================================================

/**
 * Metadata stored alongside each history entry.
 * Extended with summary tracking fields for the compression plugin.
 */
export type EntryMetadata = {
  date: string;
  contentLength: number;
  estimatedTokens: number;
  /**
   * True when this entry was produced by a compression plugin as a rolling
   * summary of earlier turns. Used so subsequent compressions can include
   * the existing summary as prior context rather than treating it as a
   * regular conversation turn.
   */
  isSummary?: boolean;
  /**
   * ISO date range covered by a summary entry.
   * Only present when isSummary is true.
   */
  coversRange?: { from: string; to: string };
};

/**
 * A history entry with its internal metadata attached.
 * Passed to plugin reduce() and transform() hooks.
 */
export type ReducibleEntry = HistoryEntry & { __metadata: EntryMetadata };

/**
 * A history plugin. Register with `history.use(plugin)`.
 *
 * Hooks:
 * - `onRegistered` — called once immediately when the plugin is registered
 * - `afterAdd` — called fire-and-forget after every addEntry(); errors are
 *   routed to the `onPluginError` option / `"pluginError"` event, never thrown
 * - `reduce` — called by history.reduce(); receives and returns the full
 *   entry array; plugins are piped in registration order
 * - `transform` — pure read-time rewrite; called by history.getEntries();
 *   sync, cheap, must not mutate stored entries; applied in registration order
 */
export type HistoryPlugin = {
  onRegistered?: (history: History) => void;
  afterAdd?: (history: History) => void | Promise<void>;
  reduce?: (
    entries: ReducibleEntry[],
    options: ReduceOptions
  ) => Promise<ReducibleEntry[]>;
  transform?: (entries: ReducibleEntry[]) => ReducibleEntry[];
};

/**
 * Internal entry with metadata
 */
type EntryWithMetadata = ReducibleEntry;

/**
 * History configuration options
 */
type HistoryOptions = {
  maxLength?: number;
  /**
   * Maximum estimated tokens to retain in history. When exceeded, oldest
   * non-system entries are dropped via the addEntry() safety net.
   * The system message is always preserved.
   */
  maxTokens?: number;
  transient?: boolean;
  /**
   * Called when a plugin's afterAdd hook throws. If not provided, the error
   * is re-emitted as a "pluginError" event on the History instance.
   */
  onPluginError?: (
    error: Error,
    plugin: HistoryPlugin,
    hook: "afterAdd"
  ) => void;
};

/**
 * Manages conversation history in a provider-agnostic format.
 *
 * This class stores history entries in a normalized format that can be
 * transformed to any LLM provider's native format using the transformers.
 *
 * History can be shared between agents of different providers, enabling
 * cross-provider conversations and handoffs.
 *
 * Plugins can be registered with `history.use(plugin)` to add read-time
 * transforms (e.g., tool result masking) or async reduce strategies
 * (e.g., rolling LLM summarization).
 *
 * @example Basic usage
 * ```typescript
 * const history = new History();
 * history.addText("user", "Hello!");
 * history.addText("assistant", "Hi there!");
 * ```
 *
 * @example With tool result masking plugin
 * ```typescript
 * import { toolResultMaskingPlugin } from "agention-lib/history/plugins";
 *
 * const maskingPlugin = toolResultMaskingPlugin({ keepRecentResults: 2 });
 * const history = new History().use(maskingPlugin);
 *
 * const agent = new ClaudeAgent(
 *   { tools: [maskingPlugin.retrieveTool, ...otherTools] },
 *   history
 * );
 * ```
 *
 * @example Sharing between agents
 * ```typescript
 * const history = new History();
 * const claudeAgent = new ClaudeAgent({ ... }, history);
 * const openAiAgent = new OpenAiAgent({ ... }, history);
 * // Both agents share the same conversation history
 * ```
 */
export class History extends EventEmitter {
  protected _entries: EntryWithMetadata[] = [];
  private options: HistoryOptions;
  public transient: boolean = false;
  private _plugins: HistoryPlugin[] = [];
  private _reducing = false;

  constructor(entries: HistoryEntry[] = [], options: HistoryOptions = {}) {
    super();
    this.options = options;
    this.transient = Boolean(options?.transient);

    // Convert initial entries to internal format with metadata
    for (const entry of entries) {
      this.addEntry(entry);
    }
  }

  // ===========================================================================
  // Plugin registration
  // ===========================================================================

  /**
   * Register a plugin with this history instance.
   * Calls plugin.onRegistered(this) immediately after registration.
   * Returns `this` for chaining.
   *
   * @example
   * ```typescript
   * history
   *   .use(compressionPlugin(summaryAgent))
   *   .use(toolResultMaskingPlugin({ keepRecentResults: 2 }));
   * ```
   */
  use(plugin: HistoryPlugin): this {
    this._plugins.push(plugin);
    plugin.onRegistered?.(this);
    return this;
  }

  // ===========================================================================
  // Core write operations
  // ===========================================================================

  /**
   * Add a complete history entry
   */
  addEntry(entry: HistoryEntry): void {
    const serialized = JSON.stringify(entry.content);
    const contentLength = serialized.length;
    const __metadata: EntryMetadata = {
      date: new Date().toISOString(),
      contentLength,
      estimatedTokens: _estimateTokenCount(serialized),
    };

    this._entries.push({
      ...entry,
      __metadata,
    });

    if (this.options.maxLength && this._entries.length > this.options.maxLength) {
      this._entries = this._entries.slice(this._entries.length - this.options.maxLength);
    }

    if (this.options.maxTokens) {
      this.trimToTokenBudget();
    }

    this.emit("entry", entry);

    // Fire plugin afterAdd hooks. Skipped during reduce() to avoid recursion
    // when compression plugins add summary entries to the history.
    if (!this._reducing) {
      for (const plugin of this._plugins) {
        if (!plugin.afterAdd) continue;
        void Promise.resolve(plugin.afterAdd(this)).catch((err: unknown) => {
          const error = err instanceof Error ? err : new Error(String(err));
          if (this.options.onPluginError) {
            this.options.onPluginError(error, plugin, "afterAdd");
          } else {
            this.emit("pluginError", error, plugin, "afterAdd");
          }
        });
      }
    }
  }

  /**
   * Add a simple text message
   */
  addText(role: MessageRole, content: string): void {
    this.addEntry({
      role,
      content: [text(content)],
    });
  }

  /**
   * Add a message with multiple content blocks
   */
  addMessage(role: MessageRole, content: MessageContent[]): void {
    this.addEntry({ role, content });
  }

  /**
   * Add a system message
   */
  addSystem(content: string): void {
    this.addText("system", content);
  }

  // ===========================================================================
  // Read operations
  // ===========================================================================

  /**
   * Get entries as agents should see them — with all registered transform
   * plugins applied in registration order.
   *
   * Use this when building API requests. The raw `entries` getter is
   * reserved for serialization, cloning, and other internal purposes.
   */
  getEntries(): HistoryEntry[] {
    let entries: ReducibleEntry[] = this._entries;
    for (const plugin of this._plugins) {
      if (plugin.transform) {
        entries = plugin.transform(entries);
      }
    }
    return entries.map(({ __metadata, ...rest }) => rest);
  }

  /**
   * Get all entries without transform plugins applied (raw storage).
   * Use for serialization, cloning, and debugging.
   */
  get entries(): HistoryEntry[] {
    return this._entries.map((entry) => {
      const { __metadata, ...rest } = entry;
      return rest;
    });
  }

  /**
   * Get the full content of a tool result by its tool_use_id.
   * Always reads from raw stored entries — never affected by transform plugins.
   *
   * For RedisHistory: call await load() before using this method.
   *
   * @returns The full result string, or undefined if not found.
   */
  getToolResult(tool_use_id: string): string | undefined {
    for (const entry of this._entries) {
      for (const block of entry.content) {
        if (isToolResultContent(block) && block.tool_use_id === tool_use_id) {
          return block.content;
        }
      }
    }
    return undefined;
  }

  /**
   * Get the number of entries
   */
  get length(): number {
    return this._entries.length;
  }

  /**
   * Get total content size in characters
   */
  get size(): number {
    return this._entries.reduce((total, { __metadata }) => {
      return total + __metadata.contentLength;
    }, 0);
  }

  /**
   * Get total estimated token count across all entries.
   * Uses a rough approximation of 1 token ≈ 4 characters.
   */
  get totalEstimatedTokens(): number {
    return this._entries.reduce((total, { __metadata }) => {
      return total + __metadata.estimatedTokens;
    }, 0);
  }

  /**
   * Get the last entry
   */
  lastEntry(): HistoryEntry | undefined {
    if (this._entries.length === 0) return undefined;
    const { __metadata, ...entry } = this._entries[this._entries.length - 1];
    return entry;
  }

  /**
   * Get system message if present
   */
  getSystemMessage(): string | undefined {
    const systemEntry = this._entries.find((e) => e.role === "system");
    if (!systemEntry) return undefined;

    return systemEntry.content
      .filter(isTextContent)
      .map((c) => c.text)
      .join("\n");
  }

  /**
   * Get entries without system messages, with transform plugins applied.
   */
  getMessagesWithoutSystem(): HistoryEntry[] {
    return this.getEntries().filter((e) => e.role !== "system");
  }

  // ===========================================================================
  // Async reduction
  // ===========================================================================

  /**
   * Asynchronously compact history using registered reduce plugins.
   *
   * Plugins are called in registration order, each receiving and returning
   * the full entry array. If no plugin has a `reduce` hook, this is a no-op —
   * the addEntry() safety net (FIFO drop via maxTokens) runs independently.
   *
   * Re-entrant calls during an in-progress reduce() return immediately.
   *
   * @example Rolling summarization
   * ```typescript
   * history.use(compressionPlugin(summaryAgent));
   * await history.reduce({ maxTokens: 4000 });
   * ```
   */
  async reduce(options: ReduceOptions = {}): Promise<void> {
    if (this._reducing) return;

    const hasReducePlugin = this._plugins.some((p) => Boolean(p.reduce));
    if (!hasReducePlugin) return;

    this._reducing = true;
    try {
      let entries: ReducibleEntry[] = [...this._entries];
      for (const plugin of this._plugins) {
        if (plugin.reduce) {
          entries = await plugin.reduce(entries, options);
        }
      }
      this._entries = entries;
    } finally {
      this._reducing = false;
    }
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  /**
   * Clear all history entries
   */
  clear(): void {
    this._entries = [];
    this.emit("clear");
  }

  /**
   * Serialize history to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.entries);
  }

  /**
   * Create a History instance from JSON
   */
  static fromJSON(json: string, options?: HistoryOptions): History {
    const entries = JSON.parse(json) as HistoryEntry[];
    return new History(entries, options);
  }

  /**
   * Create a copy of this history
   */
  clone(options?: HistoryOptions): History {
    return new History(this.entries, options ?? this.options);
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Drop oldest non-system entries until totalEstimatedTokens fits within budget.
   * Called synchronously from addEntry() as a safety net.
   * The system message is always preserved.
   */
  private trimToTokenBudget(maxTokens?: number): void {
    const budget = maxTokens ?? this.options.maxTokens;
    if (!budget) return;
    while (this.totalEstimatedTokens > budget && this._entries.length > 1) {
      const firstNonSystem = this._entries.findIndex((e) => e.role !== "system");
      if (firstNonSystem === -1) break;
      this._entries.splice(firstNonSystem, 1);
    }
  }
}
