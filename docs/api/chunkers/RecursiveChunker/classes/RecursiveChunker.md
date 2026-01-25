# Class: RecursiveChunker

Defined in: [lib/chunkers/RecursiveChunker.ts:20](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/RecursiveChunker.ts#L20)

Recursive text chunker that tries to split on semantic boundaries.
It attempts to split by larger separators first (paragraphs), then
falls back to smaller ones (sentences, words) to keep semantic units together.

## Example

```typescript
const chunker = new RecursiveChunker({
  chunkSize: 1000,
  chunkOverlap: 100,
  separators: ["\n\n", "\n", ". ", " "],
});

const chunks = await chunker.chunk(document);
```

## Extends

- [`Chunker`](../../Chunker/classes/Chunker.md)

## Constructors

### Constructor

> **new RecursiveChunker**(`config`): `RecursiveChunker`

Defined in: [lib/chunkers/RecursiveChunker.ts:24](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/RecursiveChunker.ts#L24)

#### Parameters

##### config

[`RecursiveChunkerConfig`](../../types/interfaces/RecursiveChunkerConfig.md)

#### Returns

`RecursiveChunker`

#### Overrides

[`Chunker`](../../Chunker/classes/Chunker.md).[`constructor`](../../Chunker/classes/Chunker.md#constructor)

## Properties

### name

> `readonly` **name**: `"RecursiveChunker"` = `"RecursiveChunker"`

Defined in: [lib/chunkers/RecursiveChunker.ts:21](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/RecursiveChunker.ts#L21)

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

***

### getSeparators()

> **getSeparators**(): `string`[]

Defined in: [lib/chunkers/RecursiveChunker.ts:190](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/RecursiveChunker.ts#L190)

Get the configured separators.

#### Returns

`string`[]
