import { Chunker } from "./Chunker";
import { Chunk, TokenChunkerConfig } from "./types";
import { estimateTokenCount, splitByTokens } from "tokenx";

/**
 * Token-aware text chunker using the tokenx library.
 * Splits text based on token count rather than character count,
 * ensuring chunks fit within LLM token limits.
 *
 * Uses tokenx for fast token estimation (~96% accuracy, ~2kB).
 *
 * @example
 * ```typescript
 * const chunker = new TokenChunker({
 *   chunkSize: 500,       // 500 tokens per chunk
 *   chunkOverlap: 50,     // 50 token overlap
 * });
 *
 * const chunks = await chunker.chunk(longDocument);
 * // Each chunk.metadata.tokenCount contains estimated tokens
 * ```
 */
export class TokenChunker extends Chunker {
  readonly name = "TokenChunker";

  constructor(config: TokenChunkerConfig) {
    super(config);
  }

  /**
   * Split text by token count using tokenx.
   */
  protected splitText(text: string): string[] {
    const { chunkSize, chunkOverlap = 0 } = this.config;

    // Use tokenx's splitByTokens for token-aware splitting
    const chunks = splitByTokens(text, chunkSize);

    // Apply overlap if configured
    if (chunkOverlap > 0 && chunks.length > 1) {
      return this.applyTokenOverlap(chunks, text);
    }

    return chunks;
  }

  /**
   * Apply token-based overlap between chunks.
   */
  private applyTokenOverlap(chunks: string[], _originalText: string): string[] {
    const { chunkOverlap = 0 } = this.config;
    const result: string[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currentChunk = chunks[i];

      // Get overlap from end of previous chunk
      const overlapText = this.getTokenOverlap(prevChunk, chunkOverlap);

      if (overlapText && overlapText.trim()) {
        result.push(overlapText + " " + currentChunk);
      } else {
        result.push(currentChunk);
      }
    }

    return result;
  }

  /**
   * Get approximately chunkOverlap tokens from the end of text.
   */
  private getTokenOverlap(text: string, overlapTokens: number): string {
    // Estimate characters per token (roughly 4 chars per token for English)
    const estimatedChars = overlapTokens * 4;

    if (text.length <= estimatedChars) {
      return text;
    }

    // Start from estimated position and find a word boundary
    let start = text.length - estimatedChars;

    // Find the next space to start at a word boundary
    const spaceIndex = text.indexOf(" ", start);
    if (spaceIndex !== -1 && spaceIndex < text.length - 1) {
      start = spaceIndex + 1;
    }

    const overlap = text.slice(start);

    // Verify we're close to the target token count
    const actualTokens = estimateTokenCount(overlap);
    if (actualTokens > overlapTokens * 1.5) {
      // Too many tokens, trim more aggressively
      const words = overlap.split(/\s+/);
      const targetWords = Math.ceil(
        words.length * (overlapTokens / actualTokens)
      );
      return words.slice(-targetWords).join(" ");
    }

    return overlap;
  }

  /**
   * Override chunk to add token count to metadata.
   */
  async chunk(
    text: string,
    options?: import("./types").ChunkOptions
  ): Promise<Chunk[]> {
    const chunks = await super.chunk(text, options);

    // Add token count to each chunk's metadata
    for (const chunk of chunks) {
      chunk.metadata.tokenCount = estimateTokenCount(chunk.content);
    }

    return chunks;
  }

  /**
   * Estimate token count for a given text.
   */
  static estimateTokens(text: string): number {
    return estimateTokenCount(text);
  }
}
