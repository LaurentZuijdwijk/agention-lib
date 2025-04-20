import EventEmitter from "events";
import { BaseAgent } from "../agents/BaseAgent";

export type Role = "user" | "assistant";

export type HistoryEntry =
  | {
      role: string;
      content: any;
    } & Record<string, any>;

type HistoryEntryMetadata = {
  date: string;
  contentLength: number;
};
/**
 * Represents a single entry in the conversation history
 */
type Entry = HistoryEntry & {
  __metadata: HistoryEntryMetadata;
};

interface IHistory {
  addEntry(role: string, content: any): void;
  get entries(): HistoryEntry[];
}

type HistoryOptions = {
  maxLength?: number;
  addDate?: boolean;
  agent?: BaseAgent;
  transient?: boolean;
};

/**
 * Manages conversation history.
 * This class contains history and can be shared between agents. History can be serialised
 * so it can be stored in a (vector) database or to be summarised by an agent.
 * History can be loaded from a JSON object that was previously serialised.
 *
 * History can be shared by multiple agents or it can be constructed for each individual agent.
 * If no history is provided to an agent, a new history object will be created for each request.
 *
 * @implements {EventEmitter}
 * @template T Type of history entries
 */
export class History extends EventEmitter implements IHistory {
  protected _entries: Entry[] = [];
  private options?: HistoryOptions = {};
  public transient: boolean = false;

  constructor(entries: Entry[] = [], options: HistoryOptions = {}) {
    super();
    this._entries = entries;
    this.options = options;
    this.transient = Boolean(options?.transient);
    this.options;
  }

  /**
   * Adds a new entry to the history
   *
   * @param role The role of the message sender
   * @param content The content of the message
   */
  addEntry(role: string | HistoryEntry, content?: any): void {
    const __metadata: HistoryEntryMetadata = {
      date: new Date().toISOString(),
      contentLength: 0,
    };

    if (typeof role !== "string") {
      __metadata.contentLength = JSON.stringify(role).length;
      this._entries.push({
        ...(role as Entry),
        __metadata,
      });

      return;
    }
    __metadata.contentLength = content.length
      ? content.length
      : JSON.stringify(content).length;

    this._entries.push({ role, content, __metadata: __metadata });
  }

  get entries(): HistoryEntry[] {
    return this._entries.map((entry) => {
      const e = { ...entry } as HistoryEntry;
      delete e["__metadata"];
      return e;
    });
  }

  get size(): number {
    return this._entries.reduce((total, { __metadata }) => {
      return total + __metadata.contentLength;
    }, 0);
  }

  /**
   * Clears all history entries
   */
  clear(): void {
    this._entries = [];
  }

  /**
   * Serializes history to JSON
   *
   * @returns JSON representation of history
   */
  toJSON(): string {
    return JSON.stringify(this._entries);
  }

  /**
   * Creates a History instance from JSON
   *
   * @param {string} json JSON string of history entries
   * @returns {History<T>} New History instance
   */
  static fromJSON<T extends Entry>(json: string): History {
    const entries = JSON.parse(json) as T[];
    return new History(entries);
  }
}
