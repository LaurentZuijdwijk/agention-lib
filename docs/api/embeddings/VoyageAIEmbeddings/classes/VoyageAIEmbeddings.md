# Class: VoyageAIEmbeddings

VoyageAI embeddings provider.

Supports VoyageAI's embedding models including voyage-4, voyage-3.5, voyage-code-3,
and multimodal models. Features automatic retries with exponential backoff.

## Examples

```typescript
const embeddings = new VoyageAIEmbeddings({
  model: 'voyage-4',
  inputType: 'document', // or 'query' for search queries
});

const vectors = await embeddings.embed(['Hello world', 'Goodbye world']);
```

```typescript
const embeddings = new VoyageAIEmbeddings({
  model: 'voyage-code-3',
  maxRetries: 3,
  timeoutInSeconds: 30,
});
```

## Extends

- [`Embeddings`](../../Embeddings/classes/Embeddings.md)

## Constructors

### Constructor

> **new VoyageAIEmbeddings**(`config`): `VoyageAIEmbeddings`

#### Parameters

##### config

[`VoyageAIEmbeddingsConfig`](../interfaces/VoyageAIEmbeddingsConfig.md) = `{}`

#### Returns

`VoyageAIEmbeddings`

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

> `readonly` **name**: `"voyageai"` = `"voyageai"`

Name identifier for this embeddings provider

#### Overrides

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`name`](../../Embeddings/classes/Embeddings.md#name)

## Methods

### embed()

> **embed**(`texts`): `Promise`\<`number`[][]\>

Generate embeddings for multiple texts using VoyageAI API.

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
Overrides the default to use inputType: "query" for better search results.

#### Parameters

##### query

`string`

#### Returns

`Promise`\<`number`[]\>

#### Overrides

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`embedQuery`](../../Embeddings/classes/Embeddings.md#embedquery)
