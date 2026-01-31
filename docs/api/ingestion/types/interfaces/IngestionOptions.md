# Interface: IngestionOptions

Options for the ingestion pipeline.

## Properties

### batchSize?

> `optional` **batchSize**: `number`

Number of chunks to process per embedding batch.
Larger batches are more efficient but use more memory.

#### Default

```ts
100
```

***

### onError()?

> `optional` **onError**: (`error`, `chunk`) => `"skip"` \| `"abort"`

Error handling strategy.
- 'skip': Skip the failed chunk and continue
- 'abort': Stop the entire ingestion process

#### Parameters

##### error

`Error`

##### chunk

[`Chunk`](../../../chunkers/types/interfaces/Chunk.md)

#### Returns

`"skip"` \| `"abort"`

The action to take

***

### onProgress()?

> `optional` **onProgress**: (`event`) => `void`

Callback for progress updates.

#### Parameters

##### event

[`IngestionProgressEvent`](IngestionProgressEvent.md)

#### Returns

`void`

***

### skipDuplicates?

> `optional` **skipDuplicates**: `boolean`

Whether to skip chunks with hashes that already exist in the store.
Requires the store to support hash-based lookup.

#### Default

```ts
false
```
