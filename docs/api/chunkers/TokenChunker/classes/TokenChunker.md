# Class: TokenChunker

Defined in: [lib/chunkers/TokenChunker.ts:46](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/TokenChunker.ts#L46)

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

Defined in: [lib/chunkers/TokenChunker.ts:49](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/TokenChunker.ts#L49)

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

Defined in: [lib/chunkers/TokenChunker.ts:47](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/TokenChunker.ts#L47)

Name identifier for this chunker type

#### Overrides

[`Chunker`](../../Chunker/classes/Chunker.md).[`name`](../../Chunker/classes/Chunker.md#name)

## Methods

### chunk()

> **chunk**(`text`, `options?`): `Promise`\<[`Chunk`](../../types/interfaces/Chunk.md)[]\>

Defined in: [lib/chunkers/TokenChunker.ts:152](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/TokenChunker.ts#L152)

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

### estimateTokens()

> `static` **estimateTokens**(`text`): `Promise`\<`number`\>

Defined in: [lib/chunkers/TokenChunker.ts:171](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/chunkers/TokenChunker.ts#L171)

Estimate token count for a given text.

#### Parameters

##### text

`string`

#### Returns

`Promise`\<`number`\>
