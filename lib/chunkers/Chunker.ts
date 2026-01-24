import { createHash } from "crypto";
import { Chunk, ChunkMetadata, ChunkerConfig, ChunkOptions } from "./types";

/**
 * Abstract base class for text chunkers.
 * Provides common utilities for ID generation, hashing, and chunk linking.
 */
export abstract class Chunker {
  /** Name identifier for this chunker type */
  abstract readonly name: string;

  protected config: ChunkerConfig;

  constructor(config: ChunkerConfig) {
    if (config.chunkSize <= 0) {
      throw new Error("chunkSize must be greater than 0");
    }
    if (config.chunkOverlap !== undefined && config.chunkOverlap < 0) {
      throw new Error("chunkOverlap must be non-negative");
    }
    if (
      config.chunkOverlap !== undefined &&
      config.chunkOverlap >= config.chunkSize
    ) {
      throw new Error("chunkOverlap must be less than chunkSize");
    }
    this.config = {
      chunkOverlap: 0,
      ...config,
    };
  }

  /**
   * Split text into chunks with metadata.
   * @param text - The text to chunk
   * @param options - Optional chunking options
   * @returns Array of chunks with metadata
   */
  async chunk(text: string, options?: ChunkOptions): Promise<Chunk[]> {
    if (!text || text.length === 0) {
      return [];
    }

    // Get raw splits from the subclass implementation
    const splits = this.splitText(text);

    if (splits.length === 0) {
      return [];
    }

    // Build chunks with metadata
    const chunks: Chunk[] = [];
    let currentOffset = 0;
    let currentSection: string | undefined;

    for (let i = 0; i < splits.length; i++) {
      const content = splits[i];
      const startOffset = text.indexOf(content, currentOffset);
      const endOffset = startOffset + content.length;

      // Detect section titles (markdown headers or lines ending with :)
      const detectedSection = this.detectSectionTitle(content);
      if (detectedSection) {
        currentSection = detectedSection;
      }

      const id = this.generateId(content, i, options?.sourceId);

      const metadata: ChunkMetadata = {
        chunkIndex: i,
        totalChunks: splits.length,
        previousChunkId: null, // Will be linked after
        nextChunkId: null, // Will be linked after
        startOffset,
        endOffset,
        sourceId: options?.sourceId,
        sourcePath: options?.sourcePath,
        charCount: content.length,
        hash: this.computeHash(content),
        sectionTitle: currentSection,
        ...options?.metadata,
      };

      chunks.push({ id, content, metadata });
      currentOffset = startOffset + 1; // Move past current match for next search
    }

    // Link chunks together
    this.linkChunks(chunks);

    // Update totalChunks now that we know the final count
    for (const chunk of chunks) {
      chunk.metadata.totalChunks = chunks.length;
    }

    // Apply processor if provided
    if (this.config.chunkProcessor) {
      return this.applyProcessor(chunks);
    }

    return chunks;
  }

  /**
   * Split the text into raw string segments.
   * Must be implemented by subclasses.
   */
  protected abstract splitText(text: string): string[];

  /**
   * Generate a unique ID for a chunk.
   */
  protected generateId(
    content: string,
    index: number,
    sourceId?: string
  ): string {
    if (this.config.idGenerator) {
      return this.config.idGenerator(content, index, sourceId);
    }
    // Default: hash-based ID with source prefix
    const hash = this.computeHash(content).substring(0, 8);
    const prefix = sourceId ? `${sourceId}-` : "";
    return `${prefix}chunk-${index}-${hash}`;
  }

  /**
   * Compute SHA-256 hash of content.
   */
  protected computeHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Link chunks with previousChunkId and nextChunkId.
   */
  protected linkChunks(chunks: Chunk[]): void {
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) {
        chunks[i].metadata.previousChunkId = chunks[i - 1].id;
      }
      if (i < chunks.length - 1) {
        chunks[i].metadata.nextChunkId = chunks[i + 1].id;
      }
    }
  }

  /**
   * Apply the chunk processor, filtering out null results.
   */
  protected async applyProcessor(chunks: Chunk[]): Promise<Chunk[]> {
    if (!this.config.chunkProcessor) {
      return chunks;
    }

    const processed: Chunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const result = await this.config.chunkProcessor(chunks[i], i, chunks);
      if (result !== null) {
        processed.push(result);
      }
    }

    // Re-link after filtering and update indices
    for (let i = 0; i < processed.length; i++) {
      processed[i].metadata.chunkIndex = i;
      processed[i].metadata.totalChunks = processed.length;
      processed[i].metadata.previousChunkId = i > 0 ? processed[i - 1].id : null;
      processed[i].metadata.nextChunkId =
        i < processed.length - 1 ? processed[i + 1].id : null;
    }

    return processed;
  }

  /**
   * Detect section titles from content.
   * Looks for markdown headers (# Title) or lines ending with colon.
   */
  protected detectSectionTitle(content: string): string | undefined {
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // Markdown header
      const headerMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
      if (headerMatch) {
        return headerMatch[1].trim();
      }
      // Line ending with colon (common section pattern)
      if (trimmed.endsWith(":") && trimmed.length > 1 && trimmed.length < 100) {
        return trimmed.slice(0, -1).trim();
      }
    }
    return undefined;
  }

  /**
   * Get the chunk size configuration.
   */
  getChunkSize(): number {
    return this.config.chunkSize;
  }

  /**
   * Get the chunk overlap configuration.
   */
  getChunkOverlap(): number {
    return this.config.chunkOverlap ?? 0;
  }
}
