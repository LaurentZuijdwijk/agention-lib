# Abstract Class: Chunker

Abstract base class for text chunkers.
Provides common utilities for ID generation, hashing, and chunk linking.

## Extended by

- [`RecursiveChunker`](../../RecursiveChunker/classes/RecursiveChunker.md)
- [`TextChunker`](../../TextChunker/classes/TextChunker.md)
- [`TokenChunker`](../../TokenChunker/classes/TokenChunker.md)

## Constructors

### Constructor

> **new Chunker**(`config`): `Chunker`

#### Parameters

##### config

[`ChunkerConfig`](../../types/interfaces/ChunkerConfig.md)

#### Returns

`Chunker`

## Properties

### name

> `abstract` `readonly` **name**: `string`

Name identifier for this chunker type

## Methods

### chunk()

> **chunk**(`text`, `options?`): `Promise`\<[`Chunk`](../../types/interfaces/Chunk.md)[]\>

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

Get the chunk overlap configuration.

#### Returns

`number`

***

### getChunkSize()

> **getChunkSize**(): `number`

Get the chunk size configuration.

#### Returns

`number`
