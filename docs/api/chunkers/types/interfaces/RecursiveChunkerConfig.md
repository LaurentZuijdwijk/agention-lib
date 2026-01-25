# Interface: RecursiveChunkerConfig

Defined in: [lib/chunkers/types.ts:97](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L97)

Configuration specific to RecursiveChunker.

## Extends

- [`ChunkerConfig`](ChunkerConfig.md)

## Properties

### chunkOverlap?

> `optional` **chunkOverlap**: `number`

Defined in: [lib/chunkers/types.ts:60](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L60)

Number of characters/tokens to overlap between chunks (default: 0)

#### Inherited from

[`ChunkerConfig`](ChunkerConfig.md).[`chunkOverlap`](ChunkerConfig.md#chunkoverlap)

***

### chunkProcessor()?

> `optional` **chunkProcessor**: (`chunk`, `index`, `all`) => [`Chunk`](Chunk.md) \| `Promise`\<[`Chunk`](Chunk.md) \| `null`\> \| `null`

Defined in: [lib/chunkers/types.ts:66](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L66)

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

Defined in: [lib/chunkers/types.ts:58](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L58)

Target size for each chunk (in characters or tokens depending on chunker)

#### Inherited from

[`ChunkerConfig`](ChunkerConfig.md).[`chunkSize`](ChunkerConfig.md#chunksize)

***

### idGenerator()?

> `optional` **idGenerator**: (`content`, `index`, `sourceId?`) => `string`

Defined in: [lib/chunkers/types.ts:79](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L79)

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

***

### separators?

> `optional` **separators**: `string`[]

Defined in: [lib/chunkers/types.ts:102](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/types.ts#L102)

Separators to try in order, from largest to smallest semantic unit.
Default: ["\n\n", "\n", ". ", " "]
