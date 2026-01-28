/**
 * LanceDB implementation of the VectorStore interface.
 *
 * LanceDB is an embedded vector database that runs locally or can connect
 * to cloud storage. It provides fast vector search with automatic indexing.
 *
 * @requires @lancedb/lancedb - Install with: npm install @lancedb/lancedb
 * @requires apache-arrow - Install with: npm install apache-arrow
 */

import type { Connection, Table, ConnectionOptions } from "@lancedb/lancedb";
import {
  VectorStore,
  Document,
  EmbeddedDocument,
  SearchResult,
  AddDocumentsOptions,
  SearchOptions,
  DeleteOptions,
} from "./VectorStore";
import { Embeddings } from "./Embeddings";

/**
 * Supported types for metadata fields.
 */
export type MetadataFieldType = "string" | "number" | "boolean";

/**
 * Definition for a metadata field that will be stored as a separate column.
 */
export interface MetadataFieldDefinition {
  /** Name of the metadata field */
  name: string;
  /** Data type for the field */
  type: MetadataFieldType;
  /** Whether the field can be null (default: true) */
  nullable?: boolean;
}

/**
 * Configuration for LanceDBVectorStore.
 */
export interface LanceDBVectorStoreConfig {
  /** Name identifier for this store instance */
  name: string;
  /** URI for the LanceDB database (local path or cloud URI) */
  uri: string;
  /** Name of the table to use */
  tableName: string;
  /** Embeddings provider for automatic embedding generation */
  embeddings?: Embeddings;
  /** Vector dimensions (required if no embeddings provider, defaults to embeddings.dimensions) */
  dimensions?: number;
  /** Additional connection options */
  connectionOptions?: Partial<ConnectionOptions>;
  /**
   * Metadata field definitions for filterable columns.
   * When specified, metadata fields are stored as separate columns enabling efficient filtering.
   * If not specified, metadata is stored as a JSON string (legacy behavior).
   */
  metadataFields?: MetadataFieldDefinition[];
}

/**
 * Internal record structure stored in LanceDB.
 * When metadataFields are defined, each field is stored as a separate property.
 * Otherwise, metadata is stored as a JSON string in the 'metadata' field.
 */
interface LanceDBRecord {
  id: string;
  text: string;
  vector?: number[];
  /** Legacy: JSON string of metadata (used when metadataFields not defined) */
  metadata?: string;
  /** Dynamic metadata fields when metadataFields are defined */
  [key: string]: unknown;
}

/**
 * LanceDB implementation of the VectorStore interface.
 *
 * @example Basic usage with JSON metadata (legacy)
 * ```typescript
 * import { LanceDBVectorStore, OpenAIEmbeddings } from "@agentionai/agents";
 *
 * // Create with OpenAI embeddings
 * const embeddings = new OpenAIEmbeddings({
 *   model: "text-embedding-3-small",
 * });
 *
 * const store = await LanceDBVectorStore.create({
 *   name: "knowledge_base",
 *   uri: "./my-database",
 *   tableName: "documents",
 *   embeddings,
 * });
 *
 * // Add documents (embeddings generated automatically)
 * await store.addDocuments([
 *   { id: "1", content: "LanceDB is a vector database" },
 *   { id: "2", content: "Vector search enables semantic queries" },
 * ]);
 *
 * // Search
 * const results = await store.search("What is LanceDB?", { limit: 5 });
 *
 * // Create a tool for agents
 * const searchTool = store.toRetrievalTool("Search the knowledge base");
 * ```
 *
 * @example With filterable metadata fields
 * ```typescript
 * const store = await LanceDBVectorStore.create({
 *   name: "knowledge_base",
 *   uri: "./my-database",
 *   tableName: "documents",
 *   embeddings,
 *   metadataFields: [
 *     { name: "category", type: "string" },
 *     { name: "source", type: "string" },
 *     { name: "year", type: "number" },
 *     { name: "verified", type: "boolean" },
 *     { name: "hash", type: "string" }, // Enables efficient deduplication
 *   ],
 * });
 *
 * // Add documents with metadata
 * await store.addDocuments([
 *   {
 *     id: "1",
 *     content: "LanceDB is a vector database",
 *     metadata: { category: "database", source: "docs", year: 2024, verified: true },
 *   },
 * ]);
 *
 * // Search with filters on metadata columns
 * const results = await store.search("vector database", {
 *   limit: 5,
 *   filter: { category: "database", year: 2024 },
 * });
 * ```
 */
export class LanceDBVectorStore extends VectorStore {
  readonly name: string;

  private connection: Connection;
  private table: Table;
  private embeddings?: Embeddings;
  private tableName: string;
  private dimensions: number;
  private metadataFields?: MetadataFieldDefinition[];

  private constructor(
    config: LanceDBVectorStoreConfig,
    connection: Connection,
    table: Table
  ) {
    super();
    this.name = config.name;
    this.connection = connection;
    this.table = table;
    this.embeddings = config.embeddings;
    this.tableName = config.tableName;
    this.dimensions =
      config.dimensions ?? config.embeddings?.dimensions ?? 1536;
    this.metadataFields = config.metadataFields;
  }

  /**
   * Create a new LanceDBVectorStore instance.
   *
   * This is an async factory method since LanceDB connection is asynchronous.
   *
   * @param config - Configuration for the store
   * @returns A configured LanceDBVectorStore instance
   *
   * @throws Error if @lancedb/lancedb is not installed
   */
  static async create(
    config: LanceDBVectorStoreConfig
  ): Promise<LanceDBVectorStore> {
    // Dynamic import to make lancedb an optional dependency
    let lancedb: typeof import("@lancedb/lancedb");

    try {
      lancedb = await import("@lancedb/lancedb");
    } catch {
      throw new Error(
        "LanceDB is not installed. Install it with: npm install @lancedb/lancedb apache-arrow"
      );
    }

    const connection = await lancedb.connect(
      config.uri,
      config.connectionOptions
    );
    const tableNames = await connection.tableNames();

    let table: Table;
    const dimensions =
      config.dimensions ?? config.embeddings?.dimensions ?? 1536;

    if (tableNames.includes(config.tableName)) {
      table = await connection.openTable(config.tableName);
    } else {
      // Create table with schema
      let arrow: typeof import("apache-arrow");

      try {
        arrow = await import("apache-arrow");
      } catch {
        throw new Error(
          "apache-arrow is not installed. Install it with: npm install apache-arrow"
        );
      }

      // Build schema fields - use explicit type to allow different Field types
      const schemaFields: import("apache-arrow").Field[] = [
        new arrow.Field("id", new arrow.Utf8(), false),
        new arrow.Field("text", new arrow.Utf8(), false),
        new arrow.Field(
          "vector",
          new arrow.FixedSizeList(
            dimensions,
            new arrow.Field("item", new arrow.Float32(), true)
          ),
          false
        ),
      ];

      // Add metadata fields - either as separate columns or as a JSON string
      if (config.metadataFields && config.metadataFields.length > 0) {
        for (const field of config.metadataFields) {
          const nullable = field.nullable !== false;
          let arrowType: import("apache-arrow").DataType;

          switch (field.type) {
            case "string":
              arrowType = new arrow.Utf8();
              break;
            case "number":
              arrowType = new arrow.Float64();
              break;
            case "boolean":
              arrowType = new arrow.Bool();
              break;
            default:
              throw new Error(`Unsupported metadata field type: ${field.type}`);
          }

          schemaFields.push(new arrow.Field(field.name, arrowType, nullable));
        }
      } else {
        // Legacy: store metadata as JSON string
        schemaFields.push(new arrow.Field("metadata", new arrow.Utf8(), true));
      }

      const schema = new arrow.Schema(schemaFields);
      table = await connection.createEmptyTable(config.tableName, schema);
    }

    return new LanceDBVectorStore(config, connection, table);
  }

  /**
   * Add documents to the vector store.
   * If an embeddings provider is configured, embeddings are generated automatically.
   */
  async addDocuments(
    documents: Document[],
    _options?: AddDocumentsOptions
  ): Promise<string[]> {
    if (!this.embeddings) {
      throw new Error(
        "No embeddings provider configured. Use addEmbeddedDocuments() with pre-computed embeddings, or configure an embeddings provider."
      );
    }

    // Generate embeddings for all documents
    const texts = documents.map((doc) => doc.content);
    const vectors = await this.embeddings.embed(texts);

    // Convert to embedded documents
    const embeddedDocs: EmbeddedDocument[] = documents.map((doc, i) => ({
      ...doc,
      embedding: vectors[i],
    }));

    return this.addEmbeddedDocuments(embeddedDocs, _options);
  }

  /**
   * Add documents with pre-computed embeddings.
   */
  async addEmbeddedDocuments(
    documents: EmbeddedDocument[],
    _options?: AddDocumentsOptions
  ): Promise<string[]> {
    const records: LanceDBRecord[] = documents.map((doc) => {
      const record: LanceDBRecord = {
        id: doc.id,
        text: doc.content,
        vector: doc.embedding,
      };

      if (this.metadataFields && this.metadataFields.length > 0) {
        // Store each metadata field as a separate column
        for (const field of this.metadataFields) {
          const value = doc.metadata?.[field.name];
          record[field.name] = value !== undefined ? value : null;
        }
      } else {
        // Legacy: store metadata as JSON string
        record.metadata = doc.metadata ? JSON.stringify(doc.metadata) : undefined;
      }

      return record;
    });

    await this.table.add(records);
    return documents.map((d) => d.id);
  }

  /**
   * Search for documents similar to the query.
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.embeddings) {
      throw new Error(
        "No embeddings provider configured. Use searchByVector() with a pre-computed query embedding, or configure an embeddings provider."
      );
    }

    const queryVector = await this.embeddings.embedQuery(query);
    return this.searchByVector(queryVector, options);
  }

  /**
   * Search using a pre-computed embedding vector.
   */
  async searchByVector(
    embedding: number[],
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;
    const scoreThreshold = options?.scoreThreshold;

    let queryBuilder = this.table.vectorSearch(embedding).limit(limit);

    if (options?.filter) {
      const filterStr = this.buildFilterString(options.filter);
      if (filterStr) {
        queryBuilder = queryBuilder.where(filterStr);
      }
    }

    const results = await queryBuilder.toArray();

    return this.processResults(results, scoreThreshold);
  }

  /**
   * Delete documents by their IDs.
   */
  async delete(ids: string[], _options?: DeleteOptions): Promise<number> {
    const idList = ids.map((id) => `'${id}'`).join(", ");
    const filter = `id IN (${idList})`;

    const countBefore = await this.table.countRows();
    await this.table.delete(filter);
    const countAfter = await this.table.countRows();

    return countBefore - countAfter;
  }

  /**
   * Delete all documents.
   */
  async clear(_options?: DeleteOptions): Promise<void> {
    await this.table.delete("id IS NOT NULL");
  }

  /**
   * Get a document by its ID.
   */
  async getById(
    id: string,
    _options?: DeleteOptions
  ): Promise<Document | null> {
    const results = await this.table
      .query()
      .where(`id = '${id}'`)
      .limit(1)
      .toArray();

    if (results.length === 0) {
      return null;
    }

    const row = results[0] as Record<string, unknown>;
    return {
      id: row.id as string,
      content: row.text as string,
      metadata: this.extractMetadata(row),
    };
  }

  /**
   * Get existing documents by their content hashes.
   * Used for deduplication during ingestion.
   *
   * Note: If using metadataFields, include a "hash" field of type "string"
   * for efficient hash lookups. Otherwise, falls back to LIKE queries on JSON metadata.
   */
  async getByHashes(
    hashes: string[],
    _options?: DeleteOptions
  ): Promise<Map<string, string>> {
    const hashMap = new Map<string, string>();

    if (hashes.length === 0) {
      return hashMap;
    }

    // Check if hash is a defined metadata field for efficient queries
    const hasHashField = this.metadataFields?.some(
      (field) => field.name === "hash"
    );

    for (const hash of hashes) {
      let results: Record<string, unknown>[];

      if (hasHashField) {
        // Efficient direct column query
        results = await this.table
          .query()
          .where(`hash = '${hash}'`)
          .limit(1)
          .toArray();
      } else {
        // Legacy: search for hash string in JSON metadata
        results = await this.table
          .query()
          .where(`metadata LIKE '%${hash}%'`)
          .limit(1)
          .toArray();
      }

      if (results.length > 0) {
        const record = results[0] as Record<string, unknown>;
        hashMap.set(hash, record.id as string);
      }
    }

    return hashMap;
  }

  /**
   * Get the underlying LanceDB connection.
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get the underlying LanceDB table.
   */
  getTable(): Table {
    return this.table;
  }

  /**
   * Get the configured embeddings provider.
   */
  getEmbeddings(): Embeddings | undefined {
    return this.embeddings;
  }

  /**
   * Get the vector dimensions.
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Create an index on the vector column for faster searches.
   * Recommended for tables with more than 10,000 rows.
   */
  async createIndex(): Promise<void> {
    await this.table.createIndex("vector");
  }

  /**
   * Optimize the table for better performance.
   */
  async optimize(): Promise<void> {
    await this.table.optimize();
  }

  /**
   * Build a SQL filter string from a filter object.
   */
  private buildFilterString(filter: Record<string, unknown>): string {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === "string") {
        conditions.push(`${key} = '${value}'`);
      } else if (typeof value === "number") {
        conditions.push(`${key} = ${value}`);
      } else if (typeof value === "boolean") {
        conditions.push(`${key} = ${value}`);
      }
    }

    return conditions.join(" AND ");
  }

  /**
   * Process raw LanceDB results into SearchResult format.
   */
  private processResults(
    results: Record<string, unknown>[],
    scoreThreshold?: number
  ): SearchResult[] {
    const searchResults: SearchResult[] = [];

    for (const row of results) {
      // LanceDB returns _distance for vector search
      const distance = (row._distance as number) ?? 0;
      // Convert distance to similarity score (lower distance = higher similarity)
      const score = 1 / (1 + distance);

      if (scoreThreshold !== undefined && score < scoreThreshold) {
        continue;
      }

      const metadata = this.extractMetadata(row);

      searchResults.push({
        document: {
          id: row.id as string,
          content: row.text as string,
          metadata,
        },
        score,
      });
    }

    return searchResults;
  }

  /**
   * Extract metadata from a row based on metadataFields configuration.
   */
  private extractMetadata(
    row: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (this.metadataFields && this.metadataFields.length > 0) {
      // Reconstruct metadata from separate columns
      const metadata: Record<string, unknown> = {};
      let hasValue = false;

      for (const field of this.metadataFields) {
        const value = row[field.name];
        if (value !== null && value !== undefined) {
          metadata[field.name] = value;
          hasValue = true;
        }
      }

      return hasValue ? metadata : undefined;
    } else {
      // Legacy: parse metadata from JSON string
      return row.metadata ? JSON.parse(row.metadata as string) : undefined;
    }
  }

  /**
   * Get the configured metadata fields.
   */
  getMetadataFields(): MetadataFieldDefinition[] | undefined {
    return this.metadataFields;
  }
}
