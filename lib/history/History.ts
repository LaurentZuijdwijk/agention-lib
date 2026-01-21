import EventEmitter from "events";
import {
  HistoryEntry,
  MessageRole,
  MessageContent,
  text,
  isTextContent,
} from "./types";

// Re-export types for convenience
export type { HistoryEntry, MessageRole, MessageContent } from "./types";
export {
  text,
  toolUse,
  toolResult,
  textMessage,
  isTextContent,
  isToolUseContent,
  isToolResultContent,
} from "./types";

/**
 * Internal entry with metadata
 */
type EntryWithMetadata = HistoryEntry & {
  __metadata: {
    date: string;
    contentLength: number;
  };
};

/**
 * History configuration options
 */
type HistoryOptions = {
  maxLength?: number;
  transient?: boolean;
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
 * @example Basic usage
 * ```typescript
 * const history = new History();
 * history.addText("user", "Hello!");
 * history.addText("assistant", "Hi there!");
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

  constructor(entries: HistoryEntry[] = [], options: HistoryOptions = {}) {
    super();
    this.options = options;
    this.transient = Boolean(options?.transient);

    // Convert initial entries to internal format with metadata
    for (const entry of entries) {
      this.addEntry(entry);
    }
  }

  /**
   * Add a complete history entry
   */
  addEntry(entry: HistoryEntry): void {
    const __metadata = {
      date: new Date().toISOString(),
      contentLength: JSON.stringify(entry.content).length,
    };

    this._entries.push({
      ...entry,
      __metadata,
    });

    this.emit("entry", entry);
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

  /**
   * Get all entries (without internal metadata)
   */
  get entries(): HistoryEntry[] {
    return this._entries.map((entry) => {
      const { __metadata, ...rest } = entry;
      return rest;
    });
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
   * Get entries without system messages
   */
  getMessagesWithoutSystem(): HistoryEntry[] {
    return this.entries.filter((e) => e.role !== "system");
  }

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
}
