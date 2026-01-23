/**
 * Embeddings interface for generating vector representations of text.
 *
 * This module provides an abstract interface for embedding providers,
 * allowing vector stores to work with any embedding service.
 */

/**
 * Configuration for embedding operations.
 */
export interface EmbeddingOptions {
  /** Model identifier (provider-specific) */
  model?: string;
  /** Number of dimensions for the embedding (if configurable) */
  dimensions?: number;
}

/**
 * Abstract interface for embedding providers.
 *
 * Implementations generate vector representations of text that can be
 * used for semantic similarity search in vector stores.
 *
 * @example
 * ```typescript
 * class OpenAIEmbeddings extends Embeddings {
 *   async embed(texts: string[]): Promise<number[][]> {
 *     const response = await openai.embeddings.create({
 *       model: this.model,
 *       input: texts,
 *     });
 *     return response.data.map(d => d.embedding);
 *   }
 * }
 * ```
 */
export abstract class Embeddings {
  /** Name identifier for this embeddings provider */
  abstract readonly name: string;

  /** The model being used for embeddings */
  abstract readonly model: string;

  /** Number of dimensions in the output vectors */
  abstract readonly dimensions: number;

  /**
   * Generate embeddings for multiple texts.
   *
   * @param texts - Array of text strings to embed
   * @returns Array of embedding vectors (one per input text)
   */
  abstract embed(texts: string[]): Promise<number[][]>;

  /**
   * Generate embedding for a single text.
   * Default implementation calls embed() with a single-item array.
   *
   * @param text - Text string to embed
   * @returns Embedding vector
   */
  async embedOne(text: string): Promise<number[]> {
    const results = await this.embed([text]);
    return results[0];
  }

  /**
   * Generate embedding for a search query.
   * Some providers use different models/settings for queries vs documents.
   * Default implementation calls embedOne().
   *
   * @param query - Query text to embed
   * @returns Embedding vector optimized for query
   */
  async embedQuery(query: string): Promise<number[]> {
    return this.embedOne(query);
  }
}
