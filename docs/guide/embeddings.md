# Embeddings

Embeddings are vector representations of text that capture semantic meaning. They enable similarity search, clustering, and other vector operations that power RAG systems.

## Overview

The `Embeddings` class provides a provider-agnostic interface for generating embeddings. Agention supports multiple embedding providers through a unified API.

**Installation:**
```bash
npm install @agentionai/agents
```

Embeddings are available in the dedicated module:
```typescript
import { OpenAIEmbeddings, VoyageAIEmbeddings } from '@agentionai/agents/embeddings';
```

All providers use dynamic imports, so you only install the SDKs you actually use.

## Quick Start

```typescript
import { OpenAIEmbeddings } from '@agentionai/agents/embeddings';

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
});

// Embed a single text
const vector = await embeddings.embedOne('Hello world');
console.log(vector.length);  // 1536

// Embed multiple texts
const vectors = await embeddings.embed([
  'Hello world',
  'Goodbye world',
]);
console.log(vectors.length);  // 2
```

## Embeddings Interface

All embedding providers implement three methods:

```typescript
abstract class Embeddings {
  // Embed multiple texts (required - implement this)
  abstract embed(texts: string[]): Promise<number[][]>;

  // Embed single text (default implementation calls embed())
  embedOne(text: string): Promise<number[]>;

  // Embed search query (default implementation calls embedOne())
  embedQuery(query: string): Promise<number[]>;
}
```

**Methods:**
- `embed(texts)` - Batch embedding, most efficient for multiple texts
- `embedOne(text)` - Convenience method for single text
- `embedQuery(query)` - Specialized for queries (some providers optimize differently)

## OpenAI Embeddings

OpenAI provides cost-effective, high-quality embeddings with flexible dimensionality.

```typescript
import { OpenAIEmbeddings } from '@agentionai/agents/embeddings';

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',  // or 'text-embedding-3-large', 'text-embedding-ada-002'
  dimensions: 512,                   // Optional: reduce dimensions (only for text-embedding-3-*)
  apiKey: process.env.OPENAI_API_KEY, // Optional: defaults to env var
});

const vectors = await embeddings.embed(['Hello', 'Goodbye']);
```

**Requirements:**
- Install: `npm install openai`
- Set `OPENAI_API_KEY` environment variable or pass `apiKey` in config

### Available Models

| Model | Default Dimensions | Configurable | Notes |
|-------|-------------------|--------------|-------|
| `text-embedding-3-small` | 1536 | Yes | Cost-effective, fast, recommended for most use cases |
| `text-embedding-3-large` | 3072 | Yes | Highest quality, better for complex tasks |
| `text-embedding-ada-002` | 1536 | No | Legacy model, still supported |

### Dimension Reduction

Reduce dimensions for faster search with minimal quality loss:

```typescript
const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  dimensions: 512,  // Reduce from 1536 to 512
});
```

This can reduce storage and search time by ~66% with only minor quality degradation.

## VoyageAI Embeddings

VoyageAI provides state-of-the-art embeddings with specialized models for different use cases.

```typescript
import { VoyageAIEmbeddings } from '@agentionai/agents/embeddings';

const embeddings = new VoyageAIEmbeddings({
  model: 'voyage-4',              // Latest general-purpose model
  inputType: 'document',          // or 'query' for search queries
  maxRetries: 3,                  // Optional: default is 2
  timeoutInSeconds: 30,           // Optional: default is 60
  apiKey: process.env.VOYAGE_API_KEY, // Optional: defaults to env var
});

const vectors = await embeddings.embed(['Hello', 'Goodbye']);
```

**Requirements:**
- Install: `npm install voyageai`
- Set `VOYAGE_API_KEY` environment variable or pass `apiKey` in config

### Available Models

| Model | Dimensions | Best For |
|-------|------------|----------|
| `voyage-4` | 1024 | General-purpose (recommended) |
| `voyage-4-large` | 1024 | High-performance tasks |
| `voyage-4-lite` | 1024 | Lightweight, fast inference |
| `voyage-3.5` | 1024 | General-purpose |
| `voyage-3.5-lite` | 1024 | Lightweight, fast |
| `voyage-3-large` | 1024 | High-performance tasks |
| `voyage-context-3` | 1024 | Context-aware embeddings |
| `voyage-code-3` | 1024 | Code search and understanding |
| `voyage-multimodal-3.5` | 1024 | Multimodal inputs |
| `voyage-multimodal-3` | 1024 | Multimodal inputs |

### Document vs Query Optimization

VoyageAI optimizes embeddings differently based on input type:

```typescript
// For indexing documents
const docEmbeddings = new VoyageAIEmbeddings({
  model: 'voyage-4',
  inputType: 'document',
});

const docVectors = await docEmbeddings.embed(documents);

// For search queries (automatically uses 'query' inputType)
const queryVector = await docEmbeddings.embedQuery('What is RAG?');
```

### Automatic Retries

VoyageAI includes built-in retry logic with exponential backoff:

```typescript
const embeddings = new VoyageAIEmbeddings({
  model: 'voyage-4',
  maxRetries: 5,           // Retry up to 5 times
  timeoutInSeconds: 60,    // 60 second timeout per request
});
```

## Custom Embedding Provider

Create your own embedding provider by extending the `Embeddings` base class:

```typescript
import { Embeddings } from '@agentionai/agents/embeddings';

class CustomEmbeddings extends Embeddings {
  readonly name = 'custom';
  readonly model = 'my-model';
  readonly dimensions = 768;

  async embed(texts: string[]): Promise<number[][]> {
    // Call your embedding API
    const response = await fetch('https://api.example.com/embed', {
      method: 'POST',
      body: JSON.stringify({ texts }),
    });
    
    const data = await response.json();
    return data.embeddings;
  }

  // Optional: Override embedQuery for query-specific optimization
  async embedQuery(query: string): Promise<number[]> {
    const vectors = await this.embed([query]);
    return vectors[0];
  }
}
```

**Required properties:**
- `name` - Provider identifier
- `model` - Model identifier
- `dimensions` - Vector dimensionality

**Required methods:**
- `embed(texts)` - Implement batch embedding logic

## Usage with Vector Stores

Embeddings integrate seamlessly with vector stores:

```typescript
import { LanceDBVectorStore } from '@agentionai/agents/core';
import { OpenAIEmbeddings } from '@agentionai/agents/embeddings';

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
});

const store = await LanceDBVectorStore.create({
  name: 'knowledge_base',
  uri: './data/vectors',
  tableName: 'documents',
  embeddings,  // Vector store uses this for automatic embedding
});

// Add documents - embeddings generated automatically
await store.addDocuments([
  { id: '1', content: 'Hello world' },
  { id: '2', content: 'Goodbye world' },
]);

// Search - query embedding generated automatically
const results = await store.search('greetings');
```

See [Vector Stores](/guide/vector-stores) for more details.

## Usage with Ingestion Pipelines

Embeddings work with chunking and ingestion pipelines:

```typescript
import { IngestionPipeline, RecursiveChunker } from '@agentionai/agents/core';
import { OpenAIEmbeddings } from '@agentionai/agents/embeddings';

const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
});

const chunker = new RecursiveChunker({
  chunkSize: 1000,
  chunkOverlap: 100,
});

const pipeline = new IngestionPipeline(chunker, embeddings, vectorStore);

await pipeline.ingest(documentText, {
  sourceId: 'doc-123',
  batchSize: 50,
});
```

See [Chunking and Ingestion](/guide/chunking-and-ingestion) for more details.

## Pre-computed Embeddings

If you generate embeddings outside of Agention, you can store them directly:

```typescript
// Generate embeddings yourself
const myVectors = await externalEmbeddingService.embed(texts);

// Store without an embeddings provider
const store = await LanceDBVectorStore.create({
  name: 'store',
  uri: './data',
  tableName: 'docs',
  dimensions: 1536,  // Required when no embeddings provider
});

await store.addEmbeddedDocuments([
  {
    id: '1',
    content: 'Hello world',
    embedding: myVectors[0],
  },
]);

// Search with pre-computed query vector
const queryVector = await externalEmbeddingService.embed('greetings');
const results = await store.searchByVector(queryVector);
```

## Cost Optimization

### Batch Processing

Always embed multiple texts together when possible:

```typescript
// Inefficient - multiple API calls
for (const text of texts) {
  const vector = await embeddings.embedOne(text);
}

// Efficient - single API call
const vectors = await embeddings.embed(texts);
```

### Choose the Right Model

Balance cost and quality:

| Provider | Model | Cost | Quality | Speed |
|----------|-------|------|---------|-------|
| OpenAI | text-embedding-3-small | $ | High | Fast |
| OpenAI | text-embedding-3-large | $$$ | Highest | Medium |
| VoyageAI | voyage-4-lite | $ | High | Very Fast |
| VoyageAI | voyage-4 | $$ | Higher | Fast |
| VoyageAI | voyage-4-large | $$$ | Highest | Medium |

### Reduce Dimensions

For OpenAI `text-embedding-3-*` models:

```typescript
const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  dimensions: 512,  // 66% reduction in storage/compute
});
```

## Error Handling

Handle embedding failures gracefully:

```typescript
try {
  const vectors = await embeddings.embed(texts);
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Wait and retry
    await sleep(1000);
    return embeddings.embed(texts);
  } else if (error.message.includes('invalid API key')) {
    // Handle auth error
    console.error('Invalid API key');
  } else {
    // Handle other errors
    throw error;
  }
}
```

VoyageAI includes automatic retry logic for rate limits.

## Best Practices

1. **Use batch embedding** - Always prefer `embed()` over `embedOne()` for multiple texts
2. **Choose appropriate dimensions** - Balance quality vs storage/speed
3. **Cache embeddings** - Avoid re-embedding the same content
4. **Monitor costs** - Track API usage, especially for large-scale applications
5. **Test different models** - Quality varies by domain and use case
6. **Handle errors** - Implement retry logic for rate limits
7. **Use query optimization** - Use `embedQuery()` for search queries when available

## Comparison

| Feature | OpenAI | VoyageAI |
|---------|--------|----------|
| **Models** | 3 models | 10+ models |
| **Dimension reduction** | Yes (3-small, 3-large) | No |
| **Query optimization** | No | Yes (inputType) |
| **Automatic retries** | No | Yes |
| **Special domains** | General | Code, multimodal, context |
| **Max batch size** | 2048 | 128 |

## Further Reading

- [Vector Stores](/guide/vector-stores) - Store and search embeddings
- [Chunking and Ingestion](/guide/chunking-and-ingestion) - Process documents
- [RAG](/guide/rag) - Build retrieval-augmented generation systems
