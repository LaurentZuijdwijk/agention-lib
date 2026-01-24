/**
 * Vector Store interface for document storage and semantic retrieval.
 *
 * This module provides an abstract interface for vector databases,
 * enabling document storage with embeddings and semantic search capabilities.
 */

import { Tool, ToolInputSchema } from "../tools/Tool";

/**
 * Represents a document with its content and optional metadata.
 */
export interface Document {
  /** Unique identifier for the document */
  id: string;
  /** The text content of the document */
  content: string;
  /** Optional metadata associated with the document */
  metadata?: Record<string, unknown>;
}

/**
 * A document with its computed embedding vector.
 */
export interface EmbeddedDocument extends Document {
  /** The embedding vector for the document */
  embedding: number[];
}

/**
 * Result from a similarity search operation.
 */
export interface SearchResult {
  /** The matching document */
  document: Document;
  /** Similarity score (higher is more similar, typically 0-1) */
  score: number;
}

/**
 * Options for adding documents to the vector store.
 */
export interface AddDocumentsOptions {
  /** Namespace or collection to add documents to */
  namespace?: string;
}

/**
 * Options for searching the vector store.
 */
export interface SearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Minimum similarity score threshold (0-1) */
  scoreThreshold?: number;
  /** Namespace or collection to search in */
  namespace?: string;
  /** Metadata filters to apply */
  filter?: Record<string, unknown>;
}

/**
 * Options for deleting documents from the vector store.
 */
export interface DeleteOptions {
  /** Namespace or collection to delete from */
  namespace?: string;
}

/**
 * Options for creating a retrieval tool from a vector store.
 */
export interface RetrievalToolOptions {
  /** Custom name for the tool (defaults to `${storeName}_search`) */
  toolName?: string;
  /** Default number of results to return */
  defaultLimit?: number;
  /** Default score threshold */
  defaultScoreThreshold?: number;
  /** Namespace to search in */
  namespace?: string;
  /** Whether to include document metadata in results */
  includeMetadata?: boolean;
  /** Default filters to apply (e.g., { projectId: "123", tenantId: "acme" }) */
  defaultFilter?: Record<string, unknown>;
  /** Whether to allow the agent to override filters via tool parameters */
  allowFilterOverride?: boolean;
}

/**
 * Options for creating an add documents tool from a vector store.
 */
export interface AddDocumentsToolOptions {
  /** Custom name for the tool (defaults to `${storeName}_add`) */
  toolName?: string;
  /** Namespace to add documents to */
  namespace?: string;
  /** Default metadata to add to all documents (e.g., { projectId: "123", tenantId: "acme" }) */
  defaultMetadata?: Record<string, unknown>;
}

/**
 * Options for creating a get chunk by ID tool from a vector store.
 */
export interface GetChunkByIdToolOptions {
  /** Custom name for the tool (defaults to `${storeName}_get_chunk`) */
  toolName?: string;
  /** Namespace to search in */
  namespace?: string;
  /** Whether to include document metadata in results */
  includeMetadata?: boolean;
}

/**
 * Abstract interface for vector database implementations.
 *
 * Implementations should handle:
 * - Embedding generation (or accept pre-computed embeddings)
 * - Vector storage and indexing
 * - Similarity search
 *
 * @example
 * ```typescript
 * class PineconeVectorStore extends VectorStore {
 *   async addDocuments(docs: Document[]): Promise<string[]> {
 *     // Generate embeddings and upsert to Pinecone
 *   }
 *
 *   async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
 *     // Embed query and search Pinecone
 *   }
 * }
 *
 * // Create a retrieval tool for an agent
 * const store = new PineconeVectorStore({ ... });
 * const searchTool = store.toRetrievalTool("Search product documentation");
 * const agent = new ClaudeAgent({ tools: [searchTool] });
 * ```
 */
export abstract class VectorStore {
  /** Name identifier for this vector store instance */
  abstract readonly name: string;

  /**
   * Add documents to the vector store.
   * The implementation should handle embedding generation.
   *
   * @param documents - Documents to add
   * @param options - Optional configuration for the add operation
   * @returns Array of document IDs that were added
   */
  abstract addDocuments(
    documents: Document[],
    options?: AddDocumentsOptions
  ): Promise<string[]>;

  /**
   * Add documents with pre-computed embeddings.
   * Use this when you want to control the embedding process.
   *
   * @param documents - Documents with embeddings to add
   * @param options - Optional configuration for the add operation
   * @returns Array of document IDs that were added
   */
  abstract addEmbeddedDocuments(
    documents: EmbeddedDocument[],
    options?: AddDocumentsOptions
  ): Promise<string[]>;

  /**
   * Search for documents similar to the query.
   * The implementation should handle query embedding.
   *
   * @param query - The search query text
   * @param options - Search configuration options
   * @returns Array of search results with documents and scores
   */
  abstract search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]>;

  /**
   * Search using a pre-computed embedding vector.
   *
   * @param embedding - The query embedding vector
   * @param options - Search configuration options
   * @returns Array of search results with documents and scores
   */
  abstract searchByVector(
    embedding: number[],
    options?: SearchOptions
  ): Promise<SearchResult[]>;

  /**
   * Delete documents by their IDs.
   *
   * @param ids - Array of document IDs to delete
   * @param options - Optional configuration for the delete operation
   * @returns Number of documents deleted
   */
  abstract delete(ids: string[], options?: DeleteOptions): Promise<number>;

  /**
   * Delete all documents, optionally within a namespace.
   *
   * @param options - Optional configuration including namespace
   */
  abstract clear(options?: DeleteOptions): Promise<void>;

  /**
   * Get a document by its ID.
   *
   * @param id - The document ID
   * @param options - Optional configuration including namespace
   * @returns The document if found, null otherwise
   */
  abstract getById(
    id: string,
    options?: DeleteOptions
  ): Promise<Document | null>;

  /**
   * Get existing documents by their content hashes.
   * Used for deduplication during ingestion.
   *
   * @param hashes - Array of content hashes to check
   * @param options - Optional configuration including namespace
   * @returns Map of hash to document ID
   */
  abstract getByHashes(
    hashes: string[],
    options?: DeleteOptions
  ): Promise<Map<string, string>>;

  /**
   * Create a retrieval tool that agents can use to search this vector store.
   *
   * @param description - Description of what data the store contains (e.g., "Search product documentation for technical specifications")
   * @param options - Configuration options for the tool
   * @returns A Tool instance that can be added to an agent
   *
   * @example
   * ```typescript
   * const store = new LanceDBVectorStore({ ... });
   * const tool = store.toRetrievalTool(
   *   "Search company knowledge base for HR policies and procedures",
   *   { defaultLimit: 5 }
   * );
   * agent.addTools([tool]);
   * ```
   */
  toRetrievalTool(
    description: string,
    options: RetrievalToolOptions = {}
  ): Tool<SearchResult[]> {
    const {
      toolName = `${this.name}_search`,
      defaultLimit = 3,
      defaultScoreThreshold,
      namespace,
      includeMetadata = true,
      defaultFilter,
      allowFilterOverride = false,
    } = options;

    const inputSchema: ToolInputSchema = {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant documents",
        },
        limit: {
          type: "number",
          description: `Maximum number of results to return (default: ${defaultLimit})`,
        },
        ...(allowFilterOverride && {
          filter: {
            type: "object",
            description: "Optional metadata filters to apply to the search",
          },
        }),
      },
      required: ["query", "limit"],
    };

    return new Tool<SearchResult[]>({
      name: toolName,
      description,
      inputSchema,
      execute: async (input: {
        query: string;
        limit?: number;
        filter?: Record<string, unknown>;
      }) => {
        // Merge default filters with input filters
        let finalFilter = defaultFilter;
        if (allowFilterOverride && input.filter) {
          finalFilter = { ...defaultFilter, ...input.filter };
        }

        const results = await this.search(input.query, {
          limit: input.limit ?? defaultLimit,
          scoreThreshold: defaultScoreThreshold,
          namespace,
          filter: finalFilter,
        });

        if (!includeMetadata) {
          return results.map((r) => ({
            document: { id: r.document.id, content: r.document.content },
            score: r.score,
          }));
        }

        return results;
      },
    });
  }

  /**
   * Create a tool that agents can use to add documents to this vector store.
   *
   * @param description - Description of what the tool does (e.g., "Store new knowledge articles in the database")
   * @param options - Configuration options for the tool
   * @returns A Tool instance that can be added to an agent
   *
   * @example
   * ```typescript
   * const store = new LanceDBVectorStore({ ... });
   * const tool = store.toAddDocumentsTool(
   *   "Save new information to the knowledge base for future reference"
   * );
   * agent.addTools([tool]);
   * ```
   */
  toAddDocumentsTool(
    description: string,
    options: AddDocumentsToolOptions = {}
  ): Tool<{ added: string[]; count: number }> {
    const {
      toolName = `${this.name}_add`,
      namespace,
      defaultMetadata,
    } = options;

    const inputSchema: ToolInputSchema = {
      type: "object",
      properties: {
        documents: {
          type: "array",
          description: "Array of documents to add",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Unique identifier for the document",
              },
              content: {
                type: "string",
                description: "The text content of the document",
              },
              metadata: {
                type: "object",
                description: "Optional metadata for the document",
              },
            },
            required: ["id", "content", "metadata"],
          },
        },
      },
      required: ["documents"],
    };

    return new Tool<{ added: string[]; count: number }>({
      name: toolName,
      description,
      inputSchema,
      execute: async (input: { documents: Document[] }) => {
        // Merge default metadata into each document
        const documentsWithMetadata = input.documents.map((doc) => ({
          ...doc,
          metadata: { ...defaultMetadata, ...doc.metadata },
        }));

        const ids = await this.addDocuments(documentsWithMetadata, {
          namespace,
        });
        return { added: ids, count: ids.length };
      },
    });
  }

  /**
   * Create a tool that agents can use to retrieve a chunk by its ID.
   * Useful for navigating chunk chains using previousChunkId/nextChunkId metadata.
   *
   * @param description - Description of what the tool does (e.g., "Get a specific chunk by ID to read adjacent context")
   * @param options - Configuration options for the tool
   * @returns A Tool instance that can be added to an agent
   *
   * @example
   * ```typescript
   * const store = new LanceDBVectorStore({ ... });
   * const tool = store.toGetChunkByIdTool(
   *   "Retrieve a specific chunk by ID. Use previousChunkId or nextChunkId from search results to get surrounding context."
   * );
   * agent.addTools([tool]);
   * ```
   */
  toGetChunkByIdTool(
    description: string,
    options: GetChunkByIdToolOptions = {}
  ): Tool<Document | null> {
    const {
      toolName = `${this.name}_get_chunk`,
      namespace,
      includeMetadata = true,
    } = options;

    const inputSchema: ToolInputSchema = {
      type: "object",
      properties: {
        id: {
          type: "string",
          description:
            "The chunk ID to retrieve (e.g., from previousChunkId or nextChunkId metadata)",
        },
      },
      required: ["id"],
    };

    return new Tool<Document | null>({
      name: toolName,
      description,
      inputSchema,
      execute: async (input: { id: string }) => {
        const document = await this.getById(input.id, { namespace });

        if (!document) {
          return null;
        }

        if (!includeMetadata) {
          return {
            id: document.id,
            content: document.content,
          };
        }

        return document;
      },
    });
  }
}
