# Interface: IngestionProgressEvent

Defined in: [lib/ingestion/types.ts:6](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L6)

Progress event emitted during ingestion.

## Properties

### currentBatch?

> `optional` **currentBatch**: `number`

Defined in: [lib/ingestion/types.ts:14](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L14)

Current batch number (for embedding/storing phases)

***

### phase

> **phase**: `"chunking"` \| `"embedding"` \| `"storing"`

Defined in: [lib/ingestion/types.ts:8](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L8)

Current phase of ingestion

***

### processed

> **processed**: `number`

Defined in: [lib/ingestion/types.ts:10](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L10)

Number of items processed in this phase

***

### total

> **total**: `number`

Defined in: [lib/ingestion/types.ts:12](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L12)

Total number of items in this phase

***

### totalBatches?

> `optional` **totalBatches**: `number`

Defined in: [lib/ingestion/types.ts:16](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L16)

Total number of batches
