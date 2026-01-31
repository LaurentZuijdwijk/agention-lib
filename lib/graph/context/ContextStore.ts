/**
 * Simple key-value store for sharing data between agents in a graph.
 * Accessed via tools with descriptive keys.
 *
 * @example
 * ```typescript
 * const store = new ContextStore({ userId: '123' });
 * store.set('research_findings', { topic: 'AI', summary: '...' });
 * const findings = store.get<{ topic: string; summary: string }>('research_findings');
 * ```
 */
export class ContextStore {
  private store: Map<string, unknown> = new Map();

  /**
   * Create a new ContextStore with optional initial values.
   * @param initial - Initial key-value pairs to populate the store
   */
  constructor(initial?: Record<string, unknown>) {
    if (initial) {
      for (const [key, value] of Object.entries(initial)) {
        this.store.set(key, value);
      }
    }
  }

  /**
   * Set a value with a descriptive key.
   * @param key - A descriptive key for this value (e.g., "research_findings", "user_preferences")
   * @param value - The value to store
   */
  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  /**
   * Get a value by key.
   * @param key - The key to retrieve
   * @returns The value if found, undefined otherwise
   */
  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  /**
   * Check if a key exists in the store.
   * @param key - The key to check
   * @returns True if the key exists
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Delete a key from the store.
   * @param key - The key to delete
   * @returns True if the key was deleted, false if it didn't exist
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Get all keys in the store.
   * @returns Array of all keys
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get the number of entries in the store.
   * @returns The number of entries
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Get all entries as a plain object.
   * @returns Object with all key-value pairs
   */
  toObject(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of this.store) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Clear all entries from the store.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Create a clone of this context store.
   * Note: This performs a shallow clone of values.
   * @returns A new ContextStore with the same entries
   */
  clone(): ContextStore {
    return new ContextStore(this.toObject());
  }
}
