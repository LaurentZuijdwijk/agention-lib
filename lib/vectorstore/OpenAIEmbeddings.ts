/**
 * OpenAI embeddings implementation.
 *
 * @requires openai - Uses the OpenAI SDK (already a peer dependency)
 */

import { Embeddings } from "./Embeddings";

/**
 * Configuration for OpenAI embeddings.
 */
export interface OpenAIEmbeddingsConfig {
  /** OpenAI API key (defaults to OPENAI_API_KEY env var) */
  apiKey?: string;
  /** Model to use for embeddings */
  model?:
    | "text-embedding-3-small"
    | "text-embedding-3-large"
    | "text-embedding-ada-002"
    | string;
  /** Number of dimensions (only for text-embedding-3-* models) */
  dimensions?: number;
  /** Base URL for API (for proxies or compatible APIs) */
  baseURL?: string;
}

/** Default dimensions for each model */
const MODEL_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

/**
 * OpenAI embeddings provider.
 *
 * @example
 * ```typescript
 * const embeddings = new OpenAIEmbeddings({
 *   model: 'text-embedding-3-small',
 * });
 *
 * const vectors = await embeddings.embed(['Hello world', 'Goodbye world']);
 * ```
 */
export class OpenAIEmbeddings extends Embeddings {
  readonly name = "openai";
  readonly model: string;
  readonly dimensions: number;

  private apiKey: string;
  private baseURL?: string;
  private requestedDimensions?: number;

  constructor(config: OpenAIEmbeddingsConfig = {}) {
    super();
    this.model = config.model ?? "text-embedding-3-small";
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseURL = config.baseURL;
    this.requestedDimensions = config.dimensions;

    // Determine dimensions
    if (config.dimensions) {
      this.dimensions = config.dimensions;
    } else {
      this.dimensions = MODEL_DIMENSIONS[this.model] ?? 1536;
    }

    if (!this.apiKey) {
      throw new Error(
        "OpenAI API key is required. Set OPENAI_API_KEY env var or pass apiKey in config."
      );
    }
  }

  /**
   * Generate embeddings for multiple texts using OpenAI API.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Dynamic import to keep openai optional at module load time
    const { default: OpenAI } = await import("openai");

    const client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });

    const params: {
      model: string;
      input: string[];
      dimensions?: number;
    } = {
      model: this.model,
      input: texts,
    };

    // Only text-embedding-3-* models support custom dimensions
    if (
      this.requestedDimensions &&
      this.model.startsWith("text-embedding-3-")
    ) {
      params.dimensions = this.requestedDimensions;
    }

    const response = await client.embeddings.create(params);

    // Sort by index to ensure order matches input
    const sorted = response.data.sort((a: any, b: any) => a.index - b.index);
    return sorted.map((item: any) => item.embedding);
  }
}
