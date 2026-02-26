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
import { Embeddings } from "../embeddings/Embeddings";

/**
 * All known ChunkMetadata field names.
 * Used to separate chunk metadata from user metadata when packing/unpacking.
 */
const CHUNK_METADATA_KEYS = [
  "index", "total", "prev_id", "next_id",
  "start", "end", "source_id", "source_path",
  "char_count", "token_count", "hash", "section", "page",
] as const;

const CHUNK_METADATA_KEY_SET = new Set<string>(CHUNK_METADATA_KEYS);

/**
 * Supported types for metadata fields.
 */
export type MetadataFieldType = "string" | "number" | "boolean";

/**
 * Definition for a metadata field that will be stored as a separate column.
 */
export interface MetadataFieldDefinition {
  /** Name of the metadata field. Use snake_case (e.g. `tenant_id`) to avoid SQL filter issues. */
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
   * User-defined metadata field definitions.
   *
   * When provided, these fields are stored as typed Arrow columns and are
   * filterable via SQL predicates in `search()`. The table is created on
   * first insert using an explicit Arrow schema built from these definitions.
   *
   * **Important:** Use `snake_case` for field names (e.g. `tenant_id`, not
   * `tenantId`). LanceDB uses DataFusion for SQL filtering, which normalizes
   * unquoted identifiers to lowercase. Mixed-case names like `tenantId` will
   * fail to match the column `tenantId` because the filter resolves to
   * `tenantid`.
   *
   * Chunk metadata fields (index, hash, prev_id, etc.) are handled
   * automatically via a `chunk_metadata` struct column — they do not need
   * to be listed here.
   *
   * When omitted, the store connects to a **pre-existing** table (created
   * independently, e.g. via the LanceDB CLI or another tool). In that case
   * the schema is not managed by this class and all non-system columns are
   * returned as metadata on read.
   */
  metadataFields?: MetadataFieldDefinition[];
}

/**
 * Internal record structure stored in LanceDB.
 */
interface LanceDBRecord {
  id: string;
  text: string;
  vector?: number[];
  [key: string]: unknown;
}

/**
 * LanceDB implementation of the VectorStore interface.
 *
 * Supports two modes of operation:
 *
 * **Managed mode** (`metadataFields` provided): The store creates the LanceDB
 * table on first insert using an explicit Arrow schema derived from
 * `metadataFields`. User-defined fields are stored as typed top-level columns.
 * Chunk metadata (from chunkers) is automatically packed into a `chunk_metadata`
 * struct column.
 *
 * **Pre-existing table mode** (`metadataFields` omitted): The store connects
 * to a table that was created independently (e.g. via LanceDB CLI or another
 * tool). No schema management is performed; all non-system columns are returned
 * as metadata on read.
 *
 * @example Managed mode — user-defined metadata fields
 * ```typescript
 * import { LanceDBVectorStore } from "@agentionai/agents";
 * import { OpenAIEmbeddings } from "@agentionai/agents/embeddings";
 *
 * const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
 *
 * const store = await LanceDBVectorStore.create({
 *   name: "knowledge_base",
 *   uri: "./my-database",
 *   tableName: "chunks",
 *   embeddings,
 *   metadataFields: [
 *     { name: "author", type: "string", nullable: true },
 *     { name: "category", type: "string", nullable: true },
 *   ],
 * });
 *
 * // Chunk metadata (index, hash, prev_id, etc.) is stored automatically
 * // in a chunk_metadata struct column — no need to declare it.
 * await store.addDocuments([
 *   { id: "1", content: "LanceDB is a vector database", metadata: { category: "db" } },
 * ]);
 *
 * // Search with filters on user metadata columns
 * const results = await store.search("vector database", {
 *   limit: 5,
 *   filter: { category: "db" },
 * });
 * ```
 *
 * @example Pre-existing table mode — connect to externally managed table
 * ```typescript
 * const store = await LanceDBVectorStore.create({
 *   name: "my_store",
 *   uri: "./my-database",
 *   tableName: "existing_table", // table already exists with its own schema
 *   embeddings,
 *   // metadataFields omitted — schema is not managed by this class
 * });
 * ```
 */
export class LanceDBVectorStore extends VectorStore {
  readonly name: string;

  private connection: Connection;
  private table: Table | null;
  private embeddings?: Embeddings;
  private tableName: string;
  private dimensions: number;
  private metadataFields?: MetadataFieldDefinition[];

  private constructor(
    config: LanceDBVectorStoreConfig,
    connection: Connection,
    table: Table | null
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
   * - If the table already exists it is opened immediately.
   * - If `metadataFields` is provided and the table does not exist yet, it
   *   will be created on the first insert with an explicit Arrow schema.
   * - If `metadataFields` is **not** provided and the table does not exist,
   *   an error is thrown — the store cannot manage an unknown schema.
   *
   * @param config - Configuration for the store
   * @returns A configured LanceDBVectorStore instance
   *
   * @throws Error if @lancedb/lancedb is not installed
   * @throws Error if the table does not exist and no metadataFields are provided
   */
  static async create(
    config: LanceDBVectorStoreConfig
  ): Promise<LanceDBVectorStore> {
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

    let table: Table | null = null;
    if (tableNames.includes(config.tableName)) {
      table = await connection.openTable(config.tableName);
    } else if (!config.metadataFields) {
      throw new Error(
        `Table "${config.tableName}" does not exist and no metadataFields were provided. ` +
          `Either create the table independently or provide metadataFields so the store can create it on first insert.`
      );
    }
    // Table doesn't exist but metadataFields provided → will be created on first insert.

    return new LanceDBVectorStore(config, connection, table);
  }

  /**
   * Create the table with an explicit Arrow schema derived from `metadataFields`
   * plus a `chunk_metadata` struct column.
   * Called on the first insert when operating in managed mode.
   */
  private async createManagedTable(records: LanceDBRecord[]): Promise<Table> {
    let arrow: typeof import("apache-arrow");
    try {
      arrow = await import("apache-arrow");
    } catch {
      throw new Error(
        "apache-arrow is not installed. Install it with: npm install apache-arrow"
      );
    }

    const schemaFields: import("apache-arrow").Field[] = [
      new arrow.Field("id", new arrow.Utf8(), false),
      new arrow.Field("text", new arrow.Utf8(), false),
      new arrow.Field(
        "vector",
        new arrow.FixedSizeList(
          this.dimensions,
          new arrow.Field("item", new arrow.Float32(), true)
        ),
        false
      ),
    ];

    // Warn about non-snake_case field names (DataFusion normalizes SQL identifiers to lowercase)
    for (const fieldDef of this.metadataFields!) {
      if (fieldDef.name !== fieldDef.name.toLowerCase()) {
        console.warn(
          `[LanceDBVectorStore] Warning: metadata field "${fieldDef.name}" contains uppercase characters. ` +
            `LanceDB uses DataFusion for SQL filtering, which normalizes unquoted identifiers to lowercase. ` +
            `Use snake_case names (e.g. "${fieldDef.name.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()).replace(/^_/, "")}") to avoid filter issues.`
        );
      }
    }

    // User-defined metadata columns
    for (const fieldDef of this.metadataFields!) {
      const nullable = fieldDef.nullable !== false; // default true

      let arrowType: import("apache-arrow").DataType;
      if (fieldDef.type === "number") {
        arrowType = new arrow.Float64();
      } else if (fieldDef.type === "boolean") {
        arrowType = new arrow.Bool();
      } else {
        arrowType = new arrow.Utf8();
      }

      schemaFields.push(new arrow.Field(fieldDef.name, arrowType, nullable));
    }

    // Chunk metadata struct column (always included, nullable for non-chunk docs)
    schemaFields.push(
      new arrow.Field(
        "chunk_metadata",
        new arrow.Struct([
          new arrow.Field("index", new arrow.Float64(), true),
          new arrow.Field("total", new arrow.Float64(), true),
          new arrow.Field("prev_id", new arrow.Utf8(), true),
          new arrow.Field("next_id", new arrow.Utf8(), true),
          new arrow.Field("start", new arrow.Float64(), true),
          new arrow.Field("end", new arrow.Float64(), true),
          new arrow.Field("source_id", new arrow.Utf8(), true),
          new arrow.Field("source_path", new arrow.Utf8(), true),
          new arrow.Field("char_count", new arrow.Float64(), true),
          new arrow.Field("token_count", new arrow.Float64(), true),
          new arrow.Field("hash", new arrow.Utf8(), true),
          new arrow.Field("section", new arrow.Utf8(), true),
          new arrow.Field("page", new arrow.Float64(), true),
        ]),
        true // nullable — non-chunk documents get null
      )
    );

    const schema = new arrow.Schema(schemaFields);
    this.table = await this.connection.createTable(this.tableName, records, {
      schema,
    });
    return this.table;
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

    const texts = documents.map((doc) => doc.content);
    const vectors = await this.embeddings.embed(texts);

    const embeddedDocs: EmbeddedDocument[] = documents.map((doc, i) => ({
      ...doc,
      embedding: vectors[i],
    }));

    return this.addEmbeddedDocuments(embeddedDocs, _options);
  }

  /**
   * Add documents with pre-computed embeddings.
   *
   * In managed mode, chunk metadata fields are packed into a `chunk_metadata`
   * struct and user-defined fields are projected to their declared columns.
   * The table is created on the first call; subsequent calls append directly.
   *
   * In pre-existing table mode all metadata is spread flat as-is.
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
        ...doc.metadata,
      };

      // In managed mode, pack chunk metadata into struct and project to schema
      if (this.metadataFields) {
        const packed = this.packChunkMetadata(doc.metadata ?? {});
        record.chunk_metadata = packed;
        return this.projectToSchema(record);
      }

      return record;
    });

    if (this.table) {
      await this.table.add(records);
    } else {
      // Managed mode: metadataFields must be present (enforced in create())
      await this.createManagedTable(records);
    }

    return documents.map((d) => d.id);
  }

  /**
   * Pack chunk metadata fields from flat metadata into a struct object.
   * Returns a plain object for the `chunk_metadata` column, or null if
   * no chunk metadata fields are present.
   */
  private packChunkMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown> | null {
    const struct: Record<string, unknown> = {};
    let found = false;

    for (const key of CHUNK_METADATA_KEYS) {
      if (key in metadata) {
        struct[key] = metadata[key] ?? null;
        found = true;
      }
    }

    return found ? struct : null;
  }

  /**
   * Unpack a chunk_metadata struct value back to flat metadata keys.
   */
  private unpackChunkMetadata(
    struct: Record<string, unknown>,
    target: Record<string, unknown>
  ): void {
    for (const key of CHUNK_METADATA_KEYS) {
      const value = struct[key];
      if (value !== null && value !== undefined) {
        target[key] = value;
      }
    }
  }

  /**
   * Project a record to only the columns declared in the schema
   * (id, text, vector, chunk_metadata, plus all metadataFields).
   */
  private projectToSchema(record: LanceDBRecord): LanceDBRecord {
    const projected: LanceDBRecord = { id: record.id, text: record.text };
    if (record.vector !== undefined) {
      projected.vector = record.vector;
    }

    // User-defined metadata fields
    for (const f of this.metadataFields!) {
      projected[f.name] = record[f.name] ?? null;
    }

    // Chunk metadata struct
    projected.chunk_metadata = record.chunk_metadata ?? null;

    return projected;
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
    if (!this.table) {
      return [];
    }

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
    if (!this.table) return 0;

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
    if (!this.table) return;
    await this.table.delete("id IS NOT NULL");
  }

  /**
   * Get a document by its ID.
   */
  async getById(
    id: string,
    _options?: DeleteOptions
  ): Promise<Document | null> {
    if (!this.table) return null;

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
   * Requires that documents were stored with chunk metadata containing
   * a `hash` field (automatically present when using chunkers from this library).
   * Queries the `chunk_metadata.hash` struct sub-field.
   */
  async getByHashes(
    hashes: string[],
    _options?: DeleteOptions
  ): Promise<Map<string, string>> {
    const hashMap = new Map<string, string>();

    if (hashes.length === 0 || !this.table) {
      return hashMap;
    }

    for (const hash of hashes) {
      const results = await this.table
        .query()
        .where(`chunk_metadata.hash = '${hash}'`)
        .limit(1)
        .toArray();

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
   * Get the underlying LanceDB table, or null if no data has been inserted yet.
   */
  getTable(): Table | null {
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
    if (!this.table) throw new Error("Table not yet created — insert data first.");
    await this.table.createIndex("vector");
  }

  /**
   * Optimize the table for better performance.
   */
  async optimize(): Promise<void> {
    if (!this.table) return;
    await this.table.optimize();
  }

  /**
   * Get the configured metadata fields.
   */
  getMetadataFields(): MetadataFieldDefinition[] | undefined {
    return this.metadataFields;
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
      const distance = (row._distance as number) ?? 0;
      const score = 1 / (1 + distance);

      if (scoreThreshold !== undefined && score < scoreThreshold) {
        continue;
      }

      searchResults.push({
        document: {
          id: row.id as string,
          content: row.text as string,
          metadata: this.extractMetadata(row),
        },
        score,
      });
    }

    return searchResults;
  }

  /**
   * Extract metadata from a row.
   *
   * In managed mode: returns user-defined fields plus unpacked chunk_metadata.
   * In pre-existing table mode: returns all non-system columns, with
   * chunk_metadata unpacked if present.
   */
  private extractMetadata(
    row: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    const SYSTEM_COLS = new Set(["id", "text", "vector", "_distance", "chunk_metadata"]);

    const metadata: Record<string, unknown> = {};
    let hasValue = false;

    if (this.metadataFields && this.metadataFields.length > 0) {
      // Managed mode: collect declared user fields
      for (const field of this.metadataFields) {
        const value = row[field.name];
        if (value !== null && value !== undefined) {
          metadata[field.name] = value;
          hasValue = true;
        }
      }
    } else {
      // Pre-existing table mode: return all non-system columns
      for (const [key, value] of Object.entries(row)) {
        if (!SYSTEM_COLS.has(key) && value !== null && value !== undefined) {
          metadata[key] = value;
          hasValue = true;
        }
      }
    }

    // Unpack chunk_metadata struct if present
    const chunkStruct = row.chunk_metadata;
    if (chunkStruct && typeof chunkStruct === "object") {
      this.unpackChunkMetadata(
        chunkStruct as Record<string, unknown>,
        metadata
      );
      hasValue = true;
    }

    return hasValue ? metadata : undefined;
  }
}
