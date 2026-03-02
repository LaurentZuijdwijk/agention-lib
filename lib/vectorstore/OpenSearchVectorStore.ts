/**
 * OpenSearch implementation of the VectorStore interface.
 *
 * Uses the OpenSearch k-NN plugin for approximate nearest-neighbour search
 * via HNSW indexing. Supports cosine similarity, L2, and inner product
 * space types.
 *
 * @requires @opensearch-project/opensearch - Install with: npm install @opensearch-project/opensearch
 */

import {
  VectorStore,
  Document,
  EmbeddedDocument,
  SearchResult,
  AddDocumentsOptions,
  SearchOptions,
  DeleteOptions,
  MetadataFieldDefinition,
} from "./VectorStore";
import { Embeddings } from "../embeddings/Embeddings";

// ---------------------------------------------------------------------------
// Minimal local types — avoids a hard dependency on the opensearch package
// for TypeScript compilation while still providing type safety internally.
// ---------------------------------------------------------------------------

interface OpenSearchClientConfig {
  node: string;
  auth?: { username: string; password: string };
  ssl?: { rejectUnauthorized?: boolean };
}

interface OpenSearchHit<T> {
  _id: string;
  _score: number;
  _source: T;
}

interface OpenSearchClient {
  indices: {
    exists(params: { index: string }): Promise<{ body: boolean }>;
    create(params: { index: string; body: unknown }): Promise<unknown>;
    delete(params: { index: string }): Promise<unknown>;
  };
  bulk(params: {
    body: unknown[];
    refresh?: boolean | string;
  }): Promise<{
    body: {
      items?: Array<{
        delete?: { result?: string };
        index?: { result?: string };
      }>;
      errors?: boolean;
    };
  }>;
  search<T>(params: { index: string; body: unknown }): Promise<{
    body: { hits?: { hits?: OpenSearchHit<T>[] } };
  }>;
  get<T>(params: { index: string; id: string }): Promise<{
    body: { found: boolean; _source: T };
  }>;
  deleteByQuery(params: {
    index: string;
    body: unknown;
    refresh?: boolean | string;
  }): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Public config and types
// ---------------------------------------------------------------------------

/**
 * k-NN vector space type used by the OpenSearch k-NN plugin.
 * - `cosinesimil` — cosine similarity (default, normalised vectors recommended)
 * - `l2`          — Euclidean L2 distance
 * - `innerproduct` — inner / dot product
 */
export type OpenSearchSpaceType = "cosinesimil" | "l2" | "innerproduct";

/**
 * k-NN engine used by the OpenSearch k-NN plugin.
 * - `lucene` — native Lucene ANN (cosinesimil and l2 only); default since OpenSearch 3.x
 * - `faiss`  — high-throughput GPU-accelerated (l2 and innerproduct only)
 * - `nmslib` — deprecated and removed in OpenSearch 3.0; do not use
 */
export type OpenSearchKnnEngine = "lucene" | "faiss" | "nmslib";

/**
 * Configuration for OpenSearchVectorStore.
 */
export interface OpenSearchVectorStoreConfig {
  /** Name identifier for this store instance */
  name: string;
  /** OpenSearch node URL (e.g. `https://localhost:9200`) */
  node: string;
  /** Basic-auth credentials */
  auth?: { username: string; password: string };
  /** SSL options — set `rejectUnauthorized: false` for self-signed certs */
  ssl?: { rejectUnauthorized?: boolean };
  /** OpenSearch index name to use for document storage */
  indexName: string;
  /** Embeddings provider for automatic embedding generation */
  embeddings?: Embeddings;
  /**
   * Vector dimensions.
   * Defaults to `embeddings.dimensions` when an embeddings provider is given,
   * otherwise falls back to `1536`.
   */
  dimensions?: number;
  /**
   * k-NN vector space type (default: `"cosinesimil"`).
   * Must match the space type the embeddings model was trained for.
   */
  spaceType?: OpenSearchSpaceType;
  /**
   * k-NN engine (default: `"lucene"`).
   * `nmslib` was removed in OpenSearch 3.0 and cannot be used for new indices.
   */
  engine?: OpenSearchKnnEngine;
  /**
   * HNSW `ef_search` parameter — controls recall vs. latency at query time.
   * Higher values improve recall at the cost of latency. Default: `512`.
   */
  efSearch?: number;
  /**
   * HNSW `ef_construction` parameter — controls graph quality at index time.
   * Higher values improve recall at the cost of indexing speed. Default: `512`.
   */
  efConstruction?: number;
  /**
   * HNSW `M` parameter — number of bidirectional links per node.
   * Higher values improve recall but increase memory usage. Default: `16`.
   */
  m?: number;
  /**
   * Optional user-defined metadata field definitions.
   *
   * When provided, these fields are declared in the index mapping with proper
   * types (`keyword` for strings, `double` for numbers, `boolean` for booleans),
   * which enables reliable exact-match filtering via `SearchOptions.filter`.
   *
   * Without this option, OpenSearch uses dynamic mapping for the `metadata`
   * object. String fields are mapped as `text` with a `.keyword` sub-field —
   * the store handles this automatically by appending `.keyword` to undeclared
   * string filter values at query time.
   *
   * Chunk metadata fields produced by the library's chunkers (`hash`,
   * `prev_id`, `next_id`, etc.) are always declared explicitly — you do not
   * need to list them here.
   *
   * @example
   * ```typescript
   * metadataFields: [
   *   { name: "source", type: "string" },
   *   { name: "page",   type: "number" },
   * ]
   * ```
   */
  metadataFields?: MetadataFieldDefinition[];
}

/**
 * Internal document structure stored in the OpenSearch index.
 */
interface OpenSearchDoc {
  id: string;
  content: string;
  embedding: number[];
  namespace?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Score normalisation helpers
// ---------------------------------------------------------------------------

/**
 * Raw OpenSearch k-NN scores are not in the [0, 1] range for all space types.
 * This function normalises them:
 * - cosinesimil: OpenSearch returns `1 + cos(q, d)` → range [0, 2]; divide by 2.
 * - l2:          OpenSearch returns `1 / (1 + l2_dist)` → already in (0, 1].
 * - innerproduct: pass through as-is (application-defined interpretation).
 */
function normalizeScore(
  rawScore: number,
  spaceType: OpenSearchSpaceType
): number {
  if (spaceType === "cosinesimil") {
    return rawScore / 2;
  }
  return rawScore;
}

// ---------------------------------------------------------------------------
// OpenSearchVectorStore
// ---------------------------------------------------------------------------

/**
 * OpenSearch implementation of the VectorStore interface.
 *
 * Stores documents in an OpenSearch index with a `knn_vector` field and
 * performs approximate nearest-neighbour search using the k-NN plugin (HNSW).
 *
 * **Namespace support**: namespaces are stored as a top-level `namespace`
 * keyword field. All search / delete operations that receive a namespace
 * automatically add a term filter on this field.
 *
 * **Metadata**: stored as a nested `metadata` object with dynamic mapping.
 * Chunk metadata fields produced by the library's chunkers (e.g. `hash`,
 * `prev_id`, `next_id`) live inside `metadata` and are searchable via
 * `metadata.<field>` queries.
 *
 * @example Basic setup with OpenAI embeddings
 * ```typescript
 * import { OpenSearchVectorStore } from "@agentionai/agents/vectorstore";
 * import { OpenAIEmbeddings } from "@agentionai/agents/embeddings";
 *
 * const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
 *
 * const store = await OpenSearchVectorStore.create({
 *   name: "my_store",
 *   node: "https://localhost:9200",
 *   auth: { username: "admin", password: "admin" },
 *   ssl: { rejectUnauthorized: false },
 *   indexName: "knowledge_base",
 *   embeddings,
 * });
 *
 * await store.addDocuments([
 *   { id: "1", content: "OpenSearch is a distributed search engine.", metadata: { source: "docs" } },
 * ]);
 *
 * const results = await store.search("distributed search", { limit: 5 });
 * ```
 *
 * @example Use as an agent retrieval tool
 * ```typescript
 * const searchTool = store.toRetrievalTool("Search product documentation");
 * const agent = new ClaudeAgent({ tools: [searchTool], ... });
 * ```
 */
/**
 * Chunk metadata field names always declared explicitly in the mapping.
 * These are produced by the library's chunkers and used internally for
 * deduplication (hash) and chunk navigation (prev_id, next_id).
 */
const CHUNK_KEYWORD_FIELDS = new Set([
  "hash", "prev_id", "next_id", "source_id", "source_path", "section",
]);

const CHUNK_NUMERIC_FIELDS = new Set([
  "index", "total", "start", "end", "char_count", "token_count", "page",
]);

export class OpenSearchVectorStore extends VectorStore {
  readonly name: string;

  private client: OpenSearchClient;
  private indexName: string;
  private embeddings?: Embeddings;
  private dimensions: number;
  private spaceType: OpenSearchSpaceType;
  private engine: OpenSearchKnnEngine;
  private efSearch: number;
  private efConstruction: number;
  private m: number;
  private metadataFields?: MetadataFieldDefinition[];
  /** Set of metadata field names declared as keyword (string) type. */
  private keywordFields: Set<string>;

  private constructor(
    config: OpenSearchVectorStoreConfig,
    client: OpenSearchClient
  ) {
    super();
    this.name = config.name;
    this.client = client;
    this.indexName = config.indexName;
    this.embeddings = config.embeddings;
    this.dimensions =
      config.dimensions ?? config.embeddings?.dimensions ?? 1536;
    this.spaceType = config.spaceType ?? "cosinesimil";
    this.engine = config.engine ?? "lucene";
    this.efSearch = config.efSearch ?? 512;
    this.efConstruction = config.efConstruction ?? 512;
    this.m = config.m ?? 16;
    this.metadataFields = config.metadataFields;

    // Build the set of field names that are explicitly mapped as keyword.
    // Used by the filter builder to decide whether to append ".keyword".
    this.keywordFields = new Set(CHUNK_KEYWORD_FIELDS);
    for (const field of config.metadataFields ?? []) {
      if (field.type === "string") {
        this.keywordFields.add(field.name);
      }
    }
  }

  /**
   * Create a new OpenSearchVectorStore instance.
   *
   * Connects to the given OpenSearch node and creates the index (with k-NN
   * mapping) if it does not already exist.
   *
   * @param config - Store configuration
   * @returns A ready-to-use OpenSearchVectorStore instance
   * @throws Error if `@opensearch-project/opensearch` is not installed
   */
  static async create(
    config: OpenSearchVectorStoreConfig
  ): Promise<OpenSearchVectorStore> {
    let ClientCtor: new (cfg: OpenSearchClientConfig) => OpenSearchClient;

    try {
      // Use a variable so TypeScript does not attempt static module resolution
      // for this optional peer dependency.
      const pkgName = "@opensearch-project/opensearch";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = (await import(pkgName)) as any;
      ClientCtor = mod.Client;
    } catch {
      throw new Error(
        "@opensearch-project/opensearch is not installed. " +
          "Install it with: npm install @opensearch-project/opensearch"
      );
    }

    const clientCfg: OpenSearchClientConfig = { node: config.node };
    if (config.auth) clientCfg.auth = config.auth;
    if (config.ssl) clientCfg.ssl = config.ssl;

    const client = new ClientCtor(clientCfg);
    const store = new OpenSearchVectorStore(config, client);
    await store.ensureIndex();
    return store;
  }

  // -------------------------------------------------------------------------
  // Index management
  // -------------------------------------------------------------------------

  /**
   * Create the k-NN index if it does not already exist.
   *
   * The `metadata` object always includes explicit mappings for chunk metadata
   * fields (hash, prev_id, etc.) so they work correctly in term queries.
   * Any user-declared `metadataFields` are also mapped with proper types.
   * All other metadata fields fall back to dynamic mapping.
   */
  private async ensureIndex(): Promise<void> {
    const { body: exists } = await this.client.indices.exists({
      index: this.indexName,
    });
    if (exists) return;

    // Build explicit sub-properties for the metadata object.
    const metadataProperties: Record<string, unknown> = {};

    // Chunk metadata fields — always declared with correct types.
    for (const field of CHUNK_KEYWORD_FIELDS) {
      metadataProperties[field] = { type: "keyword" };
    }
    for (const field of CHUNK_NUMERIC_FIELDS) {
      metadataProperties[field] = { type: "integer" };
    }

    // User-declared metadata fields.
    for (const field of this.metadataFields ?? []) {
      if (field.type === "number") {
        metadataProperties[field.name] = { type: "double" };
      } else if (field.type === "boolean") {
        metadataProperties[field.name] = { type: "boolean" };
      } else {
        metadataProperties[field.name] = { type: "keyword" };
      }
    }

    await this.client.indices.create({
      index: this.indexName,
      body: {
        settings: {
          index: {
            knn: true,
            "knn.algo_param.ef_search": this.efSearch,
          },
        },
        mappings: {
          properties: {
            id: { type: "keyword" },
            content: { type: "text" },
            embedding: {
              type: "knn_vector",
              dimension: this.dimensions,
              method: {
                name: "hnsw",
                space_type: this.spaceType,
                engine: this.engine,
                parameters: {
                  ef_construction: this.efConstruction,
                  m: this.m,
                },
              },
            },
            namespace: { type: "keyword" },
            metadata: {
              type: "object",
              dynamic: true, // undeclared fields still work via dynamic mapping
              properties: metadataProperties,
            },
          },
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // VectorStore abstract method implementations
  // -------------------------------------------------------------------------

  /**
   * Add documents to the store.
   * Embeddings are generated automatically using the configured provider.
   */
  async addDocuments(
    documents: Document[],
    options?: AddDocumentsOptions
  ): Promise<string[]> {
    if (!this.embeddings) {
      throw new Error(
        "No embeddings provider configured. " +
          "Use addEmbeddedDocuments() with pre-computed embeddings, " +
          "or pass an embeddings provider in the config."
      );
    }

    const texts = documents.map((d) => d.content);
    const vectors = await this.embeddings.embed(texts);

    const embedded: EmbeddedDocument[] = documents.map((doc, i) => ({
      ...doc,
      embedding: vectors[i],
    }));

    return this.addEmbeddedDocuments(embedded, options);
  }

  /**
   * Add documents with pre-computed embeddings.
   * Uses OpenSearch bulk API for efficiency.
   */
  async addEmbeddedDocuments(
    documents: EmbeddedDocument[],
    options?: AddDocumentsOptions
  ): Promise<string[]> {
    if (documents.length === 0) return [];

    const namespace = options?.namespace;

    // Flatten documents into bulk request body
    const body: unknown[] = [];
    for (const doc of documents) {
      body.push({ index: { _index: this.indexName, _id: doc.id } });
      const osDoc: OpenSearchDoc = {
        id: doc.id,
        content: doc.content,
        embedding: doc.embedding,
        metadata: doc.metadata,
      };
      if (namespace) osDoc.namespace = namespace;
      body.push(osDoc);
    }

    await this.client.bulk({ body, refresh: true });
    return documents.map((d) => d.id);
  }

  /**
   * Search for documents similar to the query text.
   * The query is embedded automatically using the configured embeddings provider.
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this.embeddings) {
      throw new Error(
        "No embeddings provider configured. " +
          "Use searchByVector() with a pre-computed query embedding, " +
          "or pass an embeddings provider in the config."
      );
    }

    const queryVector = await this.embeddings.embedQuery(query);
    return this.searchByVector(queryVector, options);
  }

  /**
   * Search using a pre-computed embedding vector.
   * Executes a k-NN query against the OpenSearch index.
   */
  async searchByVector(
    embedding: number[],
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;
    const scoreThreshold = options?.scoreThreshold;
    const namespace = options?.namespace;
    const filter = options?.filter;

    // Build bool filters for namespace and metadata
    const filters: unknown[] = [];

    if (namespace) {
      filters.push({ term: { namespace } });
    }

    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        // Declared keyword fields can be queried directly.
        // Undeclared string values are dynamically mapped as text+keyword;
        // append ".keyword" to target the exact-match sub-field.
        const isUndeclaredString =
          typeof value === "string" && !this.keywordFields.has(key);
        const fieldPath = isUndeclaredString
          ? `metadata.${key}.keyword`
          : `metadata.${key}`;
        filters.push({ term: { [fieldPath]: value } });
      }
    }

    const knnClause = {
      embedding: { vector: embedding, k: limit },
    };

    const queryBody =
      filters.length > 0
        ? {
            bool: {
              must: [{ knn: knnClause }],
              filter: filters,
            },
          }
        : { knn: knnClause };

    const response = await this.client.search<OpenSearchDoc>({
      index: this.indexName,
      body: { size: limit, query: queryBody },
    });

    const hits = response.body.hits?.hits ?? [];
    const results: SearchResult[] = [];

    for (const hit of hits) {
      const score = normalizeScore(hit._score, this.spaceType);
      if (scoreThreshold !== undefined && score < scoreThreshold) continue;

      results.push({
        document: {
          id: hit._source.id,
          content: hit._source.content,
          metadata: hit._source.metadata,
        },
        score,
      });
    }

    return results;
  }

  /**
   * Delete documents by their IDs.
   * @returns Number of documents actually deleted.
   */
  async delete(ids: string[], _options?: DeleteOptions): Promise<number> {
    if (ids.length === 0) return 0;

    const body: unknown[] = ids.map((id) => ({
      delete: { _index: this.indexName, _id: id },
    }));

    const response = await this.client.bulk({ body, refresh: true });

    return (response.body.items ?? []).filter(
      (item) => item.delete?.result === "deleted"
    ).length;
  }

  /**
   * Delete all documents, optionally scoped to a namespace.
   */
  async clear(options?: DeleteOptions): Promise<void> {
    const namespace = options?.namespace;

    const queryBody = namespace
      ? { query: { term: { namespace } } }
      : { query: { match_all: {} } };

    await this.client.deleteByQuery({
      index: this.indexName,
      body: queryBody,
      refresh: true,
    });
  }

  /**
   * Retrieve a document by its ID.
   * @returns The document, or `null` if not found.
   */
  async getById(
    id: string,
    _options?: DeleteOptions
  ): Promise<Document | null> {
    try {
      const response = await this.client.get<OpenSearchDoc>({
        index: this.indexName,
        id,
      });

      if (!response.body.found) return null;

      const src = response.body._source;
      return {
        id: src.id,
        content: src.content,
        metadata: src.metadata,
      };
    } catch (err: unknown) {
      if ((err as { statusCode?: number }).statusCode === 404) return null;
      throw err;
    }
  }

  /**
   * Get existing documents by their content hashes.
   * Used by the ingestion pipeline for deduplication.
   *
   * Requires that documents were stored with chunk metadata containing a
   * `hash` field (automatically set by chunkers in this library).
   *
   * @returns Map of hash → document ID for hashes that already exist.
   */
  async getByHashes(
    hashes: string[],
    _options?: DeleteOptions
  ): Promise<Map<string, string>> {
    const hashMap = new Map<string, string>();
    if (hashes.length === 0) return hashMap;

    const response = await this.client.search<OpenSearchDoc>({
      index: this.indexName,
      body: {
        size: hashes.length,
        query: { terms: { "metadata.hash": hashes } },
        _source: ["id", "metadata.hash"],
      },
    });

    for (const hit of response.body.hits?.hits ?? []) {
      const hash = (hit._source.metadata as { hash?: string } | undefined)
        ?.hash;
      if (hash) {
        hashMap.set(hash, hit._source.id);
      }
    }

    return hashMap;
  }

  // -------------------------------------------------------------------------
  // OpenSearch-specific accessors
  // -------------------------------------------------------------------------

  /**
   * Delete the entire OpenSearch index.
   * WARNING: This permanently removes all indexed documents and the mapping.
   */
  async deleteIndex(): Promise<void> {
    await this.client.indices.delete({ index: this.indexName });
  }

  /** The OpenSearch index name used by this store. */
  getIndexName(): string {
    return this.indexName;
  }

  /** The configured vector dimensions. */
  getDimensions(): number {
    return this.dimensions;
  }

  /** The configured embeddings provider, if any. */
  getEmbeddings(): Embeddings | undefined {
    return this.embeddings;
  }

  /** The underlying OpenSearch client instance. */
  getClient(): OpenSearchClient {
    return this.client;
  }
}
