# Class: IngestionPipeline

Pipeline for ingesting documents into a vector store.
Orchestrates the flow: chunk → batch embed → store

## Example

```typescript
const pipeline = new IngestionPipeline(
  new RecursiveChunker({ chunkSize: 1000, chunkOverlap: 100 }),
  new OpenAIEmbeddings(),
  vectorStore
);

const result = await pipeline.ingest(documentText, {
  sourceId: 'doc-123',
  sourcePath: '/docs/readme.md',
  batchSize: 50,
  onProgress: ({ phase, processed, total }) => {
    console.log(`${phase}: ${processed}/${total}`);
  }
});

console.log(`Stored ${result.chunksStored} chunks in ${result.duration}ms`);
```

## Constructors

### Constructor

> **new IngestionPipeline**(`chunker`, `embeddings`, `store`): `IngestionPipeline`

#### Parameters

##### chunker

[`Chunker`](../../../chunkers/Chunker/classes/Chunker.md)

##### embeddings

[`Embeddings`](../../../embeddings/Embeddings/classes/Embeddings.md)

##### store

[`VectorStore`](../../../vectorstore/VectorStore/classes/VectorStore.md)

#### Returns

`IngestionPipeline`

## Methods

### getChunker()

> **getChunker**(): [`Chunker`](../../../chunkers/Chunker/classes/Chunker.md)

Get the chunker used by this pipeline.

#### Returns

[`Chunker`](../../../chunkers/Chunker/classes/Chunker.md)

***

### getEmbeddings()

> **getEmbeddings**(): [`Embeddings`](../../../embeddings/Embeddings/classes/Embeddings.md)

Get the embeddings provider used by this pipeline.

#### Returns

[`Embeddings`](../../../embeddings/Embeddings/classes/Embeddings.md)

***

### getStore()

> **getStore**(): [`VectorStore`](../../../vectorstore/VectorStore/classes/VectorStore.md)

Get the vector store used by this pipeline.

#### Returns

[`VectorStore`](../../../vectorstore/VectorStore/classes/VectorStore.md)

***

### ingest()

> **ingest**(`text`, `options?`): `Promise`\<[`IngestionResult`](../../types/interfaces/IngestionResult.md)\>

Ingest a single document into the vector store.

#### Parameters

##### text

`string`

The document text to ingest

##### options?

[`ChunkOptions`](../../../chunkers/types/interfaces/ChunkOptions.md) & [`IngestionOptions`](../../types/interfaces/IngestionOptions.md)

Chunk options and ingestion options

#### Returns

`Promise`\<[`IngestionResult`](../../types/interfaces/IngestionResult.md)\>

Result of the ingestion operation

***

### ingestChunks()

> **ingestChunks**(`chunks`, `options?`): `Promise`\<[`IngestionResult`](../../types/interfaces/IngestionResult.md)\>

Ingest pre-chunked data into the vector store.
Useful when chunking is done separately.

#### Parameters

##### chunks

[`Chunk`](../../../chunkers/types/interfaces/Chunk.md)[]

Array of chunks to ingest

##### options?

[`IngestionOptions`](../../types/interfaces/IngestionOptions.md)

Ingestion options

#### Returns

`Promise`\<[`IngestionResult`](../../types/interfaces/IngestionResult.md)\>

Result of the ingestion operation

***

### ingestMany()

> **ingestMany**(`documents`, `options?`): `Promise`\<[`IngestionResult`](../../types/interfaces/IngestionResult.md)\>

Ingest multiple documents into the vector store.

#### Parameters

##### documents

[`DocumentInput`](../../types/interfaces/DocumentInput.md)[]

Array of documents with their options

##### options?

[`IngestionOptions`](../../types/interfaces/IngestionOptions.md)

Ingestion options

#### Returns

`Promise`\<[`IngestionResult`](../../types/interfaces/IngestionResult.md)\>

Aggregated result of all ingestions
