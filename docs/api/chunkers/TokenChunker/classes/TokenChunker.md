# Class: TokenChunker

Token-aware text chunker using the tokenx library.
Splits text based on token count rather than character count,
ensuring chunks fit within LLM token limits.

Uses tokenx for fast token estimation (~96% accuracy, ~2kB).

## Example

```typescript
const chunker = new TokenChunker({
  chunkSize: 500,       // 500 tokens per chunk
  chunkOverlap: 50,     // 50 token overlap
});

const chunks = await chunker.chunk(longDocument);
// Each chunk.metadata.tokenCount contains estimated tokens
```

## Extends

- [`Chunker`](../../Chunker/classes/Chunker.md)

## Constructors

### Constructor

> **new TokenChunker**(`config`): `TokenChunker`

#### Parameters

##### config

[`TokenChunkerConfig`](../../types/interfaces/TokenChunkerConfig.md)

#### Returns

`TokenChunker`

#### Overrides

[`Chunker`](../../Chunker/classes/Chunker.md).[`constructor`](../../Chunker/classes/Chunker.md#constructor)

## Properties

### name

> `readonly` **name**: `"TokenChunker"` = `"TokenChunker"`

Name identifier for this chunker type

#### Overrides

[`Chunker`](../../Chunker/classes/Chunker.md).[`name`](../../Chunker/classes/Chunker.md#name)

## Methods

### chunk()

> **chunk**(`text`, `options?`): `Promise`\<[`Chunk`](../../types/interfaces/Chunk.md)[]\>

Override chunk to add token count to metadata.

#### Parameters

##### text

`string`

##### options?

[`ChunkOptions`](../../types/interfaces/ChunkOptions.md)

#### Returns

`Promise`\<[`Chunk`](../../types/interfaces/Chunk.md)[]\>

#### Overrides

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

***

### estimateTokens()

> `static` **estimateTokens**(`text`): `Promise`\<`number`\>

Estimate token count for a given text.

#### Parameters

##### text

`string`

#### Returns

`Promise`\<`number`\>
