# Vector Stores

Vector stores enable semantic search by storing documents with embeddings and retrieving them based on meaning rather than keywords.

## Overview

The vector store system provides:

- **VectorStore interface** - Abstract base class for any vector database
- **LanceDB implementation** - Embedded vector database (local / S3)
- **OpenSearch implementation** - Distributed k-NN search via the OpenSearch k-NN plugin
- **Agent tools** - Convert stores to retrieval/storage tools with `toRetrievalTool()` and `toAddDocumentsTool()`
- **Embeddings integration** - Automatic embedding generation using any provider

## Installation

Each backend is an optional peer dependency. Install only what you need.

**LanceDB** (embedded, local or S3):

```bash
npm install @lancedb/lancedb apache-arrow
```

**OpenSearch** (distributed, requires a running OpenSearch cluster):

```bash
npm install @opensearch-project/opensearch
```

For embeddings, see the [Embeddings guide](/guide/embeddings).

## Quick Start

```typescript
import { LanceDBVectorStore } from '@agentionai/agents/core';
import { OpenAIEmbeddings } from '@agentionai/agents/embeddings';
import { ClaudeAgent } from '@agentionai/agents/claude';

// Create embeddings provider
const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
});

// Create vector store
const store = await LanceDBVectorStore.create({
  name: 'knowledge_base',
  uri: './data/vectors',
  tableName: 'documents',
  embeddings,
});

// Add documents (embeddings generated automatically)
await store.addDocuments([
  { id: '1', content: 'LanceDB is an embedded vector database.' },
  { id: '2', content: 'Vector search enables semantic queries.' },
  { id: '3', content: 'Agents can use tools to retrieve information.' },
]);

// Search
const results = await store.search('What is LanceDB?', { limit: 2 });
```

## Creating Tools for Agents

Vector stores integrate with agents through tools.

### Retrieval Tool

```typescript
const searchTool = store.toRetrievalTool(
  'Search the knowledge base for product documentation and technical guides',
  {
    defaultLimit: 5,
    scoreThreshold: 0.7,
  }
);

const agent = new ClaudeAgent({
  id: 'support-agent',
  name: 'Support Agent',
  description: 'Use the search tool to find documentation before answering questions.',
  model: 'claude-sonnet-4-5',
  tools: [searchTool],
});

const response = await agent.execute('How do I configure authentication?');
```

### Add Documents Tool

```typescript
const addTool = store.toAddDocumentsTool(
  'Save important information to the knowledge base'
);

const learningAgent = new ClaudeAgent({
  id: 'learning-agent',
  name: 'Learning Agent',
  description: 'Save useful information to the knowledge base.',
  model: 'claude-sonnet-4-5',
  tools: [searchTool, addTool],
});
```

### Tool Options

**RetrievalToolOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `toolName` | string | `${storeName}_search` | Custom tool name |
| `defaultLimit` | number | 5 | Default results count |
| `scoreThreshold` | number | - | Minimum similarity (0-1) |
| `namespace` | string | - | Namespace filter |
| `includeMetadata` | boolean | true | Include metadata |
| `defaultFilter` | object | - | Default metadata filters |
| `allowFilterOverride` | boolean | false | Allow agent to override filters |

**AddDocumentsToolOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `toolName` | string | `${storeName}_add` | Custom tool name |
| `namespace` | string | - | Target namespace |
| `defaultMetadata` | object | - | Auto-added metadata |

## LanceDB Configuration

LanceDB is an embedded vector database that runs in-process with no external server required. It supports local storage and S3-compatible backends.

### Basic Setup

```typescript
const store = await LanceDBVectorStore.create({
  name: 'my_store',
  uri: './data/lancedb',
  tableName: 'documents',
  embeddings,
  dimensions: 1536,  // Optional: defaults to embeddings.dimensions
});
```

### Storage Locations

LanceDB supports multiple backends:

```typescript
// Local storage
const local = await LanceDBVectorStore.create({
  name: 'local',
  uri: './data/vectors',
  tableName: 'docs',
  embeddings,
});

// S3 storage
const s3 = await LanceDBVectorStore.create({
  name: 's3',
  uri: 's3://my-bucket/vectors',
  tableName: 'docs',
  embeddings,
  connectionOptions: {
    storageOptions: {
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
});
```

### Pre-computed Embeddings

Use pre-computed embeddings without an embeddings provider:

```typescript
const store = await LanceDBVectorStore.create({
  name: 'store',
  uri: './data',
  tableName: 'docs',
  dimensions: 1536,  // Required when no embeddings provider
});

await store.addEmbeddedDocuments([
  {
    id: '1',
    content: 'Document text',
    embedding: [0.1, 0.2, ...],
    metadata: { source: 'manual' },
  },
]);

const results = await store.searchByVector([0.1, 0.2, ...], { limit: 5 });
```

## OpenSearch Configuration

OpenSearch uses the [k-NN plugin](https://opensearch.org/docs/latest/search-plugins/knn/index/) for approximate nearest-neighbour (ANN) search via HNSW indexing. It is a good fit for production workloads that need distributed storage, full-text search alongside vector search, or managed cloud deployments (Amazon OpenSearch Service).

### Local Development

Start a single-node OpenSearch cluster with Docker:

```bash
docker run -p 9200:9200 -p 9600:9600 \
  -e "discovery.type=single-node" \
  -e 'OPENSEARCH_INITIAL_ADMIN_PASSWORD=MySearch@7742' \
  opensearchproject/opensearch:latest
```

### Basic Setup

```typescript
import { OpenSearchVectorStore } from '@agentionai/agents/vectorstore';
import { OpenAIEmbeddings } from '@agentionai/agents/embeddings';

const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });

const store = await OpenSearchVectorStore.create({
  name: 'knowledge_base',
  node: 'https://localhost:9200',
  auth: { username: 'admin', password: 'admin' },
  ssl: { rejectUnauthorized: false },  // allow self-signed certs in dev
  indexName: 'my_index',
  embeddings,
});

await store.addDocuments([
  { id: '1', content: 'OpenSearch is a distributed search engine.' },
  { id: '2', content: 'HNSW is a graph-based ANN algorithm.' },
]);

const results = await store.search('vector search', { limit: 5 });
```

`OpenSearchVectorStore.create()` connects to the cluster and creates the index with the k-NN mapping if it does not already exist.

### Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | — | Store identifier |
| `node` | string | — | OpenSearch endpoint URL |
| `auth` | object | — | `{ username, password }` for basic auth |
| `ssl` | object | — | `{ rejectUnauthorized }` SSL options |
| `indexName` | string | — | OpenSearch index to use |
| `embeddings` | Embeddings | — | Embeddings provider |
| `dimensions` | number | `embeddings.dimensions \| 1536` | Vector dimensions |
| `spaceType` | string | `"cosinesimil"` | Distance metric (see below) |
| `engine` | string | `"lucene"` | k-NN engine (see below) |
| `efSearch` | number | `512` | HNSW recall vs. latency at query time |
| `efConstruction` | number | `512` | HNSW graph quality at index time |
| `m` | number | `16` | HNSW bidirectional links per node |
| `metadataFields` | array | — | Explicit metadata field type declarations |

### Space Types

| `spaceType` | Description |
|-------------|-------------|
| `cosinesimil` | Cosine similarity (default). Scores normalised to [0, 1]. |
| `l2` | Euclidean distance. Already in (0, 1] — no normalisation needed. |
| `innerproduct` | Dot product. Passed through as-is. |

### k-NN Engines

| `engine` | Notes |
|----------|-------|
| `lucene` | Default since OpenSearch 3.x. Supports `cosinesimil` and `l2`. |
| `faiss` | High-throughput GPU-accelerated. Supports `l2` and `innerproduct`. |
| `nmslib` | Removed in OpenSearch 3.0 — do not use. |

### Metadata Field Declarations

By default, OpenSearch uses dynamic mapping for the `metadata` object. String fields are mapped as `text` with a `.keyword` sub-field, which the store handles automatically. For stricter type control and reliable filtering, declare fields explicitly:

```typescript
const store = await OpenSearchVectorStore.create({
  name: 'kb',
  node: 'https://localhost:9200',
  auth: { username: 'admin', password: 'admin' },
  ssl: { rejectUnauthorized: false },
  indexName: 'knowledge_base',
  embeddings,
  metadataFields: [
    { name: 'category', type: 'string' },
    { name: 'source',   type: 'string' },
    { name: 'page',     type: 'number' },
    { name: 'reviewed', type: 'boolean' },
  ],
});
```

Chunk metadata fields produced by the library's chunkers (`hash`, `prev_id`, `next_id`, etc.) are always declared automatically — you do not need to list them.

### Metadata Filtering

Pass a `filter` object to scope results to specific metadata values:

```typescript
// Filter by a single field
const results = await store.search('HNSW parameters', {
  limit: 5,
  filter: { category: 'knn' },
});

// Filter by multiple fields (all conditions must match)
const results2 = await store.search('billing policy', {
  limit: 10,
  filter: { tenantId: 'acme', category: 'billing' },
});
```

### Namespace Support

Namespaces let you partition a single index into logical tenants. All operations (`addDocuments`, `search`, `clear`) accept a `namespace` option:

```typescript
// Write to a namespace
await store.addDocuments(
  [{ id: 'internal-1', content: 'Internal document.' }],
  { namespace: 'internal' }
);

// Search within a namespace only
const results = await store.search('document', {
  limit: 5,
  namespace: 'public',
});

// Clear only one namespace
await store.clear({ namespace: 'internal' });
```

### OpenSearch-Specific Methods

| Method | Description |
|--------|-------------|
| `getIndexName()` | Returns the configured index name |
| `getDimensions()` | Returns the configured vector dimension count |
| `getEmbeddings()` | Returns the embeddings provider (if any) |
| `getClient()` | Returns the raw `@opensearch-project/opensearch` client for advanced use |
| `deleteIndex()` | Permanently deletes the entire index and all its data |

### RAG Agent Example

```typescript
const searchTool = store.toRetrievalTool(
  'Search the knowledge base for relevant context.',
  { defaultLimit: 3 }
);

const agent = new ClaudeAgent({
  name: 'RAG Assistant',
  id: 'rag_assistant',
  model: 'claude-haiku-4-5',
  description: 'Always use the search tool before answering questions.',
  apiKey: process.env.ANTHROPIC_API_KEY,
  tools: [searchTool],
});

const answer = await agent.execute('What is the HNSW algorithm?');
```

## VectorStore Interface

All vector stores implement the same interface:

```typescript
abstract class VectorStore {
  // Add documents (embeddings generated automatically)
  abstract addDocuments(docs: Document[], options?: AddDocumentsOptions): Promise<string[]>;

  // Add documents with pre-computed embeddings
  abstract addEmbeddedDocuments(docs: EmbeddedDocument[], options?: AddDocumentsOptions): Promise<string[]>;

  // Search by text query
  abstract search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Search by embedding vector
  abstract searchByVector(embedding: number[], options?: SearchOptions): Promise<SearchResult[]>;

  // Delete documents
  abstract delete(ids: string[], options?: DeleteOptions): Promise<number>;

  // Clear all documents
  abstract clear(options?: DeleteOptions): Promise<void>;

  // Get document by ID
  abstract getById(id: string, options?: DeleteOptions): Promise<Document | null>;

  // Create agent tools
  toRetrievalTool(description: string, options?: RetrievalToolOptions): Tool<SearchResult[]>;
  toAddDocumentsTool(description: string, options?: AddDocumentsToolOptions): Tool;
}
```

## Document Structure

```typescript
interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface SearchResult {
  document: Document;
  score: number;  // Similarity score (0-1, higher = more similar)
}
```

## Filtering and Multi-Tenancy

Filter results using metadata for multi-tenant isolation, project separation, and categorization.

### Direct Filtering

```typescript
const results = await store.search('billing policy', {
  limit: 10,
  filter: {
    tenantId: 'acme-corp',
    projectId: 'proj-123',
    category: 'billing',
  },
});
```

### Tenant Isolation

```typescript
// Add documents with tenant metadata
await store.addDocuments([
  {
    id: '1',
    content: 'Acme Corp billing policy...',
    metadata: { tenantId: 'acme', projectId: 'proj-123' },
  },
  {
    id: '2',
    content: 'TechStart billing policy...',
    metadata: { tenantId: 'techstart', projectId: 'proj-456' },
  },
]);

// Tenant-specific search tool
const acmeSearchTool = store.toRetrievalTool(
  'Search Acme Corp knowledge base',
  {
    defaultFilter: { tenantId: 'acme' },
    allowFilterOverride: false,  // Enforce isolation
  }
);

const acmeAgent = new ClaudeAgent({
  name: 'acme-support',
  tools: [acmeSearchTool],
});
```

### Flexible Filtering

```typescript
const flexibleTool = store.toRetrievalTool(
  'Search knowledge base with filters',
  {
    defaultFilter: { tenantId: 'acme' },
    allowFilterOverride: true,  // Agent can add more filters
  }
);

const agent = new ClaudeAgent({
  id: 'flexible-agent',
  name: 'Flexible Agent',
  description: 'Use search tool with filters like { projectId: "xxx" }.',
  model: 'claude-sonnet-4-5',
  tools: [flexibleTool],
});
```

### Auto-Tagging

```typescript
const addTool = store.toAddDocumentsTool(
  'Add documents to knowledge base',
  {
    defaultMetadata: {
      tenantId: 'acme',
      projectId: 'proj-123',
      addedBy: 'system',
    },
  }
);
```

## Performance

### Indexing

For tables with >10,000 documents, create an index:

```typescript
await store.createIndex();
```

### Optimization

Periodically optimize for better performance:

```typescript
await store.optimize();
```

### Batch Operations

```typescript
const documents = loadDocuments();
const batchSize = 1000;

for (let i = 0; i < documents.length; i += batchSize) {
  const batch = documents.slice(i, i + batchSize);
  await store.addDocuments(batch);
}
```

## Custom Vector Store

Implement `VectorStore` for other databases:

```typescript
import {
  VectorStore,
  Document,
  SearchResult,
  SearchOptions,
  Embeddings
} from '@agentionai/agents/core';

class PineconeVectorStore extends VectorStore {
  readonly name = 'pinecone';

  private client: PineconeClient;
  private index: PineconeIndex;
  private embeddings: Embeddings;

  async addDocuments(docs: Document[]): Promise<string[]> {
    const texts = docs.map(d => d.content);
    const vectors = await this.embeddings.embed(texts);

    await this.index.upsert(
      docs.map((doc, i) => ({
        id: doc.id,
        values: vectors[i],
        metadata: { content: doc.content, ...doc.metadata },
      }))
    );

    return docs.map(d => d.id);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const queryVector = await this.embeddings.embedQuery(query);
    return this.searchByVector(queryVector, options);
  }

  async searchByVector(embedding: number[], options?: SearchOptions): Promise<SearchResult[]> {
    const results = await this.index.query({
      vector: embedding,
      topK: options?.limit ?? 10,
      includeMetadata: true,
    });
    return this.toSearchResults(results);
  }

  // ... implement remaining abstract methods
}
```

Custom implementations automatically get `toRetrievalTool()` and `toAddDocumentsTool()`.

## Further Reading

- [Embeddings](/guide/embeddings) - Embedding providers and configuration
- [RAG](/guide/rag) - Retrieval-augmented generation patterns
- [Chunking and Ingestion](/guide/chunking-and-ingestion) - Document processing
- [Graph Pipelines](/guide/graph-pipelines) - Workflow orchestration
- [Tools](/guide/tools) - Tool creation and usage
