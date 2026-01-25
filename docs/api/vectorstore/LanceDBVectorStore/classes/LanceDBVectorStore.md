# Class: LanceDBVectorStore

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:84](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L84)

LanceDB implementation of the VectorStore interface.

## Example

```typescript
import { LanceDBVectorStore, OpenAIEmbeddings } from "@agentionai/agents";

// Create with OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
});

const store = await LanceDBVectorStore.create({
  name: "knowledge_base",
  uri: "./my-database",
  tableName: "documents",
  embeddings,
});

// Add documents (embeddings generated automatically)
await store.addDocuments([
  { id: "1", content: "LanceDB is a vector database" },
  { id: "2", content: "Vector search enables semantic queries" },
]);

// Search
const results = await store.search("What is LanceDB?", { limit: 5 });

// Create a tool for agents
const searchTool = store.toRetrievalTool("Search the knowledge base");
```

## Extends

- [`VectorStore`](../../VectorStore/classes/VectorStore.md)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:85](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L85)

Name identifier for this vector store instance

#### Overrides

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`name`](../../VectorStore/classes/VectorStore.md#name)

## Methods

### addDocuments()

> **addDocuments**(`documents`, `_options?`): `Promise`\<`string`[]\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:180](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L180)

Add documents to the vector store.
If an embeddings provider is configured, embeddings are generated automatically.

#### Parameters

##### documents

[`Document`](../../VectorStore/interfaces/Document.md)[]

##### \_options?

[`AddDocumentsOptions`](../../VectorStore/interfaces/AddDocumentsOptions.md)

#### Returns

`Promise`\<`string`[]\>

#### Overrides

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`addDocuments`](../../VectorStore/classes/VectorStore.md#adddocuments)

***

### addEmbeddedDocuments()

> **addEmbeddedDocuments**(`documents`, `_options?`): `Promise`\<`string`[]\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:206](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L206)

Add documents with pre-computed embeddings.

#### Parameters

##### documents

[`EmbeddedDocument`](../../VectorStore/interfaces/EmbeddedDocument.md)[]

##### \_options?

[`AddDocumentsOptions`](../../VectorStore/interfaces/AddDocumentsOptions.md)

#### Returns

`Promise`\<`string`[]\>

#### Overrides

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`addEmbeddedDocuments`](../../VectorStore/classes/VectorStore.md#addembeddeddocuments)

***

### clear()

> **clear**(`_options?`): `Promise`\<`void`\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:279](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L279)

Delete all documents.

#### Parameters

##### \_options?

[`DeleteOptions`](../../VectorStore/interfaces/DeleteOptions.md)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`clear`](../../VectorStore/classes/VectorStore.md#clear)

***

### createIndex()

> **createIndex**(): `Promise`\<`void`\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:374](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L374)

Create an index on the vector column for faster searches.
Recommended for tables with more than 10,000 rows.

#### Returns

`Promise`\<`void`\>

***

### delete()

> **delete**(`ids`, `_options?`): `Promise`\<`number`\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:265](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L265)

Delete documents by their IDs.

#### Parameters

##### ids

`string`[]

##### \_options?

[`DeleteOptions`](../../VectorStore/interfaces/DeleteOptions.md)

#### Returns

`Promise`\<`number`\>

#### Overrides

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`delete`](../../VectorStore/classes/VectorStore.md#delete)

***

### getByHashes()

> **getByHashes**(`hashes`, `_options?`): `Promise`\<`Map`\<`string`, `string`\>\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:312](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L312)

Get existing documents by their content hashes.
Used for deduplication during ingestion.

#### Parameters

##### hashes

`string`[]

##### \_options?

[`DeleteOptions`](../../VectorStore/interfaces/DeleteOptions.md)

#### Returns

`Promise`\<`Map`\<`string`, `string`\>\>

#### Overrides

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`getByHashes`](../../VectorStore/classes/VectorStore.md#getbyhashes)

***

### getById()

> **getById**(`id`, `_options?`): `Promise`\<[`Document`](../../VectorStore/interfaces/Document.md) \| `null`\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:286](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L286)

Get a document by its ID.

#### Parameters

##### id

`string`

##### \_options?

[`DeleteOptions`](../../VectorStore/interfaces/DeleteOptions.md)

#### Returns

`Promise`\<[`Document`](../../VectorStore/interfaces/Document.md) \| `null`\>

#### Overrides

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`getById`](../../VectorStore/classes/VectorStore.md#getbyid)

***

### getConnection()

> **getConnection**(): `Connection`

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:345](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L345)

Get the underlying LanceDB connection.

#### Returns

`Connection`

***

### getDimensions()

> **getDimensions**(): `number`

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:366](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L366)

Get the vector dimensions.

#### Returns

`number`

***

### getEmbeddings()

> **getEmbeddings**(): [`Embeddings`](../../Embeddings/classes/Embeddings.md) \| `undefined`

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:359](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L359)

Get the configured embeddings provider.

#### Returns

[`Embeddings`](../../Embeddings/classes/Embeddings.md) \| `undefined`

***

### getTable()

> **getTable**(): `Table`

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:352](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L352)

Get the underlying LanceDB table.

#### Returns

`Table`

***

### optimize()

> **optimize**(): `Promise`\<`void`\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:381](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L381)

Optimize the table for better performance.

#### Returns

`Promise`\<`void`\>

***

### search()

> **search**(`query`, `options?`): `Promise`\<[`SearchResult`](../../VectorStore/interfaces/SearchResult.md)[]\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:224](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L224)

Search for documents similar to the query.

#### Parameters

##### query

`string`

##### options?

[`SearchOptions`](../../VectorStore/interfaces/SearchOptions.md)

#### Returns

`Promise`\<[`SearchResult`](../../VectorStore/interfaces/SearchResult.md)[]\>

#### Overrides

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`search`](../../VectorStore/classes/VectorStore.md#search)

***

### searchByVector()

> **searchByVector**(`embedding`, `options?`): `Promise`\<[`SearchResult`](../../VectorStore/interfaces/SearchResult.md)[]\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:241](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L241)

Search using a pre-computed embedding vector.

#### Parameters

##### embedding

`number`[]

##### options?

[`SearchOptions`](../../VectorStore/interfaces/SearchOptions.md)

#### Returns

`Promise`\<[`SearchResult`](../../VectorStore/interfaces/SearchResult.md)[]\>

#### Overrides

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`searchByVector`](../../VectorStore/classes/VectorStore.md#searchbyvector)

***

### toAddDocumentsTool()

> **toAddDocumentsTool**(`description`, `options`): [`Tool`](../../../tools/Tool/classes/Tool.md)\<\{ `added`: `string`[]; `count`: `number`; \}\>

Defined in: [lib/vectorstore/VectorStore.ts:338](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L338)

Create a tool that agents can use to add documents to this vector store.

#### Parameters

##### description

`string`

Description of what the tool does (e.g., "Store new knowledge articles in the database")

##### options

[`AddDocumentsToolOptions`](../../VectorStore/interfaces/AddDocumentsToolOptions.md) = `{}`

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

#### Inherited from

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`toAddDocumentsTool`](../../VectorStore/classes/VectorStore.md#toadddocumentstool)

***

### toGetChunkByIdTool()

> **toGetChunkByIdTool**(`description`, `options`): [`Tool`](../../../tools/Tool/classes/Tool.md)\<[`Document`](../../VectorStore/interfaces/Document.md) \| `null`\>

Defined in: [lib/vectorstore/VectorStore.ts:413](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L413)

Create a tool that agents can use to retrieve a chunk by its ID.
Useful for navigating chunk chains using previousChunkId/nextChunkId metadata.

#### Parameters

##### description

`string`

Description of what the tool does (e.g., "Get a specific chunk by ID to read adjacent context")

##### options

[`GetChunkByIdToolOptions`](../../VectorStore/interfaces/GetChunkByIdToolOptions.md) = `{}`

Configuration options for the tool

#### Returns

[`Tool`](../../../tools/Tool/classes/Tool.md)\<[`Document`](../../VectorStore/interfaces/Document.md) \| `null`\>

A Tool instance that can be added to an agent

#### Example

```typescript
const store = new LanceDBVectorStore({ ... });
const tool = store.toGetChunkByIdTool(
  "Retrieve a specific chunk by ID. Use previousChunkId or nextChunkId from search results to get surrounding context."
);
agent.addTools([tool]);
```

#### Inherited from

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`toGetChunkByIdTool`](../../VectorStore/classes/VectorStore.md#togetchunkbyidtool)

***

### toRetrievalTool()

> **toRetrievalTool**(`description`, `options`): [`Tool`](../../../tools/Tool/classes/Tool.md)\<[`SearchResult`](../../VectorStore/interfaces/SearchResult.md)[]\>

Defined in: [lib/vectorstore/VectorStore.ts:253](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/VectorStore.ts#L253)

Create a retrieval tool that agents can use to search this vector store.

#### Parameters

##### description

`string`

Description of what data the store contains (e.g., "Search product documentation for technical specifications")

##### options

[`RetrievalToolOptions`](../../VectorStore/interfaces/RetrievalToolOptions.md) = `{}`

Configuration options for the tool

#### Returns

[`Tool`](../../../tools/Tool/classes/Tool.md)\<[`SearchResult`](../../VectorStore/interfaces/SearchResult.md)[]\>

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

#### Inherited from

[`VectorStore`](../../VectorStore/classes/VectorStore.md).[`toRetrievalTool`](../../VectorStore/classes/VectorStore.md#toretrievaltool)

***

### create()

> `static` **create**(`config`): `Promise`\<`LanceDBVectorStore`\>

Defined in: [lib/vectorstore/LanceDBVectorStore.ts:118](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/LanceDBVectorStore.ts#L118)

Create a new LanceDBVectorStore instance.

This is an async factory method since LanceDB connection is asynchronous.

#### Parameters

##### config

[`LanceDBVectorStoreConfig`](../interfaces/LanceDBVectorStoreConfig.md)

Configuration for the store

#### Returns

`Promise`\<`LanceDBVectorStore`\>

A configured LanceDBVectorStore instance

#### Throws

Error if @lancedb/lancedb is not installed
