# Interface: IngestionOptions

Defined in: [lib/ingestion/types.ts:22](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L22)

Options for the ingestion pipeline.

## Properties

### batchSize?

> `optional` **batchSize**: `number`

Defined in: [lib/ingestion/types.ts:28](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L28)

Number of chunks to process per embedding batch.
Larger batches are more efficient but use more memory.

#### Default

```ts
100
```

***

### onError()?

> `optional` **onError**: (`error`, `chunk`) => `"skip"` \| `"abort"`

Defined in: [lib/ingestion/types.ts:41](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L41)

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

Defined in: [lib/ingestion/types.ts:33](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L33)

Callback for progress updates.

#### Parameters

##### event

[`IngestionProgressEvent`](IngestionProgressEvent.md)

#### Returns

`void`

***

### skipDuplicates?

> `optional` **skipDuplicates**: `boolean`

Defined in: [lib/ingestion/types.ts:48](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L48)

Whether to skip chunks with hashes that already exist in the store.
Requires the store to support hash-based lookup.

#### Default

```ts
false
```
