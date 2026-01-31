# Interface: IngestionProgressEvent

Progress event emitted during ingestion.

## Properties

### currentBatch?

> `optional` **currentBatch**: `number`

Current batch number (for embedding/storing phases)

***

### phase

> **phase**: `"chunking"` \| `"embedding"` \| `"storing"`

Current phase of ingestion

***

### processed

> **processed**: `number`

Number of items processed in this phase

***

### total

> **total**: `number`

Total number of items in this phase

***

### totalBatches?

> `optional` **totalBatches**: `number`

Total number of batches
