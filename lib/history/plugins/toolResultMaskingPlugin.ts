import { Tool } from "../../tools/Tool";
import { isToolUseContent, isToolResultContent } from "../types";
import type { HistoryPlugin, ReducibleEntry, History } from "../History";

export type ToolResultMaskingOptions = {
  /**
   * Number of most-recent tool results to keep verbatim.
   * Older results are replaced with a reference marker.
   * @default 2
   */
  keepRecentResults?: number;
  /**
   * Tool names that are never masked, regardless of age or size.
   * Mutually exclusive with `include`.
   */
  exclude?: string[];
  /**
   * When set, only results from these tools are masked.
   * Mutually exclusive with `exclude`.
   */
  include?: string[];
  /**
   * Skip masking for results whose estimated token count is below this
   * threshold. Small results don't consume a `keepRecentResults` slot.
   */
  minTokensToMask?: number;
};

/**
 * A HistoryPlugin with an attached `retrieveTool`.
 * Register the plugin with `history.use(maskingPlugin)`, then add
 * `maskingPlugin.retrieveTool` to the agent's tool list so the model can
 * fetch masked results on demand.
 */
export type ToolResultMaskingPlugin = HistoryPlugin & {
  /** Tool the agent can call to retrieve a masked result by its tool_use_id. */
  readonly retrieveTool: Tool<string>;
};

/**
 * Creates a read-time tool result masking plugin.
 *
 * Old tool results are replaced with a reference marker `[MASKED - ref: <id>]`
 * at read time via `history.getEntries()`. Stored entries are never mutated —
 * the full content is always available via `history.getToolResult(id)` or the
 * attached `retrieveTool`.
 *
 * Only results that pass the include/exclude/minTokensToMask filters are
 * candidates for masking. Filtered-out results stay verbatim and do not
 * consume a `keepRecentResults` slot.
 *
 * @throws If both `exclude` and `include` are provided.
 *
 * @example
 * ```typescript
 * const maskingPlugin = toolResultMaskingPlugin({
 *   keepRecentResults: 2,
 *   exclude: ["calculator", "get_date"],
 *   minTokensToMask: 50,
 * });
 *
 * history.use(maskingPlugin);
 *
 * const agent = new ClaudeAgent({
 *   tools: [maskingPlugin.retrieveTool, ...otherTools],
 * }, history);
 * ```
 */
export function toolResultMaskingPlugin(
  options?: ToolResultMaskingOptions
): ToolResultMaskingPlugin {
  const {
    keepRecentResults = 2,
    exclude,
    include,
    minTokensToMask,
  } = options ?? {};

  if (exclude && include) {
    throw new Error(
      "toolResultMaskingPlugin: `exclude` and `include` are mutually exclusive"
    );
  }

  if (keepRecentResults === 0) {
    console.warn(
      "[toolResultMaskingPlugin] keepRecentResults: 0 masks all tool results. " +
        "Ensure maskingPlugin.retrieveTool is added to the agent's tool list."
    );
  }

  // History reference captured at registration time via onRegistered
  let _history: History | undefined;

  const retrieveTool = new Tool<string>({
    name: "retrieve_tool_result",
    description:
      "Retrieve the full result of a previous tool call that has been masked " +
      "in the conversation history. Use this when you need to re-examine an " +
      "earlier tool result.",
    inputSchema: {
      type: "object",
      properties: {
        tool_call_id: {
          type: "string",
          description: "The tool_use_id of the masked tool result to retrieve",
        },
      },
      required: ["tool_call_id"],
    },
    execute: async (input: { tool_call_id: string }): Promise<string> => {
      if (!_history) {
        throw new Error(
          "retrieve_tool_result: plugin has not been registered with a history " +
            "instance. Call history.use(maskingPlugin) before executing the agent."
        );
      }
      const result = _history.getToolResult(input.tool_call_id);
      if (result === undefined) {
        return `No tool result found for id: ${input.tool_call_id}`;
      }
      return result;
    },
  });

  const plugin: ToolResultMaskingPlugin = {
    get retrieveTool() {
      return retrieveTool;
    },

    onRegistered(history: History): void {
      _history = history;
    },

    transform(entries: ReducibleEntry[]): ReducibleEntry[] {
      // First pass: build a map of tool_use_id → tool_name from tool_use blocks
      const toolNameById = new Map<string, string>();
      for (const entry of entries) {
        for (const block of entry.content) {
          if (isToolUseContent(block)) {
            toolNameById.set(block.id, block.name);
          }
        }
      }

      // Second pass: identify maskable tool_result blocks
      // A result is maskable when it passes include/exclude and minTokensToMask
      type ResultRef = { entryIdx: number; blockIdx: number; id: string };
      const maskable: ResultRef[] = [];

      const sessionAnchor = _history?.sessionAnchor ?? null;

      for (let ei = 0; ei < entries.length; ei++) {
        // Never mask entries from the current execute() session — doing so
        // would cause the model to call retrieve_tool_result mid-loop, whose
        // result would itself be masked, creating an infinite retrieval loop.
        if (sessionAnchor !== null && ei >= sessionAnchor) continue;

        const entry = entries[ei];
        for (let bi = 0; bi < entry.content.length; bi++) {
          const block = entry.content[bi];
          if (!isToolResultContent(block)) continue;

          const toolName = toolNameById.get(block.tool_use_id) ?? "";

          // include mode: only mask listed tools
          if (include && !include.includes(toolName)) continue;
          // exclude mode: skip listed tools
          if (exclude && exclude.includes(toolName)) continue;

          // minTokensToMask: skip small results
          if (minTokensToMask !== undefined) {
            const estimatedTokens = Math.ceil(block.content.length / 4);
            if (estimatedTokens < minTokensToMask) continue;
          }

          maskable.push({ entryIdx: ei, blockIdx: bi, id: block.tool_use_id });
        }
      }

      // Determine which maskable results to mask (all but the last N)
      const toMask = new Set<string>();
      const keepFrom = Math.max(0, maskable.length - keepRecentResults);
      for (let i = 0; i < keepFrom; i++) {
        toMask.add(maskable[i].id);
      }

      if (toMask.size === 0) return entries;

      // Third pass: build new entry array with masked content (never mutate originals)
      return entries.map((entry) => {
        const needsChange = entry.content.some(
          (block) =>
            isToolResultContent(block) && toMask.has(block.tool_use_id)
        );
        if (!needsChange) return entry;

        const newContent = entry.content.map((block) => {
          if (isToolResultContent(block) && toMask.has(block.tool_use_id)) {
            return {
              ...block,
              content: `[MASKED - ref: ${block.tool_use_id}]`,
            };
          }
          return block;
        });

        return { ...entry, content: newContent };
      });
    },
  };

  return plugin;
}
