# Class: IngestionPipeline

Defined in: [lib/ingestion/IngestionPipeline.ts:36](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/IngestionPipeline.ts#L36)

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

Defined in: [lib/ingestion/IngestionPipeline.ts:41](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/IngestionPipeline.ts#L41)

#### Parameters

##### chunker

[`Chunker`](../../../chunkers/Chunker/classes/Chunker.md)

##### embeddings

[`Embeddings`](../../../vectorstore/Embeddings/classes/Embeddings.md)

##### store

[`VectorStore`](../../../vectorstore/VectorStore/classes/VectorStore.md)

#### Returns

`IngestionPipeline`

## Methods

### getChunker()

> **getChunker**(): [`Chunker`](../../../chunkers/Chunker/classes/Chunker.md)

Defined in: [lib/ingestion/IngestionPipeline.ts:313](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/IngestionPipeline.ts#L313)

Get the chunker used by this pipeline.

#### Returns

[`Chunker`](../../../chunkers/Chunker/classes/Chunker.md)

***

### getEmbeddings()

> **getEmbeddings**(): [`Embeddings`](../../../vectorstore/Embeddings/classes/Embeddings.md)

Defined in: [lib/ingestion/IngestionPipeline.ts:320](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/IngestionPipeline.ts#L320)

Get the embeddings provider used by this pipeline.

#### Returns

[`Embeddings`](../../../vectorstore/Embeddings/classes/Embeddings.md)

***

### getStore()

> **getStore**(): [`VectorStore`](../../../vectorstore/VectorStore/classes/VectorStore.md)

Defined in: [lib/ingestion/IngestionPipeline.ts:327](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/IngestionPipeline.ts#L327)

Get the vector store used by this pipeline.

#### Returns

[`VectorStore`](../../../vectorstore/VectorStore/classes/VectorStore.md)

***

### ingest()

> **ingest**(`text`, `options?`): `Promise`\<[`IngestionResult`](../../types/interfaces/IngestionResult.md)\>

Defined in: [lib/ingestion/IngestionPipeline.ts:54](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/IngestionPipeline.ts#L54)

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

Defined in: [lib/ingestion/IngestionPipeline.ts:138](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/IngestionPipeline.ts#L138)

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

Defined in: [lib/ingestion/IngestionPipeline.ts:99](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/IngestionPipeline.ts#L99)

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
