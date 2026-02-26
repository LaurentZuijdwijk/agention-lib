# Interface: ChunkMetadata

Metadata associated with each chunk.

When stored in LanceDB via `LanceDBVectorStore`, these fields are
automatically packed into a `chunk_metadata` struct column — they do
not need to be declared in `metadataFields`.

## Indexable

\[`key`: `string`\]: `unknown`

## Properties

### index

> **index**: `number`

Zero-based index of this chunk in the sequence

***

### total

> **total**: `number`

Total number of chunks in the sequence

***

### prev_id

> **prev_id**: `string` \| `null`

ID of the previous chunk, or null if first

***

### next_id

> **next_id**: `string` \| `null`

ID of the next chunk, or null if last

***

### start

> **start**: `number`

Character offset where this chunk starts in the source text

***

### end

> **end**: `number`

Character offset where this chunk ends in the source text

***

### source_id?

> `optional` **source_id**: `string`

Optional identifier for the source document

***

### source_path?

> `optional` **source_path**: `string`

Optional path to the source file

***

### char_count

> **char_count**: `number`

Number of characters in the chunk content

***

### token_count?

> `optional` **token_count**: `number`

Estimated number of tokens (when available)

***

### hash

> **hash**: `string`

SHA-256 hash of the content for deduplication

***

### section?

> `optional` **section**: `string`

Section title if detected (e.g., markdown headers)

***

### page?

> `optional` **page**: `number`

Page number in the source document (e.g., PDF page)
