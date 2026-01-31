# Interface: IngestionResult

Result of an ingestion operation.

## Properties

### chunksProcessed

> **chunksProcessed**: `number`

Total number of chunks that were processed

***

### chunksSkipped

> **chunksSkipped**: `number`

Number of chunks skipped (duplicates or filtered)

***

### chunksStored

> **chunksStored**: `number`

Number of chunks successfully stored

***

### duration

> **duration**: `number`

Total time taken in milliseconds

***

### errors

> **errors**: `object`[]

Array of errors encountered during ingestion

#### chunk

> **chunk**: [`Chunk`](../../../chunkers/types/interfaces/Chunk.md)

#### error

> **error**: `Error`

***

### success

> **success**: `boolean`

Whether the ingestion completed without aborting
