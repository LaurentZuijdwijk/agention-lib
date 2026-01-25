# Abstract Class: Chunker

Defined in: [lib/chunkers/Chunker.ts:8](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/Chunker.ts#L8)

Abstract base class for text chunkers.
Provides common utilities for ID generation, hashing, and chunk linking.

## Extended by

- [`RecursiveChunker`](../../RecursiveChunker/classes/RecursiveChunker.md)
- [`TextChunker`](../../TextChunker/classes/TextChunker.md)
- [`TokenChunker`](../../TokenChunker/classes/TokenChunker.md)

## Constructors

### Constructor

> **new Chunker**(`config`): `Chunker`

Defined in: [lib/chunkers/Chunker.ts:14](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/Chunker.ts#L14)

#### Parameters

##### config

[`ChunkerConfig`](../../types/interfaces/ChunkerConfig.md)

#### Returns

`Chunker`

## Properties

### name

> `abstract` `readonly` **name**: `string`

Defined in: [lib/chunkers/Chunker.ts:10](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/Chunker.ts#L10)

Name identifier for this chunker type

## Methods

### chunk()

> **chunk**(`text`, `options?`): `Promise`\<[`Chunk`](../../types/interfaces/Chunk.md)[]\>

Defined in: [lib/chunkers/Chunker.ts:39](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/Chunker.ts#L39)

Split text into chunks with metadata.

#### Parameters

##### text

`string`

The text to chunk

##### options?

[`ChunkOptions`](../../types/interfaces/ChunkOptions.md)

Optional chunking options

#### Returns

`Promise`\<[`Chunk`](../../types/interfaces/Chunk.md)[]\>

Array of chunks with metadata

***

### getChunkOverlap()

> **getChunkOverlap**(): `number`

Defined in: [lib/chunkers/Chunker.ts:209](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/Chunker.ts#L209)

Get the chunk overlap configuration.

#### Returns

`number`

***

### getChunkSize()

> **getChunkSize**(): `number`

Defined in: [lib/chunkers/Chunker.ts:202](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/Chunker.ts#L202)

Get the chunk size configuration.

#### Returns

`number`
