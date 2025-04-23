import { History } from "./History";

interface RedisInstance {
  get(key: string): Promise<string | null>;
  set(key: string, content: string): Promise<"OK">;
}

export class RedisHistory extends History {
  constructor(private redisInstance: RedisInstance) {
    super([], { transient: false });
  }

  /**
   * Loads history entries from Redis using the specified key
   *
   * @param {string} key - The Redis key to retrieve history entries from
   * @returns {Promise<void>} A promise that resolves when history is loaded
   * @throws {Error} If there's an issue retrieving or parsing the history entries
   */
  async load(key: string): Promise<void> {
    try {
      // Retrieve the serialized history from Redis
      const serializedHistory = await this.redisInstance.get(key);

      // If no history exists for the key, return early
      if (!serializedHistory) {
        return;
      }
      // Parse the serialized history and create a new History instance
      const entries = JSON.parse(serializedHistory);
      this._entries = entries;
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
      // Serialize the current history entries
      const serializedHistory = this.toJSON();
      // Save the serialized history to Redis
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
