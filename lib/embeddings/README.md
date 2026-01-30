# Embeddings

This module provides embedding providers for generating vector representations of text. Embeddings are used by vector stores for semantic search and similarity matching.

## Available Providers

### OpenAI Embeddings

OpenAI's embedding models are highly performant and support configurable dimensions.

```typescript
import { OpenAIEmbeddings } from "@agentionai/agents/embeddings";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small", // or "text-embedding-3-large", "text-embedding-ada-002"
  dimensions: 512, // Optional: reduce dimensions for faster search (3-* models only)
});

const vectors = await embeddings.embed(["Hello world", "Goodbye world"]);
```

**Available Models:**
- `text-embedding-3-small` - 1536 dimensions (configurable), cost-effective
- `text-embedding-3-large` - 3072 dimensions (configurable), highest quality
- `text-embedding-ada-002` - 1536 dimensions (fixed), legacy model

**Requirements:**
- Install: `npm install openai`
- Set `OPENAI_API_KEY` environment variable

### VoyageAI Embeddings

VoyageAI provides state-of-the-art embedding models with specialized variants for different use cases.

```typescript
import { VoyageAIEmbeddings } from "@agentionai/agents/embeddings";

const embeddings = new VoyageAIEmbeddings({
  model: "voyage-4", // Latest general-purpose model
  inputType: "document", // or "query" for search queries
  maxRetries: 3,
  timeoutInSeconds: 30,
});

const vectors = await embeddings.embed(["Hello world", "Goodbye world"]);
```

**Available Models:**

| Model | Dimensions | Best For |
|-------|-----------|----------|
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

**Requirements:**
- Install: `npm install voyageai`
- Set `VOYAGE_API_KEY` environment variable

## Usage with Vector Stores

All embedding providers implement the `Embeddings` interface and work seamlessly with vector stores:

```typescript
import { LanceDBVectorStore } from "@agentionai/agents";
import { VoyageAIEmbeddings } from "@agentionai/agents/embeddings";

const embeddings = new VoyageAIEmbeddings({
  model: "voyage-code-3", // Use code-specific model
});

const store = await LanceDBVectorStore.create({
  name: "code_search",
  uri: "./data",
  tableName: "code_snippets",
  embeddings,
});

// Embeddings are generated automatically when adding documents
await store.addDocuments([
  { id: "1", content: "function hello() { console.log('Hello'); }" },
]);
```

## Creating Custom Embeddings

To create a custom embedding provider, extend the `Embeddings` base class:

```typescript
import { Embeddings } from "@agentionai/agents/embeddings";

class CustomEmbeddings extends Embeddings {
  readonly name = "custom";
  readonly model = "my-model";
  readonly dimensions = 768;

  async embed(texts: string[]): Promise<number[][]> {
    // Implement your embedding logic
    // Return array of vectors (one per input text)
    return texts.map(text => this.generateVector(text));
  }
}
```

## Optional Dependencies

All embedding providers use dynamic imports, so you only need to install the SDKs you actually use:

```bash
# For OpenAI embeddings
npm install openai

# For VoyageAI embeddings
npm install voyageai
```

The library will only load the SDK when you instantiate the corresponding embeddings class.

## Examples

See the `examples/` directory for complete examples:
- `examples/vector-store.ts` - OpenAI embeddings with vector store
- `examples/voyage-embeddings.ts` - VoyageAI embeddings example
- `examples/ingestion-pipeline.ts` - Using embeddings in ingestion pipelines
