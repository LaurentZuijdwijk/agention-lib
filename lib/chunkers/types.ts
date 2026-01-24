/**
 * Represents a chunk of text with metadata for tracking and linking.
 */
export interface Chunk {
  /** Unique identifier for this chunk */
  id: string;
  /** The text content of the chunk */
  content: string;
  /** Metadata about the chunk */
  metadata: ChunkMetadata;
}

/**
 * Metadata associated with each chunk.
 */
export interface ChunkMetadata {
  // Position & linking
  /** Zero-based index of this chunk in the sequence */
  chunkIndex: number;
  /** Total number of chunks in the sequence */
  totalChunks: number;
  /** ID of the previous chunk, or null if first */
  previousChunkId: string | null;
  /** ID of the next chunk, or null if last */
  nextChunkId: string | null;

  // Source tracking
  /** Character offset where this chunk starts in the source text */
  startOffset: number;
  /** Character offset where this chunk ends in the source text */
  endOffset: number;
  /** Optional identifier for the source document */
  sourceId?: string;
  /** Optional path to the source file */
  sourcePath?: string;

  // Content info
  /** Number of characters in the chunk content */
  charCount: number;
  /** Estimated number of tokens (when available) */
  tokenCount?: number;
  /** SHA-256 hash of the content for deduplication */
  hash: string;

  // Structural (when detectable)
  /** Section title if detected (e.g., markdown headers) */
  sectionTitle?: string;

  // User passthrough - allows additional custom metadata
  [key: string]: unknown;
}

/**
 * Configuration for creating a chunker.
 */
export interface ChunkerConfig {
  /** Target size for each chunk (in characters or tokens depending on chunker) */
  chunkSize: number;
  /** Number of characters/tokens to overlap between chunks (default: 0) */
  chunkOverlap?: number;

  /**
   * Optional processor function applied to each chunk.
   * Can modify the chunk or return null to filter it out.
   */
  chunkProcessor?: (
    chunk: Chunk,
    index: number,
    all: Chunk[]
  ) => Chunk | null | Promise<Chunk | null>;

  /**
   * Custom ID generator function.
   * @param content - The chunk content
   * @param index - The chunk index
   * @param sourceId - Optional source document ID
   * @returns A unique ID for the chunk
   */
  idGenerator?: (content: string, index: number, sourceId?: string) => string;
}

/**
 * Options passed when chunking text.
 */
export interface ChunkOptions {
  /** Identifier for the source document */
  sourceId?: string;
  /** Path to the source file */
  sourcePath?: string;
  /** Additional metadata to merge into each chunk */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration specific to RecursiveChunker.
 */
export interface RecursiveChunkerConfig extends ChunkerConfig {
  /**
   * Separators to try in order, from largest to smallest semantic unit.
   * Default: ["\n\n", "\n", ". ", " "]
   */
  separators?: string[];
}

/**
 * Configuration specific to TokenChunker.
 */
export interface TokenChunkerConfig extends ChunkerConfig {
  /**
   * Chunk size is in tokens, not characters.
   * Uses tokenx for estimation (~96% accuracy).
   */
  chunkSize: number;
}
