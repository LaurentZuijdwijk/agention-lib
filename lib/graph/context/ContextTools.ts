import { Tool } from "../../tools/Tool";
import { ContextStore } from "./ContextStore";

/**
 * Create a tool for agents to read from shared context.
 *
 * @param store - The ContextStore to read from
 * @returns A Tool that retrieves values from the context store
 *
 * @example
 * ```typescript
 * const store = new ContextStore();
 * const getTool = createContextGetTool(store);
 * agent.addTools([getTool]);
 * ```
 */
export function createContextGetTool(store: ContextStore): Tool<string> {
  return new Tool({
    name: "context_get",
    description:
      "Get a value from shared context by its descriptive key. Use list_context_keys first to see available keys.",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The descriptive key to retrieve",
        },
      },
      required: ["key"],
    },
    execute: async (input: { key: string }): Promise<string> => {
      const value = store.get(input.key);
      if (value === undefined) {
        return JSON.stringify({
          error: `Key "${input.key}" not found`,
          availableKeys: store.keys(),
        });
      }
      return JSON.stringify({ key: input.key, value });
    },
  });
}

/**
 * Create a tool for agents to write to shared context.
 *
 * @param store - The ContextStore to write to
 * @returns A Tool that stores values in the context store
 *
 * @example
 * ```typescript
 * const store = new ContextStore();
 * const setTool = createContextSetTool(store);
 * agent.addTools([setTool]);
 * ```
 */
export function createContextSetTool(store: ContextStore): Tool<string> {
  return new Tool({
    name: "context_set",
    description:
      'Store a value in shared context with a descriptive key. Use clear, descriptive keys like "research_findings", "user_preferences", "analysis_results".',
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "A descriptive key for this value",
        },
        value: {
          type: "string",
          description: "The value to store (JSON string for complex data)",
        },
      },
      required: ["key", "value"],
    },
    execute: async (input: { key: string; value: string }): Promise<string> => {
      // Try to parse JSON, otherwise store as string
      let parsedValue: unknown = input.value;
      try {
        parsedValue = JSON.parse(input.value);
      } catch {
        // Keep as string if not valid JSON
      }
      store.set(input.key, parsedValue);
      return JSON.stringify({ success: true, key: input.key });
    },
  });
}

/**
 * Create a tool for agents to list available context keys.
 *
 * @param store - The ContextStore to list keys from
 * @returns A Tool that lists all keys in the context store
 *
 * @example
 * ```typescript
 * const store = new ContextStore();
 * const listTool = createContextListTool(store);
 * agent.addTools([listTool]);
 * ```
 */
export function createContextListTool(store: ContextStore): Tool<string> {
  return new Tool({
    name: "list_context_keys",
    description: "List all available keys in the shared context.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async (): Promise<string> => {
      return JSON.stringify({ keys: store.keys() });
    },
  });
}

/**
 * Create a tool for agents to delete a key from context.
 *
 * @param store - The ContextStore to delete from
 * @returns A Tool that deletes keys from the context store
 */
export function createContextDeleteTool(store: ContextStore): Tool<string> {
  return new Tool({
    name: "context_delete",
    description: "Delete a key from the shared context.",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The key to delete",
        },
      },
      required: ["key"],
    },
    execute: async (input: { key: string }): Promise<string> => {
      const existed = store.delete(input.key);
      return JSON.stringify({
        success: true,
        deleted: existed,
        key: input.key,
      });
    },
  });
}
