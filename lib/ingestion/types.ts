import { Chunk, ChunkOptions } from "../chunkers/types";

/**
 * Progress event emitted during ingestion.
 */
export interface IngestionProgressEvent {
  /** Current phase of ingestion */
  phase: "chunking" | "embedding" | "storing";
  /** Number of items processed in this phase */
  processed: number;
  /** Total number of items in this phase */
  total: number;
  /** Current batch number (for embedding/storing phases) */
  currentBatch?: number;
  /** Total number of batches */
  totalBatches?: number;
}

/**
 * Options for the ingestion pipeline.
 */
export interface IngestionOptions {
  /**
   * Number of chunks to process per embedding batch.
   * Larger batches are more efficient but use more memory.
   * @default 100
   */
  batchSize?: number;

  /**
   * Callback for progress updates.
   */
  onProgress?: (event: IngestionProgressEvent) => void;

  /**
   * Error handling strategy.
   * - 'skip': Skip the failed chunk and continue
   * - 'abort': Stop the entire ingestion process
   * @returns The action to take
   */
  onError?: (error: Error, chunk: Chunk) => "skip" | "abort";

  /**
   * Whether to skip chunks with hashes that already exist in the store.
   * Requires the store to support hash-based lookup.
   * @default false
   */
  skipDuplicates?: boolean;
}

/**
 * Result of an ingestion operation.
 */
export interface IngestionResult {
  /** Whether the ingestion completed without aborting */
  success: boolean;
  /** Total number of chunks that were processed */
  chunksProcessed: number;
  /** Number of chunks skipped (duplicates or filtered) */
  chunksSkipped: number;
  /** Number of chunks successfully stored */
  chunksStored: number;
  /** Array of errors encountered during ingestion */
  errors: Array<{ chunk: Chunk; error: Error }>;
  /** Total time taken in milliseconds */
  duration: number;
}

/**
 * Document input for batch ingestion.
 */
export interface DocumentInput {
  /** The text content to ingest */
  text: string;
  /** Options for this specific document */
  options?: ChunkOptions;
}
