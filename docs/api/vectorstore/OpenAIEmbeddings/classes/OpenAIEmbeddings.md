# Class: OpenAIEmbeddings

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:42](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L42)

OpenAI embeddings provider.

## Example

```typescript
const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
});

const vectors = await embeddings.embed(['Hello world', 'Goodbye world']);
```

## Extends

- [`Embeddings`](../../Embeddings/classes/Embeddings.md)

## Constructors

### Constructor

> **new OpenAIEmbeddings**(`config`): `OpenAIEmbeddings`

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:51](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L51)

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

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:45](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L45)

Number of dimensions in the output vectors

#### Overrides

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`dimensions`](../../Embeddings/classes/Embeddings.md#dimensions)

***

### model

> `readonly` **model**: `string`

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:44](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L44)

The model being used for embeddings

#### Overrides

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`model`](../../Embeddings/classes/Embeddings.md#model)

***

### name

> `readonly` **name**: `"openai"` = `"openai"`

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:43](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L43)

Name identifier for this embeddings provider

#### Overrides

[`Embeddings`](../../Embeddings/classes/Embeddings.md).[`name`](../../Embeddings/classes/Embeddings.md#name)

## Methods

### embed()

> **embed**(`texts`): `Promise`\<`number`[][]\>

Defined in: [lib/vectorstore/OpenAIEmbeddings.ts:75](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/OpenAIEmbeddings.ts#L75)

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

Defined in: [lib/vectorstore/Embeddings.ts:62](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/Embeddings.ts#L62)

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

Defined in: [lib/vectorstore/Embeddings.ts:75](https://github.com/LaurentZuijdwijk/agention-lib/blob/3c19e87ec2ca7bbf687597f337b5812b2e5c4a54/lib/vectorstore/Embeddings.ts#L75)

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
