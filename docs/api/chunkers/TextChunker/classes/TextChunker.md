# Class: TextChunker

Defined in: [lib/chunkers/TextChunker.ts:20](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/TextChunker.ts#L20)

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

Defined in: [lib/chunkers/TextChunker.ts:23](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/TextChunker.ts#L23)

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

Defined in: [lib/chunkers/TextChunker.ts:21](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/TextChunker.ts#L21)

Name identifier for this chunker type

#### Overrides

[`Chunker`](../../Chunker/classes/Chunker.md).[`name`](../../Chunker/classes/Chunker.md#name)

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

#### Inherited from

[`Chunker`](../../Chunker/classes/Chunker.md).[`chunk`](../../Chunker/classes/Chunker.md#chunk)

***

### getChunkOverlap()

> **getChunkOverlap**(): `number`

Defined in: [lib/chunkers/Chunker.ts:209](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/Chunker.ts#L209)

Get the chunk overlap configuration.

#### Returns

`number`

#### Inherited from

[`Chunker`](../../Chunker/classes/Chunker.md).[`getChunkOverlap`](../../Chunker/classes/Chunker.md#getchunkoverlap)

***

### getChunkSize()

> **getChunkSize**(): `number`

Defined in: [lib/chunkers/Chunker.ts:202](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/Chunker.ts#L202)

Get the chunk size configuration.

#### Returns

`number`

#### Inherited from

[`Chunker`](../../Chunker/classes/Chunker.md).[`getChunkSize`](../../Chunker/classes/Chunker.md#getchunksize)
