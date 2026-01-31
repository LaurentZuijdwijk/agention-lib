# Class: TextChunker

Simple text chunker that splits by character count with optional overlap.

## Example

```typescript
const chunker = new TextChunker({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const chunks = await chunker.chunk(longText, {
  sourceId: 'doc-123',
  sourcePath: '/docs/readme.md',
});
```

## Extends

- [`Chunker`](../../Chunker/classes/Chunker.md)

## Constructors

### Constructor

> **new TextChunker**(`config`): `TextChunker`

#### Parameters

##### config

[`ChunkerConfig`](../../types/interfaces/ChunkerConfig.md)

#### Returns

`TextChunker`

#### Overrides

[`Chunker`](../../Chunker/classes/Chunker.md).[`constructor`](../../Chunker/classes/Chunker.md#constructor)

## Properties

### name

> `readonly` **name**: `"TextChunker"` = `"TextChunker"`

Name identifier for this chunker type

#### Overrides

[`Chunker`](../../Chunker/classes/Chunker.md).[`name`](../../Chunker/classes/Chunker.md#name)

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

#### Inherited from

[`Chunker`](../../Chunker/classes/Chunker.md).[`chunk`](../../Chunker/classes/Chunker.md#chunk)

***

### getChunkOverlap()

> **getChunkOverlap**(): `number`

Get the chunk overlap configuration.

#### Returns

`number`

#### Inherited from

[`Chunker`](../../Chunker/classes/Chunker.md).[`getChunkOverlap`](../../Chunker/classes/Chunker.md#getchunkoverlap)

***

### getChunkSize()

> **getChunkSize**(): `number`

Get the chunk size configuration.

#### Returns

`number`

#### Inherited from

[`Chunker`](../../Chunker/classes/Chunker.md).[`getChunkSize`](../../Chunker/classes/Chunker.md#getchunksize)
