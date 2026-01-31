/**
 * VoyageAI embeddings implementation.
 *
 * @requires voyageai - Uses the VoyageAI SDK (peer dependency, dynamically imported)
 */

import { Embeddings } from "./Embeddings";

/**
 * Available VoyageAI embedding models with their dimensions and rate limits.
 */
export type VoyageAIEmbeddingModel =
  | "voyage-4-large" // High performance
  | "voyage-3-large" // High performance
  | "voyage-context-3" // Context-aware
  | "voyage-code-3" // Code-specific
  | "voyage-4" // Standard
  | "voyage-3.5" // Standard
  | "voyage-4-lite" // Lightweight
  | "voyage-3.5-lite"; // Lightweight

/**
 * Available VoyageAI multimodal models.
 */
export type VoyageAIMultimodalModel =
  | "voyage-multimodal-3.5"
  | "voyage-multimodal-3";

/**
 * Configuration for VoyageAI embeddings.
 */
export interface VoyageAIEmbeddingsConfig {
  /** VoyageAI API key (defaults to VOYAGE_API_KEY env var) */
  apiKey?: string;
  /** Model to use for embeddings */
  model?: VoyageAIEmbeddingModel | VoyageAIMultimodalModel | string;
  /** Input type for optimization (default: "document") */
  inputType?: "query" | "document";
  /** Optional truncation mode */
  truncation?: boolean;
  /** Base URL for API (for proxies or compatible APIs) */
  baseURL?: string;
  /** Maximum number of retries (default: 2) */
  maxRetries?: number;
  /** Timeout in seconds (default: 60) */
  timeoutInSeconds?: number;
}

/** Default dimensions for each model */
const MODEL_DIMENSIONS: Record<string, number> = {
  "voyage-4-large": 1024,
  "voyage-3-large": 1024,
  "voyage-context-3": 1024,
  "voyage-code-3": 1024,
  "voyage-4": 1024,
  "voyage-3.5": 1024,
  "voyage-4-lite": 1024,
  "voyage-3.5-lite": 1024,
  "voyage-multimodal-3.5": 1024,
  "voyage-multimodal-3": 1024,
};

/**
 * VoyageAI embeddings provider.
 *
 * Supports VoyageAI's embedding models including voyage-4, voyage-3.5, voyage-code-3,
 * and multimodal models. Features automatic retries with exponential backoff.
 *
 * @example
 * ```typescript
 * const embeddings = new VoyageAIEmbeddings({
 *   model: 'voyage-4',
 *   inputType: 'document', // or 'query' for search queries
 * });
 *
 * const vectors = await embeddings.embed(['Hello world', 'Goodbye world']);
 * ```
 *
 * @example With custom configuration
 * ```typescript
 * const embeddings = new VoyageAIEmbeddings({
 *   model: 'voyage-code-3',
 *   maxRetries: 3,
 *   timeoutInSeconds: 30,
 * });
 * ```
 */
export class VoyageAIEmbeddings extends Embeddings {
  readonly name = "voyageai";
  readonly model: string;
  readonly dimensions: number;

  private apiKey: string;
  private inputType: "query" | "document";
  private truncation?: boolean;
  private baseURL?: string;
  private maxRetries: number;
  private timeoutInSeconds: number;

  constructor(config: VoyageAIEmbeddingsConfig = {}) {
    super();
    this.model = config.model ?? "voyage-4";
    this.apiKey = config.apiKey ?? process.env.VOYAGE_API_KEY ?? "";
    this.inputType = config.inputType ?? "document";
    this.truncation = config.truncation;
    this.baseURL = config.baseURL;
    this.maxRetries = config.maxRetries ?? 2;
    this.timeoutInSeconds = config.timeoutInSeconds ?? 60;

    // Determine dimensions
    this.dimensions = MODEL_DIMENSIONS[this.model] ?? 1024;

    if (!this.apiKey) {
      throw new Error(
        "VoyageAI API key is required. Set VOYAGE_API_KEY env var or pass apiKey in config."
      );
    }
  }

  /**
   * Generate embeddings for multiple texts using VoyageAI API.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Dynamic import to keep voyageai optional at module load time
    // @ts-ignore - voyageai is an optional peer dependency
    const { VoyageAIClient } = await import("voyageai");

    const client = new VoyageAIClient({
      apiKey: this.apiKey,
    });

    const params: {
      input: string[];
      model: string;
      inputType?: "query" | "document";
      truncation?: boolean;
    } = {
      input: texts,
      model: this.model,
      inputType: this.inputType,
    };

    if (this.truncation !== undefined) {
      params.truncation = this.truncation;
    }

    const response = await client.embed(params, {
      maxRetries: this.maxRetries,
      timeoutInSeconds: this.timeoutInSeconds,
    });

    // VoyageAI returns embeddings in order
    return response.data?.map((item: any) => item.embedding) ?? [];
  }

  /**
   * Generate embedding for a search query.
   * Overrides the default to use inputType: "query" for better search results.
   */
  async embedQuery(query: string): Promise<number[]> {
    const originalInputType = this.inputType;
    this.inputType = "query";

    const result = await this.embedOne(query);

    this.inputType = originalInputType;
    return result;
  }
}
