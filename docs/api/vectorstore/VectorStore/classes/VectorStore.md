# Abstract Class: VectorStore

Abstract interface for vector database implementations.

Implementations should handle:
- Embedding generation (or accept pre-computed embeddings)
- Vector storage and indexing
- Similarity search

## Example

```typescript
class PineconeVectorStore extends VectorStore {
  async addDocuments(docs: Document[]): Promise<string[]> {
    // Generate embeddings and upsert to Pinecone
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Embed query and search Pinecone
  }
}

// Create a retrieval tool for an agent
const store = new PineconeVectorStore({ ... });
const searchTool = store.toRetrievalTool("Search product documentation");
const agent = new ClaudeAgent({ tools: [searchTool] });
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

Name identifier for this vector store instance

## Methods

### addDocuments()

> `abstract` **addDocuments**(`documents`, `options?`): `Promise`\<`string`[]\>

Add documents to the vector store.
The implementation should handle embedding generation.

#### Parameters

##### documents

[`Document`](../interfaces/Document.md)[]

Documents to add

##### options?

[`AddDocumentsOptions`](../interfaces/AddDocumentsOptions.md)

Optional configuration for the add operation

#### Returns

`Promise`\<`string`[]\>

Array of document IDs that were added

***

### addEmbeddedDocuments()

> `abstract` **addEmbeddedDocuments**(`documents`, `options?`): `Promise`\<`string`[]\>

Add documents with pre-computed embeddings.
Use this when you want to control the embedding process.

#### Parameters

##### documents

[`EmbeddedDocument`](../interfaces/EmbeddedDocument.md)[]

Documents with embeddings to add

##### options?

[`AddDocumentsOptions`](../interfaces/AddDocumentsOptions.md)

Optional configuration for the add operation

#### Returns

`Promise`\<`string`[]\>

Array of document IDs that were added

***

### clear()

> `abstract` **clear**(`options?`): `Promise`\<`void`\>

Delete all documents, optionally within a namespace.

#### Parameters

##### options?

[`DeleteOptions`](../interfaces/DeleteOptions.md)

Optional configuration including namespace

#### Returns

`Promise`\<`void`\>

***

### delete()

> `abstract` **delete**(`ids`, `options?`): `Promise`\<`number`\>

Delete documents by their IDs.

#### Parameters

##### ids

`string`[]

Array of document IDs to delete

##### options?

[`DeleteOptions`](../interfaces/DeleteOptions.md)

Optional configuration for the delete operation

#### Returns

`Promise`\<`number`\>

Number of documents deleted

***

### getByHashes()

> `abstract` **getByHashes**(`hashes`, `options?`): `Promise`\<`Map`\<`string`, `string`\>\>

Get existing documents by their content hashes.
Used for deduplication during ingestion.

#### Parameters

##### hashes

`string`[]

Array of content hashes to check

##### options?

[`DeleteOptions`](../interfaces/DeleteOptions.md)

Optional configuration including namespace

#### Returns

`Promise`\<`Map`\<`string`, `string`\>\>

Map of hash to document ID

***

### getById()

> `abstract` **getById**(`id`, `options?`): `Promise`\<[`Document`](../interfaces/Document.md) \| `null`\>

Get a document by its ID.

#### Parameters

##### id

`string`

The document ID

##### options?

[`DeleteOptions`](../interfaces/DeleteOptions.md)

Optional configuration including namespace

#### Returns

`Promise`\<[`Document`](../interfaces/Document.md) \| `null`\>

The document if found, null otherwise

***

### search()

> `abstract` **search**(`query`, `options?`): `Promise`\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Search for documents similar to the query.
The implementation should handle query embedding.

#### Parameters

##### query

`string`

The search query text

##### options?

[`SearchOptions`](../interfaces/SearchOptions.md)

Search configuration options

#### Returns

`Promise`\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Array of search results with documents and scores

***

### searchByVector()

> `abstract` **searchByVector**(`embedding`, `options?`): `Promise`\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Search using a pre-computed embedding vector.

#### Parameters

##### embedding

`number`[]

The query embedding vector

##### options?

[`SearchOptions`](../interfaces/SearchOptions.md)

Search configuration options

#### Returns

`Promise`\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Array of search results with documents and scores

***

### toAddDocumentsTool()

> **toAddDocumentsTool**(`description`, `options`): [`Tool`](../../../tools/Tool/classes/Tool.md)\<\{ `added`: `string`[]; `count`: `number`; \}\>

Create a tool that agents can use to add documents to this vector store.

#### Parameters

##### description

`string`

Description of what the tool does (e.g., "Store new knowledge articles in the database")

##### options

[`AddDocumentsToolOptions`](../interfaces/AddDocumentsToolOptions.md) = `{}`

Configuration options for the tool

#### Returns

[`Tool`](../../../tools/Tool/classes/Tool.md)\<\{ `added`: `string`[]; `count`: `number`; \}\>

A Tool instance that can be added to an agent

#### Example

```typescript
const store = new LanceDBVectorStore({ ... });
const tool = store.toAddDocumentsTool(
  "Save new information to the knowledge base for future reference"
);
agent.addTools([tool]);
```

***

### toGetChunkByIdTool()

> **toGetChunkByIdTool**(`description`, `options`): [`Tool`](../../../tools/Tool/classes/Tool.md)\<[`Document`](../interfaces/Document.md) \| `null`\>

Create a tool that agents can use to retrieve a chunk by its ID.
Useful for navigating chunk chains using prev_id/next_id metadata.

#### Parameters

##### description

`string`

Description of what the tool does (e.g., "Get a specific chunk by ID to read adjacent context")

##### options

[`GetChunkByIdToolOptions`](../interfaces/GetChunkByIdToolOptions.md) = `{}`

Configuration options for the tool

#### Returns

[`Tool`](../../../tools/Tool/classes/Tool.md)\<[`Document`](../interfaces/Document.md) \| `null`\>

A Tool instance that can be added to an agent

#### Example

```typescript
const store = new LanceDBVectorStore({ ... });
const tool = store.toGetChunkByIdTool(
  "Retrieve a specific chunk by ID. Use prev_id or next_id from search results to get surrounding context."
);
agent.addTools([tool]);
```

***

### toRetrievalTool()

> **toRetrievalTool**(`description`, `options`): [`Tool`](../../../tools/Tool/classes/Tool.md)\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

Create a retrieval tool that agents can use to search this vector store.

#### Parameters

##### description

`string`

Description of what data the store contains (e.g., "Search product documentation for technical specifications")

##### options

[`RetrievalToolOptions`](../interfaces/RetrievalToolOptions.md) = `{}`

Configuration options for the tool

#### Returns

[`Tool`](../../../tools/Tool/classes/Tool.md)\<[`SearchResult`](../interfaces/SearchResult.md)[]\>

A Tool instance that can be added to an agent

#### Example

```typescript
const store = new LanceDBVectorStore({ ... });
const tool = store.toRetrievalTool(
  "Search company knowledge base for HR policies and procedures",
  { defaultLimit: 5 }
);
agent.addTools([tool]);
```
