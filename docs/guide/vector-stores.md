# Vector Stores

Vector stores enable semantic search capabilities for your agents. Store documents with embeddings and retrieve them based on meaning, not just keywords.

## Overview

The vector store system provides:

- **Embeddings interface** - `Embeddings` base class works with any embedding provider
- **OpenAI embeddings** - Built-in `OpenAIEmbeddings` implementation
- **VectorStore interface** - Abstract `VectorStore` base class for any vector database
- **LanceDB implementation** - Built-in support for LanceDB (embedded vector database)
- **Agent tools** - Convert any store to retrieval/storage tools with `toRetrievalTool()` and `toAddDocumentsTool()`

## Installation

LanceDB is an optional peer dependency. Install it when you need vector storage:

```bash
npm install @lancedb/lancedb apache-arrow
```

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
// Returns documents ranked by semantic similarity
```

## Embeddings

The `Embeddings` class provides a provider-agnostic interface for generating vector representations of text. Embeddings are available in a dedicated module: `@agentionai/agents/embeddings`.

All embedding providers use dynamic imports, so you only need to install the SDKs you actually use.

### OpenAI Embeddings

```typescript
import { OpenAIEmbeddings } from '@agentionai/agents/embeddings';

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',  // or 'text-embedding-3-large', 'text-embedding-ada-002'
  dimensions: 512,                   // Optional: reduce dimensions (only for text-embedding-3-*)
});

// Embed multiple texts
const vectors = await embeddings.embed(['Hello world', 'Goodbye world']);
```

**Requirements:**
- Install: `npm install openai`
- Set `OPENAI_API_KEY` environment variable or pass `apiKey` in config

#### Available OpenAI Models

| Model | Dimensions | Notes |
|-------|------------|-------|
| `text-embedding-3-small` | 1536 (configurable) | Cost-effective, fast |
| `text-embedding-3-large` | 3072 (configurable) | Highest quality |
| `text-embedding-ada-002` | 1536 (fixed) | Legacy model |

### VoyageAI Embeddings

VoyageAI provides state-of-the-art embedding models with specialized variants for different use cases.

```typescript
import { VoyageAIEmbeddings } from '@agentionai/agents/embeddings';

const embeddings = new VoyageAIEmbeddings({
  model: 'voyage-4',          // Latest general-purpose model
  inputType: 'document',      // or "query" for search queries
  maxRetries: 3,              // Optional: default is 2
  timeoutInSeconds: 30,       // Optional: default is 60
});

// Embed multiple texts
const vectors = await embeddings.embed(['Hello world', 'Goodbye world']);
```

**Requirements:**
- Install: `npm install voyageai`
- Set `VOYAGE_API_KEY` environment variable or pass `apiKey` in config

#### Available VoyageAI Models

| Model | Dimensions | Best For |
|-------|------------|----------|
| `voyage-4-large` | 1024 | High performance tasks |
| `voyage-3-large` | 1024 | High performance tasks |
| `voyage-context-3` | 1024 | Context-aware embeddings |
| `voyage-code-3` | 1024 | Code search and understanding |
| `voyage-4` | 1024 | General-purpose (recommended) |
| `voyage-3.5` | 1024 | General-purpose |
| `voyage-4-lite` | 1024 | Lightweight, fast inference |
| `voyage-3.5-lite` | 1024 | Lightweight, fast inference |
| `voyage-multimodal-3.5` | 1024 | Multimodal inputs |
| `voyage-multimodal-3` | 1024 | Multimodal inputs |

**Features:**
- Automatic retries with exponential backoff
- Configurable timeouts
- Separate optimization for documents vs queries (`inputType`)
- `embedQuery()` method automatically uses `inputType: "query"` for better search results

### Embeddings Interface

All embedding providers implement three methods:

- `embed(texts: string[]): Promise<number[][]>` - Embed multiple texts (required)
- `embedOne(text: string): Promise<number[]>` - Embed single text (default implementation provided)
- `embedQuery(query: string): Promise<number[]>` - Embed search query (default implementation provided, some providers optimize differently)

### Custom Embeddings Provider

To create a custom embedding provider, extend the `Embeddings` base class:

```typescript
import { Embeddings } from '@agentionai/agents/embeddings';

class CustomEmbeddings extends Embeddings {
  readonly name = 'custom';
  readonly model = 'my-model';
  readonly dimensions = 768;

  async embed(texts: string[]): Promise<number[][]> {
    // Implement your embedding logic
    // Return array of vectors (one per input text)
    return texts.map(text => this.generateVector(text));
  }

  // Optional: Override embedQuery for query-specific optimization
  async embedQuery(query: string): Promise<number[]> {
    // Custom query embedding logic
    return this.embedOne(query);
  }
}
```

## Creating Tools for Agents

The power of vector stores comes from integrating them with agents as tools.

### Retrieval Tool

Create a search tool that agents can use to find relevant documents:

```typescript
const searchTool = store.toRetrievalTool(
  'Search the knowledge base for product documentation and technical guides',
  {
    defaultLimit: 5,
    scoreThreshold: 0.7,  // Only return high-confidence matches
  }
);

const agent = new ClaudeAgent({
  id: 'support-agent',
  name: 'Support Agent',
  description: 'You are a helpful support agent. Use the search tool to find relevant documentation before answering questions.',
  model: 'claude-sonnet-4-5',
  tools: [searchTool],
});

const response = await agent.execute('How do I configure authentication?');
// Agent searches the knowledge base and uses results to answer
```

### Add Documents Tool

Allow agents to store new information:

```typescript
const addTool = store.toAddDocumentsTool(
  'Save important information to the knowledge base for future reference'
);

const learningAgent = new ClaudeAgent({
  id: 'learning-agent',
  name: 'Learning Agent',
  description: 'You learn from conversations. When you discover useful information, save it to the knowledge base.',
  model: 'claude-sonnet-4-5',
  tools: [searchTool, addTool],
});
```

### Tool Options

#### RetrievalToolOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `toolName` | string | `${storeName}_search` | Custom name for the tool |
| `defaultLimit` | number | 5 | Default number of results |
| `scoreThreshold` | number | - | Minimum similarity score (0-1) |
| `namespace` | string | - | Namespace to search in |
| `includeMetadata` | boolean | true | Include document metadata in results |
| `defaultFilter` | object | - | Default filters (e.g., `{ tenantId: "acme" }`) |
| `allowFilterOverride` | boolean | false | Allow agent to override filters |

#### AddDocumentsToolOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `toolName` | string | `${storeName}_add` | Custom name for the tool |
| `namespace` | string | - | Namespace to add documents to |
| `defaultMetadata` | object | - | Default metadata for all documents |

## LanceDB Configuration

### Basic Setup

```typescript
const store = await LanceDBVectorStore.create({
  name: 'my_store',           // Identifier for the store
  uri: './data/lancedb',      // Local path or cloud URI
  tableName: 'documents',     // Table name in the database
  embeddings,                 // Embeddings provider
  dimensions: 1536,           // Optional: defaults to embeddings.dimensions
});
```

### Storage Locations

LanceDB supports multiple storage backends:

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

If you generate embeddings yourself, use `addEmbeddedDocuments`:

```typescript
// Without embeddings provider
const store = await LanceDBVectorStore.create({
  name: 'store',
  uri: './data',
  tableName: 'docs',
  dimensions: 1536,  // Required when no embeddings provider
});

// Add with pre-computed embeddings
await store.addEmbeddedDocuments([
  {
    id: '1',
    content: 'Document text',
    embedding: [0.1, 0.2, ...],  // Your embedding vector
    metadata: { source: 'manual' },
  },
]);

// Search with vector
const results = await store.searchByVector([0.1, 0.2, ...], { limit: 5 });
```

## VectorStore Interface

All vector stores implement the same interface, making it easy to swap implementations:

```typescript
abstract class VectorStore {
  // Add documents (uses configured embeddings provider)
  abstract addDocuments(docs: Document[], options?: AddDocumentsOptions): Promise<string[]>;

  // Add documents with pre-computed embeddings
  abstract addEmbeddedDocuments(docs: EmbeddedDocument[], options?: AddDocumentsOptions): Promise<string[]>;

  // Semantic search by text query
  abstract search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Search by embedding vector
  abstract searchByVector(embedding: number[], options?: SearchOptions): Promise<SearchResult[]>;

  // Delete documents
  abstract delete(ids: string[], options?: DeleteOptions): Promise<number>;

  // Clear all documents
  abstract clear(options?: DeleteOptions): Promise<void>;

  // Get document by ID
  abstract getById(id: string, options?: DeleteOptions): Promise<Document | null>;

  // Create retrieval tool for agents
  toRetrievalTool(description: string, options?: RetrievalToolOptions): Tool<SearchResult[]>;

  // Create add documents tool for agents
  toAddDocumentsTool(description: string, options?: AddDocumentsToolOptions): Tool<{ added: string[]; count: number }>;
}
```

## Document Structure

```typescript
interface Document {
  id: string;                          // Unique identifier
  content: string;                     // Text content
  metadata?: Record<string, unknown>;  // Optional metadata
}

interface SearchResult {
  document: Document;
  score: number;  // Similarity score (0-1, higher is more similar)
}
```

## RAG Pipeline Example

Combine vector stores with pipelines for Retrieval-Augmented Generation:

```typescript
import {
  LanceDBVectorStore,
  OpenAIEmbeddings,
  Pipeline,
  ClaudeAgent
} from '@agentionai/agents/core';

// Setup embeddings and vector store
const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });

const docsStore = await LanceDBVectorStore.create({
  name: 'company_docs',
  uri: './data/docs',
  tableName: 'documentation',
  embeddings,
});

// Retriever agent - finds relevant documents
const retriever = new ClaudeAgent({
  id: 'retriever',
  name: 'Retriever',
  description: `You are a document retrieval specialist.
    Search for relevant documents and return them verbatim.
    Do not answer the question - just retrieve information.`,
  model: 'claude-haiku-4-5',
  tools: [docsStore.toRetrievalTool('Search company documentation')],
});

// Answerer agent - synthesizes response from retrieved docs
const answerer = new ClaudeAgent({
  id: 'answerer',
  name: 'Answerer',
  description: `You answer questions based on the provided context.
    Only use information from the context. If the context doesn't
    contain relevant information, say so.`,
  model: 'claude-sonnet-4-5',
});

// RAG pipeline
const ragPipeline = new Pipeline([retriever, answerer]);

const answer = await ragPipeline.execute(
  'What is our refund policy for enterprise customers?'
);
```

## Filtering and Multi-Tenancy

Vector stores support metadata filtering for multi-tenant applications, project isolation, and categorization.

### Direct Filtering

Filter results when searching:

```typescript
// Search with filters
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

Create tenant-specific tools with default filters:

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

// Create tenant-specific search tool
const acmeSearchTool = store.toRetrievalTool(
  'Search Acme Corp knowledge base',
  {
    defaultFilter: { tenantId: 'acme' },
    allowFilterOverride: false,  // Enforce tenant isolation
  }
);

// Agent can only access Acme documents
const acmeAgent = new ClaudeAgent({
  name: 'acme-support',
  tools: [acmeSearchTool],
});
```

### Flexible Filtering

Allow agents to filter dynamically:

```typescript
const flexibleTool = store.toRetrievalTool(
  'Search knowledge base with custom filters',
  {
    defaultFilter: { tenantId: 'acme' },  // Default tenant
    allowFilterOverride: true,             // Allow overriding
  }
);

// Agent can now use filter parameter in the tool
const agent = new ClaudeAgent({
  id: 'flexible-agent',
  name: 'Flexible Agent',
  description: `Use the search tool with appropriate filters.
    For project-specific queries, add { projectId: "xxx" } to your search.`,
  model: 'claude-sonnet-4-5',
  tools: [flexibleTool],
});
```

### Auto-Tagging Documents

Automatically add metadata when agents store documents:

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

// All documents added via this tool automatically get the metadata
const agent = new ClaudeAgent({
  name: 'document-manager',
  tools: [addTool],
});
```

### Multi-Level Filtering

Combine multiple filter dimensions:

```typescript
// Store with rich metadata
await store.addDocuments([
  {
    id: 'doc-1',
    content: 'Technical documentation...',
    metadata: {
      tenantId: 'acme',
      projectId: 'proj-123',
      category: 'technical',
      department: 'engineering',
      securityLevel: 'public',
    },
  },
]);

// Search with multiple filters
const results = await store.search('API documentation', {
  filter: {
    tenantId: 'acme',
    category: 'technical',
    securityLevel: 'public',
  },
});
```

## Performance Tips

### Indexing

For tables with more than 10,000 documents, create an index:

```typescript
await store.createIndex();
```

### Optimization

Periodically optimize the table for better performance:

```typescript
await store.optimize();
```

### Batch Operations

Add documents in batches for better performance:

```typescript
const documents = loadDocuments();  // Array of 10,000 docs
const batchSize = 1000;

for (let i = 0; i < documents.length; i += batchSize) {
  const batch = documents.slice(i, i + batchSize);
  await store.addDocuments(batch);
}
```

### Reduced Dimensions

Use smaller dimensions for faster search with minimal quality loss:

```typescript
const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  dimensions: 512,  // Reduce from 1536 to 512
});
```

## Custom Vector Store Implementation

Implement `VectorStore` for other databases:

```typescript
import {
  VectorStore,
  Document,
  SearchResult,
  SearchOptions,
  Embeddings
} from '@agentionai/agents';

class PineconeVectorStore extends VectorStore {
  readonly name = 'pinecone';

  private client: PineconeClient;
  private index: PineconeIndex;
  private embeddings: Embeddings;

  async addDocuments(docs: Document[]): Promise<string[]> {
    // Generate embeddings
    const texts = docs.map(d => d.content);
    const vectors = await this.embeddings.embed(texts);

    // Upsert to Pinecone
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

  // ... implement other abstract methods
}
```

Your custom implementation automatically gets `toRetrievalTool()` and `toAddDocumentsTool()` from the base class.
