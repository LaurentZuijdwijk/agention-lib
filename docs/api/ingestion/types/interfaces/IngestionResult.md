# Interface: IngestionResult

Defined in: [lib/ingestion/types.ts:54](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L54)

Result of an ingestion operation.

## Properties

### chunksProcessed

> **chunksProcessed**: `number`

Defined in: [lib/ingestion/types.ts:58](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L58)

Total number of chunks that were processed

***

### chunksSkipped

> **chunksSkipped**: `number`

Defined in: [lib/ingestion/types.ts:60](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L60)

Number of chunks skipped (duplicates or filtered)

***

### chunksStored

> **chunksStored**: `number`

Defined in: [lib/ingestion/types.ts:62](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L62)

Number of chunks successfully stored

***

### duration

> **duration**: `number`

Defined in: [lib/ingestion/types.ts:66](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L66)

Total time taken in milliseconds

***

### errors

> **errors**: `object`[]

Defined in: [lib/ingestion/types.ts:64](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L64)

Array of errors encountered during ingestion

#### chunk

> **chunk**: [`Chunk`](../../../chunkers/types/interfaces/Chunk.md)

#### error

> **error**: `Error`

***

### success

> **success**: `boolean`

Defined in: [lib/ingestion/types.ts:56](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/ingestion/types.ts#L56)

Whether the ingestion completed without aborting
