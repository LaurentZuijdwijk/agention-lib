# Class: OpenAIEmbeddings

OpenAI embeddings provider.

Supports all OpenAI embedding models including text-embedding-3-small,
text-embedding-3-large, and text-embedding-ada-002.

## Example

```typescript
const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  dimensions: 512, // Optional: reduce dimensions for faster search
});

const vectors = await embeddings.embed(['Hello world', 'Goodbye world']);
```

## Extends

- [`Embeddings`](../../Embeddings/classes/Embeddings.md)

## Constructors

### Constructor

> **new OpenAIEmbeddings**(`config`): `OpenAIEmbeddings`

#### Parameters

##### config

[`OpenAIEmbeddingsConfig`](../interfaces/OpenAIEmbeddingsConfig.md) = `{}`

#### Returns

`OpenAIEmbeddings`

#### Overrides

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`constructor`](../../Embeddings/classes/Embeddings.md#constructor)

## Properties

### dimensions

> `readonly` **dimensions**: `number`

Number of dimensions in the output vectors

#### Overrides

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`dimensions`](../../Embeddings/classes/Embeddings.md#dimensions)

***

### model

> `readonly` **model**: `string`

The model being used for embeddings

#### Overrides

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`model`](../../Embeddings/classes/Embeddings.md#model)

***

### name

> `readonly` **name**: `"openai"` = `"openai"`

Name identifier for this embeddings provider

#### Overrides

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`name`](../../Embeddings/classes/Embeddings.md#name)

## Methods

### embed()

> **embed**(`texts`): `Promise`\<`number`[][]\>

Generate embeddings for multiple texts using OpenAI API.

#### Parameters

##### texts

`string`[]

#### Returns

`Promise`\<`number`[][]\>

#### Overrides

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`embed`](../../Embeddings/classes/Embeddings.md#embed)

***

### embedOne()

> **embedOne**(`text`): `Promise`\<`number`[]\>

Generate embedding for a single text.
Default implementation calls embed() with a single-item array.

#### Parameters

##### text

`string`

Text string to embed

#### Returns

`Promise`\<`number`[]\>

Embedding vector

#### Inherited from

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`embedOne`](../../Embeddings/classes/Embeddings.md#embedone)

***

### embedQuery()

> **embedQuery**(`query`): `Promise`\<`number`[]\>

Generate embedding for a search query.
Some providers use different models/settings for queries vs documents.
Default implementation calls embedOne().

#### Parameters

##### query

`string`

Query text to embed

#### Returns

`Promise`\<`number`[]\>

Embedding vector optimized for query

#### Inherited from

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`embedQuery`](../../Embeddings/classes/Embeddings.md#embedquery)
