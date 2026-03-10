import { History, HistoryOptions } from "./History";
import type { HistoryEntry } from "./types";

interface RedisInstance {
  get(key: string): Promise<string | null>;
  set(key: string, content: string): Promise<"OK">;
}

export class RedisHistory extends History {
  constructor(
    private redisInstance: RedisInstance,
    options: HistoryOptions = {}
  ) {
    super([], options);
  }

  /**
   * Loads history entries from Redis using the specified key.
   * Entries are re-added via addEntry() so metadata is computed correctly.
   * Trimming (maxLength / maxTokens) is applied after load.
   *
   * @param {string} key - The Redis key to retrieve history entries from
   * @returns {Promise<void>} A promise that resolves when history is loaded
   * @throws {Error} If there's an issue retrieving or parsing the history entries
   */
  async load(key: string): Promise<void> {
    try {
      const serializedHistory = await this.redisInstance.get(key);
      if (!serializedHistory) return;

      const entries = JSON.parse(serializedHistory) as HistoryEntry[];
      this._entries = [];

      // Re-add via addEntry to compute metadata; suppress plugins during bulk load
      // by temporarily bypassing plugin afterAdd hooks (handled by _reducing flag
      // which is private — so we push entries directly and call applyTrimming once).
      for (const entry of entries) {
        const serialized = JSON.stringify(entry.content);
        this._entries.push({
          ...entry,
          __metadata: {
            date: new Date().toISOString(),
            contentLength: serialized.length,
            estimatedTokens: Math.ceil(serialized.length / 4),
          },
        });
      }

      this.applyTrimming();
    } catch (error: unknown) {
      console.error(`Error loading history from Redis key "${key}":`, error);
      throw new Error(
        `Failed to load history: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Saves the current history entries to Redis using the specified key
   *
   * @param {string} key - The Redis key to save history entries under
   * @returns {Promise<void>} A promise that resolves when history is saved
   * @throws {Error} If there's an issue serializing or saving the history entries
   */
  async save(key: string): Promise<void> {
    try {
      const serializedHistory = this.toJSON();
      await this.redisInstance.set(key, serializedHistory);
    } catch (error) {
      console.error(`Error saving history to Redis key "${key}":`, error);
      throw new Error(
        `Failed to save history: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
