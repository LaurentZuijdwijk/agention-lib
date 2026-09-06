/**
 * Display-only normalization for streamed reasoning text.
 *
 * Reasoning models routed through OpenRouter (and other OpenAI-compatible
 * backends) sometimes stream `reasoning`/`reasoning_content` whose formatting
 * is far noisier than the model's final answer — GLM-series models in
 * particular emit heavily bulleted chain-of-thought with a blank line between
 * almost every point, and some provider routes break tokens one phrase per
 * line instead of wrapping normally. That formatting comes from the model
 * itself (verified against live OpenRouter streams — the SDK and this
 * library's accumulation just concatenate deltas verbatim), so it can't be
 * fixed at the source.
 *
 * This is display-only: never apply it to the string that gets stored in
 * history or replayed to the provider on the next turn (DeepSeek/GLM require
 * that text back byte-for-byte, see {@link OpenAICompatibleAgent.streamTurn}).
 * Apply it only where you render or log a `reasoning` chunk for a human.
 */
export interface CollapseReasoningWhitespaceOptions {
  /** Collapse runs of 3+ newlines down to a single blank line. Default `true`. */
  collapseBlankLines?: boolean;
  /**
   * Merge consecutive non-blank lines into one, joined by a space — for
   * providers that stream reasoning broken one word or phrase per line. A
   * line starting a markdown block (list item, heading, blockquote) is never
   * merged into the line before it, so intentional structure survives.
   * Off by default since it can also merge genuinely short paragraphs;
   * enable it for the specific model/provider you've seen this on.
   */
  collapseLineWraps?: boolean;
}

const MARKDOWN_BLOCK_START = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>)/;

/**
 * Collapses excess linebreaks in reasoning text for display, leaving the
 * original string untouched for anything that needs it verbatim.
 *
 * @example
 * ```typescript
 * agent.on(AgentEvent.REASONING_CHUNK, (delta) => {
 *   process.stdout.write(collapseReasoningWhitespace(delta));
 * });
 * ```
 */
export function collapseReasoningWhitespace(
  text: string,
  options: CollapseReasoningWhitespaceOptions = {}
): string {
  const { collapseBlankLines = true, collapseLineWraps = false } = options;
  let result = text;

  if (collapseBlankLines) {
    result = result.replace(/\n{3,}/g, "\n\n");
  }

  if (collapseLineWraps) {
    const lines = result.split("\n");
    const merged: string[] = [];
    for (const line of lines) {
      const prev = merged[merged.length - 1];
      const canMergeIntoPrev =
        prev !== undefined &&
        prev.trim().length > 0 &&
        line.trim().length > 0 &&
        !MARKDOWN_BLOCK_START.test(line) &&
        !MARKDOWN_BLOCK_START.test(prev);

      if (canMergeIntoPrev) {
        merged[merged.length - 1] = `${prev.replace(/\s+$/, "")} ${line.replace(/^\s+/, "")}`;
      } else {
        merged.push(line);
      }
    }
    result = merged.join("\n");
  }

  return result;
}
