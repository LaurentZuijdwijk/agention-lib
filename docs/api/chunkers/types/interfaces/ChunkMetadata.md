# Interface: ChunkMetadata

Metadata associated with each chunk.

## Indexable

\[`key`: `string`\]: `unknown`

## Properties

### charCount

> **charCount**: `number`

Number of characters in the chunk content

***

### chunkIndex

> **chunkIndex**: `number`

Zero-based index of this chunk in the sequence

***

### endOffset

> **endOffset**: `number`

Character offset where this chunk ends in the source text

***

### hash

> **hash**: `string`

SHA-256 hash of the content for deduplication

***

### nextChunkId

> **nextChunkId**: `string` \| `null`

ID of the next chunk, or null if last

***

### previousChunkId

> **previousChunkId**: `string` \| `null`

ID of the previous chunk, or null if first

***

### sectionTitle?

> `optional` **sectionTitle**: `string`

Section title if detected (e.g., markdown headers)

***

### sourceId?

> `optional` **sourceId**: `string`

Optional identifier for the source document

***

### sourcePath?

> `optional` **sourcePath**: `string`

Optional path to the source file

***

### startOffset

> **startOffset**: `number`

Character offset where this chunk starts in the source text

***

### tokenCount?

> `optional` **tokenCount**: `number`

Estimated number of tokens (when available)

***

### totalChunks

> **totalChunks**: `number`

Total number of chunks in the sequence
