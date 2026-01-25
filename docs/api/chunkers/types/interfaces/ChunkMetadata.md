# Interface: ChunkMetadata

Defined in: [lib/chunkers/types.ts:16](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L16)

Metadata associated with each chunk.

## Indexable

\[`key`: `string`\]: `unknown`

## Properties

### charCount

> **charCount**: `number`

Defined in: [lib/chunkers/types.ts:39](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L39)

Number of characters in the chunk content

***

### chunkIndex

> **chunkIndex**: `number`

Defined in: [lib/chunkers/types.ts:19](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L19)

Zero-based index of this chunk in the sequence

***

### endOffset

> **endOffset**: `number`

Defined in: [lib/chunkers/types.ts:31](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L31)

Character offset where this chunk ends in the source text

***

### hash

> **hash**: `string`

Defined in: [lib/chunkers/types.ts:43](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L43)

SHA-256 hash of the content for deduplication

***

### nextChunkId

> **nextChunkId**: `string` \| `null`

Defined in: [lib/chunkers/types.ts:25](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L25)

ID of the next chunk, or null if last

***

### previousChunkId

> **previousChunkId**: `string` \| `null`

Defined in: [lib/chunkers/types.ts:23](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L23)

ID of the previous chunk, or null if first

***

### sectionTitle?

> `optional` **sectionTitle**: `string`

Defined in: [lib/chunkers/types.ts:47](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L47)

Section title if detected (e.g., markdown headers)

***

### sourceId?

> `optional` **sourceId**: `string`

Defined in: [lib/chunkers/types.ts:33](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L33)

Optional identifier for the source document

***

### sourcePath?

> `optional` **sourcePath**: `string`

Defined in: [lib/chunkers/types.ts:35](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L35)

Optional path to the source file

***

### startOffset

> **startOffset**: `number`

Defined in: [lib/chunkers/types.ts:29](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L29)

Character offset where this chunk starts in the source text

***

### tokenCount?

> `optional` **tokenCount**: `number`

Defined in: [lib/chunkers/types.ts:41](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L41)

Estimated number of tokens (when available)

***

### totalChunks

> **totalChunks**: `number`

Defined in: [lib/chunkers/types.ts:21](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L21)

Total number of chunks in the sequence
