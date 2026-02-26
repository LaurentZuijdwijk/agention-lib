import { Chunk, ChunkOptions } from "../chunkers/types";
import { Chunker } from "../chunkers/Chunker";
import { Embeddings } from "../embeddings/Embeddings";
import { VectorStore, EmbeddedDocument } from "../vectorstore/VectorStore";
import {
  IngestionOptions,
  IngestionResult,
  IngestionProgressEvent,
  DocumentInput,
} from "./types";

/**
 * Pipeline for ingesting documents into a vector store.
 * Orchestrates the flow: chunk → batch embed → store
 *
 * @example
 * ```typescript
 * const pipeline = new IngestionPipeline(
 *   new RecursiveChunker({ chunkSize: 1000, chunkOverlap: 100 }),
 *   new OpenAIEmbeddings(),
 *   vectorStore
 * );
 *
 * const result = await pipeline.ingest(documentText, {
 *   sourceId: 'doc-123',
 *   sourcePath: '/docs/readme.md',
 *   batchSize: 50,
 *   onProgress: ({ phase, processed, total }) => {
 *     console.log(`${phase}: ${processed}/${total}`);
 *   }
 * });
 *
 * console.log(`Stored ${result.chunksStored} chunks in ${result.duration}ms`);
 * ```
 */
export class IngestionPipeline {
  private chunker: Chunker;
  private embeddings: Embeddings;
  private store: VectorStore;

  constructor(chunker: Chunker, embeddings: Embeddings, store: VectorStore) {
    this.chunker = chunker;
    this.embeddings = embeddings;
    this.store = store;
  }

  /**
   * Ingest a single document into the vector store.
   *
   * @param text - The document text to ingest
   * @param options - Chunk options and ingestion options
   * @returns Result of the ingestion operation
   */
  async ingest(
    text: string,
    options?: ChunkOptions & IngestionOptions
  ): Promise<IngestionResult> {
    const startTime = Date.now();

    const chunkOptions: ChunkOptions = {
      sourceId: options?.sourceId,
      sourcePath: options?.sourcePath,
      metadata: options?.metadata,
    };

    const ingestionOptions: IngestionOptions = {
      batchSize: options?.batchSize,
      onProgress: options?.onProgress,
      onError: options?.onError,
      skipDuplicates: options?.skipDuplicates,
    };

    // Phase 1: Chunking
    this.emitProgress(ingestionOptions.onProgress, {
      phase: "chunking",
      processed: 0,
      total: 1,
    });

    const chunks = await this.chunker.chunk(text, chunkOptions);

    this.emitProgress(ingestionOptions.onProgress, {
      phase: "chunking",
      processed: 1,
      total: 1,
    });

    // Process the chunks
    return this.processChunks(chunks, ingestionOptions, startTime);
  }

  /**
   * Ingest multiple documents into the vector store.
   *
   * @param documents - Array of documents with their options
   * @param options - Ingestion options
   * @returns Aggregated result of all ingestions
   */
  async ingestMany(
    documents: DocumentInput[],
    options?: IngestionOptions
  ): Promise<IngestionResult> {
    const startTime = Date.now();

    // Phase 1: Chunk all documents
    this.emitProgress(options?.onProgress, {
      phase: "chunking",
      processed: 0,
      total: documents.length,
    });

    const allChunks: Chunk[] = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const chunks = await this.chunker.chunk(doc.text, doc.options);
      allChunks.push(...chunks);

      this.emitProgress(options?.onProgress, {
        phase: "chunking",
        processed: i + 1,
        total: documents.length,
      });
    }

    // Process all chunks together
    return this.processChunks(allChunks, options ?? {}, startTime);
  }

  /**
   * Ingest pre-chunked data into the vector store.
   * Useful when chunking is done separately.
   *
   * @param chunks - Array of chunks to ingest
   * @param options - Ingestion options
   * @returns Result of the ingestion operation
   */
  async ingestChunks(
    chunks: Chunk[],
    options?: IngestionOptions
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    return this.processChunks(chunks, options ?? {}, startTime);
  }

  /**
   * Process chunks through embedding and storage.
   */
  private async processChunks(
    chunks: Chunk[],
    options: IngestionOptions,
    startTime: number
  ): Promise<IngestionResult> {
    const {
      batchSize = 100,
      onProgress,
      onError,
      skipDuplicates = false,
    } = options;

    const result: IngestionResult = {
      success: true,
      chunksProcessed: chunks.length,
      chunksSkipped: 0,
      chunksStored: 0,
      errors: [],
      duration: 0,
    };

    if (chunks.length === 0) {
      result.duration = Date.now() - startTime;
      return result;
    }

    // Filter duplicates if enabled
    let chunksToProcess = chunks;
    if (skipDuplicates) {
      chunksToProcess = await this.filterDuplicates(chunks);
      result.chunksSkipped = chunks.length - chunksToProcess.length;
    }

    if (chunksToProcess.length === 0) {
      result.duration = Date.now() - startTime;
      return result;
    }

    // Calculate batches
    const totalBatches = Math.ceil(chunksToProcess.length / batchSize);

    // Phase 2 & 3: Embed and store in batches
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, chunksToProcess.length);
      const batch = chunksToProcess.slice(batchStart, batchEnd);

      // Embed batch
      this.emitProgress(onProgress, {
        phase: "embedding",
        processed: batchStart,
        total: chunksToProcess.length,
        currentBatch: batchIndex + 1,
        totalBatches,
      });

      let embeddings: number[][];
      try {
        embeddings = await this.embeddings.embed(batch.map((c) => c.content));
      } catch (error) {
        // Handle embedding error for entire batch
        for (const chunk of batch) {
          if (onError) {
            const action = onError(error as Error, chunk);
            if (action === "abort") {
              result.success = false;
              result.duration = Date.now() - startTime;
              return result;
            }
          }
          result.errors.push({ chunk, error: error as Error });
        }
        continue;
      }

      // Create embedded documents
      const embeddedDocs: EmbeddedDocument[] = batch.map((chunk, i) => ({
        id: chunk.id,
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: embeddings[i],
      }));

      // Store batch
      this.emitProgress(onProgress, {
        phase: "storing",
        processed: batchStart,
        total: chunksToProcess.length,
        currentBatch: batchIndex + 1,
        totalBatches,
      });

      try {
        await this.store.addEmbeddedDocuments(embeddedDocs);
        result.chunksStored += embeddedDocs.length;
      } catch (error) {
        // Try storing one by one to identify problematic chunks
        for (let i = 0; i < embeddedDocs.length; i++) {
          try {
            await this.store.addEmbeddedDocuments([embeddedDocs[i]]);
            result.chunksStored++;
          } catch (chunkError) {
            const chunk = batch[i];
            if (onError) {
              const action = onError(chunkError as Error, chunk);
              if (action === "abort") {
                result.success = false;
                result.duration = Date.now() - startTime;
                return result;
              }
            }
            result.errors.push({ chunk, error: chunkError as Error });
          }
        }
      }
    }

    // Final progress
    this.emitProgress(onProgress, {
      phase: "storing",
      processed: chunksToProcess.length,
      total: chunksToProcess.length,
      currentBatch: totalBatches,
      totalBatches,
    });

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Filter out chunks that already exist in the store (by hash).
   * Checks the store for existing documents with the same content hash.
   */
  private async filterDuplicates(chunks: Chunk[]): Promise<Chunk[]> {
    if (chunks.length === 0) {
      return chunks;
    }

    // Extract all hashes from chunks
    const hashes = chunks.map((chunk) => chunk.metadata.hash as string);

    // Check which hashes already exist in the store
    const existingHashes = await this.store.getByHashes(hashes);

    // Filter out chunks whose hashes exist
    return chunks.filter((chunk) => !existingHashes.has(chunk.metadata.hash as string));
  }

  /**
   * Emit a progress event if callback is provided.
   */
  private emitProgress(
    callback: ((event: IngestionProgressEvent) => void) | undefined,
    event: IngestionProgressEvent
  ): void {
    if (callback) {
      callback(event);
    }
  }

  /**
   * Get the chunker used by this pipeline.
   */
  getChunker(): Chunker {
    return this.chunker;
  }

  /**
   * Get the embeddings provider used by this pipeline.
   */
  getEmbeddings(): Embeddings {
    return this.embeddings;
  }

  /**
   * Get the vector store used by this pipeline.
   */
  getStore(): VectorStore {
    return this.store;
  }
}
