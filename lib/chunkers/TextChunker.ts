import { Chunker } from "./Chunker";
import { ChunkerConfig } from "./types";

/**
 * Simple text chunker that splits by character count with optional overlap.
 *
 * @example
 * ```typescript
 * const chunker = new TextChunker({
 *   chunkSize: 1000,
 *   chunkOverlap: 200,
 * });
 *
 * const chunks = await chunker.chunk(longText, {
 *   sourceId: 'doc-123',
 *   sourcePath: '/docs/readme.md',
 * });
 * ```
 */
export class TextChunker extends Chunker {
  readonly name = "TextChunker";

  constructor(config: ChunkerConfig) {
    super(config);
  }

  /**
   * Split text by character count with overlap.
   */
  protected splitText(text: string): string[] {
    const { chunkSize, chunkOverlap = 0 } = this.config;
    const chunks: string[] = [];

    if (text.length <= chunkSize) {
      return [text];
    }

    const step = chunkSize - chunkOverlap;
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));

      // If we've reached the end, stop
      if (end >= text.length) {
        break;
      }

      start += step;
    }

    return chunks;
  }
}
