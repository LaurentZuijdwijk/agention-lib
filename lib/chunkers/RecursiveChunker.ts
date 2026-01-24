import { Chunker } from "./Chunker";
import { RecursiveChunkerConfig } from "./types";

/**
 * Recursive text chunker that tries to split on semantic boundaries.
 * It attempts to split by larger separators first (paragraphs), then
 * falls back to smaller ones (sentences, words) to keep semantic units together.
 *
 * @example
 * ```typescript
 * const chunker = new RecursiveChunker({
 *   chunkSize: 1000,
 *   chunkOverlap: 100,
 *   separators: ["\n\n", "\n", ". ", " "],
 * });
 *
 * const chunks = await chunker.chunk(document);
 * ```
 */
export class RecursiveChunker extends Chunker {
  readonly name = "RecursiveChunker";
  private separators: string[];

  constructor(config: RecursiveChunkerConfig) {
    super(config);
    this.separators = config.separators ?? ["\n\n", "\n", ". ", " "];
  }

  /**
   * Split text recursively using the separator hierarchy.
   */
  protected splitText(text: string): string[] {
    return this.recursiveSplit(text, 0);
  }

  /**
   * Recursively split text using separators at the given index.
   */
  private recursiveSplit(text: string, separatorIndex: number): string[] {
    const { chunkSize, chunkOverlap = 0 } = this.config;

    // Base case: text fits in one chunk
    if (text.length <= chunkSize) {
      return text.trim() ? [text] : [];
    }

    // No more separators: force split by character
    if (separatorIndex >= this.separators.length) {
      return this.forceSplit(text);
    }

    const separator = this.separators[separatorIndex];
    const parts = this.splitBySeparator(text, separator);

    // If separator didn't help, try the next one
    if (parts.length <= 1) {
      return this.recursiveSplit(text, separatorIndex + 1);
    }

    // Merge parts into chunks respecting size limit
    const chunks: string[] = [];
    let currentChunk = "";

    for (const part of parts) {
      const partWithSep = currentChunk ? separator + part : part;
      const wouldBeLength = currentChunk.length + partWithSep.length;

      if (wouldBeLength <= chunkSize) {
        // Part fits in current chunk
        currentChunk = currentChunk ? currentChunk + separator + part : part;
      } else {
        // Save current chunk if it has content
        if (currentChunk.trim()) {
          chunks.push(currentChunk);
        }

        // Check if part itself is too big
        if (part.length > chunkSize) {
          // Recursively split the oversized part
          const subChunks = this.recursiveSplit(part, separatorIndex + 1);
          chunks.push(...subChunks);
          currentChunk = "";
        } else {
          currentChunk = part;
        }
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk);
    }

    // Apply overlap if configured
    if (chunkOverlap > 0 && chunks.length > 1) {
      return this.applyOverlap(chunks, separator);
    }

    return chunks;
  }

  /**
   * Split text by separator, keeping the parts clean.
   */
  private splitBySeparator(text: string, separator: string): string[] {
    if (separator === ". ") {
      // Special handling for sentence boundaries - keep the period
      return text.split(/(?<=\.)\s+/).filter((p) => p.trim());
    }
    return text.split(separator).filter((p) => p.trim());
  }

  /**
   * Force split text by character count when no separator works.
   */
  private forceSplit(text: string): string[] {
    const { chunkSize, chunkOverlap = 0 } = this.config;
    const chunks: string[] = [];
    const step = chunkSize - chunkOverlap;

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      if (chunk.trim()) {
        chunks.push(chunk);
      }
      if (end >= text.length) break;
      start += step;
    }

    return chunks;
  }

  /**
   * Apply overlap between chunks by prepending context from previous chunk.
   */
  private applyOverlap(chunks: string[], separator: string): string[] {
    const { chunkOverlap = 0 } = this.config;
    if (chunkOverlap === 0 || chunks.length <= 1) {
      return chunks;
    }

    const result: string[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currentChunk = chunks[i];

      // Get overlap from end of previous chunk
      const overlapText = this.getOverlapText(prevChunk, chunkOverlap, separator);

      if (overlapText) {
        result.push(overlapText + separator + currentChunk);
      } else {
        result.push(currentChunk);
      }
    }

    return result;
  }

  /**
   * Extract overlap text from the end of a chunk, trying to break at separator.
   */
  private getOverlapText(
    text: string,
    overlapSize: number,
    separator: string
  ): string {
    if (text.length <= overlapSize) {
      return text;
    }

    // Try to find a clean break point near the overlap size
    const overlapStart = text.length - overlapSize;
    const sepIndex = text.indexOf(separator, overlapStart);

    if (sepIndex !== -1 && sepIndex < text.length - 1) {
      return text.slice(sepIndex + separator.length);
    }

    // Fall back to exact character overlap
    return text.slice(overlapStart);
  }

  /**
   * Get the configured separators.
   */
  getSeparators(): string[] {
    return [...this.separators];
  }
}
