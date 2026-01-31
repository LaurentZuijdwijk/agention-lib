# Interface: TokenChunkerConfig

Configuration specific to TokenChunker.

## Extends

- [`ChunkerConfig`](ChunkerConfig.md)

## Properties

### chunkOverlap?

> `optional` **chunkOverlap**: `number`

Number of characters/tokens to overlap between chunks (default: 0)

#### Inherited from

[`ChunkerConfig`](ChunkerConfig.md).[`chunkOverlap`](ChunkerConfig.md#chunkoverlap)

***

### chunkProcessor()?

> `optional` **chunkProcessor**: (`chunk`, `index`, `all`) => [`Chunk`](Chunk.md) \| `Promise`\<[`Chunk`](Chunk.md) \| `null`\> \| `null`

Optional processor function applied to each chunk.
Can modify the chunk or return null to filter it out.

#### Parameters

##### chunk

[`Chunk`](Chunk.md)

##### index

`number`

##### all

[`Chunk`](Chunk.md)[]

#### Returns

[`Chunk`](Chunk.md) \| `Promise`\<[`Chunk`](Chunk.md) \| `null`\> \| `null`

#### Inherited from

[`ChunkerConfig`](ChunkerConfig.md).[`chunkProcessor`](ChunkerConfig.md#chunkprocessor)

***

### chunkSize

> **chunkSize**: `number`

Chunk size is in tokens, not characters.
Uses tokenx for estimation (~96% accuracy).

#### Overrides

[`ChunkerConfig`](ChunkerConfig.md).[`chunkSize`](ChunkerConfig.md#chunksize)

***

### idGenerator()?

> `optional` **idGenerator**: (`content`, `index`, `sourceId?`) => `string`

Custom ID generator function.

#### Parameters

##### content

`string`

The chunk content

##### index

`number`

The chunk index

##### sourceId?

`string`

Optional source document ID

#### Returns

`string`

A unique ID for the chunk

#### Inherited from

[`ChunkerConfig`](ChunkerConfig.md).[`idGenerator`](ChunkerConfig.md#idgenerator)
