# Vector Stores

Vector stores enable semantic search by storing documents with embeddings and retrieving them based on meaning rather than keywords.

## Overview

The vector store system provides:

- **VectorStore interface** - Abstract base class for any vector database
- **LanceDB implementation** - Built-in embedded vector database
- **Agent tools** - Convert stores to retrieval/storage tools with `toRetrievalTool()` and `toAddDocumentsTool()`
- **Embeddings integration** - Automatic embedding generation using any provider

## Installation

LanceDB is an optional peer dependency:

```bash
npm install @lancedb/lancedb apache-arrow
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
