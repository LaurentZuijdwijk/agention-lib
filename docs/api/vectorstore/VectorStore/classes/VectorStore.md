# Abstract Class: VectorStore

Defined in: [lib/vectorstore/VectorStore.ts:140](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L140)

Abstract base class for vector database implementations. Provides a unified interface for embedding storage, similarity search, and agent tool generation.

## Example

```typescript
import { LanceDBVectorStore } from '@agentionai/agents/core';
import { OpenAIEmbeddings } from '@agentionai/agents/embeddings';
import { ClaudeAgent } from '@agentionai/agents/claude';

// Create store with embeddings provider
const store = await LanceDBVectorStore.create({
  name: 'knowledge_base',
  uri: './data/vectors',
  tableName: 'documents',
  embeddings: new OpenAIEmbeddings({ model: 'text-embedding-3-small' }),
});

// Add documents (embeddings generated automatically)
await store.addDocuments([
  { id: '1', content: 'Vector databases enable semantic search.' },
]);

// Create retrieval tool for agent
const searchTool = store.toRetrievalTool('Search documentation');
const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-5',
  tools: [searchTool],
});
```

## Extended by

- [`LanceDBVectorStore`](../../LanceDBVectorStore/classes/LanceDBVectorStore.md)

## Constructors

### Constructor

> **new VectorStore**(): `VectorStore`

#### Returns

`VectorStore`

## Properties

### name

> `abstract` `readonly` **name**: `string`

Defined in: [lib/vectorstore/VectorStore.ts:142](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L142)

Name identifier for this vector store instance.

## Methods

### addDocuments()

> `abstract` **addDocuments**(`documents`, `options?`): `Promise`\<`string`[]\>

Defined in: [lib/vectorstore/VectorStore.ts:152](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L152)

Add documents to the store. Embeddings are generated automatically using the configured embeddings provider.

#### Parameters

##### documents

[`Document`](../interfaces/Document.md)[]

Documents to add

##### options?

[`AddDocumentsOptions`](../interfaces/AddDocumentsOptions.md)

Optional configuration

#### Returns

`Promise`\<`string`[]\>

Array of document IDs

#### Example

```typescript
await store.addDocuments([
  { id: '1', content: 'Hello world', metadata: { source: 'example' } },
  { id: '2', content: 'Goodbye world' },
]);
```

***

### addEmbeddedDocuments()

> `abstract` **addEmbeddedDocuments**(`documents`, `options?`): `Promise`\<`string`[]\>

Defined in: [lib/vectorstore/VectorStore.ts:165](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L165)

Add documents with pre-computed embeddings. Use when you generate embeddings externally.

#### Parameters

##### documents

[`EmbeddedDocument`](../interfaces/EmbeddedDocument.md)[]

Documents with embeddings

##### options?

[`AddDocumentsOptions`](../interfaces/AddDocumentsOptions.md)

Optional configuration

#### Returns

`Promise`\<`string`[]\>

Array of document IDs

#### Example

```typescript
await store.addEmbeddedDocuments([
  {
    id: '1',
    content: 'Hello world',
    embedding: [0.1, 0.2, 0.3, ...],
    metadata: { source: 'external' },
  },
]);
```

***

### search()

> `abstract` **search**(`query`, `options?`): `Promise`\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Defined in: [lib/vectorstore/VectorStore.ts:178](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L178)

Search for similar documents using a text query. Query is embedded automatically.

#### Parameters

##### query

`string`

Text query

##### options?

[`SearchOptions`](../interfaces/SearchOptions.md)

Search configuration

#### Returns

`Promise`\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Results ranked by similarity

#### Example

```typescript
const results = await store.search('What is RAG?', {
  limit: 5,
  filter: { category: 'documentation' },
});

results.forEach(r => {
  console.log(`Score: ${r.score}, Content: ${r.document.content}`);
});
```

***

### searchByVector()

> `abstract` **searchByVector**(`embedding`, `options?`): `Promise`\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Defined in: [lib/vectorstore/VectorStore.ts:190](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L190)

Search using a pre-computed embedding vector.

#### Parameters

##### embedding

`number`[]

Query embedding vector

##### options?

[`SearchOptions`](../interfaces/SearchOptions.md)

Search configuration

#### Returns

`Promise`\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Results ranked by similarity

#### Example

```typescript
const queryVector = await embeddings.embedQuery('What is RAG?');
const results = await store.searchByVector(queryVector, { limit: 5 });
```

***

### delete()

> `abstract` **delete**(`ids`, `options?`): `Promise`\<`number`\>

Defined in: [lib/vectorstore/VectorStore.ts:202](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L202)

Delete documents by ID.

#### Parameters

##### ids

`string`[]

Document IDs to delete

##### options?

[`DeleteOptions`](../interfaces/DeleteOptions.md)

Optional configuration

#### Returns

`Promise`\<`number`\>

Number of documents deleted

#### Example

```typescript
const deleted = await store.delete(['doc-1', 'doc-2']);
console.log(`Deleted ${deleted} documents`);
```

***

### clear()

> `abstract` **clear**(`options?`): `Promise`\<`void`\>

Defined in: [lib/vectorstore/VectorStore.ts:209](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L209)

Delete all documents, optionally within a namespace.

#### Parameters

##### options?

[`DeleteOptions`](../interfaces/DeleteOptions.md)

Optional configuration (e.g., namespace)

#### Returns

`Promise`\<`void`\>

#### Example

```typescript
// Clear all documents
await store.clear();

// Clear documents in namespace
await store.clear({ namespace: 'tenant-123' });
```

***

### getById()

> `abstract` **getById**(`id`, `options?`): `Promise`\<[`Document`](../interfaces/Document.md) \| `null`\>

Defined in: [lib/vectorstore/VectorStore.ts:218](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L218)

Retrieve a document by ID.

#### Parameters

##### id

`string`

Document ID

##### options?

[`DeleteOptions`](../interfaces/DeleteOptions.md)

Optional configuration

#### Returns

`Promise`\<[`Document`](../interfaces/Document.md) \| `null`\>

Document if found, null otherwise

#### Example

```typescript
const doc = await store.getById('doc-123');
if (doc) {
  console.log(doc.content);
}
```

***

### getByHashes()

> `abstract` **getByHashes**(`hashes`, `options?`): `Promise`\<`Map`\<`string`, `string`\>\>

Defined in: [lib/vectorstore/VectorStore.ts:231](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L231)

Get existing documents by content hashes. Used for deduplication during ingestion.

#### Parameters

##### hashes

`string`[]

Content hashes to check

##### options?

[`DeleteOptions`](../interfaces/DeleteOptions.md)

Optional configuration

#### Returns

`Promise`\<`Map`\<`string`, `string`\>\>

Map of hash to document ID

***

### toRetrievalTool()

> **toRetrievalTool**(`description`, `options`): [`Tool`](../../../tools/Tool/classes/Tool.md)\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Defined in: [lib/vectorstore/VectorStore.ts:253](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L253)

Create a search tool that agents can use to retrieve documents.

#### Parameters

##### description

`string`

Description of what the store contains (shown to the agent)

##### options

[`RetrievalToolOptions`](../interfaces/RetrievalToolOptions.md) = `{}`

Configuration options

#### Returns

[`Tool`](../../../tools/Tool/classes/Tool.md)\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Tool instance for the agent

#### Example

```typescript
const tool = store.toRetrievalTool(
  'Search company knowledge base for policies and procedures',
  {
    defaultLimit: 5,
    scoreThreshold: 0.7,
    defaultFilter: { tenantId: 'acme' },
  }
);

const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-5',
  tools: [tool],
});
```

***

### toAddDocumentsTool()

> **toAddDocumentsTool**(`description`, `options`): [`Tool`](../../../tools/Tool/classes/Tool.md)\<\{ `added`: `string`[]; `count`: `number`; \}\>

Defined in: [lib/vectorstore/VectorStore.ts:338](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L338)

Create a tool that allows agents to add documents to the store.

#### Parameters

##### description

`string`

Description of what the tool does (shown to the agent)

##### options

[`AddDocumentsToolOptions`](../interfaces/AddDocumentsToolOptions.md) = `{}`

Configuration options

#### Returns

[`Tool`](../../../tools/Tool/classes/Tool.md)\<\{ `added`: `string`[]; `count`: `number`; \}\>

Tool instance for the agent

#### Example

```typescript
const tool = store.toAddDocumentsTool(
  'Save information to the knowledge base for future reference',
  {
    defaultMetadata: {
      tenantId: 'acme',
      addedBy: 'agent',
    },
  }
);

const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-5',
  tools: [tool],
});
```

***

### toGetChunkByIdTool()

> **toGetChunkByIdTool**(`description`, `options`): [`Tool`](../../../tools/Tool/classes/Tool.md)\<[`Document`](../interfaces/Document.md) \| `null`\>

Defined in: [lib/vectorstore/VectorStore.ts:413](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L413)

Create a tool for retrieving chunks by ID. Useful for navigating chunk chains via previousChunkId/nextChunkId metadata.

#### Parameters

##### description

`string`

Description of what the tool does (shown to the agent)

##### options

[`GetChunkByIdToolOptions`](../interfaces/GetChunkByIdToolOptions.md) = `{}`

Configuration options

#### Returns

[`Tool`](../../../tools/Tool/classes/Tool.md)\<[`Document`](../interfaces/Document.md) \| `null`\>

Tool instance for the agent

#### Example

```typescript
const tool = store.toGetChunkByIdTool(
  'Get a chunk by ID. Use previousChunkId or nextChunkId from search results to get surrounding context.'
);

const agent = new ClaudeAgent({
  model: 'claude-sonnet-4-5',
  tools: [searchTool, tool],
});
```

---

## See Also

- [Vector Stores Guide](/guide/vector-stores) - Usage patterns and examples
- [Embeddings Guide](/guide/embeddings) - Embedding providers
- [RAG Guide](/guide/rag) - Retrieval-augmented generation patterns
- [LanceDBVectorStore](../../LanceDBVectorStore/classes/LanceDBVectorStore.md) - Built-in implementation
