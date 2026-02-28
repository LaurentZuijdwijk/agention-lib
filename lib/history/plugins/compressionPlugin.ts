import { text, isTextContent } from "../types";
import type { ReduceOptions } from "../types";
import type { History, HistoryPlugin, ReducibleEntry, EntryMetadata } from "../History";
import type { BaseAgent } from "../../agents/BaseAgent";

/** Options for {@link compressionPlugin}. */
export type CompressionPluginOptions = {
  /**
   * When set, the plugin automatically calls `history.reduce()` from its
   * `afterAdd` hook whenever the history exceeds the given threshold.
   * The same `ReduceOptions` object is forwarded to `reduce()`.
   *
   * @example
   * ```typescript
   * history.use(compressionPlugin(summaryAgent, { autoReduceWhen: { maxTokens: 6000 } }));
   * ```
   */
  autoReduceWhen?: ReduceOptions;
};

/**
 * Creates a rolling-summary compression plugin.
 *
 * When `history.reduce(options)` is called, this plugin compresses old entries
 * into a single summary entry using the provided agent. On subsequent reduces,
 * the existing summary is included as prior context so the agent can extend it
 * (rolling strategy) — at most one summary entry exists at any time.
 *
 * The summary entry uses `role: "user"` because no LLM provider has a
 * dedicated summary role. Content is always wrapped as
 * `[Earlier conversation summary: ...]` so it can be detected by pattern
 * as well as the `isSummary` metadata flag.
 *
 * Pass `autoReduceWhen` to trigger compression automatically after every
 * `addEntry()` call when the given threshold is exceeded — no manual
 * `history.reduce()` call required.
 *
 * @example
 * ```typescript
 * const summaryAgent = new ClaudeAgent({
 *   id: "summarizer",
 *   name: "Summarizer",
 *   description: "Summarizes conversation history",
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
 *   model: "claude-haiku-4-5-20251001",
 * });
 *
 * // Manual trigger
 * history.use(compressionPlugin(summaryAgent));
 * await history.reduce({ maxTokens: 4000 });
 *
 * // Automatic trigger
 * history.use(compressionPlugin(summaryAgent, { autoReduceWhen: { maxTokens: 6000 } }));
 * ```
 */
export function compressionPlugin(
  agent: BaseAgent,
  options: CompressionPluginOptions = {}
): HistoryPlugin {
  const { autoReduceWhen } = options;

  function shouldAutoReduce(history: History): boolean {
    if (!autoReduceWhen) return false;
    if (autoReduceWhen.maxTokens !== undefined) {
      return history.totalEstimatedTokens > autoReduceWhen.maxTokens;
    }
    if (autoReduceWhen.maxEntries !== undefined) {
      return history.length > autoReduceWhen.maxEntries;
    }
    // olderThan: always trigger so reduce() can evaluate
    if (autoReduceWhen.olderThan !== undefined) return true;
    return false;
  }

  return {
    afterAdd(history: History): void {
      if (!autoReduceWhen) return;
      if (!shouldAutoReduce(history)) return;
      // Fire-and-forget — History._reducing guard prevents re-entrancy
      void history.reduce(autoReduceWhen);
    },

    async reduce(
      entries: ReducibleEntry[],
      options: ReduceOptions
    ): Promise<ReducibleEntry[]> {
      const { maxTokens, maxEntries, olderThan } = options;

      // Separate system entries — always preserved verbatim
      const systemEntries = entries.filter((e) => e.role === "system");
      const nonSystemEntries = entries.filter((e) => e.role !== "system");

      if (nonSystemEntries.length === 0) return entries;

      // Determine which non-system entries to compress
      let toCompress: ReducibleEntry[] = [];

      if (olderThan) {
        const cutoff = olderThan.toISOString();
        toCompress = nonSystemEntries.filter(
          (e) => e.__metadata.date < cutoff
        );
      } else if (maxEntries !== undefined) {
        const totalNonSystem = nonSystemEntries.length;
        if (totalNonSystem <= maxEntries) return entries;
        toCompress = nonSystemEntries.slice(0, totalNonSystem - maxEntries);
      } else if (maxTokens !== undefined) {
        // Accumulate from oldest until we'd fit within budget
        let totalTokens = entries.reduce(
          (sum, e) => sum + e.__metadata.estimatedTokens,
          0
        );
        let i = 0;
        while (totalTokens > maxTokens && i < nonSystemEntries.length) {
          toCompress.push(nonSystemEntries[i]);
          totalTokens -= nonSystemEntries[i].__metadata.estimatedTokens;
          i++;
        }
      }

      if (toCompress.length === 0) return entries;

      // Build prompt — include existing rolling summary as prior context
      const existingSummary = toCompress.find(
        (e) => e.__metadata.isSummary
      );
      const rawToCompress = toCompress.filter(
        (e) => !e.__metadata.isSummary
      );

      let prompt =
        "Produce a concise summary of the following conversation. " +
        "Preserve key facts, decisions, and outcomes. " +
        "Omit filler and repetition.\n\n";

      if (existingSummary) {
        const summaryText = existingSummary.content
          .filter(isTextContent)
          .map((c) => c.text)
          .join("\n");
        prompt += `Prior context:\n${summaryText}\n\nAdditional turns to incorporate:\n`;
      }

      for (const entry of rawToCompress) {
        const lines = entry.content
          .filter(isTextContent)
          .map((c) => c.text)
          .join(" ");
        prompt += `[${entry.role}]: ${lines}\n`;
      }

      const summaryText = await agent.execute(prompt);

      // Determine date range covered by this summary
      const allCompressed = existingSummary
        ? [existingSummary, ...rawToCompress]
        : rawToCompress;
      const earliestDate =
        existingSummary?.__metadata.coversRange?.from ??
        allCompressed[0].__metadata.date;
      const latestDate =
        allCompressed[allCompressed.length - 1].__metadata.date;

      const content = `[Earlier conversation summary: ${summaryText}]`;
      const __metadata: EntryMetadata = {
        date: new Date().toISOString(),
        contentLength: content.length,
        estimatedTokens: Math.ceil(content.length / 4),
        isSummary: true,
        coversRange: { from: earliestDate, to: latestDate },
      };

      const summaryEntry: ReducibleEntry = {
        role: "user",
        content: [text(content)],
        __metadata,
      };

      const toCompressSet = new Set(toCompress);
      const recent = nonSystemEntries.filter((e) => !toCompressSet.has(e));

      return [...systemEntries, summaryEntry, ...recent];
    },
  };
}
